import type {
  LearningActionDraftInput,
  LearningReferenceCandidate,
  QuestionClosureInput,
} from '../../learningEngine';
import {
  getNodeOrThrow,
  isScaffoldSummaryNode,
  type ModuleNode,
  type NodeTree,
  type PlanStepNode,
  type TreeNode,
} from '../../nodeDomain';

export interface QuestionClosureRuntimeContext {
  answerNodeId: string;
  introductions: string[];
  learnerAnswer: string;
  moduleNode: ModuleNode | null;
  planStepNode: PlanStepNode | null;
  questionPath: QuestionClosureInput['questionPath'];
  referenceCandidates: LearningReferenceCandidate[];
  resourceSummary: string;
}

export interface QuestionAnswerEvaluationTarget {
  answerNodeId: string;
  questionNodeId: string;
}

export interface JudgmentInlineActionContext {
  answerNodeId: string | null;
  hint: string;
  questionNodeId: string;
  summaryNodeId: string | null;
}

export interface LearningActionRuntimeContext {
  currentNode: NonNullable<LearningActionDraftInput['currentNode']>;
  existingQuestionTitles: string[];
  introductions: string[];
  learnerAnswer: string;
  moduleNode: ModuleNode | null;
  planStepNode: PlanStepNode | null;
  questionPath: QuestionClosureInput['questionPath'];
  referenceCandidates: LearningReferenceCandidate[];
  resourceSummary: string;
}

export function buildQuestionClosureRuntimeContext(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
): QuestionClosureRuntimeContext {
  const planStepNode = findAncestorNode(tree, questionNodeId, 'plan-step');
  const referenceCandidates = collectLearningReferenceCandidates(tree);

  if (!planStepNode) {
    throw new Error('当前问题不在任何学习步骤下，无法生成回答评估闭环。');
  }

  const answerNode = getNodeOrThrow(tree, answerNodeId);

  if (answerNode.type !== 'answer' || answerNode.parentId !== questionNodeId) {
    throw new Error('当前回答不属于目标问题，无法生成回答评估闭环。');
  }

  return {
    answerNodeId,
    introductions: collectPlanStepIntroductions(tree, planStepNode.id),
    learnerAnswer: formatAnswerForEvaluation(answerNode),
    moduleNode: findAncestorNode(tree, questionNodeId, 'module'),
    planStepNode,
    questionPath: collectQuestionPath(tree, questionNodeId),
    referenceCandidates,
    resourceSummary: summarizeLearningReferenceCandidates(referenceCandidates),
  };
}

export function collectLearningReferenceCandidates(
  tree: NodeTree,
): LearningReferenceCandidate[] {
  return Object.values(tree.nodes)
    .filter(
      (node) => node.type === 'resource' || node.type === 'resource-fragment',
    )
    .map((node) => {
      if (node.type === 'resource') {
        return {
          content: node.content || '暂无资料摘要',
          targetNodeId: node.id,
          targetType: 'resource' as const,
          title: node.title,
        };
      }

      const sourceResourceTitle =
        tree.nodes[node.sourceResourceId]?.type === 'resource'
          ? tree.nodes[node.sourceResourceId].title
          : undefined;

      return {
        content: node.excerpt || node.content || '暂无摘录正文',
        locator: node.locator,
        sourceResourceTitle,
        targetNodeId: node.id,
        targetType: 'resource-fragment' as const,
        title: node.title,
      };
    });
}

export function summarizeLearningReferenceCandidates(
  candidates: LearningReferenceCandidate[],
  maxCount = 6,
) {
  return candidates
    .slice(0, maxCount)
    .map((candidate, index) => {
      const locatorLabel = candidate.locator ? `（${candidate.locator}）` : '';
      const sourceLabel = candidate.sourceResourceTitle
        ? ` / 来源：${candidate.sourceResourceTitle}`
        : '';

      return `${String(index + 1)}. [${candidate.targetType}] ${candidate.title}${locatorLabel}${sourceLabel}：${candidate.content}`;
    })
    .join('\n');
}

export function hasQuestionAnswerEvidence(tree: NodeTree, questionNodeId: string) {
  return collectFilledAnswerNodes(tree, questionNodeId).length > 0;
}

