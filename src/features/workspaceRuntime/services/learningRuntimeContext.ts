import type {
  LearningActionDraftInput,
  LearningReferenceCandidate,
  QuestionClosureInput,
} from '../../learningEngine';
import {
  buildFallbackClosureHintText,
  extractJudgmentGapItemsFromText,
} from '../../learningEngine/services/closureHint';
import {
  getCurrentQuestionAnswerNodeId,
  getJudgmentNodeKind,
  getNodeOrThrow,
  getQuestionAnswerClosureSummaryNodeId,
  getSummaryNodeKind,
  isScaffoldSummaryNode,
  type ModuleNode,
  type NodeTree,
  type PlanStepNode,
  type ResourceMetadataRecord,
  type TreeNode,
} from '../../nodeDomain';

const MAX_RESOURCE_REFERENCE_BODY_LENGTH = 600;
const MAX_RESOURCE_REFERENCE_SUMMARY_LENGTH = 180;
const EMPTY_RESOURCE_SUMMARY_VALUES = new Set([
  '暂无资料概况',
  '暂无资料摘要',
  '鏆傛棤璧勬枡鎽樿',
]);
const RESOURCE_BODY_FOUNDATION_LABEL = '正文基础（优先用于定位真实引用）';
const RESOURCE_SUMMARY_LABEL = '资料概况（只用于判断资料是否相关，不是引用正文）';

interface LearningReferenceContextOptions {
  resourceMetadataByNodeId?: Record<string, ResourceMetadataRecord | undefined>;
}

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

export interface SummaryEvaluationTarget {
  answerNodeId: string | null;
  questionNodeId: string;
  summaryNodeId: string;
}

export interface SummaryCheckJudgmentContext extends SummaryEvaluationTarget {
  judgmentNodeId: string;
}

export interface LearningActionRuntimeContext {
  currentNode: NonNullable<LearningActionDraftInput['currentNode']>;
  existingQuestionTitles: string[];
  focusContext: LearningActionDraftInput['focusContext'];
  introductions: string[];
  learnerAnswer: string;
  moduleNode: ModuleNode | null;
  planStepNode: PlanStepNode | null;
  questionPath: QuestionClosureInput['questionPath'];
  referenceCandidates: LearningReferenceCandidate[];
  resourceSummary: string;
}

export interface JudgmentHintRuntimeContext extends QuestionClosureRuntimeContext {
  judgmentContent: string;
  judgmentNodeId: string;
  questionNodeId: string;
  summaryContent: string;
}

export interface SummaryEvaluationRuntimeContext {
  answerNodeId: string | null;
  introductions: string[];
  learnerAnswer: string;
  learnerSummary: string;
  moduleNode: ModuleNode | null;
  planStepNode: PlanStepNode | null;
  questionNodeId: string;
  questionPath: QuestionClosureInput['questionPath'];
  referenceCandidates: LearningReferenceCandidate[];
  resourceSummary: string;
  summaryNodeId: string;
}

