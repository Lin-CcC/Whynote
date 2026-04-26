import type { NodeTree, ResourceFragmentNode } from '../../nodeDomain';
import type { ResourceGroup } from '../resourceSearchExportTypes';
import { getNodeSourceSummary } from '../utils/resourceTreeUtils';

export function listResourceGroups(tree: NodeTree): ResourceGroup[] {
  return tree.nodes[tree.rootId].childIds.flatMap((childId) => {
    const resourceNode = tree.nodes[childId];

    if (!resourceNode || resourceNode.type !== 'resource') {
      return [];
    }

    const fragmentNodes = resourceNode.childIds
      .map((fragmentId) => tree.nodes[fragmentId])
      .filter((node): node is ResourceFragmentNode => node?.type === 'resource-fragment');

    const referenceCount = Object.values(tree.references).filter(
      (reference) =>
        reference.targetNodeId === resourceNode.id ||
        fragmentNodes.some((fragmentNode) => fragmentNode.id === reference.targetNodeId),
    ).length;

    return [
      {
        fragmentNodes,
        referenceCount,
        resourceNode,
        sourceSummary: getNodeSourceSummary(tree, resourceNode) ?? '未提供来源信息',
      },
    ];
  });
}
