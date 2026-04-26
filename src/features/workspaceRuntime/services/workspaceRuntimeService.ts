import {
  appendChildQuestionsToTree,
  appendPlanStepDraftsToModule,
  createCompoundQuestionSplitService,
  createOpenAiCompatibleProviderClient,
  createPlanStepGenerationService,
  suggestPlanStepCompletion,
  type AiConfig,
} from '../../learningEngine';
import {
  getModuleScopeId,
  getNodeOrThrow,
  type ModuleNode,
  type NodeTree,
  type TreeNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import { createInitialWorkspaceSnapshot } from '../utils/createInitialWorkspaceSnapshot';
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
    loadAiConfig,
    saveAiConfig,
    saveWorkspace,
    rememberSelectionState,
    async generatePlanSteps(
      snapshot: WorkspaceSnapshot,
      moduleNodeId: string,
      config: AiConfig,
    ) {
      const moduleNode = getNodeOrThrow(snapshot.tree, moduleNodeId);

      if (moduleNode.type !== 'module') {
        throw new Error(`节点 ${moduleNodeId} 不是 module。`);
      }

      if (moduleNode.childIds.some((childId) => snapshot.tree.nodes[childId]?.type === 'plan-step')) {
        throw new Error('当前模块已经包含 plan-step，首版不做覆盖生成。');
      }

      const providerClient = providerFactory(config);
      const generationService = createPlanStepGenerationService({
        providerClient,
      });
      const result = await generationService.generate({
        topic: snapshot.workspace.title,
        moduleTitle: moduleNode.title,
        moduleSummary: moduleNode.content,
        mode: learningMode,
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
        message: `已为模块生成 ${String(result.planSteps.length)} 个 plan-step。`,
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

      if (questionNode.childIds.some((childId) => snapshot.tree.nodes[childId]?.type === 'question')) {
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
    };
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
    tree,
  };
}

function resolveInitialModuleId(tree: NodeTree, preferredModuleId?: string | null) {
  if (preferredModuleId && tree.nodes[preferredModuleId]?.type === 'module') {
    return preferredModuleId;
  }

  return tree.nodes[tree.rootId].childIds.find(
    (childId) => tree.nodes[childId]?.type === 'module',
  ) ?? null;
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