export function buildQuestionClosureRuntimeContext(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string,
  options: LearningReferenceContextOptions = {},
): QuestionClosureRuntimeContext {
  const planStepNode = findAncestorNode(tree, questionNodeId, 'plan-step');
  const referenceCandidates = collectLearningReferenceCandidates(
    tree,
    options.resourceMetadataByNodeId,
  );

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
  resourceMetadataByNodeId: Record<string, ResourceMetadataRecord | undefined> = {},
): LearningReferenceCandidate[] {
  if (Object.keys(resourceMetadataByNodeId).length > 0) {
    return collectLearningReferenceCandidates(tree).map((candidate) => {
      if (candidate.targetType !== 'resource') {
        return candidate;
      }

      return {
        ...candidate,
        content: buildResourceReferenceContent(
          candidate.content,
          resourceMetadataByNodeId[candidate.targetNodeId],
        ),
      };
    });
  }

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
  return getCurrentQuestionAnswerNodeId(tree, questionNodeId);
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

  if (!answerNodeId) {
    return null;
  }

  return getQuestionAnswerClosureSummaryNodeId(
    tree,
    questionNode.id,
    answerNodeId,
  );
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
  const questionNode = getQuestionContextNode(tree, selectedNode.id);
  const answerNodeId = questionNode
    ? getCurrentQuestionAnswerNodeId(tree, questionNode.id)
    : null;

  if (
    questionNode?.type === 'question' &&
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

  if (
    !judgmentNode ||
    judgmentNode.type !== 'judgment' ||
    judgmentNode.parentId === null ||
    getJudgmentNodeKind(tree, judgmentNode) !== 'answer-closure'
  ) {
    return null;
  }

  const questionNode = tree.nodes[judgmentNode.parentId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const answerNodeId = resolveAnswerNodeIdForAnswerClosureJudgment(
    tree,
    questionNode.id,
    judgmentNode.id,
  );
  const summaryNodeId = answerNodeId
    ? getQuestionAnswerClosureSummaryNodeId(tree, questionNode.id, answerNodeId)
    : null;
  const answerNode =
    answerNodeId && tree.nodes[answerNodeId]?.type === 'answer'
      ? tree.nodes[answerNodeId]
      : null;

  return {
    answerNodeId,
    hint: buildJudgmentHint(judgmentNode, questionNode, answerNode),
    questionNodeId: questionNode.id,
    summaryNodeId,
  };
}

export function buildJudgmentHintRuntimeContext(
  tree: NodeTree,
  judgmentNodeId: string,
  options: LearningReferenceContextOptions = {},
): JudgmentHintRuntimeContext {
  const judgmentNode = getNodeOrThrow(tree, judgmentNodeId);

  if (
    judgmentNode.type !== 'judgment' ||
    judgmentNode.parentId === null ||
    getJudgmentNodeKind(tree, judgmentNode) !== 'answer-closure'
  ) {
    throw new Error('当前节点不是可生成提示的 judgment。');
  }

  const questionNode = tree.nodes[judgmentNode.parentId];

  if (questionNode?.type !== 'question') {
    throw new Error('当前 judgment 没有关联 question，无法生成提示。');
  }

  const judgmentIndex = questionNode.childIds.indexOf(judgmentNode.id);

  if (judgmentIndex === -1) {
    throw new Error('当前 judgment 不在所属 question 的子节点序列中。');
  }

  const answerNodeId = resolveAnswerNodeIdForAnswerClosureJudgment(
    tree,
    questionNode.id,
    judgmentNode.id,
  );

  if (!answerNodeId) {
    throw new Error('当前 judgment 还没有关联回答，暂时无法生成提示。');
  }

  const summaryNodeId = getQuestionAnswerClosureSummaryNodeId(
    tree,
    questionNode.id,
    answerNodeId,
  );
  const summaryNode =
    summaryNodeId && tree.nodes[summaryNodeId]?.type === 'summary'
      ? tree.nodes[summaryNodeId]
      : null;
  const closureContext = buildQuestionClosureRuntimeContext(
    tree,
    questionNode.id,
    answerNodeId,
    options,
  );

  return {
    ...closureContext,
    judgmentContent: judgmentNode.content,
    judgmentNodeId: judgmentNode.id,
    questionNodeId: questionNode.id,
    summaryContent: summaryNode?.content ?? '',
  };
}

export function resolveSummaryEvaluationTarget(
  tree: NodeTree,
  selectedNodeId: string | null,
): SummaryEvaluationTarget | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (
    selectedNode.type !== 'summary' ||
    selectedNode.parentId === null ||
    isScaffoldSummaryNode(tree, selectedNode) ||
    getSummaryNodeKind(tree, selectedNode) !== 'manual'
  ) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];

  if (parentNode?.type !== 'question') {
    return null;
  }

  return {
    answerNodeId:
      resolveAnswerNodeForSummary(tree, parentNode.id, selectedNode)?.id ??
      getCurrentQuestionAnswerNodeId(tree, parentNode.id),
    questionNodeId: parentNode.id,
    summaryNodeId: selectedNode.id,
  };
}