export function canEvaluateQuestionAnswer(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId?: string,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return false;
  }

  if (!answerNodeId) {
    return hasQuestionAnswerEvidence(tree, questionNodeId);
  }

  const answerNode = tree.nodes[answerNodeId];

  return (
    answerNode?.type === 'answer' &&
    answerNode.parentId === questionNodeId &&
    answerNode.content.trim().length > 0
  );
}

export function getLatestQuestionAnswerNodeId(
  tree: NodeTree,
  questionNodeId: string,
) {
  const filledAnswerNodes = collectFilledAnswerNodes(tree, questionNodeId);

  if (filledAnswerNodes.length > 0) {
    return filledAnswerNodes[filledAnswerNodes.length - 1]?.id ?? null;
  }

  const answerNodes = collectAnswerNodes(tree, questionNodeId);

  return answerNodes[answerNodes.length - 1]?.id ?? null;
}

export function getLatestQuestionAnswerExplanationNodeId(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId?: string | null,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  if (answerNodeId) {
    const matchedSummaryNodeId = findSummaryNodeIdForAnswer(
      tree,
      questionNode.childIds,
      answerNodeId,
    );

    if (matchedSummaryNodeId) {
      return matchedSummaryNodeId;
    }
  }

  const summaryNodes = questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (node): node is Extract<TreeNode, { type: 'summary' }> =>
        node?.type === 'summary',
    )
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);

  return summaryNodes[summaryNodes.length - 1]?.id ?? null;
}

export function countQuestionFollowUpNodes(tree: NodeTree, questionNodeId: string) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return 0;
  }

  return questionNode.childIds.filter(
    (childId) => tree.nodes[childId]?.type === 'question',
  ).length;
}

export function resolveQuestionAnswerEvaluationTarget(
  tree: NodeTree,
  selectedNodeId: string | null,
): QuestionAnswerEvaluationTarget | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (selectedNode.type === 'question') {
    const answerNodeId = getLatestQuestionAnswerNodeId(tree, selectedNode.id);

    if (answerNodeId && canEvaluateQuestionAnswer(tree, selectedNode.id, answerNodeId)) {
      return {
        answerNodeId,
        questionNodeId: selectedNode.id,
      };
    }

    return null;
  }

  const questionNode = getQuestionContextNode(tree, selectedNode.id);

  if (!questionNode) {
    return null;
  }

  const selectedNodeIndex = questionNode.childIds.indexOf(selectedNode.id);
  let answerNodeId: string | null = null;

  switch (selectedNode.type) {
    case 'answer':
      answerNodeId = selectedNode.id;
      break;
    case 'judgment':
    case 'summary':
      if (selectedNodeIndex !== -1) {
        answerNodeId = findAnswerNodeIdBeforeIndex(
          tree,
          questionNode.childIds,
          selectedNodeIndex,
        );
      }
      break;
    default:
      return null;
  }

  if (!answerNodeId) {
    answerNodeId = getLatestQuestionAnswerNodeId(tree, questionNode.id);
  }

  if (
    answerNodeId &&
    canEvaluateQuestionAnswer(tree, questionNode.id, answerNodeId)
  ) {
    return {
      answerNodeId,
      questionNodeId: questionNode.id,
    };
  }

  return null;
}

export function getJudgmentInlineActionContext(
  tree: NodeTree,
  judgmentNodeId: string,
): JudgmentInlineActionContext | null {
  const judgmentNode = tree.nodes[judgmentNodeId];

  if (!judgmentNode || judgmentNode.type !== 'judgment' || judgmentNode.parentId === null) {
    return null;
  }

  const questionNode = tree.nodes[judgmentNode.parentId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const judgmentIndex = questionNode.childIds.indexOf(judgmentNode.id);

  if (judgmentIndex === -1) {
    return null;
  }

  const answerNodeId = findAnswerNodeIdForJudgment(
    tree,
    questionNode.childIds,
    judgmentIndex,
  );
  const summaryNodeId = findSummaryNodeIdForJudgment(
    tree,
    questionNode.childIds,
    judgmentIndex,
  );
  const answerNode =
    answerNodeId && tree.nodes[answerNodeId]?.type === 'answer'
      ? tree.nodes[answerNodeId]
      : null;

  return {
    answerNodeId,
    hint: buildJudgmentHint(judgmentNode, answerNode),
    questionNodeId: questionNode.id,
    summaryNodeId,
  };
}

export function isLeafQuestion(tree: NodeTree, questionNodeId: string) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return false;
  }

  return !questionNode.childIds.some(
    (childId) => tree.nodes[childId]?.type === 'question',
  );
}

