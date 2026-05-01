import type { AnswerNode, JudgmentNode, NodeTree, SummaryNode, TreeNode } from '../../nodeDomain';
import {
  getCurrentQuestionAnswerNodeId,
  getJudgmentNodeKind,
  getQuestionAnswerClosureJudgmentNodeId,
  getQuestionAnswerClosureSummaryNodeId,
  getQuestionSummaryCheckJudgmentNodeId,
  getSummaryNodeKind,
  isAnswerClosureResultNodeStale,
  isSummaryCheckJudgmentNodeStale,
} from '../../nodeDomain';
import { getDisplayTitleForNode } from './treeSelectors';

type SemanticBadgeTone = 'current' | 'history' | 'stale';

export type NodeSemanticBadge = {
  key: string;
  label: string;
  tone: SemanticBadgeTone;
};

export type NodeSemanticVisibility = {
  badges: NodeSemanticBadge[];
  notes: string[];
};

export function getNodeSemanticVisibility(
  tree: NodeTree,
  node: TreeNode,
): NodeSemanticVisibility {
  const badges: NodeSemanticBadge[] = [];
  const notes: string[] = [];

  if (node.type === 'question') {
    const currentAnswerNode = resolveCurrentQuestionAnswerNode(tree, node);

    if (currentAnswerNode) {
      notes.push(
        `当前回答：${formatNodeDisplayName(tree, currentAnswerNode, '回答')}${currentAnswerNode.content.trim().length === 0 ? '（正文为空）' : ''}`,
      );
    }

    if (node.sourceContext) {
      notes.push(
        `追问围绕：${formatQuestionSourceContext(node.sourceContext)}`,
      );
    }
  }

  if (node.type === 'answer') {
    const parentQuestionNode = resolveParentQuestionNode(tree, node);

    if (parentQuestionNode) {
      const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, parentQuestionNode.id);

      badges.push({
        key: currentAnswerNodeId === node.id ? 'current-answer' : 'history-answer',
        label: currentAnswerNodeId === node.id ? '当前回答' : '旧回答',
        tone: currentAnswerNodeId === node.id ? 'current' : 'history',
      });
    }
  }

  if (node.type === 'summary' && getSummaryNodeKind(tree, node) === 'answer-closure') {
    appendAnswerClosureResultVisibility(tree, node, badges, notes);
  }

  if (node.type === 'judgment' && getJudgmentNodeKind(tree, node) === 'answer-closure') {
    appendAnswerClosureResultVisibility(tree, node, badges, notes);
  }

  if (node.type === 'judgment' && getJudgmentNodeKind(tree, node) === 'summary-check') {
    appendSummaryCheckResultVisibility(tree, node, badges, notes);
  }

  return {
    badges,
    notes,
  };
}

function appendAnswerClosureResultVisibility(
  tree: NodeTree,
  node: SummaryNode | JudgmentNode,
  badges: NodeSemanticBadge[],
  notes: string[],
) {
  const parentQuestionNode = resolveParentQuestionNode(tree, node);
  const sourceAnswerNode = resolveAnswerClosureSourceAnswerNode(tree, node);

  if (!parentQuestionNode || !sourceAnswerNode) {
    return;
  }

  const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, parentQuestionNode.id);
  const latestResultNodeId =
    node.type === 'summary'
      ? getQuestionAnswerClosureSummaryNodeId(tree, parentQuestionNode.id, sourceAnswerNode.id)
      : getQuestionAnswerClosureJudgmentNodeId(tree, parentQuestionNode.id, sourceAnswerNode.id);

  badges.push({
    key: latestResultNodeId === node.id && currentAnswerNodeId === sourceAnswerNode.id
      ? 'current-result'
      : 'history-result',
    label:
      latestResultNodeId === node.id && currentAnswerNodeId === sourceAnswerNode.id
        ? '当前结果'
        : '历史结果',
    tone:
      latestResultNodeId === node.id && currentAnswerNodeId === sourceAnswerNode.id
        ? 'current'
        : 'history',
  });

  if (isAnswerClosureResultNodeStale(tree, node)) {
    badges.push({
      key: 'stale-result',
      label: '已过期',
      tone: 'stale',
    });
  }

  notes.push(
    `配对回答：${currentAnswerNodeId === sourceAnswerNode.id ? '当前回答' : '旧回答'} · ${formatNodeDisplayName(tree, sourceAnswerNode, '回答')}`,
  );
}

