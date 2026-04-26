import { useEffect, useRef, useState } from 'react';

import {
  canNodeHaveChildren,
  createNode,
  deleteNode,
  getModuleScopeId,
  getNodeOrThrow,
  insertChildNode,
  insertSiblingNode,
  liftNode,
  lowerNode,
  type NodeTree,
  type NonRootNode,
  type PlanStepNode,
} from '../../nodeDomain';
import type {
  EditorActionAvailability,
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
  operations = defaultWorkspaceEditorOperations,
}: WorkspaceEditorProps) {
  const [tree, setTree] = useState(initialSnapshot.tree);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(() =>
    resolveModuleId(
      initialSnapshot.tree,
      initialSelectedNodeId,
      initialModuleId,
    ),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const resolvedModuleId = resolveModuleId(
      initialSnapshot.tree,
      initialSelectedNodeId,
      initialModuleId,
    );

    return resolveSelectedNodeId(
      initialSnapshot.tree,
      initialSelectedNodeId,
      resolvedModuleId,
    );
  });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    buildExpandedNodeIds(initialSnapshot.tree, initialModuleId),
  );
  const [operationError, setOperationError] = useState<string | null>(null);
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
  const actionAvailability = getActionAvailability(tree, selectedNodeId);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const nodeElement = nodeElementMapRef.current.get(selectedNodeId);

    nodeElement?.focus();
  }, [selectedNodeId, tree]);

  function switchModule(moduleId: string) {
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
    setTree((previousTree) => applyNodePatch(previousTree, nodeId, patch));
  }

  function insertChildAtSelection() {
    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const parentNode = getNodeOrThrow(tree, selectedNodeId);
    const nextNodeType = getDefaultChildType(parentNode.type);

    if (!nextNodeType) {
      return;
    }

    const nextNode = createEditorNode(nextNodeType, parentNode.id);
    const nextTree = operations.insertChildNode(tree, parentNode.id, nextNode);

    commitTreeChange(nextTree, {
      nextSelectedNodeId: nextNode.id,
      preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
    });
  }

  function insertSiblingAtSelection() {
    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const selectedTreeNode = getNodeOrThrow(tree, selectedNodeId);

    if (selectedTreeNode.type === 'theme-root') {
      return;
    }

    const nextNode = createEditorNode(selectedTreeNode.type, selectedTreeNode.parentId);
    const nextTree = operations.insertSiblingNode(tree, selectedTreeNode.id, nextNode);

    commitTreeChange(nextTree, {
      nextSelectedNodeId: nextNode.id,
      preferredModuleId: resolveModuleId(nextTree, nextNode.id, currentModuleId),
    });
  }

  function deleteSelection() {
    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const selectedTreeNode = getNodeOrThrow(tree, selectedNodeId);
    const fallbackNodeId =
      selectedTreeNode.parentId ?? resolveModuleId(tree, selectedNodeId, currentModuleId);
    const nextTree = operations.deleteNode(tree, selectedTreeNode.id);

    commitTreeChange(nextTree, {
      nextSelectedNodeId: fallbackNodeId,
      preferredModuleId: resolveModuleId(nextTree, fallbackNodeId, currentModuleId),
    });
  }

  function liftSelection() {
    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const nextTree = operations.liftNode(tree, selectedNodeId);

    commitTreeChange(nextTree, {
      nextSelectedNodeId: selectedNodeId,
      preferredModuleId: resolveModuleId(nextTree, selectedNodeId, currentModuleId),
    });
  }

  function lowerSelection() {
    if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
      return;
    }

    const nextTree = operations.lowerNode(tree, selectedNodeId);

    commitTreeChange(nextTree, {
      nextSelectedNodeId: selectedNodeId,
      preferredModuleId: resolveModuleId(nextTree, selectedNodeId, currentModuleId),
    });
  }

  function registerNodeElement(nodeId: string, element: HTMLElement | null) {
    if (!element) {
      nodeElementMapRef.current.delete(nodeId);
      return;
    }

    nodeElementMapRef.current.set(nodeId, element);
  }

  function commitTreeChange(
    nextTree: NodeTree,
    options: {
      nextSelectedNodeId?: string | null;
      preferredModuleId?: string | null;
    },
  ) {
    try {
      const nextModuleId = resolveModuleId(
        nextTree,
        options.nextSelectedNodeId,
        options.preferredModuleId ?? currentModuleId,
      );
      const nextSelectedNodeId = resolveSelectedNodeId(
        nextTree,
        options.nextSelectedNodeId,
        nextModuleId,
      );

      setTree(nextTree);
      setCurrentModuleId(nextModuleId);
      setSelectedNodeId(nextSelectedNodeId);
      setExpandedNodeIds((previousExpandedNodeIds) =>
        syncExpandedNodeIds(
          previousExpandedNodeIds,
          nextTree,
          nextModuleId,
          nextSelectedNodeId,
        ),
      );
      setOperationError(null);
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
    expandedNodeIds,
    moduleNodes,
    operationError,
    registerNodeElement,
    selectNode,
    selectedNode,
    selectedNodeId,
    switchModule,
    toggleNodeExpanded,
    tree,
    updateNode,
    workspaceTitle: initialSnapshot.workspace.title,
    insertChildAtSelection,
    insertSiblingAtSelection,
    deleteSelection,
    liftSelection,
    lowerSelection,
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

function getActionAvailability(
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

  const parentNode = node.parentId ? getNodeOrThrow(tree, node.parentId) : null;

  return {
    canInsertChild: canNodeHaveChildren(node.type),
    canInsertSibling: node.parentId !== null,
    canDelete: true,
    canLift: parentNode !== null && parentNode.parentId !== null,
    canLower: node.order > 0,
  };
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
