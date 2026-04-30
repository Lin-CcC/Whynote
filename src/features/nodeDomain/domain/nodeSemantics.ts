import type {
  JudgmentNodeKind,
  NodeTree,
  SummaryNodeKind,
  TreeNode,
} from './nodeTypes';

type AnswerNode = Extract<TreeNode, { type: 'answer' }>;
type SummaryNode = Extract<TreeNode, { type: 'summary' }>;
type JudgmentNode = Extract<TreeNode, { type: 'judgment' }>;

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
  const node = resolveNode(tree, nodeOrId);

  if (!node || node.type !== 'summary') {
    return null;
  }

  if (node.summaryKind) {
    return node.summaryKind;
  }

  if (node.parentId === null) {
    return null;
  }

  if (node.sourceAnswerId) {
    return 'answer-closure';
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
  const node = resolveNode(tree, nodeOrId);

  if (!node || node.type !== 'judgment') {
    return null;
  }

  if (node.judgmentKind) {
    return node.judgmentKind;
  }

  if (node.parentId === null) {
    return null;
  }

  if (node.sourceSummaryId) {
    return 'summary-check';
  }

  if (node.sourceAnswerId) {
    return 'answer-closure';
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

export function getLegacyCurrentQuestionAnswerNodeId(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
) {
  const questionNode = resolveQuestionNode(tree, questionNodeOrId);

  if (!questionNode) {
    return null;
  }

  const filledAnswerNodes = collectQuestionAnswerNodes(tree, questionNode.id).filter(
    (answerNode) => answerNode.content.trim().length > 0,
  );

  if (filledAnswerNodes.length > 0) {
    return filledAnswerNodes[filledAnswerNodes.length - 1]?.id ?? null;
  }

  const answerNodes = collectQuestionAnswerNodes(tree, questionNode.id);

  return answerNodes[answerNodes.length - 1]?.id ?? null;
}

export function getCurrentQuestionAnswerNodeId(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
) {
  const questionNode = resolveQuestionNode(tree, questionNodeOrId);

  if (!questionNode) {
    return null;
  }

  const explicitAnswerNodeId = questionNode.currentAnswerId;

  if (
    explicitAnswerNodeId &&
    tree.nodes[explicitAnswerNodeId]?.type === 'answer' &&
    tree.nodes[explicitAnswerNodeId]?.parentId === questionNode.id
  ) {
    return explicitAnswerNodeId;
  }

  return getLegacyCurrentQuestionAnswerNodeId(tree, questionNode);
}

export function isQuestionCurrentAnswerNode(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
  answerNodeOrId: TreeNode | string | null | undefined,
) {
  const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, questionNodeOrId);
  const answerNode = resolveNode(tree, answerNodeOrId);

  return Boolean(
    currentAnswerNodeId &&
      answerNode?.type === 'answer' &&
      answerNode.id === currentAnswerNodeId,
  );
}

export function getQuestionAnswerClosureSummaryNodeId(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
  answerNodeId: string,
) {
  const questionNode = resolveQuestionNode(tree, questionNodeOrId);

  if (!questionNode) {
    return null;
  }

  const explicitSummaryNodes = collectQuestionChildNodes(tree, questionNode.id).filter(
    (childNode): childNode is SummaryNode =>
      childNode.type === 'summary' &&
      getSummaryNodeKind(tree, childNode) === 'answer-closure' &&
      childNode.sourceAnswerId === answerNodeId,
  );

  if (explicitSummaryNodes.length > 0) {
    return explicitSummaryNodes[explicitSummaryNodes.length - 1]?.id ?? null;
  }

  const legacySummaryNode = findLegacySummaryNodeForAnswer(
    tree,
    questionNode.id,
    answerNodeId,
  );

  return legacySummaryNode?.id ?? null;
}

export function getQuestionAnswerClosureJudgmentNodeId(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
  answerNodeId: string,
) {
  const questionNode = resolveQuestionNode(tree, questionNodeOrId);

  if (!questionNode) {
    return null;
  }

  const explicitJudgmentNodes = collectQuestionChildNodes(tree, questionNode.id).filter(
    (childNode): childNode is JudgmentNode =>
      childNode.type === 'judgment' &&
      getJudgmentNodeKind(tree, childNode) === 'answer-closure' &&
      childNode.sourceAnswerId === answerNodeId,
  );

  if (explicitJudgmentNodes.length > 0) {
    return explicitJudgmentNodes[explicitJudgmentNodes.length - 1]?.id ?? null;
  }

  const legacyJudgmentNode = findLegacyJudgmentNodeForAnswer(
    tree,
    questionNode.id,
    answerNodeId,
  );

  return legacyJudgmentNode?.id ?? null;
}

export function getQuestionSummaryCheckJudgmentNodeId(
  tree: NodeTree,
  questionNodeOrId: TreeNode | string | null | undefined,
  summaryNodeId: string,
) {
  const questionNode = resolveQuestionNode(tree, questionNodeOrId);

  if (!questionNode) {
    return null;
  }

  const explicitJudgmentNodes = collectQuestionChildNodes(tree, questionNode.id).filter(
    (childNode): childNode is JudgmentNode =>
      childNode.type === 'judgment' &&
      getJudgmentNodeKind(tree, childNode) === 'summary-check' &&
      childNode.sourceSummaryId === summaryNodeId,
  );

  if (explicitJudgmentNodes.length > 0) {
    return explicitJudgmentNodes[explicitJudgmentNodes.length - 1]?.id ?? null;
  }

  const legacyJudgmentNode = findLegacySummaryCheckJudgmentNode(
    tree,
    questionNode.id,
    summaryNodeId,
  );

  return legacyJudgmentNode?.id ?? null;
}

export function isAnswerClosureResultNodeStale(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
) {
  const node = resolveNode(tree, nodeOrId);

  if (
    !node ||
    (node.type !== 'summary' && node.type !== 'judgment') ||
    !node.sourceAnswerId ||
    !node.sourceAnswerUpdatedAt
  ) {
    return false;
  }

  if (
    (node.type === 'summary' && getSummaryNodeKind(tree, node) !== 'answer-closure') ||
    (node.type === 'judgment' &&
      getJudgmentNodeKind(tree, node) !== 'answer-closure')
  ) {
    return false;
  }

  const sourceAnswerNode = tree.nodes[node.sourceAnswerId];

  return (
    sourceAnswerNode?.type === 'answer' &&
    sourceAnswerNode.updatedAt > node.sourceAnswerUpdatedAt
  );
}

export function isSummaryCheckJudgmentNodeStale(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
) {
  const node = resolveNode(tree, nodeOrId);

  if (
    !node ||
    node.type !== 'judgment' ||
    getJudgmentNodeKind(tree, node) !== 'summary-check' ||
    !node.sourceSummaryId ||
    !node.sourceSummaryUpdatedAt
  ) {
    return false;
  }

  const sourceSummaryNode = tree.nodes[node.sourceSummaryId];

  return (
    sourceSummaryNode?.type === 'summary' &&
    sourceSummaryNode.updatedAt > node.sourceSummaryUpdatedAt
  );
}

export function isLearningResultNodeStale(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
) {
  return (
    isAnswerClosureResultNodeStale(tree, nodeOrId) ||
    isSummaryCheckJudgmentNodeStale(tree, nodeOrId)
  );
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
  const displayTypeLabel = getDisplayNodeTypeLabel(tree, node);
  let displayTitle = stripRedundantDisplayTypePrefix(node.title, displayTypeLabel);

  if (isSummaryCheckJudgmentNode(tree, node)) {
    displayTitle = stripRedundantDisplayTypePrefix(displayTitle, '判断');
  }

  return displayTitle;
}

function resolveNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
) {
  return typeof nodeOrId === 'string' ? tree.nodes[nodeOrId] : nodeOrId;
}

