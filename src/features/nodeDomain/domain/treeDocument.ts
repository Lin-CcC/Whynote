import { NodeDomainError } from './nodeErrors';
import {
  canNodeHaveChildren,
  canParentAcceptChild,
  isReferenceSourceNodeType,
  isReferenceTargetNodeType,
} from './treeConstraints';
import type { NodeTree, TreeNode } from './nodeTypes';

export function cloneNodeTree(tree: NodeTree): NodeTree {
  return structuredClone(tree);
}

export function getNodeOrThrow(tree: NodeTree, nodeId: string): TreeNode {
  const node = tree.nodes[nodeId];

  if (!node) {
    throw new NodeDomainError('NODE_NOT_FOUND', `节点 ${nodeId} 不存在。`, {
      nodeId,
    });
  }

  return node;
}

export function getSubtreeNodeIds(tree: NodeTree, nodeId: string) {
  const collectedNodeIds = new Set<string>();
  const pendingNodeIds = [nodeId];

  while (pendingNodeIds.length > 0) {
    const currentNodeId = pendingNodeIds.pop();

    if (!currentNodeId || collectedNodeIds.has(currentNodeId)) {
      continue;
    }

    const currentNode = getNodeOrThrow(tree, currentNodeId);
    collectedNodeIds.add(currentNodeId);
    pendingNodeIds.push(...currentNode.childIds);
  }

  return collectedNodeIds;
}

export function getModuleScopeId(tree: NodeTree, nodeId: string) {
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === 'module') {
      return currentNode.id;
    }

    if (currentNode.parentId === null) {
      return null;
    }

    currentNode = tree.nodes[currentNode.parentId];
  }

  return null;
}

export function isDescendantNode(
  tree: NodeTree,
  ancestorNodeId: string,
  candidateNodeId: string,
) {
  const descendantNodeIds = getSubtreeNodeIds(tree, ancestorNodeId);
  descendantNodeIds.delete(ancestorNodeId);

  return descendantNodeIds.has(candidateNodeId);
}

