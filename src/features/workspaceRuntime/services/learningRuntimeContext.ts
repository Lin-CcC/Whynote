import type {
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
): QuestionClosureRuntimeContext {
  const planStepNode = findAncestorNode(tree, questionNodeId, 'plan-step');
  const referenceCandidates = collectLearningReferenceCandidates(tree);

  if (!planStepNode) {
    throw new Error('当前问题不在任何学习步骤下，无法生成回答评估闭环。');
  }

  return {
    introductions: collectPlanStepIntroductions(tree, planStepNode.id),
    learnerAnswer: collectQuestionAnswerText(tree, questionNodeId),
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
  return collectAnswerNodes(tree, questionNodeId).length > 0;
}

export function getQuestionNodeIdForAnswerEvaluation(
  tree: NodeTree,
  selectedNodeId: string | null,
) {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (
    selectedNode.type === 'question' &&
    isLeafQuestion(tree, selectedNode.id) &&
    hasQuestionAnswerEvidence(tree, selectedNode.id)
  ) {
    return selectedNode.id;
  }

  if (selectedNode.type !== 'answer' || selectedNode.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];

  if (
    parentNode?.type === 'question' &&
    isLeafQuestion(tree, parentNode.id) &&
    hasQuestionAnswerEvidence(tree, parentNode.id)
  ) {
    return parentNode.id;
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
  return collectAnswerNodes(tree, questionNodeId)
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
