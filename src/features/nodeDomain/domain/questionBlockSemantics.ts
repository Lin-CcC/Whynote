import { getJudgmentNodeKind, getSummaryNodeKind } from './nodeSemantics';
import { getNodeOrThrow } from './treeDocument';
import type {
  AnswerNode,
  JudgmentNode,
  NodeTree,
  QuestionNode,
  SummaryNode,
  TreeNode,
} from './nodeTypes';

type QuestionBlockAnswerClosureNode = JudgmentNode | SummaryNode;

interface MutableQuestionBlockAnswerGroup {
  answer: AnswerNode;
  closureNodes: QuestionBlockAnswerClosureNode[];
}

interface MutableQuestionBlockSummaryGroup {
  checkNodes: JudgmentNode[];
  summary: SummaryNode;
}

export interface QuestionBlockAnswerGroup {
  answer: AnswerNode;
  historicalClosureNodes: QuestionBlockAnswerClosureNode[];
  latestEvaluationNode: JudgmentNode | null;
  latestExplanationNode: SummaryNode | null;
}

export interface QuestionBlockSummaryGroup {
  historicalCheckNodes: JudgmentNode[];
  latestCheckNode: JudgmentNode | null;
  summary: SummaryNode;
}

export interface QuestionBlockData {
  currentAnswerGroup: QuestionBlockAnswerGroup | null;
  fallbackNodes: TreeNode[];
  followUpQuestionIds: string[];
  previousAnswerGroups: QuestionBlockAnswerGroup[];
  question: QuestionNode;
  summaryGroups: QuestionBlockSummaryGroup[];
}

export function findNearestQuestionNodeId(
  tree: NodeTree,
  nodeId: string | null | undefined,
) {
  if (!nodeId || !tree.nodes[nodeId]) {
    return null;
  }

  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === 'question') {
      return currentNode.id;
    }

    currentNode =
      currentNode.parentId === null
        ? undefined
        : tree.nodes[currentNode.parentId];
  }

  return null;
}

export function resolveQuestionCurrentAnswerNodeId(
  tree: NodeTree,
  questionNodeId: string,
) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  const answerNodes = getQuestionChildNodes(tree, questionNode.id).filter(
    (childNode): childNode is AnswerNode => childNode.type === 'answer',
  );

  if (answerNodes.length === 0) {
    return null;
  }

  if (
    questionNode.currentAnswerId &&
    answerNodes.some((answerNode) => answerNode.id === questionNode.currentAnswerId)
  ) {
    return questionNode.currentAnswerId;
  }

  for (let index = answerNodes.length - 1; index >= 0; index -= 1) {
    const answerNode = answerNodes[index];

    if (answerNode && answerNode.content.trim().length > 0) {
      return answerNode.id;
    }
  }

  return answerNodes[answerNodes.length - 1]?.id ?? null;
}

export function buildQuestionBlockData(
  tree: NodeTree,
  questionNodeId: string,
): QuestionBlockData {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    throw new Error(`Node ${questionNodeId} is not a question.`);
  }

  const childNodes = getQuestionChildNodes(tree, questionNode.id);
  const answerNodes = childNodes.filter(
    (childNode): childNode is AnswerNode => childNode.type === 'answer',
  );
  const answerGroupsById = new Map<string, MutableQuestionBlockAnswerGroup>(
    answerNodes.map((answerNode) => [
      answerNode.id,
      {
        answer: answerNode,
        closureNodes: [],
      },
    ]),
  );
  const summaryGroupsById = new Map<string, MutableQuestionBlockSummaryGroup>();
  const followUpQuestionIds: string[] = [];
  const fallbackNodes: TreeNode[] = [];

  for (const childNode of childNodes) {
    if (childNode.type === 'answer') {
      continue;
    }

    if (childNode.type === 'question') {
      followUpQuestionIds.push(childNode.id);
      continue;
    }

    if (childNode.type === 'summary') {
      const summaryKind = getSummaryNodeKind(tree, childNode);

      if (summaryKind === 'manual') {
        summaryGroupsById.set(childNode.id, {
          checkNodes: [],
          summary: childNode,
        });
        continue;
      }

      if (summaryKind === 'answer-closure') {
        const answerGroup = resolveAnswerGroupForNode(
          childNodes,
          childNode,
          answerGroupsById,
        );

        if (answerGroup) {
          answerGroup.closureNodes.push(childNode);
          continue;
        }
      }

      fallbackNodes.push(childNode);
      continue;
    }

    if (childNode.type === 'judgment') {
      const judgmentKind = getJudgmentNodeKind(tree, childNode);

      if (judgmentKind === 'summary-check') {
        const summaryGroup = resolveSummaryGroupForNode(
          tree,
          childNodes,
          childNode,
          summaryGroupsById,
        );

        if (summaryGroup) {
          summaryGroup.checkNodes.push(childNode);
          continue;
        }
      }

      if (judgmentKind === 'answer-closure') {
        const answerGroup = resolveAnswerGroupForNode(
          childNodes,
          childNode,
          answerGroupsById,
        );

        if (answerGroup) {
          answerGroup.closureNodes.push(childNode);
          continue;
        }
      }

      fallbackNodes.push(childNode);
      continue;
    }

    fallbackNodes.push(childNode);
  }

  const currentAnswerNodeId = resolveQuestionCurrentAnswerNodeId(tree, questionNode.id);
  const currentAnswerGroup = currentAnswerNodeId
    ? buildAnswerGroup(answerGroupsById.get(currentAnswerNodeId) ?? null)
    : null;
  const previousAnswerGroups = answerNodes
    .filter((answerNode) => answerNode.id !== currentAnswerNodeId)
    .map((answerNode) => buildAnswerGroup(answerGroupsById.get(answerNode.id) ?? null))
    .filter((answerGroup): answerGroup is QuestionBlockAnswerGroup => answerGroup !== null);
  const summaryGroups = childNodes
    .filter(
      (childNode): childNode is SummaryNode =>
        childNode.type === 'summary' && getSummaryNodeKind(tree, childNode) === 'manual',
    )
    .map((summaryNode) => buildSummaryGroup(summaryGroupsById.get(summaryNode.id) ?? null))
    .filter((summaryGroup): summaryGroup is QuestionBlockSummaryGroup => summaryGroup !== null);

  return {
    currentAnswerGroup,
    fallbackNodes,
    followUpQuestionIds,
    previousAnswerGroups,
    question: questionNode,
    summaryGroups,
  };
}