function resolveQuestionNode(
  tree: NodeTree,
  nodeOrId: TreeNode | string | null | undefined,
) {
  const node = resolveNode(tree, nodeOrId);

  return node?.type === 'question' ? node : null;
}

function collectQuestionAnswerNodes(tree: NodeTree, questionNodeId: string) {
  return collectQuestionChildNodes(tree, questionNodeId).filter(
    (childNode): childNode is AnswerNode => childNode.type === 'answer',
  );
}

function collectQuestionChildNodes(tree: NodeTree, questionNodeId: string) {
  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return [];
  }

  return questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is TreeNode => Boolean(childNode))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
}

function findLegacySummaryNodeForAnswer(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
) {
  const questionChildNodes = collectQuestionChildNodes(tree, questionNodeId);
  const answerIndex = questionChildNodes.findIndex(
    (childNode) => childNode.id === answerNodeId && childNode.type === 'answer',
  );

  if (answerIndex === -1) {
    return null;
  }

  const nextAnswerIndex = questionChildNodes.findIndex(
    (childNode, index) => index > answerIndex && childNode.type === 'answer',
  );
  const scopedChildNodes = questionChildNodes.slice(
    answerIndex + 1,
    nextAnswerIndex === -1 ? undefined : nextAnswerIndex,
  );
  const summaryNodes = scopedChildNodes.filter(
    (childNode): childNode is SummaryNode =>
      childNode.type === 'summary' &&
      getSummaryNodeKind(tree, childNode) === 'answer-closure' &&
      !childNode.sourceAnswerId,
  );

  return summaryNodes[summaryNodes.length - 1] ?? null;
}

function findLegacyJudgmentNodeForAnswer(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
) {
  const questionChildNodes = collectQuestionChildNodes(tree, questionNodeId);
  const answerIndex = questionChildNodes.findIndex(
    (childNode) => childNode.id === answerNodeId && childNode.type === 'answer',
  );

  if (answerIndex === -1) {
    return null;
  }

  const nextAnswerIndex = questionChildNodes.findIndex(
    (childNode, index) => index > answerIndex && childNode.type === 'answer',
  );
  const scopedChildNodes = questionChildNodes.slice(
    answerIndex + 1,
    nextAnswerIndex === -1 ? undefined : nextAnswerIndex,
  );
  const judgmentNodes = scopedChildNodes.filter(
    (childNode): childNode is JudgmentNode =>
      childNode.type === 'judgment' &&
      getJudgmentNodeKind(tree, childNode) === 'answer-closure' &&
      !childNode.sourceAnswerId,
  );

  return judgmentNodes[judgmentNodes.length - 1] ?? null;
}

function findLegacySummaryCheckJudgmentNode(
  tree: NodeTree,
  questionNodeId: string,
  summaryNodeId: string,
) {
  const questionChildNodes = collectQuestionChildNodes(tree, questionNodeId);
  const summaryIndex = questionChildNodes.findIndex(
    (childNode) => childNode.id === summaryNodeId,
  );

  if (summaryIndex === -1) {
    return null;
  }

  for (
    let childIndex = summaryIndex + 1;
    childIndex < questionChildNodes.length;
    childIndex += 1
  ) {
    const childNode = questionChildNodes[childIndex];

    if (
      childNode.type === 'judgment' &&
      getJudgmentNodeKind(tree, childNode) === 'summary-check' &&
      !childNode.sourceSummaryId
    ) {
      return childNode;
    }

    if (childNode.type === 'summary' || childNode.type === 'answer') {
      break;
    }
  }

  return null;
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