export function collectLeafQuestionIdsUnderPlanStep(
  tree: NodeTree,
  planStepNodeId: string,
) {
  const planStepNode = getNodeOrThrow(tree, planStepNodeId);

  if (planStepNode.type !== 'plan-step') {
    return [];
  }

  return collectLeafQuestionIdsFromNode(tree, planStepNode.id);
}

export function buildLearningActionRuntimeContext(
  tree: NodeTree,
  selectedNodeId: string,
): LearningActionRuntimeContext {
  const selectedNode = getNodeOrThrow(tree, selectedNodeId);
  const planStepNode = findAncestorNode(tree, selectedNodeId, 'plan-step');
  const questionNode = getQuestionContextNode(tree, selectedNodeId);
  const referenceCandidates = collectLearningReferenceCandidates(tree);

  return {
    currentNode: {
      type:
        selectedNode.type as NonNullable<
          LearningActionDraftInput['currentNode']
        >['type'],
      title: selectedNode.title,
      content: selectedNode.content,
    },
    existingQuestionTitles: planStepNode
      ? collectDirectQuestionTitles(tree, planStepNode.id)
      : [],
    introductions: planStepNode ? collectPlanStepIntroductions(tree, planStepNode.id) : [],
    learnerAnswer: questionNode ? collectQuestionAnswerText(tree, questionNode.id) : '',
    moduleNode: findAncestorNode(tree, selectedNodeId, 'module'),
    planStepNode,
    questionPath: questionNode ? collectQuestionPath(tree, questionNode.id) : [],
    referenceCandidates,
    resourceSummary: summarizeLearningReferenceCandidates(referenceCandidates),
  };
}

function collectQuestionPath(
  tree: NodeTree,
  questionNodeId: string,
): QuestionClosureInput['questionPath'] {
  const path: QuestionClosureInput['questionPath'] = [];
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, questionNodeId);

  while (currentNode) {
    if (currentNode.type === 'question') {
      path.unshift({
        title: currentNode.title,
        content: currentNode.content,
      });
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return path;
}

function collectPlanStepIntroductions(tree: NodeTree, planStepNodeId: string) {
  const planStepNode = getNodeOrThrow(tree, planStepNodeId);

  if (planStepNode.type !== 'plan-step') {
    return [];
  }

  const introductions: string[] = [];

  for (const childId of planStepNode.childIds) {
    const childNode = tree.nodes[childId];

    if (isScaffoldSummaryNode(tree, childId) && childNode?.type === 'summary') {
      introductions.push(formatNodeContent(childNode.title, childNode.content));
      continue;
    }

    if (childNode?.type === 'question') {
      break;
    }
  }

  return introductions;
}

function collectQuestionAnswerText(tree: NodeTree, questionNodeId: string) {
  return collectFilledAnswerNodes(tree, questionNodeId)
    .map((answerNode, index) =>
      `回答 ${String(index + 1)}：${formatNodeContent(
        answerNode.title,
        answerNode.content,
      )}`,
    )
    .join('\n\n');
}

function collectAnswerNodes(tree: NodeTree, questionNodeId: string) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return [];
  }

  return questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((node): node is Extract<TreeNode, { type: 'answer' }> => node?.type === 'answer');
}

function collectFilledAnswerNodes(tree: NodeTree, questionNodeId: string) {
  return collectAnswerNodes(tree, questionNodeId)
    .filter((answerNode) => answerNode.content.trim().length > 0)
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
}

function formatAnswerForEvaluation(
  answerNode: Extract<TreeNode, { type: 'answer' }>,
) {
  return `当前回答：${formatNodeContent(answerNode.title, answerNode.content)}`;
}

function getQuestionContextNode(tree: NodeTree, selectedNodeId: string) {
  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (selectedNode.type === 'question') {
    return selectedNode;
  }

  if (selectedNode.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];

  return parentNode?.type === 'question' ? parentNode : null;
}

function collectDirectQuestionTitles(tree: NodeTree, planStepNodeId: string) {
  const planStepNode = getNodeOrThrow(tree, planStepNodeId);

  if (planStepNode.type !== 'plan-step') {
    return [];
  }

  return planStepNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((node): node is Extract<TreeNode, { type: 'question' }> => node?.type === 'question')
    .map((questionNode) => questionNode.title)
    .filter(Boolean);
}

