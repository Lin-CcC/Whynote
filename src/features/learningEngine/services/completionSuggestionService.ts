import {
  isScaffoldSummaryNode,
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
  '还不完整',
  '不完整',
  '不准确',
  '待补充',
  '需要补充',
  '需要继续',
  '仍有问题',
];
const COMPLETION_READY_REASON = '当前步骤已满足最小学习闭环。';

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
      reasons.length === 1 && reasons[0] === COMPLETION_READY_REASON,
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

  const subtreeNodes = [...subtreeNodeIds].map((nodeId) =>
    getNodeOrThrow(tree, nodeId),
  );
  const questionNodes = subtreeNodes.filter(
    (node): node is Extract<TreeNode, { type: 'question' }> =>
      node.type === 'question',
  );
  const completionTargetQuestions = collectCompletionTargetQuestions(
    tree,
    planStepNode.id,
  );
  const answerNodes = subtreeNodes.filter(
    (node) => node.type === 'answer' && hasMeaningfulAnswerContent(node),
  );
  const scaffoldSummaryIds = collectScaffoldSummaryIds(tree, planStepNode);
  const summaryNodes = subtreeNodes.filter(
    (node) => node.type === 'summary' && !scaffoldSummaryIds.has(node.id),
  );
  const judgmentNodes = subtreeNodes.filter((node) => node.type === 'judgment');
  const referencedLearningEvidenceNodes = [
    ...answerNodes,
    ...summaryNodes,
    ...judgmentNodes,
  ];
  const blockingTagNames = collectBlockingTagNames(tree, [
    planStepNode,
    ...subtreeNodes,
  ]);
  const resolvedLeafQuestionIds = collectResolvedLeafQuestionIds(
    tree,
    completionTargetQuestions,
  );
  const directClosureCount = planStepNode.childIds
    .map((childId) => getNodeOrThrow(tree, childId))
    .filter((node) => {
      if (node.type === 'answer' || node.type === 'judgment') {
        return true;
      }

      return node.type === 'summary' && !scaffoldSummaryIds.has(node.id);
    }).length;
  const answeredQuestionCount = completionTargetQuestions.filter(
    (questionNode) => hasDirectMeaningfulAnswerChild(tree, questionNode),
  ).length;
  const unresolvedQuestionTitles = completionTargetQuestions
    .filter((questionNode) => !resolvedLeafQuestionIds.has(questionNode.id))
    .map((questionNode) => questionNode.title);
  const blockingJudgmentCount = countBlockingStepLevelJudgments(tree, planStepNode);
  const refinedQuestionCount = questionNodes.filter((questionNode) =>
    questionNode.childIds.some((childId) => tree.nodes[childId]?.type === 'question'),
  ).length;
  const referencedNodeCount = referencedLearningEvidenceNodes.filter(
    (node) => node.referenceIds.length > 0,
  ).length;

  return {
    stepStatus: planStepNode.status,
    questionCount: questionNodes.length,
    leafQuestionCount: completionTargetQuestions.length,
    answerCount: answerNodes.length,
    answeredQuestionCount,
    closedLeafQuestionCount: resolvedLeafQuestionIds.size,
    summaryCount: summaryNodes.length,
    judgmentCount: judgmentNodes.length,
    scaffoldSummaryCount: scaffoldSummaryIds.size,
    directClosureCount,
    blockingJudgmentCount,
    refinedQuestionCount,
    referencedNodeCount,
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
    reasons.push('当前步骤还没有 question 节点。');
  }

  if (evidence.leafQuestionCount === 0) {
    reasons.push('当前步骤还没有可直接闭环的叶子问题。');
  }

  if (
    evidence.answerCount === 0 &&
    evidence.summaryCount === 0 &&
    evidence.judgmentCount === 0 &&
    evidence.referencedNodeCount === 0
  ) {
    reasons.push('当前步骤仍停留在铺垫与问题骨架阶段，尚未出现真实学习证据。');
  }

  if (evidence.summaryCount === 0) {
    reasons.push('当前步骤还没有回答后的总结讲解。');
  }

  if (evidence.judgmentCount === 0) {
    reasons.push('当前步骤还没有回答后的 judgment 节点。');
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
    reasons.push(
      '直接挂在 plan-step 下的回答、总结或判断只能作为补充证据，不能替代具体 question 的闭环。',
    );
  }

  if (evidence.blockingTagNames.length > 0) {
    reasons.push(`存在阻塞标签：${evidence.blockingTagNames.join('、')}`);
  }

  if (evidence.blockingJudgmentCount > 0) {
    reasons.push('步骤层级仍存在阻塞性 judgment，暂时不能完成。');
  }

  if (reasons.length === 0) {
    return [COMPLETION_READY_REASON];
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

function collectResolvedLeafQuestionIds(
  tree: NodeTree,
  leafQuestionNodes: Extract<TreeNode, { type: 'question' }>[],
) {
  const resolvedQuestionIds = new Set<string>();

  for (const questionNode of leafQuestionNodes) {
    if (isLeafQuestionResolved(tree, questionNode)) {
      resolvedQuestionIds.add(questionNode.id);
    }
  }

  return resolvedQuestionIds;
}

function collectCompletionTargetQuestions(
  tree: NodeTree,
  nodeId: string,
): Array<Extract<TreeNode, { type: 'question' }>> {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'question') {
    if (hasDirectMeaningfulAnswerChild(tree, node)) {
      return [node];
    }

    const childQuestionIds = node.childIds.filter(
      (childId) => tree.nodes[childId]?.type === 'question',
    );

    if (childQuestionIds.length === 0) {
      return [node];
    }

    return childQuestionIds.flatMap((childId) =>
      collectCompletionTargetQuestions(tree, childId),
    );
  }

  return node.childIds.flatMap((childId) =>
    collectCompletionTargetQuestions(tree, childId),
  );
}

