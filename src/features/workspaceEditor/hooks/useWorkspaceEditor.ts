import { useEffect, useRef, useState } from 'react';

import {
  reconcilePlanStepStatuses,
  shouldSkipPlanStepStatusReconciliation,
} from '../../learningEngine';

import {
  attachTagToNode,
  canParentAcceptChild,
  canNodeHaveChildren,
  createNode,
  deleteNode,
  detachTagFromNode,
  ensureBuiltinTags,
  getAllowedChildTypes,
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
  type TreeNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import type {
  EditorActionAvailability,
  EditorInsertTypeOption,
  ExternalTreeChangeOptions,
  NodeContentPatch,
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

const FIRST_MODULE_CONTENT = '先定义当前主题下的第一个学习方向。';
const FOLLOW_UP_MODULE_CONTENT = '补充这个模块的学习目标、边界或导读。';

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
        onSnapshotChange?.(
          createNextSnapshot(initialSnapshot, nextTree),
        );
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

      onSnapshotChange?.(createNextSnapshot(initialSnapshot, nextTree));

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

    const nextNode = createEditorNode(nextNodeType, parentNode.id);

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

    const nextNodeType =
      selectedSiblingInsertType ??
      getPreferredSiblingInsertType(tree, selectedNodeId) ??
      selectedTreeNode.type;
    const nextNode = createEditorNode(nextNodeType, selectedTreeNode.parentId);

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
      onSnapshotChange?.(createNextSnapshot(initialSnapshot, reconciledTree));
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : '结构操作失败，请检查当前节点。',
      );
    }
  }

  return {
    actionAvailability,
    currentModule,
    currentModuleId,
    childInsertOptions,
    createModule,
    expandedNodeIds,
    moduleNodes,
    operationError,
    applyTreeChange,
    registerNodeElement,
    selectNode,
    selectedChildInsertType,
    selectedNode,
    selectedNodeId,
    selectedSiblingInsertType,
    setSelectedChildInsertType,
    setSelectedSiblingInsertType,
    siblingInsertOptions,
    switchModule,
    toggleNodeExpanded,
    tree,
    toggleSelectedNodeTag,
    updateNode,
    workspaceTitle: initialSnapshot.workspace.title,
    insertChildAtSelection,
    insertSiblingAtSelection,
    deleteSelection,
    liftSelection,
    lowerSelection,
  };
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
): NonRootNode {
  if (nodeType === 'resource-fragment') {
    return createNode({
      type: 'resource-fragment',
      title: getDefaultTitleForType(nodeType),
      content: '',
      sourceResourceId: parentNodeId ?? '',
      excerpt: '后续在资料区承接真实摘录内容。',
    });
  }

  return createNode({
    type: nodeType,
    title: getDefaultTitleForType(nodeType),
    content: '',
  });
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
    nextNode.title = patch.title;
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
