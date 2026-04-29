import {
  deleteNode,
  getNodeOrThrow,
  type NodeTree,
  type ResourceFragmentNode,
  type ResourceNode,
} from '../../nodeDomain';

type BaseResourceDeleteImpact = {
  nextFocusNodeId: string | null;
  nodeId: string;
  nodeTitle: string;
  totalReferenceCount: number;
};

export interface ResourceDeleteImpact extends BaseResourceDeleteImpact {
  directReferenceCount: number;
  fragmentCount: number;
  fragmentReferenceCount: number;
  nodeType: 'resource';
}

export interface ResourceFragmentDeleteImpact
  extends BaseResourceDeleteImpact {
  nodeType: 'resource-fragment';
  parentResourceId: string | null;
  parentResourceTitle: string | null;
  referenceCount: number;
}

export type ResourceDeleteImpactSummary =
  | ResourceDeleteImpact
  | ResourceFragmentDeleteImpact;

export interface DeleteResourceNodeResult {
  impact: ResourceDeleteImpactSummary;
  nextFocusNodeId: string | null;
  tree: NodeTree;
}

export function countReferencesToNode(tree: NodeTree, nodeId: string) {
  return Object.values(tree.references).filter(
    (reference) => reference.targetNodeId === nodeId,
  ).length;
}

export function buildResourceDeleteImpact(
  tree: NodeTree,
  nodeId: string,
): ResourceDeleteImpactSummary {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'resource-fragment') {
    const parentResourceNode = resolveParentResourceNode(tree, node);
    const referenceCount = countReferencesToNode(tree, node.id);

    return {
      nextFocusNodeId: parentResourceNode?.id ?? null,
      nodeId: node.id,
      nodeTitle: node.title,
      nodeType: 'resource-fragment',
      parentResourceId: parentResourceNode?.id ?? null,
      parentResourceTitle: parentResourceNode?.title ?? null,
      referenceCount,
      totalReferenceCount: referenceCount,
    };
  }

  if (node.type === 'resource') {
    const fragmentNodes = listResourceFragmentNodes(tree, node);
    const directReferenceCount = countReferencesToNode(tree, node.id);
    const fragmentReferenceCount = fragmentNodes.reduce(
      (count, fragmentNode) => count + countReferencesToNode(tree, fragmentNode.id),
      0,
    );

    return {
      directReferenceCount,
      fragmentCount: fragmentNodes.length,
      fragmentReferenceCount,
      nextFocusNodeId: resolveAdjacentResourceNodeId(tree, node.id),
      nodeId: node.id,
      nodeTitle: node.title,
      nodeType: 'resource',
      totalReferenceCount: directReferenceCount + fragmentReferenceCount,
    };
  }

  throw new Error('当前只能删除 resource 或 resource-fragment。');
}

export function deleteResourceNode(
  tree: NodeTree,
  nodeId: string,
): DeleteResourceNodeResult {
  const impact = buildResourceDeleteImpact(tree, nodeId);

  return {
    impact,
    nextFocusNodeId: impact.nextFocusNodeId,
    tree: deleteNode(tree, nodeId),
  };
}

function resolveParentResourceNode(
  tree: NodeTree,
  fragmentNode: ResourceFragmentNode,
): ResourceNode | null {
  const sourceResourceNode = tree.nodes[fragmentNode.sourceResourceId];

  if (sourceResourceNode?.type === 'resource') {
    return sourceResourceNode;
  }

  if (!fragmentNode.parentId) {
    return null;
  }

  const parentNode = tree.nodes[fragmentNode.parentId];

  return parentNode?.type === 'resource' ? parentNode : null;
}

function listResourceFragmentNodes(tree: NodeTree, resourceNode: ResourceNode) {
  return resourceNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (childNode): childNode is ResourceFragmentNode =>
        childNode?.type === 'resource-fragment',
    );
}

function resolveAdjacentResourceNodeId(tree: NodeTree, resourceNodeId: string) {
  const rootNode = getNodeOrThrow(tree, tree.rootId);
  const resourceNodeIds = rootNode.childIds.filter(
    (childId) => tree.nodes[childId]?.type === 'resource',
  );
  const resourceNodeIndex = resourceNodeIds.indexOf(resourceNodeId);

  if (resourceNodeIndex === -1) {
    return resourceNodeIds[0] ?? null;
  }

  return (
    resourceNodeIds[resourceNodeIndex + 1] ??
    resourceNodeIds[resourceNodeIndex - 1] ??
    null
  );
}