function buildAnswerGroup(
  answerGroup: MutableQuestionBlockAnswerGroup | null,
): QuestionBlockAnswerGroup | null {
  if (!answerGroup) {
    return null;
  }

  const evaluationNodes = answerGroup.closureNodes.filter(
    (node): node is JudgmentNode => node.type === 'judgment',
  );
  const explanationNodes = answerGroup.closureNodes.filter(
    (node): node is SummaryNode => node.type === 'summary',
  );
  const latestEvaluationNode =
    evaluationNodes[evaluationNodes.length - 1] ?? null;
  const latestExplanationNode =
    explanationNodes[explanationNodes.length - 1] ?? null;

  return {
    answer: answerGroup.answer,
    historicalClosureNodes: answerGroup.closureNodes.filter(
      (node) =>
        node.id !== latestEvaluationNode?.id &&
        node.id !== latestExplanationNode?.id,
    ),
    latestEvaluationNode,
    latestExplanationNode,
  };
}

function buildSummaryGroup(
  summaryGroup: MutableQuestionBlockSummaryGroup | null,
): QuestionBlockSummaryGroup | null {
  if (!summaryGroup) {
    return null;
  }

  const latestCheckNode =
    summaryGroup.checkNodes[summaryGroup.checkNodes.length - 1] ?? null;

  return {
    historicalCheckNodes: summaryGroup.checkNodes.filter(
      (checkNode) => checkNode.id !== latestCheckNode?.id,
    ),
    latestCheckNode,
    summary: summaryGroup.summary,
  };
}

function resolveAnswerGroupForNode(
  childNodes: TreeNode[],
  node: JudgmentNode | SummaryNode,
  answerGroupsById: Map<string, MutableQuestionBlockAnswerGroup>,
) {
  if (node.sourceAnswerId && answerGroupsById.has(node.sourceAnswerId)) {
    return answerGroupsById.get(node.sourceAnswerId) ?? null;
  }

  const answerNodeId = findNearestAnswerNodeIdBeforeNode(childNodes, node.id);

  return answerNodeId ? answerGroupsById.get(answerNodeId) ?? null : null;
}

function resolveSummaryGroupForNode(
  tree: NodeTree,
  childNodes: TreeNode[],
  node: JudgmentNode,
  summaryGroupsById: Map<string, MutableQuestionBlockSummaryGroup>,
) {
  if (node.sourceSummaryId && summaryGroupsById.has(node.sourceSummaryId)) {
    return summaryGroupsById.get(node.sourceSummaryId) ?? null;
  }

  const summaryNodeId = findNearestManualSummaryNodeIdBeforeNode(
    tree,
    childNodes,
    node.id,
  );

  return summaryNodeId ? summaryGroupsById.get(summaryNodeId) ?? null : null;
}

function findNearestAnswerNodeIdBeforeNode(childNodes: TreeNode[], nodeId: string) {
  const nodeIndex = childNodes.findIndex((childNode) => childNode.id === nodeId);

  if (nodeIndex === -1) {
    return null;
  }

  for (let index = nodeIndex - 1; index >= 0; index -= 1) {
    const candidateNode = childNodes[index];

    if (candidateNode?.type === 'answer') {
      return candidateNode.id;
    }
  }

  return null;
}

function findNearestManualSummaryNodeIdBeforeNode(
  tree: NodeTree,
  childNodes: TreeNode[],
  nodeId: string,
) {
  const nodeIndex = childNodes.findIndex((childNode) => childNode.id === nodeId);

  if (nodeIndex === -1) {
    return null;
  }

  for (let index = nodeIndex - 1; index >= 0; index -= 1) {
    const candidateNode = childNodes[index];

    if (
      candidateNode?.type === 'summary' &&
      getSummaryNodeKind(tree, candidateNode) === 'manual'
    ) {
      return candidateNode.id;
    }
  }

  return null;
}

function getQuestionChildNodes(tree: NodeTree, questionNodeId: string) {
  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return [];
  }

  return questionNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is TreeNode => Boolean(childNode))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
}