export function buildSummaryEvaluationRuntimeContext(
  tree: NodeTree,
  summaryNodeId: string,
  options: LearningReferenceContextOptions = {},
): SummaryEvaluationRuntimeContext {
  const summaryNode = getNodeOrThrow(tree, summaryNodeId);

  if (
    summaryNode.type !== 'summary' ||
    summaryNode.parentId === null ||
    isScaffoldSummaryNode(tree, summaryNode)
  ) {
    throw new Error('当前节点不是可检查理解的 summary。');
  }

  const questionNode = tree.nodes[summaryNode.parentId];

  if (questionNode?.type !== 'question') {
    throw new Error('当前 summary 不在 question 语境下，暂时无法做理解检查。');
  }

  const planStepNode = findAncestorNode(tree, questionNode.id, 'plan-step');
  const referenceCandidates = collectLearningReferenceCandidates(
    tree,
    options.resourceMetadataByNodeId,
  );

  if (!planStepNode) {
    throw new Error('当前总结不在任何学习步骤下，无法生成理解检查。');
  }

  const answerNode = resolveAnswerNodeForSummary(
    tree,
    questionNode.id,
    summaryNode,
  );
  const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(
    tree,
    questionNode.id,
  );
  const currentAnswerNode =
    currentAnswerNodeId && tree.nodes[currentAnswerNodeId]?.type === 'answer'
      ? tree.nodes[currentAnswerNodeId]
      : null;

  return {
    answerNodeId: answerNode?.id ?? currentAnswerNode?.id ?? null,
    introductions: collectPlanStepIntroductions(tree, planStepNode.id),
    learnerAnswer: answerNode
      ? formatAnswerForEvaluation(answerNode)
      : currentAnswerNode
        ? formatAnswerForEvaluation(currentAnswerNode)
        : '',
    learnerSummary: formatNodeContent(summaryNode.title, summaryNode.content),
    moduleNode: findAncestorNode(tree, questionNode.id, 'module'),
    planStepNode,
    questionNodeId: questionNode.id,
    questionPath: collectQuestionPath(tree, questionNode.id),
    referenceCandidates,
    resourceSummary: summarizeLearningReferenceCandidates(referenceCandidates),
    summaryNodeId: summaryNode.id,
  };
}

