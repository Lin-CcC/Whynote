import {
  getNodeOrThrow,
  getSubtreeNodeIds,
  type NodeTree,
  type PlanStepNode,
  type TreeNode,
} from '../../nodeDomain';

import type {
  CompletionSuggestionResult,
  PlanStepCompletionEvidence,
} from '../domain';

const BLOCKING_TAG_NAMES = new Set(['未理解', '待验证']);
const BLOCKING_JUDGMENT_KEYWORDS = [
  '未完成',
  '不完整',
  '不准确',
  '待验证',
  '仍有问题',
  '需要补充',
  '存在疑问',
];

export function suggestPlanStepCompletion(
  tree: NodeTree,
  planStepNodeId: string,
): CompletionSuggestionResult {
  const planStepNode = getNodeOrThrow(tree, planStepNodeId);

  if (planStepNode.type !== 'plan-step') {
    throw new Error(`节点 ${planStepNodeId} 不是 plan-step。`);
  }

  const evidence = buildPlanStepCompletionEvidence(tree, planStepNode);
  const reasons = evaluateCompletionEvidence(evidence);

  return {
    shouldSuggestComplete:
      reasons.length === 1 && reasons[0] === '当前步骤已具备完成信号。',
    reasonSummary: reasons.join('；'),
    reasons,
    evidence,
  };
}

function buildPlanStepCompletionEvidence(
  tree: NodeTree,
  planStepNode: PlanStepNode,
): PlanStepCompletionEvidence {
  const subtreeNodeIds = getSubtreeNodeIds(tree, planStepNode.id);
  subtreeNodeIds.delete(planStepNode.id);
  const subtreeNodes = [...subtreeNodeIds].map((nodeId) => getNodeOrThrow(tree, nodeId));
  const questionNodes = subtreeNodes.filter(
    (node): node is Extract<TreeNode, { type: 'question' }> => node.type === 'question',
  );
  const answerNodes = subtreeNodes.filter((node) => node.type === 'answer');
  const summaryNodes = subtreeNodes.filter((node) => node.type === 'summary');
  const judgmentNodes = subtreeNodes.filter((node) => node.type === 'judgment');
  const blockingTagNames = collectBlockingTagNames(tree, [planStepNode, ...subtreeNodes]);
  const resolvedQuestionIds = collectResolvedQuestionIds(tree, questionNodes);
  const directClosureCount = planStepNode.childIds
    .map((childId) => getNodeOrThrow(tree, childId))
    .filter(
      (node) =>
        node.type === 'answer' ||
        node.type === 'summary' ||
        node.type === 'judgment',
    ).length;
  const answeredQuestionCount = resolvedQuestionIds.size;
  const unresolvedQuestionTitles = questionNodes
    .filter((questionNode) => !resolvedQuestionIds.has(questionNode.id))
    .map((questionNode) => questionNode.title);
  const blockingJudgmentCount = judgmentNodes.filter((judgmentNode) =>
    containsBlockingJudgmentSignal(judgmentNode),
  ).length;

  return {
    stepStatus: planStepNode.status,
    questionCount: questionNodes.length,
    answerCount: answerNodes.length,
    answeredQuestionCount,
    summaryCount: summaryNodes.length,
    judgmentCount: judgmentNodes.length,
    directClosureCount,
    blockingJudgmentCount,
    unresolvedQuestionTitles,
    blockingTagNames,
  };
}

function evaluateCompletionEvidence(evidence: PlanStepCompletionEvidence) {
  const reasons: string[] = [];

  if (evidence.stepStatus === 'done') {
    return ['当前步骤已标记为 done，无需再次建议完成。'];
  }

  if (evidence.questionCount === 0) {
    reasons.push('当前步骤还没有问题节点。');
  }

  if (evidence.answerCount === 0 && evidence.summaryCount === 0) {
    reasons.push('当前步骤缺少回答或总结。');
  }

  if (evidence.summaryCount === 0) {
    reasons.push('当前步骤缺少总结节点。');
  }

  if (evidence.unresolvedQuestionTitles.length > 0) {
    reasons.push(
      `仍有未闭环问题：${evidence.unresolvedQuestionTitles.join('、')}`,
    );
  }

  if (
    evidence.unresolvedQuestionTitles.length > 0 &&
    evidence.directClosureCount > 0
  ) {
    reasons.push('直属于 plan-step 的回答 / 总结 / 判断只能作为补充证据，不能替代 question 自身闭环。');
  }

  if (evidence.blockingTagNames.length > 0) {
    reasons.push(
      `存在阻塞标签：${evidence.blockingTagNames.join('、')}`,
    );
  }

  if (evidence.blockingJudgmentCount > 0) {
    reasons.push('判断节点仍提示内容未完成或待修正。');
  }

  if (reasons.length === 0) {
    return ['当前步骤已具备完成信号。'];
  }

  return reasons;
}

function collectBlockingTagNames(tree: NodeTree, nodes: TreeNode[]) {
  const blockingTagNames = new Set<string>();

  for (const node of nodes) {
    for (const tagId of node.tagIds) {
      const tagName = tree.tags[tagId]?.name;

      if (tagName && BLOCKING_TAG_NAMES.has(tagName)) {
        blockingTagNames.add(tagName);
      }
    }
  }

  return [...blockingTagNames];
}

function collectResolvedQuestionIds(
  tree: NodeTree,
  questionNodes: Extract<TreeNode, { type: 'question' }>[],
) {
  const resolvedQuestionIds = new Set<string>();

  for (const questionNode of questionNodes) {
    const descendantNodeIds = getSubtreeNodeIds(tree, questionNode.id);
    descendantNodeIds.delete(questionNode.id);
    const hasClosureNode = [...descendantNodeIds]
      .map((nodeId) => getNodeOrThrow(tree, nodeId))
      .some(
        (node) =>
          node.type === 'answer' ||
          node.type === 'summary' ||
          node.type === 'judgment',
      );

    if (hasClosureNode) {
      resolvedQuestionIds.add(questionNode.id);
    }
  }

  return resolvedQuestionIds;
}

function containsBlockingJudgmentSignal(
  judgmentNode: Extract<TreeNode, { type: 'judgment' }>,
) {
  const signalText = `${judgmentNode.title}\n${judgmentNode.content}`;

  return BLOCKING_JUDGMENT_KEYWORDS.some((keyword) => signalText.includes(keyword));
}
