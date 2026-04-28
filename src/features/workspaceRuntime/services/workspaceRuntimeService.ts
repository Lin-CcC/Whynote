import {
  appendLearningNodeDraftToTree,
  appendChildQuestionsToTree,
  appendPlanStepDraftsToModule,
  appendQuestionClosureToTree,
  createCompoundQuestionSplitService,
  createLearningActionDraftService,
  createOpenAiCompatibleProviderClient,
  createPlanStepGenerationService,
  createQuestionClosureService,
  reconcilePlanStepStatuses,
  suggestPlanStepCompletion,
  type AiConfig,
} from '../../learningEngine';
import {
  getModuleScopeId,
  getNodeOrThrow,
  type ModuleNode,
  type NodeTree,
  type ResourceMetadataRecord,
  type TreeNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import {
  createResourceSummaryGenerationService,
} from '../../resourcesSearchExport/services/resourceSummaryGenerationService';
import type { ResourceImportDraft } from '../../resourcesSearchExport/services/resourceIngestTypes';
import type { WorkspaceEditorLearningActionRequest } from '../../workspaceEditor/workspaceEditorTypes';
import { createInitialWorkspaceSnapshot } from '../utils/createInitialWorkspaceSnapshot';
import {
  buildLearningActionRuntimeContext,
  buildQuestionClosureRuntimeContext,
  canEvaluateQuestionAnswer,
  collectLeafQuestionIdsUnderPlanStep,
  collectLearningReferenceCandidates,
  summarizeLearningReferenceCandidates,
} from './learningRuntimeContext';
import type {
  WorkspaceInitializationResult,
  WorkspaceMutationResult,
  WorkspaceRuntimeDependencies,
  WorkspaceRuntimeSelectionState,
} from '../workspaceRuntimeTypes';

const AI_SETTINGS_KEYS = {
  apiKey: 'ai.apiKey',
  baseUrl: 'ai.baseUrl',
  model: 'ai.model',
} as const;

export function createWorkspaceRuntimeService(
  dependencies: WorkspaceRuntimeDependencies,
) {
  const providerFactory =
    dependencies.createProviderClient ?? createOpenAiCompatibleProviderClient;
  const learningMode = dependencies.defaultLearningMode ?? 'standard';

  return {
    initializeWorkspace,
    listResourceMetadata,
    loadAiConfig,
    saveAiConfig,
    saveWorkspace,
    upsertResourceMetadata,
    rememberSelectionState,
    resolveResourceSummary,
    async generatePlanSteps(
      snapshot: WorkspaceSnapshot,
      moduleNodeId: string,
      config: AiConfig,
      resourceMetadataRecords: ResourceMetadataRecord[] = [],
    ) {
      const moduleNode = getNodeOrThrow(snapshot.tree, moduleNodeId);

      if (moduleNode.type !== 'module') {
        throw new Error(`节点 ${moduleNodeId} 不是 module。`);
      }

      if (
        moduleNode.childIds.some(
          (childId) => snapshot.tree.nodes[childId]?.type === 'plan-step',
        )
      ) {
        throw new Error('当前模块已经包含学习路径步骤，首版不做覆盖规划。');
      }

      const providerClient = providerFactory(config);
      const generationService = createPlanStepGenerationService({
        providerClient,
      });
      const referenceCandidates = collectLearningReferenceCandidates(
        snapshot.tree,
        indexResourceMetadataByNodeId(resourceMetadataRecords),
      );
      const result = await generationService.generate({
        topic: snapshot.workspace.title,
        moduleTitle: moduleNode.title,
        moduleSummary: moduleNode.content,
        mode: learningMode,
        referenceCandidates,
        resourceSummary: summarizeLearningReferenceCandidates(referenceCandidates),
      });
      const previousChildIds = new Set(moduleNode.childIds);
      const nextTree = appendPlanStepDraftsToModule(
        snapshot.tree,
        moduleNode.id,
        result.planSteps,
      );
      const generatedPlanStepId = nextTree.nodes[moduleNode.id].childIds.find(
        (childId) => !previousChildIds.has(childId),
      );

      return {
        snapshot: createSnapshot(nextTree, snapshot),
        nextModuleId: moduleNode.id,
        nextSelectedNodeId: generatedPlanStepId ?? moduleNode.id,
        message: `已为模块规划 ${String(result.planSteps.length)} 个学习步骤，并落下铺垫讲解与关键问题。`,
      } satisfies WorkspaceMutationResult;
    },
    async splitQuestion(
      snapshot: WorkspaceSnapshot,
      questionNodeId: string,
      config: AiConfig,
    ) {
      const questionNode = getNodeOrThrow(snapshot.tree, questionNodeId);

      if (questionNode.type !== 'question') {
        throw new Error(`节点 ${questionNodeId} 不是 question。`);
      }

      if (
        questionNode.childIds.some(
          (childId) => snapshot.tree.nodes[childId]?.type === 'question',
        )
      ) {
        throw new Error('当前问题已经存在子问题，首版不重复拆分。');
      }

      const providerClient = providerFactory(config);
      const splitService = createCompoundQuestionSplitService({
        providerClient,
      });
      const moduleNode = resolveCurrentModuleNode(snapshot.tree, questionNode.id);
      const planStepNode = findAncestorNode(snapshot.tree, questionNode.id, 'plan-step');
      const result = await splitService.split({
        question: buildQuestionText(questionNode),
        moduleTitle: moduleNode?.title,
        planStepTitle: planStepNode?.title,
      });

      if (result.childQuestions.length === 0) {
        throw new Error('当前问题暂时无法拆分出可落树的子问题。');
      }

      const nextTree = appendChildQuestionsToTree(
        snapshot.tree,
        questionNode.id,
        result,
      );

      return {
        snapshot: createSnapshot(nextTree, snapshot),
        nextModuleId: moduleNode?.id ?? null,
        nextSelectedNodeId: questionNode.id,
        message:
          result.fallbackReason ??
          `已为当前问题补充 ${String(result.childQuestions.length)} 个子问题。`,
      } satisfies WorkspaceMutationResult;
    },
    async evaluateQuestionAnswer(
      snapshot: WorkspaceSnapshot,
      questionNodeId: string,
      answerNodeId: string,
      config: AiConfig,
      resourceMetadataRecords: ResourceMetadataRecord[] = [],
    ) {
      const questionNode = getNodeOrThrow(snapshot.tree, questionNodeId);

      if (questionNode.type !== 'question') {
        throw new Error(`节点 ${questionNodeId} 不是 question。`);
      }

      if (!canEvaluateQuestionAnswer(snapshot.tree, questionNodeId, answerNodeId)) {
        throw new Error('当前问题还没有回答，无法生成判断与讲解。');
      }

      const providerClient = providerFactory(config);
      const questionClosureService = createQuestionClosureService({
        providerClient,
      });
      const context = buildQuestionClosureRuntimeContext(
        snapshot.tree,
        questionNodeId,
        answerNodeId,
        {
          resourceMetadataByNodeId: indexResourceMetadataByNodeId(
            resourceMetadataRecords,
          ),
        },
      );
      const previousChildIds = new Set(questionNode.childIds);
      const closureResult = await questionClosureService.generate({
        topic: snapshot.workspace.title,
        moduleTitle: context.moduleNode?.title,
        planStepSummary: context.planStepNode?.content,
        planStepTitle: context.planStepNode?.title,
        introductions: context.introductions,
        learnerAnswer: context.learnerAnswer,
        questionPath: context.questionPath,
        referenceCandidates: context.referenceCandidates,
      });
      const nextTree = appendQuestionClosureToTree(
        snapshot.tree,
        questionNodeId,
        closureResult,
      );
      const nextSnapshot = createSnapshot(nextTree, snapshot);

      return {
        snapshot: nextSnapshot,
        nextModuleId: context.moduleNode?.id ?? null,
        nextSelectedNodeId: resolveNextSelectionAfterQuestionClosure(
          nextSnapshot.tree,
          questionNodeId,
          context.answerNodeId,
          previousChildIds,
          closureResult.isAnswerSufficient,
        ),
        message: buildQuestionClosureMessage(
          nextSnapshot.tree,
          questionNodeId,
          previousChildIds,
          closureResult.isAnswerSufficient,
        ),
      } satisfies WorkspaceMutationResult;
    },
    async generateLearningActionDraft(
      snapshot: WorkspaceSnapshot,
      request: WorkspaceEditorLearningActionRequest,
      config: AiConfig,
      resourceMetadataRecords: ResourceMetadataRecord[] = [],
    ) {
      const actionId = resolveDraftActionId(request.actionId);

      if (!actionId) {
        throw new Error('当前学习动作不走 AI 草稿生成链路。');
      }

      const providerClient = providerFactory(config);
      const draftService = createLearningActionDraftService({
        providerClient,
      });
      const context = buildLearningActionRuntimeContext(
        snapshot.tree,
        request.selectedNodeId,
        {
          resourceMetadataByNodeId: indexResourceMetadataByNodeId(
            resourceMetadataRecords,
          ),
        },
      );
      const parentNode = getNodeOrThrow(snapshot.tree, request.placement.parentNodeId);
      const previousChildIds = new Set(parentNode.childIds);
      const result = await draftService.generate({
        actionId,
        topic: snapshot.workspace.title,
        moduleTitle: context.moduleNode?.title,
        planStepSummary: context.planStepNode?.content,
        planStepTitle: context.planStepNode?.title,
        currentNode: context.currentNode,
        existingQuestionTitles: context.existingQuestionTitles,
        introductions: context.introductions,
        learnerAnswer: context.learnerAnswer,
        questionPath: context.questionPath,
        referenceCandidates: context.referenceCandidates,
      });
      const nextTree = appendLearningNodeDraftToTree(
        snapshot.tree,
        request.placement.parentNodeId,
        result.draft,
        request.placement.insertIndex,
      );
      const nextParentNode = getNodeOrThrow(nextTree, request.placement.parentNodeId);
      const createdNodeId =
        nextParentNode.childIds.find((childId) => !previousChildIds.has(childId)) ??
        request.selectedNodeId;
      const nextSnapshot = createSnapshot(nextTree, snapshot);

      return {
        snapshot: nextSnapshot,
        nextModuleId: resolveCurrentModuleNode(nextSnapshot.tree, createdNodeId)?.id ?? null,
        nextSelectedNodeId: createdNodeId,
        message: buildLearningActionDraftMessage(actionId),
      } satisfies WorkspaceMutationResult;
    },
    suggestPlanStepCompletion(
      snapshot: WorkspaceSnapshot,
      planStepNodeId: string,
    ) {
      return {
        completionSuggestion: suggestPlanStepCompletion(
          snapshot.tree,
          planStepNodeId,
        ),
      } satisfies WorkspaceMutationResult;
    },
  };

  async function initializeWorkspace(): Promise<WorkspaceInitializationResult> {
    const recentState = dependencies.localPreferenceStorage.loadRecentWorkspaceState();

    if (recentState) {
      const recentSnapshot = await dependencies.structuredDataStorage.loadWorkspace(
        recentState.workspaceId,
      );

      if (recentSnapshot) {
        const resourceMetadataRecords =
          await dependencies.structuredDataStorage.listResourceMetadata(
            recentSnapshot.workspace.id,
          );

        return {
          snapshot: recentSnapshot,
          initialModuleId: resolveInitialModuleId(
            recentSnapshot.tree,
            recentState.moduleId,
          ),
          initialSelectedNodeId: resolveInitialSelectedNodeId(
            recentSnapshot.tree,
            recentState.focusedNodeId,
          ),
          resourceMetadataRecords,
        };
      }
    }

    const workspaces = await dependencies.structuredDataStorage.listWorkspaces();
    const latestWorkspace = [...workspaces].sort((leftWorkspace, rightWorkspace) =>
      rightWorkspace.updatedAt.localeCompare(leftWorkspace.updatedAt),
    )[0];

    if (latestWorkspace) {
      const snapshot = await dependencies.structuredDataStorage.loadWorkspace(
        latestWorkspace.id,
      );

      if (!snapshot) {
        throw new Error(`工作区 ${latestWorkspace.id} 读取为空。`);
      }

      const resourceMetadataRecords =
        await dependencies.structuredDataStorage.listResourceMetadata(
          latestWorkspace.id,
        );

      const initialModuleId = resolveInitialModuleId(snapshot.tree);
      const initialSelectedNodeId = resolveInitialSelectedNodeId(snapshot.tree);

      rememberSelectionState(snapshot.workspace.id, {
        currentModuleId: initialModuleId,
        selectedNodeId: initialSelectedNodeId,
      });

      return {
        snapshot,
        initialModuleId,
        initialSelectedNodeId,
        resourceMetadataRecords,
      };
    }

    const snapshot = createInitialWorkspaceSnapshot();
    const initialModuleId = resolveInitialModuleId(snapshot.tree);
    const initialSelectedNodeId = resolveInitialSelectedNodeId(snapshot.tree);

    await dependencies.structuredDataStorage.saveWorkspace(snapshot);
    rememberSelectionState(snapshot.workspace.id, {
      currentModuleId: initialModuleId,
      selectedNodeId: initialSelectedNodeId,
    });

    return {
      snapshot,
      initialModuleId,
      initialSelectedNodeId,
      resourceMetadataRecords: [],
    };
  }

  async function listResourceMetadata(workspaceId: string) {
    return dependencies.structuredDataStorage.listResourceMetadata(workspaceId);
  }

  function loadAiConfig(): AiConfig {
    const settings = dependencies.localPreferenceStorage.loadSettings();

    return {
      baseUrl: readSetting(settings?.values[AI_SETTINGS_KEYS.baseUrl]),
      apiKey: readSetting(settings?.values[AI_SETTINGS_KEYS.apiKey]),
      model: readSetting(settings?.values[AI_SETTINGS_KEYS.model]),
    };
  }

  function saveAiConfig(config: AiConfig) {
    const previousSettings = dependencies.localPreferenceStorage.loadSettings();

    dependencies.localPreferenceStorage.saveSettings({
      values: {
        ...previousSettings?.values,
        [AI_SETTINGS_KEYS.baseUrl]: config.baseUrl,
        [AI_SETTINGS_KEYS.apiKey]: config.apiKey,
        [AI_SETTINGS_KEYS.model]: config.model,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  async function saveWorkspace(
    snapshot: WorkspaceSnapshot,
    selection: WorkspaceRuntimeSelectionState,
  ) {
    await dependencies.structuredDataStorage.saveWorkspace(snapshot);
    rememberSelectionState(snapshot.workspace.id, selection);
  }

  async function upsertResourceMetadata(record: ResourceMetadataRecord) {
    await dependencies.structuredDataStorage.upsertResourceMetadata(record);
  }

  async function resolveResourceSummary(
    draft: ResourceImportDraft,
    config: AiConfig,
  ) {
    if (
      draft.ingest.importMethod !== 'url' ||
      !draft.ingest.bodyText?.trim()
    ) {
      return draft;
    }

    try {
      const providerClient = providerFactory(config);
      const generationService = createResourceSummaryGenerationService({
        providerClient,
      });
      const generatedSummary = await generationService.generate({
        bodyFormat: draft.ingest.bodyFormat,
        bodyText: draft.ingest.bodyText,
        fallbackSummary: draft.content,
        fallbackTitle: draft.title,
        importMethod: draft.ingest.importMethod,
        mimeType: draft.ingest.mimeType,
        sourceUri: draft.sourceUri,
      });

      return {
        ...draft,
        content: generatedSummary.summary,
        ingest: {
          ...draft.ingest,
          summarySource: 'ai-generated',
          titleSource: 'ai-generated',
        },
        title: generatedSummary.title,
      } satisfies ResourceImportDraft;
    } catch {
      return draft;
    }
  }

  function rememberSelectionState(
    workspaceId: string,
    selection: WorkspaceRuntimeSelectionState,
  ) {
    dependencies.localPreferenceStorage.saveRecentWorkspaceState({
      workspaceId,
      moduleId: selection.currentModuleId ?? undefined,
      focusedNodeId: selection.selectedNodeId ?? undefined,
      openedAt: new Date().toISOString(),
    });
  }
}

function createSnapshot(
  tree: NodeTree,
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      updatedAt: new Date().toISOString(),
    },
    tree: reconcilePlanStepStatuses(tree),
  };
}

function resolveInitialModuleId(tree: NodeTree, preferredModuleId?: string | null) {
  if (preferredModuleId && tree.nodes[preferredModuleId]?.type === 'module') {
    return preferredModuleId;
  }

  return (
    tree.nodes[tree.rootId].childIds.find(
      (childId) => tree.nodes[childId]?.type === 'module',
    ) ?? null
  );
}

function resolveInitialSelectedNodeId(
  tree: NodeTree,
  preferredNodeId?: string | null,
) {
  if (preferredNodeId && tree.nodes[preferredNodeId]) {
    return preferredNodeId;
  }

  const moduleNodeId = resolveInitialModuleId(tree);

  if (!moduleNodeId) {
    return null;
  }

  return descendToFirstEditableNode(tree, moduleNodeId);
}

function descendToFirstEditableNode(tree: NodeTree, nodeId: string) {
  let currentNodeId = nodeId;

  while (tree.nodes[currentNodeId]?.childIds.length) {
    currentNodeId = tree.nodes[currentNodeId].childIds[0];
  }

  return currentNodeId;
}

function resolveCurrentModuleNode(tree: NodeTree, nodeId: string): ModuleNode | null {
  const moduleNodeId = getModuleScopeId(tree, nodeId);

  if (!moduleNodeId) {
    return null;
  }

  const moduleNode = getNodeOrThrow(tree, moduleNodeId);

  return moduleNode.type === 'module' ? moduleNode : null;
}

function findAncestorNode<TNodeType extends TreeNode['type']>(
  tree: NodeTree,
  nodeId: string,
  nodeType: TNodeType,
) {
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === nodeType) {
      return currentNode as Extract<TreeNode, { type: TNodeType }>;
    }

    currentNode =
      currentNode.parentId === null
        ? undefined
        : tree.nodes[currentNode.parentId];
  }

  return null;
}

function resolveNextSelectionAfterQuestionClosure(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
  previousChildIds: Set<string>,
  isAnswerSufficient: boolean,
) {
  if (!isAnswerSufficient) {
    return tree.nodes[answerNodeId] ? answerNodeId : questionNodeId;
  }

  const planStepNode = findAncestorNode(tree, questionNodeId, 'plan-step');

  if (!planStepNode) {
    return questionNodeId;
  }

  const leafQuestionIds = collectLeafQuestionIdsUnderPlanStep(tree, planStepNode.id);
  const currentQuestionIndex = leafQuestionIds.indexOf(questionNodeId);
  const nextQuestionId =
    currentQuestionIndex >= 0 ? leafQuestionIds[currentQuestionIndex + 1] : null;

  if (nextQuestionId) {
    return nextQuestionId;
  }

  const moduleNode = findAncestorNode(tree, questionNodeId, 'module');

  if (!moduleNode) {
    return planStepNode.id;
  }

  const currentPlanStepIndex = moduleNode.childIds.indexOf(planStepNode.id);

  for (
    let siblingIndex = currentPlanStepIndex + 1;
    siblingIndex < moduleNode.childIds.length;
    siblingIndex += 1
  ) {
    const siblingNode = tree.nodes[moduleNode.childIds[siblingIndex]];

    if (siblingNode?.type !== 'plan-step') {
      continue;
    }

    return collectLeafQuestionIdsUnderPlanStep(tree, siblingNode.id)[0] ?? siblingNode.id;
  }

  const summaryNodeId = getLatestInsertedSummaryId(tree, questionNodeId, previousChildIds);

  if (summaryNodeId) {
    return summaryNodeId;
  }

  return planStepNode.id;
}

function buildQuestionClosureMessage(
  tree: NodeTree,
  questionNodeId: string,
  previousChildIds: Set<string>,
  isAnswerSufficient: boolean,
) {
  const planStepNode = findAncestorNode(tree, questionNodeId, 'plan-step');
  const stepStatusLabel =
    planStepNode?.type === 'plan-step'
      ? {
          todo: 'todo',
          doing: 'doing',
          done: 'done',
        }[planStepNode.status]
      : null;

  if (!isAnswerSufficient) {
    const hasFollowUpQuestion =
      getLatestInsertedFollowUpQuestionId(tree, questionNodeId, previousChildIds) !==
      null;
    const hasExplanation =
      getLatestInsertedSummaryId(tree, questionNodeId, previousChildIds) !== null;

    if (hasFollowUpQuestion && hasExplanation) {
      return '系统已检查这次回答，并补出判断与答案解析。默认主路径仍留在当前回答上，先修改后重新评估；追问已生成，但只作为次级推进。';
    }

    if (hasExplanation) {
      return '系统已检查这次回答，并补出判断与答案解析。默认主路径仍留在当前回答上，先修改后重新评估。';
    }

    return '系统已检查这次回答。默认主路径仍留在当前回答上，先修改后重新评估；如有追问，也只作为次级推进。';
  }

  const summaryNodeId = getLatestInsertedSummaryId(tree, questionNodeId, previousChildIds);

  if (stepStatusLabel === 'done') {
    return summaryNodeId
      ? '系统已检查这次回答，并补出判断与总结；当前问题已闭环，这一步也收敛为 done。'
      : '系统已检查这次回答，当前问题已闭环，这一步也收敛为 done。';
  }

  return summaryNodeId
    ? '系统已检查这次回答，并补出判断与总结；你可以继续看这份总结，或直接进入下一题。'
    : '系统已检查这次回答；你可以继续下一题或下一步。';
}

function buildQuestionText(node: Extract<TreeNode, { type: 'question' }>) {
  const normalizedContent = node.content.trim();

  if (!normalizedContent) {
    return node.title;
  }

  return `${node.title}\n${normalizedContent}`;
}

function readSetting(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function resolveDraftActionId(actionId: WorkspaceEditorLearningActionRequest['actionId']) {
  switch (actionId) {
    case 'insert-scaffold':
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
    case 'insert-question':
    case 'insert-summary':
    case 'insert-judgment':
      return actionId;
    default:
      return null;
  }
}

function getLatestInsertedSummaryId(
  tree: NodeTree,
  questionNodeId: string,
  previousChildIds: Set<string>,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  const insertedSummaryNodes = questionNode.childIds
    .filter((childId) => !previousChildIds.has(childId))
    .map((childId) => tree.nodes[childId])
    .filter(
      (childNode): childNode is Extract<TreeNode, { type: 'summary' }> =>
        childNode?.type === 'summary',
    )
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);

  return insertedSummaryNodes[insertedSummaryNodes.length - 1]?.id ?? null;
}

function getLatestInsertedFollowUpQuestionId(
  tree: NodeTree,
  questionNodeId: string,
  previousChildIds: Set<string>,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  const insertedQuestions = questionNode.childIds
    .filter((childId) => !previousChildIds.has(childId))
    .map((childId) => tree.nodes[childId])
    .filter(
      (childNode): childNode is Extract<TreeNode, { type: 'question' }> =>
        childNode?.type === 'question',
    )
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);

  return insertedQuestions[insertedQuestions.length - 1]?.id ?? null;
}

function indexResourceMetadataByNodeId(
  resourceMetadataRecords: ResourceMetadataRecord[],
) {
  return Object.fromEntries(
    resourceMetadataRecords.map((record) => [record.nodeId, record]),
  ) satisfies Record<string, ResourceMetadataRecord>;
}

function buildLearningActionDraftMessage(
  actionId: NonNullable<ReturnType<typeof resolveDraftActionId>>,
) {
  switch (actionId) {
    case 'insert-scaffold':
      return '已补上一段新的铺垫讲解草稿。';
    case 'rephrase-scaffold':
      return '已沿着当前铺垫补上一版换个说法的讲解草稿。';
    case 'simplify-scaffold':
      return '已补上一版更基础的讲解草稿。';
    case 'add-example':
      return '已补上一个帮助理解的例子草稿。';
    case 'insert-question':
      return '已补上一个新的问题草稿。';
    case 'insert-summary':
      return '已补上一段可编辑的总结草稿。';
    case 'insert-judgment':
      return '已补上一段可编辑的判断草稿。';
  }
}
