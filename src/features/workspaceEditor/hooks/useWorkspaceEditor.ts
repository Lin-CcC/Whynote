import { useEffect, useRef, useState } from 'react';

import {
  reconcilePlanStepStatuses,
  shouldSkipPlanStepStatusReconciliation,
} from '../../learningEngine';

import {
  attachTagToNode,
  canParentAcceptChild,
  canNodeHaveChildren,
  cloneNodeTree,
  createNode,
  deleteNode,
  detachTagFromNode,
  ensureBuiltinTags,
  getAllowedChildTypes,
  getDisplayNodeTypeLabel,
  getModuleScopeId,
  getNodeOrThrow,
  insertChildNode,
  insertSiblingNode,
  liftNode,
  lowerNode,
  type NodeTree,
  type NonRootNode,
  type PlanStepNode,
  shouldConvertToModuleAtRoot,
  stripRedundantDisplayTypePrefix,
  switchNodeType as switchNodeTypeInDomain,
  type TreeNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import type {
  EditorActionAvailability,
  EditorInsertTypeOption,
  ExternalTreeChangeOptions,
  LearningActionId,
  NodeContentPatch,
  LearningActionPlacement,
  WorkspaceEditorOperations,
  WorkspaceEditorProps,
} from '../workspaceEditorTypes';
import {
  DEMO_MODULE_ID,
  DEMO_SELECTED_NODE_ID,
  createDemoWorkspaceSnapshot,
} from '../utils/createDemoWorkspace';
import {
  buildExpandedNodeIds,
  getDefaultChildType,
  getDefaultSelectedNodeId,
  getDefaultTitleForType,
  getModuleNodes,
  getNodePath,
  isNodeWithinModule,
} from '../utils/treeSelectors';
import {
  getLearningActionOptions,
  resolveLearningActionPlacement,
} from '../utils/learningActions';

const FIRST_MODULE_CONTENT = '先定义当前主题下的第一个学习方向。';
const FOLLOW_UP_MODULE_CONTENT = '补充这个模块的学习目标、边界或导读。';
const SWITCHABLE_LEAF_NODE_TYPES = [
  'question',
  'answer',
  'summary',
  'judgment',
] as const;

export const defaultWorkspaceEditorOperations: WorkspaceEditorOperations = {
  insertChildNode,
  insertSiblingNode,
  deleteNode,
  liftNode,
  lowerNode,
};

export function useWorkspaceEditor({
  initialSnapshot = createDemoWorkspaceSnapshot(),
  initialModuleId = DEMO_MODULE_ID,
  initialSelectedNodeId = DEMO_SELECTED_NODE_ID,
  isInteractionLocked = false,
  operations = defaultWorkspaceEditorOperations,
  onLearningActionRequest,
  onSnapshotChange,
  onSelectionChange,
}: WorkspaceEditorProps) {
  const initialTreeRef = useRef<NodeTree | null>(null);
  const initialTree =
    initialTreeRef.current ??
    (initialTreeRef.current = ensureBuiltinTags(initialSnapshot.tree));
  const [tree, setTree] = useState(initialTree);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(() =>
    resolveModuleId(
      initialTree,
      initialSelectedNodeId,
      initialModuleId,
    ),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const resolvedModuleId = resolveModuleId(
      initialTree,
      initialSelectedNodeId,
      initialModuleId,
    );

    return resolveSelectedNodeId(
      initialTree,
      initialSelectedNodeId,
      resolvedModuleId,
    );
  });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    buildExpandedNodeIds(initialTree, initialModuleId),
  );
  const [selectedChildInsertType, setSelectedChildInsertType] = useState<
    NonRootNode['type'] | null
  >(null);
  const [selectedSiblingInsertType, setSelectedSiblingInsertType] = useState<
    NonRootNode['type'] | null
  >(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  const pendingSnapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const nodeElementMapRef = useRef(new Map<string, HTMLElement>());

  const moduleNodes = getModuleNodes(tree);
  const selectedNode =
    selectedNodeId && tree.nodes[selectedNodeId]
      ? getNodeOrThrow(tree, selectedNodeId)
      : null;
  const currentModule =
    currentModuleId && tree.nodes[currentModuleId]
      ? getNodeOrThrow(tree, currentModuleId)
      : null;
  const actionAvailability = isInteractionLocked
    ? getLockedActionAvailability()
    : getActionAvailability(tree, selectedNodeId);
  const childInsertOptions = getInsertTypeOptions(
    getInsertableChildTypes(tree, selectedNodeId),
  );
  const siblingInsertOptions = getInsertTypeOptions(
    getInsertableSiblingTypes(tree, selectedNodeId),
  );
  const learningActions = getLearningActionOptions(tree, selectedNodeId);
  const selectedNodeTypeSwitchOptions = getSwitchableNodeTypes(tree, selectedNodeId);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' || isInteractionLocked || !selectedNodeId) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      event.preventDefault();
      deleteSelection();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentModuleId, isInteractionLocked, selectedNodeId, tree]);

  useEffect(() => {
    setSelectedChildInsertType((previousType) =>
      resolveInsertTypeSelection(
        previousType,
        childInsertOptions,
        getPreferredChildInsertType(tree, selectedNodeId),
      ),
    );
  }, [childInsertOptions, selectedNodeId, tree]);

  useEffect(() => {
    setSelectedSiblingInsertType((previousType) =>
      resolveInsertTypeSelection(
        previousType,
        siblingInsertOptions,
        getPreferredSiblingInsertType(tree, selectedNodeId),
      ),
    );
  }, [selectedNodeId, siblingInsertOptions, tree]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange;
  }, [onSnapshotChange]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const nodeElement = nodeElementMapRef.current.get(selectedNodeId);
    const activeElement = document.activeElement;

    if (!nodeElement || nodeElement.contains(activeElement)) {
      return;
    }

    nodeElement.focus();
  }, [selectedNodeId, tree]);

  useEffect(() => {
    onSelectionChangeRef.current?.({
      currentModuleId,
      selectedNodeId,
    });
  }, [currentModuleId, selectedNodeId]);

  useEffect(() => {
    const pendingSnapshot = pendingSnapshotRef.current;

    if (!pendingSnapshot) {
      return;
    }

    pendingSnapshotRef.current = null;
    onSnapshotChangeRef.current?.(pendingSnapshot);
  }, [tree]);

  function switchModule(moduleId: string) {
    if (isInteractionLocked) {
      return;
    }

    if (!tree.nodes[moduleId]) {
      return;
    }

    const nextSelectedNodeId = isNodeWithinModule(tree, selectedNodeId, moduleId)
      ? selectedNodeId
      : getDefaultSelectedNodeId(tree, moduleId);

    setCurrentModuleId(moduleId);
    setSelectedNodeId(nextSelectedNodeId);
    setExpandedNodeIds(buildExpandedNodeIds(tree, moduleId));
    setOperationError(null);
  }

  function selectNode(nodeId: string) {
    if (isInteractionLocked) {
      return;
    }

    if (!tree.nodes[nodeId]) {
      return;
    }

    const nextModuleId = resolveModuleId(tree, nodeId, currentModuleId);

    setCurrentModuleId(nextModuleId);
    setSelectedNodeId(nodeId);
    setExpandedNodeIds((previousExpandedNodeIds) =>
      syncExpandedNodeIds(
        previousExpandedNodeIds,
        tree,
        nextModuleId,
        nodeId,
      ),
    );
    setOperationError(null);
  }

  function toggleNodeExpanded(nodeId: string) {
    if (isInteractionLocked) {
      return;
    }

    setExpandedNodeIds((previousExpandedNodeIds) => {
      const nextExpandedNodeIds = new Set(previousExpandedNodeIds);

      if (nextExpandedNodeIds.has(nodeId)) {
        nextExpandedNodeIds.delete(nodeId);
      } else {
        nextExpandedNodeIds.add(nodeId);
      }

      return nextExpandedNodeIds;
    });
  }

  function updateNode(nodeId: string, patch: NodeContentPatch) {
    if (isInteractionLocked) {
      return;
    }

    setTree((previousTree) => {
      const patchedTree = applyNodePatch(previousTree, nodeId, patch);
      const nextTree = shouldSkipPlanStepStatusReconciliation(patch)
        ? patchedTree
        : reconcilePlanStepStatuses(patchedTree);

      if (nextTree !== previousTree) {
        pendingSnapshotRef.current = createNextSnapshot(initialSnapshot, nextTree);
      }

      return nextTree;
    });
  }

  function toggleSelectedNodeTag(tagId: string) {
    if (isInteractionLocked || !selectedNodeId) {
      return;
    }

    setTree((previousTree) => {
      if (!previousTree.nodes[selectedNodeId]) {
        return previousTree;
      }

      const normalizedTree = ensureBuiltinTags(previousTree);
      const selectedNode = getNodeOrThrow(normalizedTree, selectedNodeId);
      const nextTree = reconcilePlanStepStatuses(
        selectedNode.tagIds.includes(tagId)
          ? detachTagFromNode(normalizedTree, selectedNodeId, tagId)
          : attachTagToNode(normalizedTree, selectedNodeId, tagId),
      );

      pendingSnapshotRef.current = createNextSnapshot(initialSnapshot, nextTree);

      return nextTree;
    });
    setOperationError(null);
  }

  function createModule() {
    if (isInteractionLocked) {
      return;
    }

    const nextNode = createNode({
      type: 'module',
      title: buildNextModuleTitle(tree),
      content:
        moduleNodes.length === 0
          ? FIRST_MODULE_CONTENT
          : FOLLOW_UP_MODULE_CONTENT,
    });

    runStructuralOperation(
      () => {
        const nextTree = operations.insertChildNode(
          tree,
          tree.rootId,
          nextNode,
          getModuleInsertIndex(tree),
        );

        return {
          nextTree,
          nextSelectedNodeId: nextNode.id,
          preferredModuleId: nextNode.id,
        };
      },
      '创建模块失败，请稍后重试。',
    );
  }

  function runLearningAction(actionId: LearningActionId) {
    if (isInteractionLocked) {
      return;
    }

    const isHandledByExternalRuntime = requestExternalLearningAction(
      actionId,
      selectedNodeId,
    );

    if (isHandledByExternalRuntime) {
      setOperationError(null);
      return;
    }

    const placement = resolveLearningActionPlacement(tree, selectedNodeId, actionId);

    if (!placement) {
      return;
    }

    const nextNode = createLearningActionNode(actionId, placement);

    runStructuralOperation(
      () => {
        const nextTree = operations.insertChildNode(
          tree,
          placement.parentNodeId,
          nextNode,
          placement.insertIndex,
        );

        return {
          nextSelectedNodeId: nextNode.id,
          nextTree,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '学习动作执行失败，请检查当前节点。',
    );
  }

  function insertChildAtSelection() {
    if (isInteractionLocked) {
      return;
    }

    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const parentNode = getNodeOrThrow(tree, selectedNodeId);
    const nextNodeType =
      selectedChildInsertType ??
      getPreferredChildInsertType(tree, selectedNodeId) ??
      getDefaultChildType(parentNode.type);

    if (!nextNodeType) {
      return;
    }

    const nextNode = createEditorNode(nextNodeType, parentNode.id, {
      judgmentKind: nextNodeType === 'judgment' ? 'manual' : undefined,
      summaryKind:
        nextNodeType === 'summary'
          ? parentNode.type === 'plan-step'
            ? 'scaffold'
            : 'manual'
          : undefined,
    });

    runStructuralOperation(
      () => {
        const nextTree = operations.insertChildNode(tree, parentNode.id, nextNode);

        return {
          nextTree,
          nextSelectedNodeId: nextNode.id,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '结构操作失败，请检查当前节点。',
    );
  }

  function insertSiblingAtSelection() {
    if (isInteractionLocked) {
      return;
    }

    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const selectedTreeNode = getNodeOrThrow(tree, selectedNodeId);

    if (selectedTreeNode.type === 'theme-root') {
      return;
    }

    if (selectedTreeNode.parentId === null) {
      return;
    }

    const nextNodeType =
      selectedSiblingInsertType ??
      getPreferredSiblingInsertType(tree, selectedNodeId) ??
      selectedTreeNode.type;
    const siblingParentNode = getNodeOrThrow(tree, selectedTreeNode.parentId);
    const nextNode = createEditorNode(nextNodeType, selectedTreeNode.parentId, {
      judgmentKind: nextNodeType === 'judgment' ? 'manual' : undefined,
      summaryKind:
        nextNodeType === 'summary'
          ? siblingParentNode.type === 'plan-step'
            ? 'scaffold'
            : 'manual'
          : undefined,
    });

    runStructuralOperation(
      () => {
        const nextTree = operations.insertSiblingNode(
          tree,
          selectedTreeNode.id,
          nextNode,
        );

        return {
          nextTree,
          nextSelectedNodeId: nextNode.id,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '结构操作失败，请检查当前节点。',
    );
  }

  function deleteSelection() {
    if (isInteractionLocked) {
      return;
    }

    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const selectedTreeNode = getNodeOrThrow(tree, selectedNodeId);
    const fallbackNodeId =
      selectedTreeNode.parentId ?? resolveModuleId(tree, selectedNodeId, currentModuleId);

    runStructuralOperation(
      () => {
        const nextTree = operations.deleteNode(tree, selectedTreeNode.id);

        return {
          nextTree,
          nextSelectedNodeId: fallbackNodeId,
          preferredModuleId: resolveModuleId(nextTree, fallbackNodeId, currentModuleId),
        };
      },
      '结构操作失败，请检查当前节点。',
    );
  }

  function liftSelection() {
    if (isInteractionLocked) {
      return;
    }

    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    runStructuralOperation(
      () => {
        const nextTree = operations.liftNode(tree, selectedNodeId);

        return {
          nextTree,
          nextSelectedNodeId: selectedNodeId,
          preferredModuleId: resolveModuleId(nextTree, selectedNodeId, currentModuleId),
        };
      },
      '结构操作失败，请检查当前节点。',
    );
  }

  function lowerSelection() {
    if (isInteractionLocked) {
      return;
    }

    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    runStructuralOperation(
      () => {
        const nextTree = operations.lowerNode(tree, selectedNodeId);

        return {
          nextTree,
          nextSelectedNodeId: selectedNodeId,
          preferredModuleId: resolveModuleId(nextTree, selectedNodeId, currentModuleId),
        };
      },
      '结构操作失败，请检查当前节点。',
    );
  }

  function insertAnswerForQuestion(questionNodeId: string) {
    if (isInteractionLocked) {
      return;
    }

    const placement = resolveLearningActionPlacement(
      tree,
      questionNodeId,
      'insert-answer',
    );

    if (!placement) {
      return;
    }

    const nextNode = createEditorNode('answer', questionNodeId);

    runStructuralOperation(
      () => {
        const insertedTree = operations.insertChildNode(
          tree,
          placement.parentNodeId,
          nextNode,
          placement.insertIndex,
        );
        const nextTree = setQuestionCurrentAnswerId(
          insertedTree,
          questionNodeId,
          nextNode.id,
        );

        return {
          nextSelectedNodeId: nextNode.id,
          nextTree,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '插入回答失败，请检查当前问题节点。',
    );
  }

  function insertFollowUpQuestion(
    questionNodeId: string,
    options?: {
      sourceNodeId?: string | null;
    },
  ) {
    if (isInteractionLocked || !tree.nodes[questionNodeId]) {
      return;
    }

    const questionNode = getNodeOrThrow(tree, questionNodeId);

    if (questionNode.type !== 'question') {
      return;
    }

    const nextNode = createEditorNode('question', questionNodeId, {
      sourceContext: buildQuestionSourceContext(
        tree,
        questionNodeId,
        options?.sourceNodeId ?? questionNodeId,
      ),
    });

    runStructuralOperation(
      () => {
        const nextTree = operations.insertChildNode(
          tree,
          questionNodeId,
          nextNode,
          questionNode.childIds.length,
        );

        return {
          nextSelectedNodeId: nextNode.id,
          nextTree,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '插入追问失败，请检查当前问题节点。',
    );
  }

  function insertSummaryForQuestion(questionNodeId: string) {
    if (isInteractionLocked) {
      return;
    }

    const placement = resolveLearningActionPlacement(
      tree,
      questionNodeId,
      'insert-summary',
    );

    if (!placement) {
      return;
    }

    const nextNode = createEditorNode('summary', questionNodeId, {
      summaryKind: 'manual',
    });

    runStructuralOperation(
      () => {
        const nextTree = operations.insertChildNode(
          tree,
          placement.parentNodeId,
          nextNode,
          placement.insertIndex,
        );

        return {
          nextSelectedNodeId: nextNode.id,
          nextTree,
          preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
        };
      },
      '插入总结失败，请检查当前问题节点。',
    );
  }

  function setCurrentAnswer(questionNodeId: string, answerNodeId: string) {
    if (isInteractionLocked) {
      return;
    }

    runStructuralOperation(
      () => {
        const nextTree = setQuestionCurrentAnswerId(
          tree,
          questionNodeId,
          answerNodeId,
        );

        return {
          nextSelectedNodeId: answerNodeId,
          nextTree,
          preferredModuleId: resolveModuleId(nextTree, answerNodeId, currentModuleId),
        };
      },
      '设为当前回答失败，请检查问题与回答的归属关系。',
    );
  }

  function registerNodeElement(nodeId: string, element: HTMLElement | null) {
    if (!element) {
      nodeElementMapRef.current.delete(nodeId);
      return;
    }

    nodeElementMapRef.current.set(nodeId, element);
  }

  function runStructuralOperation(
    executor: () => {
      nextTree: NodeTree;
      nextSelectedNodeId?: string | null;
      preferredModuleId?: string | null;
    },
    fallbackMessage: string,
  ) {
    try {
      const result = executor();

      commitTreeChange(result.nextTree, {
        nextSelectedNodeId: result.nextSelectedNodeId,
        preferredModuleId: result.preferredModuleId,
      });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : fallbackMessage);
    }
  }

  function applyTreeChange(
    nextTree: NodeTree,
    options?: ExternalTreeChangeOptions,
  ) {
    commitTreeChange(nextTree, {
      nextSelectedNodeId: options?.nextSelectedNodeId ?? selectedNodeId,
      preferredModuleId: options?.preferredModuleId ?? currentModuleId,
    });
  }

  function commitTreeChange(
    nextTree: NodeTree,
    options: {
      nextSelectedNodeId?: string | null;
      preferredModuleId?: string | null;
    },
  ) {
    try {
      const reconciledTree = reconcilePlanStepStatuses(nextTree);
      const nextModuleId = resolveModuleId(
        reconciledTree,
        options.nextSelectedNodeId,
        options.preferredModuleId ?? currentModuleId,
      );
      const nextSelectedNodeId = resolveSelectedNodeId(
        reconciledTree,
        options.nextSelectedNodeId,
        nextModuleId,
      );

      setTree(reconciledTree);
      setCurrentModuleId(nextModuleId);
      setSelectedNodeId(nextSelectedNodeId);
      setExpandedNodeIds((previousExpandedNodeIds) =>
        syncExpandedNodeIds(
          previousExpandedNodeIds,
          reconciledTree,
          nextModuleId,
          nextSelectedNodeId,
        ),
      );
      setOperationError(null);
      pendingSnapshotRef.current = createNextSnapshot(initialSnapshot, reconciledTree);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : '结构操作失败，请检查当前节点。',
      );
    }
  }

  function requestExternalLearningAction(
    actionId: LearningActionId,
    anchorNodeId: string | null,
  ) {
    if (!anchorNodeId || !tree.nodes[anchorNodeId]) {
      return false;
    }

    const placement = resolveLearningActionPlacement(tree, anchorNodeId, actionId);

    if (!placement) {
      return false;
    }

    return (
      onLearningActionRequest?.({
        actionId,
        currentModuleId: resolveModuleId(tree, anchorNodeId, currentModuleId),
        placement,
        selectedNodeId: anchorNodeId,
        tree,
      }) === true
    );
  }

  return {
    actionAvailability,
    currentModule,
    currentModuleId,
    childInsertOptions,
    createModule,
    expandedNodeIds,
    insertAnswerForQuestion,
    insertFollowUpQuestion,
    insertSummaryForQuestion,
    learningActions,
    moduleNodes,
    operationError,
    applyTreeChange,
    registerNodeElement,
    selectNode,
    selectedChildInsertType,
    selectedNode,
    selectedNodeId,
    selectedNodeTypeSwitchOptions,
    selectedSiblingInsertType,
    setSelectedChildInsertType,
    setSelectedSiblingInsertType,
    siblingInsertOptions,
    switchModule,
    toggleNodeExpanded,
    tree,
    toggleSelectedNodeTag,
    updateNode,
    setCurrentAnswer,
    workspaceTitle: initialSnapshot.workspace.title,
    insertChildAtSelection,
    insertSiblingAtSelection,
    runLearningAction,
    deleteSelection,
    liftSelection,
    lowerSelection,
    switchSelectedNodeType,
  };

  function switchSelectedNodeType(
    nextNodeType: (typeof SWITCHABLE_LEAF_NODE_TYPES)[number],
  ) {
    if (isInteractionLocked || !selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    runStructuralOperation(
      () => {
        const nextTree = switchNodeTypeInDomain(
          tree,
          selectedNodeId,
          nextNodeType,
        );

        return {
          nextTree,
          nextSelectedNodeId: selectedNodeId,
          preferredModuleId: resolveModuleId(nextTree, selectedNodeId, currentModuleId),
        };
      },
      '节点类型切换失败，请检查当前节点。',
    );
  }
}

function createNextSnapshot(
  snapshot: WorkspaceSnapshot,
  tree: NodeTree,
): WorkspaceSnapshot {
  return {
    workspace: {
      ...snapshot.workspace,
      updatedAt: new Date().toISOString(),
    },
    tree,
  };
}

function createEditorNode(
  nodeType: NonRootNode['type'],
  parentNodeId: string | null,
  options?: {
    content?: string;
    judgmentKind?: 'manual';
    sourceContext?: Extract<TreeNode, { type: 'question' }>['sourceContext'];
    summaryKind?: 'answer-closure' | 'manual' | 'scaffold';
    title?: string;
  },
): NonRootNode {
  const nodeTitle = options?.title ?? getDefaultTitleForType(nodeType);
  const nodeContent = options?.content ?? '';

  if (nodeType === 'resource-fragment') {
    return createNode({
      type: 'resource-fragment',
      title: nodeTitle,
      content: nodeContent,
      sourceResourceId: parentNodeId ?? '',
      excerpt: '后续在资料区承接真实摘录内容。',
    });
  }

  if (nodeType === 'summary') {
    return createNode({
      type: 'summary',
      title: nodeTitle,
      content: nodeContent,
      summaryKind: options?.summaryKind,
    });
  }

  if (nodeType === 'judgment') {
    return createNode({
      type: 'judgment',
      title: nodeTitle,
      content: nodeContent,
      judgmentKind: options?.judgmentKind,
    });
  }

  return createNode({
    type: nodeType,
    title: nodeTitle,
    content: nodeContent,
    ...(nodeType === 'question' && options?.sourceContext
      ? { sourceContext: options.sourceContext }
      : {}),
  });
}

function createLearningActionNode(
  actionId: LearningActionId,
  placement: LearningActionPlacement,
) {
  return createEditorNode(placement.nodeType, placement.parentNodeId, {
    content: getLearningActionStarterContent(actionId),
    judgmentKind: actionId === 'insert-judgment' ? 'manual' : undefined,
    summaryKind: resolveLearningActionSummaryKind(actionId),
    title: placement.title,
  });
}

function getLearningActionStarterContent(actionId: LearningActionId) {
  switch (actionId) {
    case 'insert-plan-step':
      return '';
    case 'insert-scaffold':
      return '先交代这一小步为什么值得先学，再点出后面会继续追问的关键概念、关系或判断线索。';
    case 'rephrase-scaffold':
      return '换个更直白的说法，把同一件事再解释一次，尽量减少术语堆叠。';
    case 'simplify-scaffold':
      return '先退回更基础的直觉或日常语言，再把它接回当前步骤的问题。';
    case 'add-example':
      return '给当前铺垫补一个具体情境或例子，让抽象关系更容易看懂。';
    case 'insert-question':
      return '请围绕当前步骤补一个真正可判断是否答到的具体问题，优先只检查一个关键理解点。';
    case 'insert-answer':
      return '';
    case 'insert-summary':
      return '先把当前问题真正要说明的对象、关系和判断线索讲清楚，再决定是否补充例子或边界。';
    case 'insert-judgment':
      return '先判断当前理解最可能已经答到了什么、还缺什么，再决定是否需要继续追问。';
    case 'insert-resource-fragment':
      return '';
  }
}

function getModuleInsertIndex(tree: NodeTree) {
  const rootNode = getNodeOrThrow(tree, tree.rootId);
  const firstResourceIndex = rootNode.childIds.findIndex(
    (childId) => tree.nodes[childId]?.type === 'resource',
  );

  return firstResourceIndex === -1
    ? rootNode.childIds.length
    : firstResourceIndex;
}

function buildNextModuleTitle(tree: NodeTree) {
  const existingTitles = new Set(getModuleNodes(tree).map((node) => node.title));

  for (let index = 0; ; index += 1) {
    const candidateTitle = index === 0 ? '新模块' : `新模块 ${String(index + 1)}`;

    if (!existingTitles.has(candidateTitle)) {
      return candidateTitle;
    }
  }
}

function resolveModuleId(
  tree: NodeTree,
  preferredNodeId: string | null | undefined,
  fallbackModuleId: string | null | undefined,
) {
  if (preferredNodeId && tree.nodes[preferredNodeId]) {
    const preferredNode = getNodeOrThrow(tree, preferredNodeId);

    if (preferredNode.type === 'module') {
      return preferredNode.id;
    }

    const moduleScopeId = getModuleScopeId(tree, preferredNode.id);

    if (moduleScopeId) {
      return moduleScopeId;
    }
  }

  if (fallbackModuleId && tree.nodes[fallbackModuleId]?.type === 'module') {
    return fallbackModuleId;
  }

  return getModuleNodes(tree)[0]?.id ?? null;
}

function resolveSelectedNodeId(
  tree: NodeTree,
  preferredNodeId: string | null | undefined,
  moduleId: string | null,
) {
  if (
    preferredNodeId &&
    tree.nodes[preferredNodeId] &&
    isNodeWithinModule(tree, preferredNodeId, moduleId)
  ) {
    return preferredNodeId;
  }

  return getDefaultSelectedNodeId(tree, moduleId);
}

function syncExpandedNodeIds(
  previousExpandedNodeIds: Set<string>,
  tree: NodeTree,
  moduleId: string | null,
  selectedNodeId: string | null,
) {
  const nextExpandedNodeIds = new Set<string>();

  for (const nodeId of previousExpandedNodeIds) {
    if (tree.nodes[nodeId]?.childIds.length) {
      nextExpandedNodeIds.add(nodeId);
    }
  }

  if (moduleId && tree.nodes[moduleId]?.childIds.length) {
    nextExpandedNodeIds.add(moduleId);
  }

  if (selectedNodeId) {
    for (const pathNode of getNodePath(tree, selectedNodeId)) {
      if (pathNode.childIds.length > 0) {
        nextExpandedNodeIds.add(pathNode.id);
      }
    }
  }

  return nextExpandedNodeIds;
}

export function getActionAvailability(
  tree: NodeTree,
  selectedNodeId: string | null,
): EditorActionAvailability {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return {
      canInsertChild: false,
      canInsertSibling: false,
      canDelete: false,
      canLift: false,
      canLower: false,
    };
  }

  const node = getNodeOrThrow(tree, selectedNodeId);

  if (node.type === 'theme-root') {
    return {
      canInsertChild: false,
      canInsertSibling: false,
      canDelete: false,
      canLift: false,
      canLower: false,
    };
  }

  return {
    canInsertChild: canNodeHaveChildren(node.type),
    canInsertSibling: node.parentId !== null,
    canDelete: true,
    canLift: canLiftNode(tree, node),
    canLower: canLowerNode(tree, node),
  };
}

function getLockedActionAvailability(): EditorActionAvailability {
  return {
    canDelete: false,
    canInsertChild: false,
    canInsertSibling: false,
    canLift: false,
    canLower: false,
  };
}

function getInsertableChildTypes(
  tree: NodeTree,
  selectedNodeId: string | null,
): NonRootNode['type'][] {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return [];
  }

  const node = getNodeOrThrow(tree, selectedNodeId);

  if (node.type === 'theme-root') {
    return [];
  }

  return getAllowedChildTypes(node.type) as NonRootNode['type'][];
}

function getInsertableSiblingTypes(
  tree: NodeTree,
  selectedNodeId: string | null,
): NonRootNode['type'][] {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return [];
  }

  const node = getNodeOrThrow(tree, selectedNodeId);

  if (node.parentId === null) {
    return [];
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);

  return getAllowedChildTypes(parentNode.type) as NonRootNode['type'][];
}

function getSwitchableNodeTypes(
  tree: NodeTree,
  selectedNodeId: string | null,
): (typeof SWITCHABLE_LEAF_NODE_TYPES)[number][] {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return [];
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (
    selectedNode.parentId === null ||
    selectedNode.childIds.length > 0 ||
    !SWITCHABLE_LEAF_NODE_TYPES.includes(
      selectedNode.type as (typeof SWITCHABLE_LEAF_NODE_TYPES)[number],
    )
  ) {
    return [];
  }

  const parentNode = getNodeOrThrow(tree, selectedNode.parentId);

  return SWITCHABLE_LEAF_NODE_TYPES.filter((nodeType) =>
    canParentAcceptChild(parentNode.type, nodeType),
  );
}

function getInsertTypeOptions(
  nodeTypes: NonRootNode['type'][],
): EditorInsertTypeOption[] {
  return [...nodeTypes]
    .sort(compareInsertTypes)
    .map((nodeType) => ({
      label: getDefaultTitleForType(nodeType).replace(/^新/u, ''),
      value: nodeType,
    }));
}

function resolveInsertTypeSelection(
  previousType: NonRootNode['type'] | null,
  options: EditorInsertTypeOption[],
  preferredType: NonRootNode['type'] | null,
) {
  if (previousType && options.some((option) => option.value === previousType)) {
    return previousType;
  }

  if (preferredType && options.some((option) => option.value === preferredType)) {
    return preferredType;
  }

  return options[0]?.value ?? null;
}

function getPreferredChildInsertType(
  tree: NodeTree,
  selectedNodeId: string | null,
): NonRootNode['type'] | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const node = getNodeOrThrow(tree, selectedNodeId);
  const allowedChildTypes = getInsertableChildTypes(tree, selectedNodeId);

  if (node.type === 'question' && allowedChildTypes.includes('answer')) {
    return 'answer';
  }

  if (node.type === 'plan-step' && allowedChildTypes.includes('question')) {
    return 'question';
  }

  if (node.type === 'module' && allowedChildTypes.includes('plan-step')) {
    return 'plan-step';
  }

  if (node.type === 'resource' && allowedChildTypes.includes('resource-fragment')) {
    return 'resource-fragment';
  }

  return allowedChildTypes[0] ?? null;
}

function getPreferredSiblingInsertType(
  tree: NodeTree,
  selectedNodeId: string | null,
): NonRootNode['type'] | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const node = getNodeOrThrow(tree, selectedNodeId);
  const allowedSiblingTypes = getInsertableSiblingTypes(tree, selectedNodeId);

  if (
    node.type !== 'theme-root' &&
    allowedSiblingTypes.includes(node.type as NonRootNode['type'])
  ) {
    return node.type as NonRootNode['type'];
  }

  return allowedSiblingTypes[0] ?? null;
}

function compareInsertTypes(leftType: NonRootNode['type'], rightType: NonRootNode['type']) {
  return getInsertTypeSortOrder(leftType) - getInsertTypeSortOrder(rightType);
}

function getInsertTypeSortOrder(nodeType: NonRootNode['type']) {
  switch (nodeType) {
    case 'module':
      return 0;
    case 'plan-step':
      return 1;
    case 'question':
      return 2;
    case 'answer':
      return 3;
    case 'summary':
      return 4;
    case 'judgment':
      return 5;
    case 'resource':
      return 6;
    case 'resource-fragment':
      return 7;
  }
}

function canLiftNode(tree: NodeTree, node: TreeNode) {
  if (node.parentId === null) {
    return false;
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);

  if (parentNode.parentId === null) {
    return false;
  }

  const grandparentNode = getNodeOrThrow(tree, parentNode.parentId);

  return canTargetParentAcceptNode(node, grandparentNode);
}

function canLowerNode(tree: NodeTree, node: TreeNode) {
  if (node.parentId === null || node.order === 0) {
    return false;
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);
  const previousSiblingNodeId = parentNode.childIds[node.order - 1];

  if (!previousSiblingNodeId || !tree.nodes[previousSiblingNodeId]) {
    return false;
  }

  const previousSiblingNode = getNodeOrThrow(tree, previousSiblingNodeId);

  return canTargetParentAcceptNode(node, previousSiblingNode);
}

function canTargetParentAcceptNode(node: TreeNode, targetParentNode: TreeNode) {
  const targetNodeType = getEffectiveTargetNodeType(node, targetParentNode);

  if (!targetNodeType) {
    return false;
  }

  return canParentAcceptChild(targetParentNode.type, targetNodeType);
}

function getEffectiveTargetNodeType(
  node: TreeNode,
  targetParentNode: TreeNode,
): TreeNode['type'] | null {
  if (targetParentNode.type !== 'theme-root') {
    return node.type;
  }

  if (node.type === 'resource-fragment') {
    return null;
  }

  if (shouldConvertToModuleAtRoot(node.type)) {
    return 'module';
  }

  return node.type;
}

function applyNodePatch(tree: NodeTree, nodeId: string, patch: NodeContentPatch) {
  if (!tree.nodes[nodeId]) {
    return tree;
  }

  const nextTree = structuredClone(tree);
  const nextNode = getNodeOrThrow(nextTree, nodeId);

  if (patch.title !== undefined) {
    nextNode.title = stripRedundantDisplayTypePrefix(
      patch.title,
      getDisplayNodeTypeLabel(tree, getNodeOrThrow(tree, nodeId)),
    );
  }

  if (patch.content !== undefined) {
    nextNode.content = patch.content;
  }

  if (patch.status !== undefined && nextNode.type === 'plan-step') {
    (nextNode as PlanStepNode).status = patch.status;
  }

  nextNode.updatedAt = new Date().toISOString();

  return nextTree;
}

function setQuestionCurrentAnswerId(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
) {
  const questionNode = tree.nodes[questionNodeId];
  const answerNode = tree.nodes[answerNodeId];

  if (
    questionNode?.type !== 'question' ||
    answerNode?.type !== 'answer' ||
    answerNode.parentId !== questionNodeId ||
    questionNode.currentAnswerId === answerNodeId
  ) {
    return tree;
  }

  const nextTree = cloneNodeTree(tree);
  const nextQuestionNode = getNodeOrThrow(nextTree, questionNodeId);

  if (nextQuestionNode.type !== 'question') {
    return tree;
  }

  nextQuestionNode.currentAnswerId = answerNodeId;
  nextQuestionNode.updatedAt = new Date().toISOString();

  return nextTree;
}

function resolveLearningActionSummaryKind(actionId: LearningActionId) {
  switch (actionId) {
    case 'insert-scaffold':
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
      return 'scaffold' as const;
    case 'insert-summary':
      return 'manual' as const;
    default:
      return undefined;
  }
}

function buildQuestionSourceContext(
  tree: NodeTree,
  questionNodeId: string,
  sourceNodeId: string,
) {
  const sourceNode = tree.nodes[sourceNodeId];

  if (
    !sourceNode ||
    (sourceNode.type !== 'question' &&
      sourceNode.type !== 'answer' &&
      sourceNode.type !== 'summary' &&
      sourceNode.type !== 'judgment')
  ) {
    return undefined;
  }

  if (sourceNode.type === 'question') {
    if (sourceNode.id !== questionNodeId) {
      return undefined;
    }
  } else if (sourceNode.parentId !== questionNodeId) {
    return undefined;
  }

  return {
    content: sourceNode.content,
    nodeId: sourceNode.id,
    nodeType: sourceNode.type,
    title: sourceNode.title,
    updatedAt: sourceNode.updatedAt,
  } satisfies NonNullable<Extract<TreeNode, { type: 'question' }>['sourceContext']>;
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}
