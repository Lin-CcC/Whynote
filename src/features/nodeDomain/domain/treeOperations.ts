import { NodeDomainError } from './nodeErrors';
import { canParentAcceptChild, shouldConvertToModuleAtRoot } from './treeConstraints';
import {
  cloneNodeTree,
  getNodeOrThrow,
  getSubtreeNodeIds,
  isDescendantNode,
} from './treeDocument';
import type { ModuleNode, NodeTree, NonRootNode, TreeNode } from './nodeTypes';

export function insertChildNode(
  tree: NodeTree,
  parentNodeId: string,
  node: NonRootNode,
  index?: number,
) {
  if (tree.nodes[node.id]) {
    throw new NodeDomainError('DUPLICATE_NODE_ID', `节点 ${node.id} 已存在。`, {
      nodeId: node.id,
    });
  }

  const nextTree = cloneNodeTree(tree);
  const parentNode = getNodeOrThrow(nextTree, parentNodeId);
  const insertIndex = normalizeInsertIndex(index, parentNode.childIds.length);

  if (!canParentAcceptChild(parentNode.type, node.type)) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `节点 ${parentNode.type} 不能插入子节点 ${node.type}。`,
      {
        parentNodeId,
        nodeType: node.type,
      },
    );
  }

  const nextNode = {
    ...structuredClone(node),
    parentId: parentNode.id,
    order: insertIndex,
    updatedAt: createTimestamp(),
  };

  nextTree.nodes[nextNode.id] = nextNode;
  parentNode.childIds.splice(insertIndex, 0, nextNode.id);
  parentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, parentNode.id);

  return nextTree;
}

export function insertSiblingNode(
  tree: NodeTree,
  siblingNodeId: string,
  node: NonRootNode,
  position: 'before' | 'after' = 'after',
) {
  const siblingNode = getNodeOrThrow(tree, siblingNodeId);

  if (siblingNode.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能插入同级节点。',
      {
        siblingNodeId,
      },
    );
  }

  const insertIndex =
    position === 'before' ? siblingNode.order : siblingNode.order + 1;

  return insertChildNode(tree, siblingNode.parentId, node, insertIndex);
}

export function deleteNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能被删除。',
      {
        nodeId,
      },
    );
  }

  const nextTree = cloneNodeTree(tree);
  const nodeIdsToDelete = getSubtreeNodeIds(nextTree, nodeId);
  const parentNode = getNodeOrThrow(nextTree, node.parentId);
  const referenceIdsToDelete = collectReferenceIdsToDelete(
    nextTree,
    nodeIdsToDelete,
  );

  parentNode.childIds = parentNode.childIds.filter((childId) => childId !== nodeId);
  parentNode.updatedAt = createTimestamp();

  for (const currentNode of Object.values(nextTree.nodes)) {
    currentNode.referenceIds = currentNode.referenceIds.filter(
      (referenceId) => !referenceIdsToDelete.has(referenceId),
    );
  }

  for (const referenceId of referenceIdsToDelete) {
    delete nextTree.references[referenceId];
  }

  for (const currentNodeId of nodeIdsToDelete) {
    delete nextTree.nodes[currentNodeId];
  }

  reindexChildren(nextTree, parentNode.id);

  return nextTree;
}

export function moveNode(
  tree: NodeTree,
  nodeId: string,
  targetParentNodeId: string,
  index?: number,
) {
  const currentNode = getNodeOrThrow(tree, nodeId);
  const currentParentNodeId = currentNode.parentId;

  if (currentParentNodeId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能移动。',
      {
        nodeId,
      },
    );
  }

  if (isDescendantNode(tree, nodeId, targetParentNodeId)) {
    throw new NodeDomainError(
      'MOVE_TARGET_IS_DESCENDANT',
      '不能把节点移动到自己的后代节点下。',
      {
        nodeId,
        targetParentNodeId,
      },
    );
  }

  const nextTree = cloneNodeTree(tree);
  const node = getNonRootNodeOrThrow(nextTree, nodeId);
  const currentParentNode = getNodeOrThrow(nextTree, currentParentNodeId);
  const targetParentNode = getNodeOrThrow(nextTree, targetParentNodeId);
  const siblingCapacity =
    targetParentNode.id === currentParentNode.id
      ? targetParentNode.childIds.length - 1
      : targetParentNode.childIds.length;
  const normalizedInsertIndex = normalizeInsertIndex(
    index ?? siblingCapacity,
    siblingCapacity,
  );

  currentParentNode.childIds = currentParentNode.childIds.filter(
    (childId) => childId !== node.id,
  );
  currentParentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, currentParentNode.id);

  const nextNode = normalizeNodeForParent(node, targetParentNode.type);

  if (!canParentAcceptChild(targetParentNode.type, nextNode.type)) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `节点 ${targetParentNode.type} 不能容纳 ${nextNode.type}。`,
      {
        nodeId,
        targetParentNodeId,
      },
    );
  }

  const adjustedInsertIndex =
    targetParentNode.id === currentParentNode.id &&
    normalizedInsertIndex > node.order
      ? normalizedInsertIndex - 1
      : normalizedInsertIndex;

  nextNode.parentId = targetParentNode.id;
  nextNode.order = adjustedInsertIndex;
  nextNode.updatedAt = createTimestamp();
  nextTree.nodes[nextNode.id] = nextNode;
  targetParentNode.childIds.splice(adjustedInsertIndex, 0, nextNode.id);
  targetParentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, targetParentNode.id);

  return nextTree;
}