export function resolveSummaryCheckJudgmentContext(
  tree: NodeTree,
  selectedNodeId: string | null,
): SummaryCheckJudgmentContext | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  if (
    selectedNode.type !== 'judgment' ||
    selectedNode.parentId === null ||
    getJudgmentNodeKind(tree, selectedNode) !== 'summary-check'
  ) {
    return null;
  }

  const questionNode = tree.nodes[selectedNode.parentId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const summaryNode = resolveSummaryNodeForSummaryCheckJudgment(
    tree,
    questionNode.id,
    selectedNode.id,
  );

  if (!summaryNode) {
    return null;
  }

  return {
    answerNodeId: resolveAnswerNodeIdForSummaryCheckJudgment(
      tree,
      questionNode.id,
      selectedNode.id,
      summaryNode,
    ),
    judgmentNodeId: selectedNode.id,
    questionNodeId: questionNode.id,
    summaryNodeId: summaryNode.id,
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
  options: LearningReferenceContextOptions = {},
): LearningActionRuntimeContext {
  const selectedNode = getNodeOrThrow(tree, selectedNodeId);
  const planStepNode = findAncestorNode(tree, selectedNodeId, 'plan-step');
  const questionNode = getQuestionContextNode(tree, selectedNodeId);
  const answerNode = resolveScopedAnswerNode(tree, selectedNodeId);
  const referenceCandidates = collectLearningReferenceCandidates(
    tree,
    options.resourceMetadataByNodeId,
  );

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
    focusContext: resolveQuestionSourceContext(tree, selectedNode),
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

function resolveQuestionSourceContext(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionDraftInput['focusContext'] {
  if (selectedNode.type !== 'question' || !selectedNode.sourceContext) {
    return undefined;
  }

  const liveSourceNode =
    selectedNode.sourceContext.nodeId &&
    tree.nodes[selectedNode.sourceContext.nodeId]?.type ===
      selectedNode.sourceContext.nodeType
      ? tree.nodes[selectedNode.sourceContext.nodeId]
      : null;
  const title = liveSourceNode?.title ?? selectedNode.sourceContext.title;
  const content = liveSourceNode?.content ?? selectedNode.sourceContext.content;

  return {
    content,
    title,
    type: selectedNode.sourceContext.nodeType,
  };
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

  const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, parentNode.id);
  const currentAnswerNode =
    currentAnswerNodeId && tree.nodes[currentAnswerNodeId]?.type === 'answer'
      ? tree.nodes[currentAnswerNodeId]
      : null;

  if (selectedNode.type === 'summary') {
    return resolveAnswerNodeForSummary(tree, parentNode.id, selectedNode) ??
      currentAnswerNode;
  }

  if (getJudgmentNodeKind(tree, selectedNode) === 'summary-check') {
    const summaryNode = resolveSummaryNodeForSummaryCheckJudgment(
      tree,
      parentNode.id,
      selectedNode.id,
    );
    const summaryCheckAnswerNodeId = resolveAnswerNodeIdForSummaryCheckJudgment(
      tree,
      parentNode.id,
      selectedNode.id,
      summaryNode,
    );

    return summaryCheckAnswerNodeId &&
      tree.nodes[summaryCheckAnswerNodeId]?.type === 'answer'
      ? tree.nodes[summaryCheckAnswerNodeId]
      : currentAnswerNode;
  }

  const answerNodeId = resolveAnswerNodeIdForAnswerClosureJudgment(
    tree,
    parentNode.id,
    selectedNode.id,
  );

  return answerNodeId && tree.nodes[answerNodeId]?.type === 'answer'
    ? tree.nodes[answerNodeId]
    : currentAnswerNode;
}

function resolveAnswerNodeIdForAnswerClosureJudgment(
  tree: NodeTree,
  questionNodeId: string,
  judgmentNodeId: string,
) {
  const judgmentNode = tree.nodes[judgmentNodeId];

  if (
    judgmentNode?.type === 'judgment' &&
    judgmentNode.sourceAnswerId &&
    tree.nodes[judgmentNode.sourceAnswerId]?.type === 'answer' &&
    tree.nodes[judgmentNode.sourceAnswerId]?.parentId === questionNodeId
  ) {
    return judgmentNode.sourceAnswerId;
  }

  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return null;
  }

  const judgmentIndex = questionNode.childIds.indexOf(judgmentNodeId);

  if (judgmentIndex === -1) {
    return null;
  }

  return findAnswerNodeIdForJudgment(tree, questionNode.childIds, judgmentIndex);
}

function resolveSummaryNodeForSummaryCheckJudgment(
  tree: NodeTree,
  questionNodeId: string,
  judgmentNodeId: string,
) {
  const judgmentNode = tree.nodes[judgmentNodeId];
  const linkedSummaryNode = judgmentNode?.type === 'judgment' &&
    judgmentNode.sourceSummaryId
    ? tree.nodes[judgmentNode.sourceSummaryId]
    : null;

  if (
    linkedSummaryNode?.type === 'summary' &&
    linkedSummaryNode.parentId === questionNodeId &&
    getSummaryNodeKind(tree, linkedSummaryNode) === 'manual'
  ) {
    return linkedSummaryNode;
  }

  return findImmediatePreviousSummarySibling(tree, questionNodeId, judgmentNodeId);
}

function resolveAnswerNodeIdForSummaryCheckJudgment(
  tree: NodeTree,
  questionNodeId: string,
  judgmentNodeId: string,
  summaryNode?: Extract<TreeNode, { type: 'summary' }> | null,
) {
  const judgmentNode = tree.nodes[judgmentNodeId];

  if (
    judgmentNode?.type === 'judgment' &&
    judgmentNode.sourceAnswerId &&
    tree.nodes[judgmentNode.sourceAnswerId]?.type === 'answer' &&
    tree.nodes[judgmentNode.sourceAnswerId]?.parentId === questionNodeId
  ) {
    return judgmentNode.sourceAnswerId;
  }

  const resolvedSummaryNode =
    summaryNode ??
    resolveSummaryNodeForSummaryCheckJudgment(tree, questionNodeId, judgmentNodeId);
  const summaryAnswerNode = resolvedSummaryNode
    ? resolveAnswerNodeForSummary(tree, questionNodeId, resolvedSummaryNode)
    : null;

  if (summaryAnswerNode) {
    return summaryAnswerNode.id;
  }

  return getCurrentQuestionAnswerNodeId(tree, questionNodeId);
}

export function getLatestSummaryNodeIdForAnswer(
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
      childNode.type === 'summary' &&
      getSummaryNodeKind(tree, childNode) === 'answer-closure' &&
      (!childNode.sourceAnswerId || childNode.sourceAnswerId === answerNodeId),
  );

  return summaryNodes[summaryNodes.length - 1]?.id ?? null;
}

