import type { NodeTree, TreeNode } from './nodeTypes';

export function isScaffoldSummaryNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): boolean {
  const node =
    typeof nodeOrId === 'string'
      ? tree.nodes[nodeOrId]
      : nodeOrId;

  if (!node || node.type !== 'summary' || node.parentId === null) {
    return false;
  }

  const parentNode = tree.nodes[node.parentId];

  if (parentNode?.type !== 'plan-step') {
    return false;
  }

  for (const childId of parentNode.childIds) {
    if (childId === node.id) {
      return true;
    }

    if (tree.nodes[childId]?.type === 'question') {
      return false;
    }
  }

  return false;
}

export function getDisplayNodeTypeLabel(tree: NodeTree, node: TreeNode): string {
  if (isScaffoldSummaryNode(tree, node)) {
    return '铺垫';
  }

  switch (node.type) {
    case 'theme-root':
      return '主题';
    case 'module':
      return '模块';
    case 'plan-step':
      return '步骤';
    case 'question':
      return '问题';
    case 'answer':
      return '回答';
    case 'summary':
      return '总结';
    case 'judgment':
      return '判断';
    case 'resource':
      return '资料';
    case 'resource-fragment':
      return '摘录';
  }
}