export function liftNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能提升一级。',
      {
        nodeId,
      },
    );
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);
  const grandparentNodeId = parentNode.parentId;

  if (grandparentNodeId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      '根节点直接子级无法继续提升。',
      {
        nodeId,
      },
    );
  }

  return moveNode(tree, nodeId, grandparentNodeId, parentNode.order + 1);
}

export function lowerNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能降低一级。',
      {
        nodeId,
      },
    );
  }

  if (node.order === 0) {
    throw new NodeDomainError(
      'MISSING_PREVIOUS_SIBLING',
      '没有前一个同级节点，无法降低一级。',
      {
        nodeId,
      },
    );
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);
  const previousSiblingNodeId = parentNode.childIds[node.order - 1];

  return moveNode(tree, nodeId, previousSiblingNodeId);
}

function normalizeNodeForParent(
  node: NonRootNode,
  parentType: TreeNode['type'],
): NonRootNode {
  if (parentType !== 'theme-root') {
    return node;
  }

  if (node.type === 'resource-fragment') {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      'resource-fragment 不能直接提升到根层。',
      {
        nodeId: node.id,
      },
    );
  }

  if (!shouldConvertToModuleAtRoot(node.type)) {
    return node;
  }

  return convertNodeToModule(node);
}

function convertNodeToModule(node: NonRootNode): ModuleNode {
  return {
    id: node.id,
    type: 'module',
    title: node.title,
    content: node.content,
    parentId: node.parentId,
    childIds: [...node.childIds],
    order: node.order,
    tagIds: [...node.tagIds],
    referenceIds: [...node.referenceIds],
    createdAt: node.createdAt,
    updatedAt: createTimestamp(),
  };
}

function normalizeInsertIndex(index: number | undefined, length: number) {
  const nextIndex = index ?? length;

  if (nextIndex < 0 || nextIndex > length) {
    throw new NodeDomainError(
      'INVALID_INSERT_INDEX',
      `插入位置 ${nextIndex} 超出范围 0-${length}。`,
      {
        index: nextIndex,
        length,
      },
    );
  }

  return nextIndex;
}

function reindexChildren(tree: NodeTree, parentNodeId: string) {
  const parentNode = getNodeOrThrow(tree, parentNodeId);

  for (let index = 0; index < parentNode.childIds.length; index += 1) {
    const childNodeId = parentNode.childIds[index];
    const childNode = getNodeOrThrow(tree, childNodeId);
    childNode.order = index;
  }
}

function collectReferenceIdsToDelete(
  tree: NodeTree,
  nodeIdsToDelete: Set<string>,
) {
  const referenceIdsToDelete = new Set<string>();

  for (const reference of Object.values(tree.references)) {
    if (
      nodeIdsToDelete.has(reference.sourceNodeId) ||
      nodeIdsToDelete.has(reference.targetNodeId)
    ) {
      referenceIdsToDelete.add(reference.id);
    }
  }

  return referenceIdsToDelete;
}

function getNonRootNodeOrThrow(tree: NodeTree, nodeId: string): NonRootNode {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'theme-root') {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'theme-root 不能参与此结构操作。',
      {
        nodeId,
      },
    );
  }

  return node;
}

function createTimestamp() {
  return new Date().toISOString();
}
