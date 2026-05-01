import {
  attachCitationDraftsToNode,
  appendLearningNodeDraftToTree,
  appendChildQuestionsToTree,
  appendPlanStepDraftsToModule,
  appendQuestionClosureToTree,
  createSummaryEvaluationService,
  createCompoundQuestionSplitService,
  createJudgmentHintService,
  createLearningActionDraftService,
  createOpenAiCompatibleProviderClient,
  createPlanStepGenerationService,
  createQuestionClosureService,
  reconcilePlanStepStatuses,
  suggestPlanStepCompletion,
  type AiConfig,
  type JudgmentNodeDraft,
} from '../../learningEngine';
import {
  cloneNodeTree,
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
  buildJudgmentHintRuntimeContext,
  buildLearningActionRuntimeContext,
  buildQuestionClosureRuntimeContext,
  buildSummaryEvaluationRuntimeContext,
  canEvaluateQuestionAnswer,
  collectLeafQuestionIdsUnderPlanStep,
  collectLearningReferenceCandidates,
  summarizeLearningReferenceCandidates,
} from './learningRuntimeContext';
import type { StoredAiConfigPreferences } from './aiConfigPresets';
import {
  loadStoredAiConfigPreferences,
  saveStoredAiConfigPreferences,
} from './aiConfigPresets';
import type {
  WorkspaceInitializationResult,
  WorkspaceMutationResult,
  WorkspaceRuntimeDependencies,
  WorkspaceRuntimeSelectionState,
} from '../workspaceRuntimeTypes';

