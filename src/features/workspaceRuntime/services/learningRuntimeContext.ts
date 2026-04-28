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

  const questionNode = getQuestionContextNode(tree, selectedNode.id);
  const answerNode = resolveScopedAnswerNode(tree, selectedNode.id);

  if (
    questionNode?.type === 'question' &&
    answerNode &&
    canEvaluateQuestionAnswer(tree, questionNode.id, answerNode.id)
  ) {
    return {
      answerNodeId: answerNode.id,
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
  const summaryNodeId =
    (answerNodeId
      ? getLatestSummaryNodeIdForAnswer(tree, questionNode.id, answerNodeId)
      : null) ??
    findSummaryNodeIdForJudgment(tree, questionNode.childIds, judgmentIndex);
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
  answerNode: Extract<TreeNode, { type: 'answer' }> | null,
) {
  const persistedHint = judgmentNode.hint?.trim();

  if (persistedHint) {
    return persistedHint;
  }

  const answerPrefix = answerNode
    ? `先回到「${answerNode.title}」，只补这次缺口。`
    : '先只补这次缺口。';
  const gapItems = extractJudgmentGapItems(judgmentNode.content, questionNode.title);
  const primaryGap = gapItems[0] ?? `把“${questionNode.title}”里还缺的关键点说清楚`;
  const hintLines = [
    answerPrefix,
    `先补哪块：${primaryGap}。`,
    buildHintPrimerFromGap(primaryGap, questionNode.title),
    '不要急着把整段答案解析搬回回答里，先把这一个缺口补完整。',
  ];

  return hintLines.join('\n');
}

function extractJudgmentGapItems(content: string, questionTitle: string) {
  const sectionText = extractStructuredSection(content, [
    '还缺的关键点',
    '当前最关键缺口',
    '还缺',
  ]);

  if (sectionText) {
    const structuredItems = splitGapItems(sectionText);

    if (structuredItems.length > 0) {
      return structuredItems;
    }
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return [
      `把“${questionTitle}”真正依赖的关键机制、因果关系或判断边界说清楚`,
    ];
  }

  const fallbackGap = normalizedContent
    .replace(/^已答到[:：][^\n]+/u, '')
    .replace(/^还缺(?:的关键点)?[:：]/u, '')
    .replace(/^为什么关键[:：][^\n]+/u, '')
    .replace(/^这次回答(?:还不完整|已答到[^。！？!?；]*?)，?/u, '')
    .replace(/^这版(?:只差把)?/u, '')
    .replace(/^回答方向对了，但/u, '')
    .replace(/^你还没有(?:解释|说明)?/u, '')
    .replace(/^还没有(?:解释|说明)?/u, '')
    .replace(/^还缺/u, '')
    .replace(/^只差把/u, '')
    .replace(/^需要继续把/u, '')
    .replace(/^需要把/u, '')
    .replace(/[。！？!?；;]+$/u, '')
    .trim();

  if (!fallbackGap) {
    return [
      `把“${questionTitle}”真正依赖的关键机制、因果关系或判断边界说清楚`,
    ];
  }

  return splitGapItems(fallbackGap);
}

function buildHintPrimerFromGap(primaryGap: string, questionTitle: string) {
  if (primaryGap.includes('为什么')) {
    return '先想清：把“发生了什么变化 -> 为什么会这样 -> 最后带来什么结果”连成一条因果链。';
  }

  if (primaryGap.includes('边界') || primaryGap.includes('条件')) {
    return '先想清：不要只说结论，先分清它在什么条件下成立、什么时候会失效。';
  }

  if (primaryGap.includes('关系') || primaryGap.includes('对象') || primaryGap.includes('机制')) {
    return '先想清：把相关对象各自扮演的角色分开，再说明它们怎样发生联系。';
  }

  return `先想清：围绕“${questionTitle}”，先把对象、关系和判断线索摆正，再决定要不要补更多背景。`;
}

function extractStructuredSection(content: string, labels: string[]) {
  for (const label of labels) {
    const sectionPattern = new RegExp(
      `${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:已答到|还缺的关键点|当前最关键缺口|还缺|为什么关键)[:：]|$)`,
      'u',
    );
    const matched = content.match(sectionPattern)?.[1]?.trim();

    if (matched) {
      return matched;
    }
  }

  return '';
}

function splitGapItems(content: string) {
  const normalizedItems = content
    .split(/\n|[；;]+/u)
    .map((item) =>
      item
        .replace(/^\s*[-*•]\s*/u, '')
        .replace(/^\s*\d+[.)、]\s*/u, '')
        .replace(/[。！？!?；;]+$/u, '')
        .trim(),
    )
    .filter(Boolean);

  if (normalizedItems.length > 0) {
    return normalizedItems.slice(0, 3);
  }

  return [
    content.replace(/[。！？!?；;]+$/u, '').trim(),
  ].filter(Boolean);
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