function isLeafQuestionResolved(
  tree: NodeTree,
  questionNode: Extract<TreeNode, { type: 'question' }>,
) {
  if (!hasDirectChildOfType(tree, questionNode, 'answer')) {
    return false;
  }

  if (!hasDirectMeaningfulAnswerChild(tree, questionNode)) {
    return false;
  }

  if (!hasDirectChildOfType(tree, questionNode, 'summary')) {
    return false;
  }

  const latestJudgment = getLatestDirectChildNode(tree, questionNode, 'judgment');

  if (!latestJudgment) {
    return false;
  }

  return !containsBlockingJudgmentSignal(latestJudgment);
}

function collectScaffoldSummaryIds(tree: NodeTree, planStepNode: PlanStepNode) {
  return new Set(
    planStepNode.childIds.filter((childId) => isScaffoldSummaryNode(tree, childId)),
  );
}

function countBlockingStepLevelJudgments(tree: NodeTree, planStepNode: PlanStepNode) {
  return planStepNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (node): node is Extract<TreeNode, { type: 'judgment' }> =>
        node?.type === 'judgment',
    )
    .filter((judgmentNode) => containsBlockingJudgmentSignal(judgmentNode)).length;
}

function hasDirectChildOfType<TNodeType extends TreeNode['type']>(
  tree: NodeTree,
  node: Extract<TreeNode, { childIds: string[] }>,
  nodeType: TNodeType,
) {
  return node.childIds.some((childId) => tree.nodes[childId]?.type === nodeType);
}

function hasDirectMeaningfulAnswerChild(
  tree: NodeTree,
  node: Extract<TreeNode, { childIds: string[] }>,
) {
  return node.childIds.some((childId) => {
    const childNode = tree.nodes[childId];

    return childNode?.type === 'answer' && hasMeaningfulAnswerContent(childNode);
  });
}

function getLatestDirectChildNode<TNodeType extends TreeNode['type']>(
  tree: NodeTree,
  node: Extract<TreeNode, { childIds: string[] }>,
  nodeType: TNodeType,
) {
  const matchingNodes = node.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (childNode): childNode is Extract<TreeNode, { type: TNodeType }> =>
        childNode?.type === nodeType,
    )
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);

  return matchingNodes[matchingNodes.length - 1];
}

function containsBlockingJudgmentSignal(
  judgmentNode: Extract<TreeNode, { type: 'judgment' }>,
) {
  const signalText = `${judgmentNode.title}\n${judgmentNode.content}`;

  return BLOCKING_JUDGMENT_KEYWORDS.some((keyword) =>
    signalText.includes(keyword),
  );
}

function hasMeaningfulAnswerContent(
  answerNode: Extract<TreeNode, { type: 'answer' }>,
) {
  return answerNode.content.trim().length > 0;
}
