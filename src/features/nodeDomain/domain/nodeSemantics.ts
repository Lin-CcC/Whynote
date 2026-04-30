import type {
  JudgmentNodeKind,
  NodeTree,
  SummaryNodeKind,
  TreeNode,
} from './nodeTypes';

export function isScaffoldSummaryNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): boolean {
  return getSummaryNodeKind(tree, nodeOrId) === 'scaffold';
}

export function isAnswerClosureSummaryNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): boolean {
  return getSummaryNodeKind(tree, nodeOrId) === 'answer-closure';
}

export function isSummaryCheckJudgmentNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): boolean {
  return getJudgmentNodeKind(tree, nodeOrId) === 'summary-check';
}

export function getSummaryNodeKind(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): SummaryNodeKind | null {
  const node = typeof nodeOrId === 'string' ? tree.nodes[nodeOrId] : nodeOrId;

  if (!node || node.type !== 'summary') {
    return null;
  }

  if (node.summaryKind) {
    return node.summaryKind;
  }

  if (node.parentId === null) {
    return null;
  }

  if (isLegacyScaffoldSummaryNode(tree, node)) {
    return 'scaffold';
  }

  const parentNode = tree.nodes[node.parentId];

  if (parentNode?.type !== 'question') {
    return 'manual';
  }

  const previousSiblingNode = getPreviousSiblingNode(tree, node);

  return previousSiblingNode?.type === 'judgment' &&
    isLikelyLegacyAnswerClosureJudgment(previousSiblingNode)
    ? 'answer-closure'
    : 'manual';
}

export function getJudgmentNodeKind(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
): JudgmentNodeKind | null {
  const node = typeof nodeOrId === 'string' ? tree.nodes[nodeOrId] : nodeOrId;

  if (!node || node.type !== 'judgment') {
    return null;
  }

  if (node.judgmentKind) {
    return node.judgmentKind;
  }

  if (node.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[node.parentId];

  if (parentNode?.type !== 'question') {
    return 'manual';
  }

  const previousSiblingNode = getPreviousSiblingNode(tree, node);

  return previousSiblingNode?.type === 'summary' &&
    getSummaryNodeKind(tree, previousSiblingNode) === 'manual'
    ? 'summary-check'
    : isLikelyLegacyAnswerClosureJudgment(node)
      ? 'answer-closure'
      : 'manual';
}

export function getDisplayNodeTypeLabel(tree: NodeTree, node: TreeNode): string {
  if (isScaffoldSummaryNode(tree, node)) {
    return '铺垫';
  }

  if (isAnswerClosureSummaryNode(tree, node)) {
    return '答案解析';
  }

  if (isSummaryCheckJudgmentNode(tree, node)) {
    return '总结检查结果';
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

export function stripRedundantDisplayTypePrefix(
  title: string,
  nodeTypeLabel: string,
): string {
  const normalizedLabel = nodeTypeLabel.trim();

  if (!normalizedLabel) {
    return title;
  }

  const prefixPattern = new RegExp(
    `^${escapeRegExp(normalizedLabel)}\\s*[:：]\\s*`,
    'u',
  );

  return title.replace(prefixPattern, '').trimStart();
}

export function getDisplayNodeTitle(tree: NodeTree, node: TreeNode): string {
  return stripRedundantDisplayTypePrefix(
    node.title,
    getDisplayNodeTypeLabel(tree, node),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLegacyScaffoldSummaryNode(
  tree: NodeTree,
  node: Extract<TreeNode, { type: 'summary' }>,
) {
  if (node.parentId === null) {
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

function getPreviousSiblingNode(
  tree: NodeTree,
  node: Exclude<TreeNode, { parentId: null }>,
) {
  const parentId = node.parentId;

  if (parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[parentId];

  if (!parentNode) {
    return null;
  }

  const nodeIndex = parentNode.childIds.indexOf(node.id);

  if (nodeIndex <= 0) {
    return null;
  }

  const previousSiblingId = parentNode.childIds[nodeIndex - 1];

  return previousSiblingId ? tree.nodes[previousSiblingId] ?? null : null;
}

function isLikelyLegacyAnswerClosureJudgment(
  node: Extract<TreeNode, { type: 'judgment' }>,
) {
  return typeof node.hint === 'string' && node.hint.trim().length > 0;
}