export function findLatestAnswerBeforeQuestionChild(
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

function findAnswerNodeIdForJudgment(
  tree: NodeTree,
  siblingIds: string[],
  judgmentIndex: number,
) {
  return findAnswerNodeIdBeforeIndex(tree, siblingIds, judgmentIndex);
}

function resolveAnswerNodeForSummary(
  tree: NodeTree,
  questionNodeId: string,
  summaryNode: Extract<TreeNode, { type: 'summary' }>,
): Extract<TreeNode, { type: 'answer' }> | null {
  const linkedAnswerNode = summaryNode.sourceAnswerId
    ? tree.nodes[summaryNode.sourceAnswerId]
    : null;

  if (
    linkedAnswerNode?.type === 'answer' &&
    linkedAnswerNode.parentId === questionNodeId
  ) {
    return linkedAnswerNode;
  }

  return findLatestAnswerBeforeQuestionChild(tree, questionNodeId, summaryNode.id);
}

function findImmediatePreviousSummarySibling(
  tree: NodeTree,
  questionNodeId: string,
  judgmentNodeId: string,
) {
  const questionChildNodes = collectQuestionChildNodes(tree, questionNodeId);
  const judgmentIndex = questionChildNodes.findIndex(
    (childNode) => childNode.id === judgmentNodeId,
  );

  if (judgmentIndex <= 0) {
    return null;
  }

  const previousNode = questionChildNodes[judgmentIndex - 1];

  return previousNode?.type === 'summary' &&
    getSummaryNodeKind(tree, previousNode) === 'manual'
    ? previousNode
    : null;
}

export function findSummaryNodeIdForJudgment(
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
  questionNode: Extract<TreeNode, { type: 'question' }>,
  _answerNode: Extract<TreeNode, { type: 'answer' }> | null,
) {
  const persistedHint = judgmentNode.hint?.trim();

  if (persistedHint) {
    return persistedHint;
  }

  return buildFallbackClosureHintText({
    currentQuestionTitle: questionNode.title,
    judgmentGapItems: extractJudgmentGapItemsFromText(
      judgmentNode.content,
      questionNode.title,
    ),
    judgmentContent: judgmentNode.content,
  });
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

function buildResourceReferenceContent(
  resourceSummary: string,
  resourceMetadata?: ResourceMetadataRecord,
) {
  const normalizedSummary = truncateReferenceText(
    normalizeReferenceText(
      EMPTY_RESOURCE_SUMMARY_VALUES.has(resourceSummary.trim()) ? '' : resourceSummary,
    ),
    MAX_RESOURCE_REFERENCE_SUMMARY_LENGTH,
  );
  const bodyFoundation = truncateReferenceText(
    normalizeReferenceText(resourceMetadata?.bodyText),
    MAX_RESOURCE_REFERENCE_BODY_LENGTH,
  );

  if (bodyFoundation) {
    if (normalizedSummary && !bodyFoundation.includes(normalizedSummary)) {
      return `${RESOURCE_BODY_FOUNDATION_LABEL}：${bodyFoundation}\n${RESOURCE_SUMMARY_LABEL}：${normalizedSummary}`;
    }

    return `${RESOURCE_BODY_FOUNDATION_LABEL}：${bodyFoundation}`;
  }

  return normalizedSummary
    ? `${RESOURCE_SUMMARY_LABEL}：${normalizedSummary}`
    : '暂无资料概况';
}

function normalizeReferenceText(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(/\s+/gu, ' ').trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function truncateReferenceText(value: string | null, maxLength: number) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
