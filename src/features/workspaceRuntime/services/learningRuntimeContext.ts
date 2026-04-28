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
  answerNodeId?: string,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  if (!answerNodeId) {
    return null;
  }

  return getLatestSummaryNodeIdForAnswer(tree, questionNode.id, answerNodeId);
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

  if (selectedNode.type === 'answer' && selectedNode.parentId !== null) {
    const parentNode = tree.nodes[selectedNode.parentId];

    if (
      parentNode?.type === 'question' &&
      canEvaluateQuestionAnswer(tree, parentNode.id, selectedNode.id)
    ) {
      return {
        answerNodeId: selectedNode.id,
        questionNodeId: parentNode.id,
      };
    }
  }

  if (selectedNode.type !== 'judgment' || selectedNode.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];
  const answerNode = resolveScopedAnswerNode(tree, selectedNode.id);

  if (
    parentNode?.type === 'question' &&
    answerNode &&
    canEvaluateQuestionAnswer(tree, parentNode.id, answerNode.id)
  ) {
    return {
      answerNodeId: answerNode.id,
      questionNodeId: parentNode.id,
    };
  }

  return null;
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
  const answerNode = resolveScopedAnswerNode(tree, selectedNodeId);
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
    learnerAnswer: answerNode
      ? formatAnswerForEvaluation(answerNode)
      : questionNode
        ? collectQuestionAnswerText(tree, questionNode.id)
        : '',
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

function resolveScopedAnswerNode(tree: NodeTree, selectedNodeId: string) {
  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (selectedNode.type === 'answer') {
    return selectedNode;
  }

  if (
    (selectedNode.type !== 'summary' && selectedNode.type !== 'judgment') ||
    selectedNode.parentId === null
  ) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];

  if (parentNode?.type !== 'question') {
    return null;
  }

  return findLatestAnswerBeforeQuestionChild(
    tree,
    parentNode.id,
    selectedNode.id,
  );
}

function getLatestSummaryNodeIdForAnswer(
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
    (childNode): childNode is Extract<TreeNode, { type: 'summary' }> =>
      childNode.type === 'summary',
  );

  return summaryNodes[summaryNodes.length - 1]?.id ?? null;
}

function findLatestAnswerBeforeQuestionChild(
  tree: NodeTree,
  questionNodeId: string,
  questionChildNodeId: string,
) {
  const questionChildNodes = collectQuestionChildNodes(tree, questionNodeId);
  const childIndex = questionChildNodes.findIndex(
    (childNode) => childNode.id === questionChildNodeId,
  );

  if (childIndex === -1) {
    return null;
  }

  for (let index = childIndex - 1; index >= 0; index -= 1) {
    const childNode = questionChildNodes[index];

    if (childNode.type === 'answer') {
      return childNode;
    }
  }

  return null;
}

function collectQuestionChildNodes(tree: NodeTree, questionNodeId: string) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return [];
  }

  return questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is TreeNode => Boolean(childNode))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
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