export function validateNodeTree(tree: NodeTree) {
  const rootNode = getNodeOrThrow(tree, tree.rootId);

  if (rootNode.type !== 'theme-root') {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      '根节点必须是 theme-root。',
      {
        rootId: tree.rootId,
      },
    );
  }

  if (rootNode.parentId !== null) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      'theme-root 不能有父节点。',
      {
        rootId: tree.rootId,
      },
    );
  }

  for (const node of Object.values(tree.nodes)) {
    validateNodeTags(tree, node);
    validateNodeReferences(tree, node);

    if (!canNodeHaveChildren(node.type) && node.childIds.length > 0) {
      throw new NodeDomainError(
        'INVALID_CHILD_TYPE',
        `节点 ${node.id} (${node.type}) 不能拥有子节点。`,
        {
          nodeId: node.id,
        },
      );
    }

    if (new Set(node.childIds).size !== node.childIds.length) {
      throw new NodeDomainError(
        'INVALID_CHILD_TYPE',
        `节点 ${node.id} 包含重复子节点。`,
        {
          nodeId: node.id,
        },
      );
    }

    if (node.parentId === null) {
      if (node.id !== tree.rootId) {
        throw new NodeDomainError(
          'INVALID_CHILD_TYPE',
          `只有 theme-root 可以没有父节点，节点 ${node.id} 非法悬空。`,
          {
            nodeId: node.id,
          },
        );
      }

      if (node.order !== 0) {
        throw new NodeDomainError(
          'INVALID_CHILD_TYPE',
          'theme-root 的顺序必须为 0。',
          {
            nodeId: node.id,
          },
        );
      }

      continue;
    }

    const parentNode = getNodeOrThrow(tree, node.parentId);
    const childIndex = parentNode.childIds.indexOf(node.id);

    if (childIndex === -1) {
      throw new NodeDomainError(
        'INVALID_CHILD_TYPE',
        `父节点 ${parentNode.id} 未登记子节点 ${node.id}。`,
        {
          nodeId: node.id,
          parentId: parentNode.id,
        },
      );
    }

    if (!canParentAcceptChild(parentNode.type, node.type)) {
      throw new NodeDomainError(
        'INVALID_CHILD_TYPE',
        `节点 ${parentNode.type} 不能包含子节点 ${node.type}。`,
        {
          nodeId: node.id,
          parentId: parentNode.id,
        },
      );
    }

    validateParentNodeInvariant(node, parentNode);

    if (node.order !== childIndex) {
      throw new NodeDomainError(
        'INVALID_CHILD_TYPE',
        `节点 ${node.id} 的顺序与父节点登记不一致。`,
        {
          nodeId: node.id,
        },
      );
    }

    for (let index = 0; index < node.childIds.length; index += 1) {
      const childId = node.childIds[index];
      const childNode = getNodeOrThrow(tree, childId);

      if (childNode.parentId !== node.id) {
        throw new NodeDomainError(
          'INVALID_CHILD_TYPE',
          `子节点 ${childId} 的父节点记录与 ${node.id} 不一致。`,
          {
            nodeId: node.id,
            childId,
          },
        );
      }

      if (childNode.order !== index) {
        throw new NodeDomainError(
          'INVALID_CHILD_TYPE',
          `子节点 ${childId} 的排序值不正确。`,
          {
            childId,
          },
        );
      }
    }
  }

  for (const reference of Object.values(tree.references)) {
    const sourceNode = getNodeOrThrow(tree, reference.sourceNodeId);
    const targetNode = getNodeOrThrow(tree, reference.targetNodeId);

    if (!sourceNode.referenceIds.includes(reference.id)) {
      throw new NodeDomainError(
        'INVALID_REFERENCE',
        `引用 ${reference.id} 未挂到源节点 ${sourceNode.id}。`,
        {
          referenceId: reference.id,
        },
      );
    }

    if (!isReferenceSourceNodeType(sourceNode.type)) {
      throw new NodeDomainError(
        'INVALID_REFERENCE',
        `节点 ${sourceNode.type} 不能作为引用源。`,
        {
          sourceNodeId: sourceNode.id,
        },
      );
    }

    if (!isReferenceTargetNodeType(targetNode.type)) {
      throw new NodeDomainError(
        'INVALID_REFERENCE',
        `节点 ${targetNode.type} 不能作为引用目标。`,
        {
          targetNodeId: targetNode.id,
        },
      );
    }
  }
}

function validateNodeTags(tree: NodeTree, node: TreeNode) {
  for (const tagId of node.tagIds) {
    if (!tree.tags[tagId]) {
      throw new NodeDomainError(
        'INVALID_TAG',
        `节点 ${node.id} 引用了不存在的标签 ${tagId}。`,
        {
          nodeId: node.id,
          tagId,
        },
      );
    }
  }
}

function validateNodeReferences(tree: NodeTree, node: TreeNode) {
  for (const referenceId of node.referenceIds) {
    if (!tree.references[referenceId]) {
      throw new NodeDomainError(
        'INVALID_REFERENCE',
        `节点 ${node.id} 引用了不存在的引用 ${referenceId}。`,
        {
          nodeId: node.id,
          referenceId,
        },
      );
    }
  }
}

function validateParentNodeInvariant(node: TreeNode, parentNode: TreeNode) {
  if (node.type !== 'resource-fragment') {
    return;
  }

  if (parentNode.type !== 'resource') {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `resource-fragment ${node.id} 的父节点必须是 resource。`,
      {
        nodeId: node.id,
        parentId: parentNode.id,
      },
    );
  }

  if (node.sourceResourceId !== parentNode.id) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `resource-fragment ${node.id} 的 sourceResourceId 必须与父 resource 一致。`,
      {
        nodeId: node.id,
        parentId: parentNode.id,
      },
    );
  }
}
