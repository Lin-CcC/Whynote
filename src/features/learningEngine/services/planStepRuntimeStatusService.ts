import {
  getNodeOrThrow,
  type NodeTree,
  type PlanStepNode,
} from '../../nodeDomain';

import type { PlanStepRuntimeStatusResult } from '../domain';
import { suggestPlanStepCompletion } from './completionSuggestionService';

export function resolvePlanStepRuntimeStatus(
  tree: NodeTree,
  planStepNodeId: string,
): PlanStepRuntimeStatusResult {
  const planStepNode = getNodeOrThrow(tree, planStepNodeId);

  if (planStepNode.type !== 'plan-step') {
    throw new Error(`节点 ${planStepNodeId} 不是 plan-step。`);
  }

  const completionSuggestion = suggestPlanStepCompletion(tree, planStepNodeId);

  if (completionSuggestion.shouldSuggestComplete) {
    return {
      evidence: completionSuggestion.evidence,
      reasonSummary: completionSuggestion.reasonSummary,
      reasons: completionSuggestion.reasons,
      suggestedStatus: 'done',
    };
  }

  const progressReasons = collectProgressReasons(completionSuggestion.evidence);

  if (progressReasons.length > 0) {
    return {
      evidence: completionSuggestion.evidence,
      reasonSummary: progressReasons.join('；'),
      reasons: progressReasons,
      suggestedStatus: 'doing',
    };
  }

  const todoReasons = [
    '当前仍处于学习路径骨架阶段，尚未出现回答、总结、判断、问题细化或资料引用。',
  ];

  return {
    evidence: completionSuggestion.evidence,
    reasonSummary: todoReasons.join('；'),
    reasons: todoReasons,
    suggestedStatus: 'todo',
  };
}

export function reconcilePlanStepStatuses(tree: NodeTree) {
  let nextTree = tree;
  let hasChanges = false;

  for (const node of Object.values(tree.nodes)) {
    if (node.type !== 'plan-step') {
      continue;
    }

    const runtimeStatus = resolvePlanStepRuntimeStatus(nextTree, node.id);

    if (node.status === runtimeStatus.suggestedStatus) {
      continue;
    }

    if (!hasChanges) {
      nextTree = structuredClone(tree);
      hasChanges = true;
    }

    const nextNode = getNodeOrThrow(nextTree, node.id);

    if (nextNode.type !== 'plan-step') {
      continue;
    }

    (nextNode as PlanStepNode).status = runtimeStatus.suggestedStatus;
    nextNode.updatedAt = new Date().toISOString();
  }

  return nextTree;
}

export function shouldSkipPlanStepStatusReconciliation(
  patch: Partial<Pick<PlanStepNode, 'title' | 'content' | 'status'>>,
) {
  return (
    patch.status !== undefined &&
    patch.title === undefined &&
    patch.content === undefined
  );
}

function collectProgressReasons(
  result: PlanStepRuntimeStatusResult['evidence'],
): string[] {
  const reasons: string[] = [];

  pushCountReason(reasons, result.answerCount, '已有回答节点');
  pushCountReason(reasons, result.summaryCount, '已有总结节点');
  pushCountReason(reasons, result.judgmentCount, '已有判断节点');
  pushCountReason(reasons, result.refinedQuestionCount, '已有 question 被继续拆分');
  pushCountReason(reasons, result.referencedNodeCount, '已有学习节点挂上资料引用');

  return reasons;
}

function pushCountReason(
  reasons: string[],
  count: number,
  label: string,
) {
  if (count <= 0) {
    return;
  }

  reasons.push(`${label} ${String(count)} 个`);
}
