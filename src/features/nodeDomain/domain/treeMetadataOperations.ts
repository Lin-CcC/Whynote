import { NodeDomainError } from './nodeErrors';
import { cloneNodeTree, getNodeOrThrow } from './treeDocument';
import {
  isReferenceSourceNodeType,
  isReferenceTargetNodeType,
} from './treeConstraints';
import type { NodeReference, NodeTree, Tag } from './nodeTypes';

export function upsertTag(tree: NodeTree, tag: Tag) {
  const nextTree = cloneNodeTree(tree);
  const existingTag = nextTree.tags[tag.id];

  nextTree.tags[tag.id] = existingTag
    ? {
        ...tag,
        createdAt: existingTag.createdAt,
        updatedAt: createTimestamp(),
      }
    : structuredClone(tag);

  return nextTree;
}

export function attachTagToNode(tree: NodeTree, nodeId: string, tagId: string) {
  const nextTree = cloneNodeTree(tree);
  const node = getNodeOrThrow(nextTree, nodeId);

  if (!nextTree.tags[tagId]) {
    throw new NodeDomainError(
      'INVALID_TAG',
      `标签 ${tagId} 不存在，不能挂到节点 ${nodeId}。`,
      {
        nodeId,
        tagId,
      },
    );
  }

  if (!node.tagIds.includes(tagId)) {
    node.tagIds.push(tagId);
    node.updatedAt = createTimestamp();
  }

  return nextTree;
}

export function detachTagFromNode(tree: NodeTree, nodeId: string, tagId: string) {
  const nextTree = cloneNodeTree(tree);
  const node = getNodeOrThrow(nextTree, nodeId);

  node.tagIds = node.tagIds.filter((currentTagId) => currentTagId !== tagId);
  node.updatedAt = createTimestamp();

  return nextTree;
}

export function addNodeReference(tree: NodeTree, reference: NodeReference) {
  if (tree.references[reference.id]) {
    throw new NodeDomainError(
      'INVALID_REFERENCE',
      `引用 ${reference.id} 已存在。`,
      {
        referenceId: reference.id,
      },
    );
  }

  const nextTree = cloneNodeTree(tree);
  const sourceNode = getNodeOrThrow(nextTree, reference.sourceNodeId);
  const targetNode = getNodeOrThrow(nextTree, reference.targetNodeId);

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

  nextTree.references[reference.id] = structuredClone(reference);
  sourceNode.referenceIds.push(reference.id);
  sourceNode.updatedAt = createTimestamp();

  return nextTree;
}

export function removeNodeReference(tree: NodeTree, referenceId: string) {
  if (!tree.references[referenceId]) {
    return tree;
  }

  const nextTree = cloneNodeTree(tree);
  const reference = nextTree.references[referenceId];
  const sourceNode = getNodeOrThrow(nextTree, reference.sourceNodeId);

  sourceNode.referenceIds = sourceNode.referenceIds.filter(
    (currentReferenceId) => currentReferenceId !== referenceId,
  );
  sourceNode.updatedAt = createTimestamp();
  delete nextTree.references[referenceId];

  return nextTree;
}

function createTimestamp() {
  return new Date().toISOString();
}