export function createWorkspaceRuntimeService(
  dependencies: WorkspaceRuntimeDependencies,
) {
  const providerFactory =
    dependencies.createProviderClient ?? createOpenAiCompatibleProviderClient;
  const learningMode = dependencies.defaultLearningMode ?? 'standard';

  return {
    initializeWorkspace,
    listResourceMetadata,
    loadAiConfigPreferences,
    saveAiConfigPreferences,
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
      const sourceAnswerNode = getNodeOrThrow(snapshot.tree, context.answerNodeId);
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
        sourceAnswerNode.type === 'answer'
          ? {
              sourceAnswerId: sourceAnswerNode.id,
              sourceAnswerUpdatedAt: sourceAnswerNode.updatedAt,
            }
          : undefined,
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
    async evaluateSummary(
      snapshot: WorkspaceSnapshot,
      summaryNodeId: string,
      config: AiConfig,
      resourceMetadataRecords: ResourceMetadataRecord[] = [],
    ) {
      const summaryNode = getNodeOrThrow(snapshot.tree, summaryNodeId);

      if (summaryNode.type !== 'summary') {
        throw new Error(`节点 ${summaryNodeId} 不是 summary。`);
      }

      const providerClient = providerFactory(config);
      const summaryEvaluationService = createSummaryEvaluationService({
        providerClient,
      });
      const context = buildSummaryEvaluationRuntimeContext(
        snapshot.tree,
        summaryNodeId,
        {
          resourceMetadataByNodeId: indexResourceMetadataByNodeId(
            resourceMetadataRecords,
          ),
        },
      );
      const result = await summaryEvaluationService.generate({
        topic: snapshot.workspace.title,
        moduleTitle: context.moduleNode?.title,
        planStepSummary: context.planStepNode?.content,
        planStepTitle: context.planStepNode?.title,
        introductions: context.introductions,
        learnerAnswer: context.learnerAnswer || undefined,
        learnerSummary: context.learnerSummary,
        questionPath: context.questionPath,
        referenceCandidates: context.referenceCandidates,
      });
      const nextTree = appendSummaryCheckJudgmentToTree(
        snapshot.tree,
        context.questionNodeId,
        context.summaryNodeId,
        result.judgment,
        {
          ...(context.answerNodeId &&
          snapshot.tree.nodes[context.answerNodeId]?.type === 'answer'
            ? {
                sourceAnswerId: context.answerNodeId,
                sourceAnswerUpdatedAt:
                  snapshot.tree.nodes[context.answerNodeId].updatedAt,
              }
            : {}),
          sourceSummaryId: context.summaryNodeId,
          sourceSummaryUpdatedAt:
            snapshot.tree.nodes[context.summaryNodeId]?.type === 'summary'
              ? snapshot.tree.nodes[context.summaryNodeId].updatedAt
              : undefined,
        },
      );
      const nextSnapshot = createSnapshot(nextTree, snapshot);
      const nextJudgmentNodeId = findImmediateSummaryCheckJudgmentId(
        nextSnapshot.tree,
        context.questionNodeId,
        context.summaryNodeId,
      );

      return {
        snapshot: nextSnapshot,
        nextModuleId: context.moduleNode?.id ?? null,
        nextSelectedNodeId: nextJudgmentNodeId ?? context.summaryNodeId,
        message: '已检查这段总结，并补出一条理解检查结果。',
      } satisfies WorkspaceMutationResult;
    },
    async generateJudgmentHint(
      snapshot: WorkspaceSnapshot,
      judgmentNodeId: string,
      config: AiConfig,
      resourceMetadataRecords: ResourceMetadataRecord[] = [],
    ) {
      const judgmentNode = getNodeOrThrow(snapshot.tree, judgmentNodeId);

      if (judgmentNode.type !== 'judgment') {
        throw new Error(`节点 ${judgmentNodeId} 不是 judgment。`);
      }

      const persistedHint = judgmentNode.hint?.trim();

      if (persistedHint) {
        return {
          message: '当前提示已经存在。',
        } satisfies WorkspaceMutationResult;
      }

      const providerClient = providerFactory(config);
      const hintService = createJudgmentHintService({
        providerClient,
      });
      const context = buildJudgmentHintRuntimeContext(snapshot.tree, judgmentNodeId, {
        resourceMetadataByNodeId: indexResourceMetadataByNodeId(
          resourceMetadataRecords,
        ),
      });
      const result = await hintService.generate({
        topic: snapshot.workspace.title,
        moduleTitle: context.moduleNode?.title,
        planStepTitle: context.planStepNode?.title,
        planStepSummary: context.planStepNode?.content,
        introductions: context.introductions,
        learnerAnswer: context.learnerAnswer,
        questionPath: context.questionPath,
        judgmentContent: context.judgmentContent,
        summaryContent: context.summaryContent,
        referenceCandidates: context.referenceCandidates,
      });
      const nextTree = cloneNodeTree(snapshot.tree);
      const nextJudgmentNode = getNodeOrThrow(nextTree, judgmentNodeId);

      if (nextJudgmentNode.type !== 'judgment') {
        throw new Error(`节点 ${judgmentNodeId} 不是 judgment。`);
      }

      nextJudgmentNode.hint = result.hint;
      nextJudgmentNode.updatedAt = new Date().toISOString();
      const nextTreeWithHintCitations = attachCitationDraftsToNode(
        nextTree,
        judgmentNodeId,
        result.citations,
      );

      return {
        snapshot: createSnapshot(nextTreeWithHintCitations, snapshot),
        nextModuleId: context.moduleNode?.id ?? null,
        nextSelectedNodeId: judgmentNodeId,
        message: '已补一条围绕当前缺口的思考提示。',
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
        focusContext: context.focusContext,
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
      const nextTreeWithSourceContext = applyQuestionSourceContext(
        nextTree,
        createdNodeId,
        request,
      );
      const nextSnapshot = createSnapshot(nextTreeWithSourceContext, snapshot);

      return {
        snapshot: nextSnapshot,
        nextModuleId: resolveCurrentModuleNode(nextSnapshot.tree, createdNodeId)?.id ?? null,
        nextSelectedNodeId: createdNodeId,
        message: buildLearningActionDraftMessage(
          actionId,
          result.metadata.providerLabel === 'local-fallback',
        ),
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
        const normalizedRecentTree = normalizeTreeForCurrentAnswerCompatibility(
          recentSnapshot.tree,
        );
        const normalizedRecentSnapshot =
          normalizedRecentTree === recentSnapshot.tree
            ? recentSnapshot
            : createSnapshot(normalizedRecentTree, recentSnapshot);
        const resourceMetadataRecords =
          await dependencies.structuredDataStorage.listResourceMetadata(
            normalizedRecentSnapshot.workspace.id,
          );

        return {
          snapshot: normalizedRecentSnapshot,
          initialModuleId: resolveInitialModuleId(
            normalizedRecentSnapshot.tree,
            recentState.moduleId,
          ),
          initialSelectedNodeId: resolveInitialSelectedNodeId(
            normalizedRecentSnapshot.tree,
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

      const normalizedTree = normalizeTreeForCurrentAnswerCompatibility(
        snapshot.tree,
      );
      const normalizedSnapshot =
        normalizedTree === snapshot.tree
          ? snapshot
          : createSnapshot(normalizedTree, snapshot);
      const resourceMetadataRecords =
        await dependencies.structuredDataStorage.listResourceMetadata(
          latestWorkspace.id,
        );

      const initialModuleId = resolveInitialModuleId(normalizedSnapshot.tree);
      const initialSelectedNodeId = resolveInitialSelectedNodeId(
        normalizedSnapshot.tree,
      );

      rememberSelectionState(normalizedSnapshot.workspace.id, {
        currentModuleId: initialModuleId,
        selectedNodeId: initialSelectedNodeId,
      });

      return {
        snapshot: normalizedSnapshot,
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

  function loadAiConfigPreferences(): StoredAiConfigPreferences {
    const settings = dependencies.localPreferenceStorage.loadSettings();

    return loadStoredAiConfigPreferences(settings);
  }

  function saveAiConfigPreferences(preferences: StoredAiConfigPreferences) {
    const previousSettings = dependencies.localPreferenceStorage.loadSettings();

    dependencies.localPreferenceStorage.saveSettings(
      saveStoredAiConfigPreferences(previousSettings, preferences),
    );
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
  const normalizedTree = normalizeTreeForCurrentAnswerCompatibility(tree);

  return {
    workspace: {
      ...snapshot.workspace,
      updatedAt: new Date().toISOString(),
    },
    tree: reconcilePlanStepStatuses(normalizedTree),
  };
}

function applyQuestionSourceContext(
  tree: NodeTree,
  createdNodeId: string,
  request: WorkspaceEditorLearningActionRequest,
) {
  if (request.actionId !== 'insert-question') {
    return tree;
  }

  const createdNode = tree.nodes[createdNodeId];
  const sourceNode = tree.nodes[request.selectedNodeId];

  if (
    createdNode?.type !== 'question' ||
    !sourceNode ||
    (sourceNode.type !== 'question' &&
      sourceNode.type !== 'answer' &&
      sourceNode.type !== 'summary' &&
      sourceNode.type !== 'judgment')
  ) {
    return tree;
  }

  const nextTree = cloneNodeTree(tree);
  const nextQuestionNode = getNodeOrThrow(nextTree, createdNodeId);

  if (nextQuestionNode.type !== 'question') {
    return tree;
  }

  nextQuestionNode.sourceContext = {
    content: sourceNode.content,
    nodeId: sourceNode.id,
    nodeType: sourceNode.type,
    title: sourceNode.title,
    updatedAt: sourceNode.updatedAt,
  };

  return nextTree;
}

function normalizeTreeForCurrentAnswerCompatibility(tree: NodeTree) {
  let nextTree = tree;
  let hasChange = false;

  for (const node of Object.values(tree.nodes)) {
    if (node.type !== 'question' || node.currentAnswerId) {
      continue;
    }

    const fallbackCurrentAnswerId = resolveLegacyInitialCurrentAnswerId(
      tree,
      node.id,
    );

    if (!fallbackCurrentAnswerId) {
      continue;
    }

    if (!hasChange) {
      nextTree = cloneNodeTree(tree);
      hasChange = true;
    }

    const nextQuestionNode = getNodeOrThrow(nextTree, node.id);

    if (nextQuestionNode.type === 'question' && !nextQuestionNode.currentAnswerId) {
      nextQuestionNode.currentAnswerId = fallbackCurrentAnswerId;
    }
  }

  return nextTree;
}

function resolveLegacyInitialCurrentAnswerId(
  tree: NodeTree,
  questionNodeId: string,
) {
  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const answerNodes = questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (
        childNode,
      ): childNode is Extract<TreeNode, { type: 'answer' }> => childNode?.type === 'answer',
    );
  const filledAnswerNodes = answerNodes.filter(
    (answerNode) => answerNode.content.trim().length > 0,
  );

  return filledAnswerNodes[filledAnswerNodes.length - 1]?.id ?? null;
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
      ? '系统已检查这次回答，并补出判断与答案解析；当前问题已闭环，这一步也收敛为 done。'
      : '系统已检查这次回答，当前问题已闭环，这一步也收敛为 done。';
  }

  return summaryNodeId
    ? '系统已检查这次回答，并补出判断与答案解析；你可以先对照这份标准理解，或直接进入下一题。'
    : '系统已检查这次回答；你可以继续下一题或下一步。';
}

function buildQuestionText(node: Extract<TreeNode, { type: 'question' }>) {
  const normalizedContent = node.content.trim();

  if (!normalizedContent) {
    return node.title;
  }

  return `${node.title}\n${normalizedContent}`;
}

function resolveDraftActionId(actionId: WorkspaceEditorLearningActionRequest['actionId']) {
  switch (actionId) {
    case 'insert-scaffold':
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
    case 'insert-question':
    case 'insert-answer':
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

function appendSummaryCheckJudgmentToTree(
  tree: NodeTree,
  questionNodeId: string,
  summaryNodeId: string,
  judgmentDraft: JudgmentNodeDraft,
  sourceOptions?: {
    sourceAnswerId?: string;
    sourceAnswerUpdatedAt?: string;
    sourceSummaryId?: string;
    sourceSummaryUpdatedAt?: string;
  },
) {
  return appendLearningNodeDraftToTree(
    tree,
    questionNodeId,
    {
      ...judgmentDraft,
      ...sourceOptions,
    },
    getSummaryCheckJudgmentInsertIndex(tree, questionNodeId, summaryNodeId),
  );
}

function findImmediateSummaryCheckJudgmentId(
  tree: NodeTree,
  questionNodeId: string,
  summaryNodeId: string,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  const summaryIndex = questionNode.childIds.indexOf(summaryNodeId);

  if (summaryIndex === -1) {
    return null;
  }

  const nextSiblingId = questionNode.childIds[summaryIndex + 1];
  const nextSiblingNode = nextSiblingId ? tree.nodes[nextSiblingId] : null;

  return nextSiblingNode?.type === 'judgment' &&
    nextSiblingNode.judgmentKind === 'summary-check'
    ? nextSiblingNode.id
    : null;
}

function getSummaryCheckJudgmentInsertIndex(
  tree: NodeTree,
  questionNodeId: string,
  summaryNodeId: string,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    throw new Error(`节点 ${questionNodeId} 不是 question。`);
  }

  const summaryIndex = questionNode.childIds.indexOf(summaryNodeId);

  if (summaryIndex === -1) {
    throw new Error(`总结 ${summaryNodeId} 不属于问题 ${questionNodeId}。`);
  }

  return summaryIndex + 1;
}

function buildLearningActionDraftMessage(
  actionId: NonNullable<ReturnType<typeof resolveDraftActionId>>,
  isLocalFallback = false,
) {
  if (isLocalFallback) {
    switch (actionId) {
      case 'insert-scaffold':
        return 'AI 暂时不可用，已先补上一段可编辑的本地铺垫草稿。';
      case 'rephrase-scaffold':
        return 'AI 暂时不可用，已先补上一版可编辑的本地改写草稿。';
      case 'simplify-scaffold':
        return 'AI 暂时不可用，已先补上一版可编辑的本地简化讲解草稿。';
      case 'add-example':
        return 'AI 暂时不可用，已先补上一个可编辑的本地例子草稿。';
      case 'insert-question':
        return 'AI 暂时不可用，已先补上一个可编辑的本地追问草稿。';
      case 'insert-answer':
        return 'AI 暂时不可用，已先补上一版可编辑的本地回答草稿。';
      case 'insert-summary':
        return 'AI 暂时不可用，已先补上一段可编辑的本地总结草稿。';
      case 'insert-judgment':
        return 'AI 暂时不可用，已先补上一段可编辑的本地判断草稿。';
    }
  }

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
      return '已补上一个新的追问草稿。';
    case 'insert-answer':
      return '已直接回答当前问题，并生成一版可编辑的回答草稿。';
    case 'insert-summary':
      return '已补上一段可编辑的总结草稿。';
    case 'insert-judgment':
      return '已补上一段可编辑的判断草稿。';
  }
}