function collectLeafQuestionIdsFromNode(tree: NodeTree, nodeId: string): string[] {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'question') {
    const childQuestionIds = node.childIds.filter(
      (childId) => tree.nodes[childId]?.type === 'question',
    );

    if (childQuestionIds.length === 0) {
      return [node.id];
    }

    return childQuestionIds.flatMap((childId) =>
      collectLeafQuestionIdsFromNode(tree, childId),
    );
  }

  return node.childIds.flatMap((childId) =>
    collectLeafQuestionIdsFromNode(tree, childId),
  );
}

function findAnswerNodeIdForJudgment(
  tree: NodeTree,
  siblingIds: string[],
  judgmentIndex: number,
) {
  return findAnswerNodeIdBeforeIndex(tree, siblingIds, judgmentIndex);
}

function findSummaryNodeIdForJudgment(
  tree: NodeTree,
  siblingIds: string[],
  judgmentIndex: number,
) {
  for (
    let siblingIndex = judgmentIndex + 1;
    siblingIndex < siblingIds.length;
    siblingIndex += 1
  ) {
    const siblingNode = tree.nodes[siblingIds[siblingIndex]];

    if (!siblingNode) {
      continue;
    }

    if (siblingNode.type === 'summary') {
      return siblingNode.id;
    }

    if (siblingNode.type === 'answer') {
      return null;
    }
  }

  for (let siblingIndex = judgmentIndex - 1; siblingIndex >= 0; siblingIndex -= 1) {
    const siblingNode = tree.nodes[siblingIds[siblingIndex]];

    if (!siblingNode) {
      continue;
    }

    if (siblingNode.type === 'summary') {
      return siblingNode.id;
    }

    if (siblingNode.type === 'answer') {
      return null;
    }
  }

  return null;
}

function findSummaryNodeIdForAnswer(
  tree: NodeTree,
  siblingIds: string[],
  answerNodeId: string,
) {
  const answerIndex = siblingIds.indexOf(answerNodeId);

  if (answerIndex === -1) {
    return null;
  }

  let matchedSummaryNodeId: string | null = null;

  for (
    let siblingIndex = answerIndex + 1;
    siblingIndex < siblingIds.length;
    siblingIndex += 1
  ) {
    const siblingNode = tree.nodes[siblingIds[siblingIndex]];

    if (!siblingNode) {
      continue;
    }

    if (siblingNode.type === 'summary') {
      matchedSummaryNodeId = siblingNode.id;
      continue;
    }

    if (siblingNode.type === 'answer') {
      break;
    }
  }

  return matchedSummaryNodeId;
}

function findAnswerNodeIdBeforeIndex(
  tree: NodeTree,
  siblingIds: string[],
  startIndex: number,
) {
  for (let siblingIndex = startIndex - 1; siblingIndex >= 0; siblingIndex -= 1) {
    const siblingNode = tree.nodes[siblingIds[siblingIndex]];

    if (siblingNode?.type === 'answer') {
      return siblingNode.id;
    }
  }

  return null;
}

function buildJudgmentHint(
  judgmentNode: Extract<TreeNode, { type: 'judgment' }>,
  answerNode: Extract<TreeNode, { type: 'answer' }> | null,
) {
  const normalizedContent = judgmentNode.content.trim();
  const answerPrefix = answerNode
    ? `先回到「${answerNode.title}」，只补这次判断指出的缺口。`
    : '先只补这次判断指出的缺口。';

  if (!normalizedContent) {
    return `${answerPrefix} 不要直接改写成完整答案解析。`;
  }

  return `${answerPrefix} 不要直接改写成完整答案解析。\n${normalizedContent}`;
}

function findAncestorNode<TNodeType extends TreeNode['type']>(
  tree: NodeTree,
  nodeId: string,
  nodeType: TNodeType,
) {
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === nodeType) {
      return currentNode as Extract<TreeNode, { type: TNodeType }>;
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return null;
}

function formatNodeContent(title: string, content?: string) {
  const normalizedContent = content?.trim();

  if (!normalizedContent) {
    return title.trim();
  }

  return `${title.trim()}\n${normalizedContent}`;
}