function appendSummaryCheckResultVisibility(
  tree: NodeTree,
  node: JudgmentNode,
  badges: NodeSemanticBadge[],
  notes: string[],
) {
  const parentQuestionNode = resolveParentQuestionNode(tree, node);
  const sourceSummaryNode = resolveSummaryCheckSourceSummaryNode(tree, node);

  if (!parentQuestionNode || !sourceSummaryNode) {
    return;
  }

  const latestResultNodeId = getQuestionSummaryCheckJudgmentNodeId(
    tree,
    parentQuestionNode.id,
    sourceSummaryNode.id,
  );

  badges.push({
    key: latestResultNodeId === node.id ? 'current-result' : 'history-result',
    label: latestResultNodeId === node.id ? '当前结果' : '历史结果',
    tone: latestResultNodeId === node.id ? 'current' : 'history',
  });

  if (isSummaryCheckJudgmentNodeStale(tree, node)) {
    badges.push({
      key: 'stale-result',
      label: '已过期',
      tone: 'stale',
    });
  }

  notes.push(`检查对象：${formatNodeDisplayName(tree, sourceSummaryNode, '总结')}`);
}

function resolveCurrentQuestionAnswerNode(tree: NodeTree, questionNode: TreeNode) {
  if (questionNode.type !== 'question') {
    return null;
  }

  const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, questionNode.id);

  return currentAnswerNodeId && tree.nodes[currentAnswerNodeId]?.type === 'answer'
    ? tree.nodes[currentAnswerNodeId]
    : null;
}

function resolveParentQuestionNode(tree: NodeTree, node: TreeNode) {
  if (node.type === 'question') {
    return node;
  }

  if (node.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[node.parentId];

  return parentNode?.type === 'question' ? parentNode : null;
}

function resolveAnswerClosureSourceAnswerNode(
  tree: NodeTree,
  node: SummaryNode | JudgmentNode,
) {
  const parentQuestionNode = resolveParentQuestionNode(tree, node);

  if (!parentQuestionNode) {
    return null;
  }

  if (
    node.sourceAnswerId &&
    tree.nodes[node.sourceAnswerId]?.type === 'answer' &&
    tree.nodes[node.sourceAnswerId]?.parentId === parentQuestionNode.id
  ) {
    return tree.nodes[node.sourceAnswerId];
  }

  return findPreviousQuestionChildNode(
    tree,
    parentQuestionNode.id,
    node.id,
    (candidateNode): candidateNode is AnswerNode => candidateNode.type === 'answer',
  );
}

function resolveSummaryCheckSourceSummaryNode(tree: NodeTree, node: JudgmentNode) {
  const parentQuestionNode = resolveParentQuestionNode(tree, node);

  if (!parentQuestionNode) {
    return null;
  }

  if (
    node.sourceSummaryId &&
    tree.nodes[node.sourceSummaryId]?.type === 'summary' &&
    tree.nodes[node.sourceSummaryId]?.parentId === parentQuestionNode.id
  ) {
    return tree.nodes[node.sourceSummaryId];
  }

  return findPreviousQuestionChildNode(
    tree,
    parentQuestionNode.id,
    node.id,
    (candidateNode): candidateNode is SummaryNode =>
      candidateNode.type === 'summary' && getSummaryNodeKind(tree, candidateNode) === 'manual',
  );
}

function formatQuestionSourceContext(
  sourceContext: Extract<TreeNode, { type: 'question' }>['sourceContext'],
) {
  if (!sourceContext) {
    return '';
  }

  const typeLabel = getSourceContextTypeLabel(sourceContext.nodeType);
  const normalizedContent = sourceContext.content.trim();

  return normalizedContent
    ? `${typeLabel} · ${sourceContext.title}：${normalizedContent}`
    : `${typeLabel} · ${sourceContext.title}`;
}

function getSourceContextTypeLabel(
  nodeType: NonNullable<Extract<TreeNode, { type: 'question' }>['sourceContext']>['nodeType'],
) {
  switch (nodeType) {
    case 'question':
      return '来源问题';
    case 'answer':
      return '来源回答';
    case 'summary':
      return '来源总结';
    case 'judgment':
      return '来源判断';
  }
}

function findPreviousQuestionChildNode<TNode extends TreeNode>(
  tree: NodeTree,
  questionNodeId: string,
  nodeId: string,
  predicate: (candidateNode: TreeNode) => candidateNode is TNode,
) {
  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const nodeIndex = questionNode.childIds.indexOf(nodeId);

  if (nodeIndex === -1) {
    return null;
  }

  for (let childIndex = nodeIndex - 1; childIndex >= 0; childIndex -= 1) {
    const candidateNodeId = questionNode.childIds[childIndex];

    if (!candidateNodeId) {
      continue;
    }

    const candidateNode = tree.nodes[candidateNodeId];

    if (candidateNode && predicate(candidateNode)) {
      return candidateNode;
    }
  }

  return null;
}

function formatNodeDisplayName(
  tree: NodeTree,
  node: TreeNode,
  fallbackLabel: string,
) {
  const displayTitle = getDisplayTitleForNode(tree, node).trim();

  return displayTitle.length > 0 ? displayTitle : `未命名${fallbackLabel}`;
}
