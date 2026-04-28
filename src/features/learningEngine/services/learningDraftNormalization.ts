import type {
  LearningActionDraftActionId,
  JudgmentNodeDraft,
  LearningMode,
  ModuleNodeDraft,
  PlanStepNodeDraft,
  QuestionClosureResult,
  QuestionNodeDraft,
  SummaryNodeDraft,
} from '../domain';
import { getLearningModeLimits } from '../domain';

const MODULE_TITLE_SUFFIXES = [
  '整体框架',
  '核心概念',
  '关键机制',
  '应用练习',
  '常见误区',
  '深入专题',
  '总结复盘',
] as const;

const PLAN_STEP_TITLE_SUFFIXES = [
  '明确范围',
  '拆解关键概念',
  '梳理核心机制',
  '验证理解',
  '建立联系',
  '总结复盘',
] as const;

const QUESTION_TITLE_SUFFIXES = [
  '关键问题',
  '需要解释什么',
  '如何判断你真的理解了',
] as const;
const MIN_INTRODUCTION_LENGTH = 42;
const MIN_INTRODUCTION_SENTENCE_COUNT = 2;
const MIN_QUESTION_GUIDANCE_LENGTH = 18;
const MIN_SUMMARY_EXPLANATION_LENGTH = 20;

interface RawModuleDraft {
  title?: unknown;
  content?: unknown;
  description?: unknown;
  planSteps?: unknown;
  steps?: unknown;
}

interface RawPlanStepDraft {
  title?: unknown;
  content?: unknown;
  description?: unknown;
  introductions?: unknown;
  prerequisiteQuestions?: unknown;
  prerequisites?: unknown;
  keyQuestions?: unknown;
  questions?: unknown;
}

interface RawLearningNodeDraft {
  title?: unknown;
  content?: unknown;
  description?: unknown;
  prompt?: unknown;
  citations?: unknown;
  references?: unknown;
}

interface RawQuestionClosurePayload {
  isAnswerSufficient?: unknown;
  answerSufficient?: unknown;
  judgment?: unknown;
  evaluation?: unknown;
  summary?: unknown;
  explanation?: unknown;
  followUpQuestions?: unknown;
  followUps?: unknown;
  nextQuestions?: unknown;
}

export function parseJsonObject(rawText: string): unknown {
  const normalizedText = stripCodeFence(rawText);

  try {
    return JSON.parse(normalizedText) as unknown;
  } catch {
    throw new Error('AI 返回的内容不是合法 JSON。');
  }
}

export function normalizeModuleDrafts(
  payload: unknown,
  topic: string,
  mode: LearningMode,
): ModuleNodeDraft[] {
  const limits = getLearningModeLimits(mode);
  const rawModules = extractRawModules(payload);
  const desiredCount =
    rawModules.length === 0
      ? limits.moduleCount.target
      : clamp(rawModules.length, limits.moduleCount.min, limits.moduleCount.max);
  const normalizedModules = rawModules
    .slice(0, limits.moduleCount.max)
    .map((rawModule, index) =>
      normalizeModuleDraft(rawModule, index, topic, mode),
    );

  while (normalizedModules.length < desiredCount) {
    normalizedModules.push(
      createFallbackModuleDraft(topic, normalizedModules.length, mode),
    );
  }

  ensureUniqueTitles(normalizedModules);

  return normalizedModules;
}

export function normalizePlanStepDrafts(
  payload: unknown,
  moduleTitle: string,
  mode: LearningMode,
): PlanStepNodeDraft[] {
  const limits = getLearningModeLimits(mode);
  const rawPlanSteps = extractRawPlanSteps(payload);
  const desiredCount =
    rawPlanSteps.length === 0
      ? limits.planStepCount.target
      : clamp(
          rawPlanSteps.length,
          limits.planStepCount.min,
          limits.planStepCount.max,
        );
  const normalizedPlanSteps = rawPlanSteps
    .slice(0, limits.planStepCount.max)
    .map((rawPlanStep, index) =>
      normalizePlanStepDraft(rawPlanStep, index, moduleTitle),
    );

  while (normalizedPlanSteps.length < desiredCount) {
    normalizedPlanSteps.push(
      createFallbackPlanStepDraft(moduleTitle, normalizedPlanSteps.length),
    );
  }

  ensureUniqueTitles(normalizedPlanSteps);

  return normalizedPlanSteps;
}

export function normalizeQuestionClosure(
  payload: unknown,
  options?: {
    currentQuestionTitle?: string;
  },
): QuestionClosureResult {
  const rawPayload = isRecord(payload) ? (payload as RawQuestionClosurePayload) : {};
  const isAnswerSufficient = resolveAnswerSufficiency(rawPayload);
  const judgment = normalizeJudgmentDraft(
    rawPayload.judgment ?? rawPayload.evaluation,
    isAnswerSufficient,
    options?.currentQuestionTitle,
  );
  const summary = normalizeClosureSummaryDraft(
    rawPayload.summary ?? rawPayload.explanation,
    {
      currentQuestionTitle: options?.currentQuestionTitle,
      isAnswerSufficient,
    },
  );
  const followUpQuestions = normalizeFollowUpQuestionDrafts(
    rawPayload,
    isAnswerSufficient,
    options?.currentQuestionTitle,
  );

  return {
    isAnswerSufficient,
    judgment,
    summary,
    followUpQuestions,
    metadata: {
      model: '',
      providerLabel: '',
    },
  };
}

export function normalizeLearningActionDraft(
  payload: unknown,
  options: {
    actionId: LearningActionDraftActionId;
    currentQuestionTitle?: string;
    planStepTitle?: string;
    questionTitles?: string[];
    hasLearnerAnswer?: boolean;
  },
) {
  const rawNode = isRecord(payload) ? (payload as RawLearningNodeDraft) : {};

  switch (options.actionId) {
    case 'insert-scaffold':
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
      return normalizeScaffoldActionDraft(rawNode, {
        actionId: options.actionId,
        planStepTitle: options.planStepTitle,
        questionTitles: options.questionTitles,
      });
    case 'insert-question':
      return normalizeStandaloneQuestionDraft(rawNode, options);
    case 'insert-summary':
      return normalizeActionSummaryDraft(rawNode, options);
    case 'insert-judgment':
      return normalizeActionJudgmentDraft(rawNode, options);
  }
}

function normalizeModuleDraft(
  rawModule: RawModuleDraft,
  index: number,
  topic: string,
  mode: LearningMode,
): ModuleNodeDraft {
  const title = getText(rawModule.title);
  const normalizedTitle = title || createModuleTitle(topic, index);
  const content = getText(rawModule.content) || getText(rawModule.description);

  return {
    type: 'module',
    title: normalizedTitle,
    content,
    planSteps: normalizePlanStepDrafts(
      {
        planSteps: rawModule.planSteps ?? rawModule.steps,
      },
      normalizedTitle,
      mode,
    ),
  };
}

function normalizePlanStepDraft(
  rawPlanStep: RawPlanStepDraft,
  index: number,
  moduleTitle: string,
): PlanStepNodeDraft {
  const title = getText(rawPlanStep.title);
  const content =
    getText(rawPlanStep.content) || getText(rawPlanStep.description);
  const normalizedTitle = title || createPlanStepTitle(moduleTitle, index);
  const questions = normalizeQuestionDrafts(rawPlanStep, normalizedTitle);

  return {
    type: 'plan-step',
    title: normalizedTitle,
    content,
    introductions: normalizeIntroductionDrafts(
      rawPlanStep,
      normalizedTitle,
      questions.map((question) => question.title),
    ),
    questions,
    status: 'todo',
  };
}

function createFallbackModuleDraft(
  topic: string,
  index: number,
  mode: LearningMode,
): ModuleNodeDraft {
  const title = createModuleTitle(topic, index);

  return {
    type: 'module',
    title,
    content: '',
    planSteps: normalizePlanStepDrafts(
      {
        planSteps: [],
      },
      title,
      mode,
    ),
  };
}

function createFallbackPlanStepDraft(
  moduleTitle: string,
  index: number,
): PlanStepNodeDraft {
  const title = createPlanStepTitle(moduleTitle, index);
  const questions = createFallbackQuestionDrafts(title);

  return {
    type: 'plan-step',
    title,
    content: '',
    introductions: createFallbackIntroductionDrafts(
      title,
      questions.map((question) => question.title),
    ),
    questions,
    status: 'todo',
  };
}

function normalizeIntroductionDrafts(
  rawPlanStep: RawPlanStepDraft,
  planStepTitle: string,
  questionTitles: string[],
) {
  const rawIntroductions = extractRawLearningNodeDrafts(
    rawPlanStep.introductions ??
      rawPlanStep.prerequisites ??
      rawPlanStep.prerequisiteQuestions,
  );
  const normalizedIntroductions = rawIntroductions.map((rawIntroduction, index) =>
    normalizeIntroductionDraft(
      rawIntroduction,
      index,
      planStepTitle,
      questionTitles,
    ),
  );

  if (normalizedIntroductions.length === 0) {
    return createFallbackIntroductionDrafts(planStepTitle, questionTitles);
  }

  ensureUniqueTitles(normalizedIntroductions);

  return normalizedIntroductions;
}

function normalizeQuestionDrafts(
  rawPlanStep: RawPlanStepDraft,
  planStepTitle: string,
) {
  const rawQuestions = extractRawLearningNodeDrafts(
    rawPlanStep.questions ?? rawPlanStep.keyQuestions,
  );
  const normalizedQuestions = rawQuestions.map((rawQuestion, index) =>
    normalizeQuestionDraft(rawQuestion, index, planStepTitle),
  );

  if (normalizedQuestions.length === 0) {
    return createFallbackQuestionDrafts(planStepTitle);
  }

  ensureUniqueTitles(normalizedQuestions);

  return normalizedQuestions;
}

function normalizeIntroductionDraft(
  rawIntroduction: RawLearningNodeDraft,
  index: number,
  planStepTitle: string,
  questionTitles: string[],
): SummaryNodeDraft {
  const rawTitle =
    getText(rawIntroduction.title) ||
    getText(rawIntroduction.prompt) ||
    `建立前置理解 ${String(index + 1)}`;
  const rawContent =
    getText(rawIntroduction.content) ||
    getText(rawIntroduction.description) ||
    '';

  return {
    type: 'summary',
    title: normalizeIntroductionTitle(rawTitle, planStepTitle, index),
    content: normalizeIntroductionContent(
      rawContent,
      planStepTitle,
      questionTitles,
    ),
    citations: normalizeCitationDrafts(
      rawIntroduction.citations ?? rawIntroduction.references,
    ),
  };
}

function normalizeQuestionDraft(
  rawQuestion: RawLearningNodeDraft,
  index: number,
  planStepTitle: string,
): QuestionNodeDraft {
  const title =
    getText(rawQuestion.title) ||
    getText(rawQuestion.prompt) ||
    createQuestionTitle(planStepTitle, index);
  const content =
    getText(rawQuestion.content) ||
    getText(rawQuestion.description) ||
    '请结合当前 step，用自己的话回答这个具体问题。';

  return {
    type: 'question',
    title,
    content: normalizeQuestionContent(content, title, planStepTitle),
    citations: normalizeCitationDrafts(
      rawQuestion.citations ?? rawQuestion.references,
    ),
  };
}

function normalizeScaffoldActionDraft(
  rawNode: RawLearningNodeDraft,
  options: {
    actionId: Extract<
      LearningActionDraftActionId,
      'insert-scaffold' | 'rephrase-scaffold' | 'simplify-scaffold' | 'add-example'
    >;
    planStepTitle?: string;
    questionTitles?: string[];
  },
): SummaryNodeDraft {
  const fallbackTitle = getScaffoldActionFallbackTitle(options.actionId);
  const planStepLabel = options.planStepTitle || '当前步骤';
  const title =
    getText(rawNode.title) ||
    getText(rawNode.prompt) ||
    fallbackTitle;
  const rawContent =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    getScaffoldActionFallbackContent(options.actionId);

  return {
    type: 'summary',
    title: normalizeIntroductionTitle(title, planStepLabel, 0),
    content: normalizeIntroductionContent(
      rawContent,
      planStepLabel,
      options.questionTitles ?? [],
    ),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeStandaloneQuestionDraft(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
): QuestionNodeDraft {
  const title =
    getText(rawNode.title) ||
    getText(rawNode.prompt) ||
    getStandaloneQuestionFallbackTitle(
      options.currentQuestionTitle,
      options.planStepTitle,
    );
  const rawContent =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    getStandaloneQuestionFallbackContent(
      options.currentQuestionTitle,
      options.planStepTitle,
    );
  const planStepLabel =
    options.planStepTitle || options.currentQuestionTitle || '当前步骤';

  return {
    type: 'question',
    title,
    content: normalizeQuestionContent(rawContent, title, planStepLabel),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeJudgmentDraft(
  rawJudgment: unknown,
  isAnswerSufficient: boolean,
  currentQuestionTitle?: string,
): JudgmentNodeDraft {
  const rawNode = isRecord(rawJudgment)
    ? (rawJudgment as RawLearningNodeDraft)
    : {};
  const title = getText(rawNode.title);
  const rawContent =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    (isAnswerSufficient
      ? '可以进入下一步。'
      : '需要继续补充。');

  return {
    type: 'judgment',
    title: normalizeJudgmentTitle(title, isAnswerSufficient),
    content: normalizeJudgmentContent(
      rawContent,
      isAnswerSufficient,
      currentQuestionTitle,
    ),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeClosureSummaryDraft(
  rawSummary: unknown,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
  },
): SummaryNodeDraft {
  const rawNode = isRecord(rawSummary)
    ? (rawSummary as RawLearningNodeDraft)
    : {};
  const title = getText(rawNode.title);
  const rawContent =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    '';

  return {
    type: 'summary',
    title: title || '总结：标准理解',
    content: normalizeClosureSummaryContent(rawContent, options),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeActionSummaryDraft(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
): SummaryNodeDraft {
  const title = normalizeActionSummaryTitle(
    getText(rawNode.title) || getText(rawNode.prompt),
  );
  const rawContent =
    getText(rawNode.content) || getText(rawNode.description) || '';

  return {
    type: 'summary',
    title,
    content: normalizeActionSummaryContent(rawContent, options),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeActionJudgmentDraft(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
    hasLearnerAnswer?: boolean;
  },
): JudgmentNodeDraft {
  const title = getText(rawNode.title) || getText(rawNode.prompt);
  const rawContent =
    getText(rawNode.content) || getText(rawNode.description) || '';

  if (options.hasLearnerAnswer) {
    const isAnswerSufficient = inferActionJudgmentSufficiency(title, rawContent);

    return {
      type: 'judgment',
      title: normalizeJudgmentTitle(title, isAnswerSufficient),
      content: normalizeJudgmentContent(
        rawContent,
        isAnswerSufficient,
        options.currentQuestionTitle,
      ),
      citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
    };
  }

  return {
    type: 'judgment',
    title: normalizeStandaloneJudgmentTitle(title),
    content: normalizeStandaloneJudgmentContent(rawContent, options),
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeFollowUpQuestionDrafts(
  rawPayload: RawQuestionClosurePayload,
  isAnswerSufficient: boolean,
  currentQuestionTitle?: string,
) {
  if (isAnswerSufficient) {
    return [] satisfies QuestionNodeDraft[];
  }

  const rawQuestions = extractRawLearningNodeDrafts(
    rawPayload.followUpQuestions ??
      rawPayload.followUps ??
      rawPayload.nextQuestions,
  );
  const normalizedQuestions = rawQuestions.map((rawQuestion, index) =>
    normalizeFollowUpQuestionDraft(rawQuestion, index, currentQuestionTitle),
  );

  if (normalizedQuestions.length === 0) {
    return [
      {
        type: 'question',
        title: '追问：补上缺失的关键点',
        content: normalizeFollowUpQuestionContent('', currentQuestionTitle),
        citations: [],
      },
    ] satisfies QuestionNodeDraft[];
  }

  ensureUniqueTitles(normalizedQuestions);

  return normalizedQuestions;
}

function createFallbackIntroductionDrafts(
  planStepTitle: string,
  questionTitles: string[],
): SummaryNodeDraft[] {
  return [
    {
      type: 'summary',
      title: normalizeIntroductionTitle('建立当前问题的基本图景', planStepTitle, 0),
      content: normalizeIntroductionContent('', planStepTitle, questionTitles),
      citations: [],
    },
  ];
}

function createFallbackQuestionDrafts(
  planStepTitle: string,
): QuestionNodeDraft[] {
  return [
    {
      type: 'question',
      title: createQuestionTitle(planStepTitle, 0),
      content: '请围绕当前 step，用自己的话解释最关键的因果关系、判断标准或使用边界。',
      citations: [],
    },
  ];
}

function resolveAnswerSufficiency(rawPayload: RawQuestionClosurePayload) {
  const explicitBoolean =
    getBoolean(rawPayload.isAnswerSufficient) ??
    getBoolean(rawPayload.answerSufficient);

  if (explicitBoolean !== null) {
    return explicitBoolean;
  }

  const fallbackText = extractSignalText(
    rawPayload.judgment ?? rawPayload.evaluation,
  );

  if (containsBlockingSignal(fallbackText)) {
    return false;
  }

  if (containsReadySignal(fallbackText)) {
    return true;
  }

  return false;
}

function normalizeCitationDrafts(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const citations = payload
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }

      if (!isRecord(entry)) {
        return '';
      }

      return (
        getText(entry.targetNodeId) ||
        getText(entry.nodeId) ||
        getText(entry.id)
      );
    })
    .filter(Boolean)
    .map((targetNodeId) => ({ targetNodeId }));

  return dedupeCitations(citations);
}

function extractRawModules(payload: unknown): RawModuleDraft[] {
  if (!isRecord(payload) || !Array.isArray(payload.modules)) {
    return [];
  }

  return payload.modules as RawModuleDraft[];
}

function extractRawPlanSteps(payload: unknown): RawPlanStepDraft[] {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.planSteps)) {
    return payload.planSteps as RawPlanStepDraft[];
  }

  if (Array.isArray(payload.steps)) {
    return payload.steps as RawPlanStepDraft[];
  }

  return [];
}

function extractRawLearningNodeDrafts(payload: unknown): RawLearningNodeDraft[] {
  return Array.isArray(payload) ? (payload as RawLearningNodeDraft[]) : [];
}

function extractSignalText(payload: unknown) {
  if (!isRecord(payload)) {
    return '';
  }

  return [getText(payload.title), getText(payload.content), getText(payload.description)]
    .filter(Boolean)
    .join('\n');
}

function containsBlockingSignal(text: string) {
  return [
    '还不完整',
    '不完整',
    '不准确',
    '需要补充',
    '需要继续',
    '待补充',
    '未答到',
  ].some((keyword) => text.includes(keyword));
}

function containsReadySignal(text: string) {
  return ['已答到', '可以进入下一步', '回答充分', '回答到位', '已经闭环'].some(
    (keyword) => text.includes(keyword),
  );
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function createModuleTitle(topic: string, index: number) {
  const suffix =
    MODULE_TITLE_SUFFIXES[index] ?? `学习模块 ${String(index + 1)}`;

  return `${topic.trim()}：${suffix}`;
}

function createPlanStepTitle(moduleTitle: string, index: number) {
  const suffix =
    PLAN_STEP_TITLE_SUFFIXES[index] ?? `学习步骤 ${String(index + 1)}`;

  return `${moduleTitle.trim()} - ${suffix}`;
}

function createQuestionTitle(planStepTitle: string, index: number) {
  const suffix = QUESTION_TITLE_SUFFIXES[index] ?? `关键问题 ${String(index + 1)}`;

  return `${planStepTitle.trim()}：${suffix}`;
}

function normalizeIntroductionTitle(
  title: string,
  planStepTitle: string,
  index: number,
) {
  const normalizedTitle = title || `建立前置理解 ${String(index + 1)}`;

  if (/^(铺垫|前置|讲解)[:：]/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  if (normalizedTitle.includes(planStepTitle)) {
    return `铺垫：${normalizedTitle}`;
  }

  return `铺垫：${normalizedTitle}`;
}

function normalizeIntroductionContent(
  rawContent: string,
  planStepTitle: string,
  questionTitles: string[],
) {
  const normalizedContent = rawContent.trim();

  if (isSubstantialIntroductionContent(normalizedContent)) {
    return ensureIntroductionQuestionBridge(normalizedContent, questionTitles);
  }

  const focusSentence = normalizedContent
    ? ensureSentenceEnding(normalizedContent)
    : '先知道这一步在当前主题里要解决什么问题，而不是直接记零散结论。';

  return ensureIntroductionQuestionBridge(
    [
    `这一小步先要建立“${planStepTitle}”的整体图景，知道它在当前主题里处于什么位置、为什么值得先学。`,
    focusSentence,
    buildIntroductionQuestionBridge(questionTitles),
    ].join(''),
    questionTitles,
  );
}

function isSubstantialIntroductionContent(content: string) {
  if (!content) {
    return false;
  }

  return (
    content.length >= MIN_INTRODUCTION_LENGTH &&
    countSentences(content) >= MIN_INTRODUCTION_SENTENCE_COUNT
  );
}

function countSentences(content: string) {
  return content
    .split(/[。！？!?；;]/u)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function ensureSentenceEnding(content: string) {
  if (!content) {
    return '';
  }

  if (/[。！？!?；]$/u.test(content)) {
    return content;
  }

  return `${content}。`;
}

function ensureIntroductionQuestionBridge(
  content: string,
  questionTitles: string[],
) {
  if (!content) {
    return content;
  }

  if (
    /(接下来|后面会|继续追问|继续讨论|下面会问)/u.test(content) ||
    questionTitles.some((title) => content.includes(title))
  ) {
    return content;
  }

  return `${ensureSentenceEnding(content)}${buildIntroductionQuestionBridge(questionTitles)}`;
}

function buildIntroductionQuestionBridge(questionTitles: string[]) {
  const normalizedQuestionTitles = questionTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (normalizedQuestionTitles.length === 0) {
    return '接下来系统会继续追问这里的关键机制、判断标准和使用边界，所以先把核心对象、关键关系和判断线索放到同一张理解地图里。';
  }

  if (normalizedQuestionTitles.length === 1) {
    return `接下来会围绕“${normalizedQuestionTitles[0]}”继续追问，所以先把核心对象、关键关系和判断线索放到同一张理解地图里。`;
  }

  return `接下来会围绕“${normalizedQuestionTitles[0]}”和“${normalizedQuestionTitles[1]}”继续追问，所以先把这些概念之间的关系、因果线索和判断边界理顺。`;
}

function normalizeQuestionContent(
  rawContent: string,
  questionTitle: string,
  planStepTitle: string,
) {
  const normalizedContent = rawContent.trim();

  if (isSpecificQuestionContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const detailSentence =
    normalizedContent && !looksGenericQuestionContent(normalizedContent)
      ? ensureSentenceEnding(normalizedContent)
      : '';

  return [
    detailSentence,
    `请围绕“${questionTitle}”，结合“${planStepTitle}”这一步要解决的问题，说明最关键的对象、关系或判断标准，并尽量解释为什么会这样，而不是只复述名词或空泛列项。`,
  ]
    .filter(Boolean)
    .join('');
}

function isSpecificQuestionContent(content: string) {
  if (!content) {
    return false;
  }

  return (
    content.length >= MIN_QUESTION_GUIDANCE_LENGTH &&
    !looksGenericQuestionContent(content)
  );
}

function looksGenericQuestionContent(content: string) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return true;
  }

  return (
    normalizedContent.length < 12 ||
    normalizedContent === '请结合当前 step，用自己的话回答这个具体问题。' ||
    [
      '围绕关键问题继续学习',
      '谈谈你的理解',
      '请谈谈理解',
      '请解释这个问题',
      '请回答这个问题',
      '请总结以上内容',
      '总结全部内容',
      '列举几个方面',
      '展开说明',
      '继续学习',
      '简单回答',
    ].some((keyword) => normalizedContent.includes(keyword))
  );
}

function normalizeJudgmentContent(
  rawContent: string,
  isAnswerSufficient: boolean,
  currentQuestionTitle?: string,
) {
  const normalizedContent = rawContent.trim();
  const statusSentence = isAnswerSufficient
    ? buildReadyJudgmentSentence(currentQuestionTitle)
    : buildBlockingJudgmentSentence(currentQuestionTitle);

  if (!normalizedContent) {
    return statusSentence;
  }

  const completedContent = ensureSentenceEnding(normalizedContent);
  const hasExplicitStatus = isAnswerSufficient
    ? containsReadySignal(completedContent)
    : containsBlockingSignal(completedContent);

  if (hasExplicitStatus) {
    return completedContent;
  }

  return `${statusSentence}${completedContent}`;
}

function normalizeClosureSummaryContent(
  rawContent: string,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
  },
) {
  const normalizedContent = rawContent.trim();

  if (isExplanatorySummaryContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const reusableSentence =
    normalizedContent && !looksLikeJudgmentOnlyContent(normalizedContent)
      ? ensureSentenceEnding(normalizedContent)
      : '';
  const questionLabel = options.currentQuestionTitle
    ? `围绕“${options.currentQuestionTitle}”`
    : '围绕当前问题';
  const explanationSentence = options.isAnswerSufficient
    ? `${questionLabel}，更稳妥的理解是把核心对象、关键关系和判断线索讲清楚，并说明它们为什么成立，而不是只给结论。`
    : `${questionLabel}，更稳妥的理解是先把还缺的核心对象、关键关系和判断线索补齐，再进入下一步，而不是只停在“答案差不多了”的判断上。`;

  return [reusableSentence, explanationSentence].filter(Boolean).join('');
}

function isExplanatorySummaryContent(content: string) {
  if (!content) {
    return false;
  }

  return (
    !looksLikeJudgmentOnlyContent(content) &&
    (content.length >= MIN_SUMMARY_EXPLANATION_LENGTH ||
      containsExplanatorySignal(content) ||
      countSentences(content) >= 2)
  );
}

function looksLikeJudgmentOnlyContent(content: string) {
  if (!content) {
    return true;
  }

  return (
    (containsBlockingSignal(content) || containsReadySignal(content)) &&
    !containsExplanatorySignal(content)
  );
}

function containsExplanatorySignal(content: string) {
  return [
    '因为',
    '所以',
    '意味着',
    '关键在于',
    '本质上',
    '也就是',
    '需要把',
    '可以理解为',
    '核心是',
    '换句话说',
  ].some((keyword) => content.includes(keyword));
}

function normalizeFollowUpQuestionDraft(
  rawQuestion: RawLearningNodeDraft,
  index: number,
  currentQuestionTitle?: string,
): QuestionNodeDraft {
  const title = normalizeFollowUpQuestionTitle(
    getText(rawQuestion.title) ||
      getText(rawQuestion.prompt) ||
      `补充问题 ${String(index + 1)}`,
  );
  const rawContent =
    getText(rawQuestion.content) || getText(rawQuestion.description) || '';

  return {
    type: 'question',
    title,
    content: normalizeFollowUpQuestionContent(rawContent, currentQuestionTitle),
    citations: normalizeCitationDrafts(
      rawQuestion.citations ?? rawQuestion.references,
    ),
  };
}

function normalizeFollowUpQuestionContent(
  rawContent: string,
  currentQuestionTitle?: string,
) {
  const normalizedContent = rawContent.trim();

  if (isSpecificFollowUpQuestionContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const detailSentence =
    normalizedContent && !looksGenericFollowUpQuestionContent(normalizedContent)
      ? ensureSentenceEnding(normalizedContent)
      : '';
  const questionLabel = currentQuestionTitle
    ? `“${currentQuestionTitle}”`
    : '当前问题';

  return [
    detailSentence,
    `请只补上${questionLabel}里还缺的关键点，优先说明缺失的因果关系、判断条件或使用边界，不需要重复已经答对的部分。`,
  ]
    .filter(Boolean)
    .join('');
}

function isSpecificFollowUpQuestionContent(content: string) {
  if (!content) {
    return false;
  }

  return (
    content.length >= MIN_QUESTION_GUIDANCE_LENGTH &&
    !looksGenericFollowUpQuestionContent(content)
  );
}

function looksGenericFollowUpQuestionContent(content: string) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return true;
  }

  return (
    normalizedContent.length < 14 ||
    looksGenericQuestionContent(normalizedContent) ||
    [
      '继续补充',
      '再想想',
      '补充说明',
      '重新回答',
      '再回答一次',
      '继续回答',
      '补上缺失点',
      '还有遗漏',
    ].some((keyword) => normalizedContent.includes(keyword))
  );
}

function buildReadyJudgmentSentence(currentQuestionTitle?: string) {
  if (!currentQuestionTitle) {
    return '这次回答已答到当前问题，可以进入下一步。';
  }

  return `这次回答已答到“${currentQuestionTitle}”的关键点，可以进入下一步。`;
}

function buildBlockingJudgmentSentence(currentQuestionTitle?: string) {
  if (!currentQuestionTitle) {
    return '这次回答还不完整，当前问题里仍有关键点没有答到。';
  }

  return `这次回答还不完整，“${currentQuestionTitle}”里仍有关键点没有答到。`;
}

function normalizeJudgmentTitle(title: string, isAnswerSufficient: boolean) {
  const normalizedTitle =
    title ||
    (isAnswerSufficient ? '判断：已答到当前问题' : '判断：回答还不完整');

  if (/^判断[:：]/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  return `判断：${normalizedTitle}`;
}

function normalizeFollowUpQuestionTitle(title: string) {
  if (/^(追问|补充问题)[:：]/u.test(title)) {
    return title;
  }

  return `追问：${title}`;
}

function normalizeActionSummaryTitle(title: string) {
  const normalizedTitle = title || '总结：先把标准理解讲清楚';

  if (/^总结[:：]/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  return `总结：${normalizedTitle}`;
}

function normalizeActionSummaryContent(
  rawContent: string,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
) {
  const normalizedContent = rawContent.trim();

  if (isExplanatorySummaryContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const reusableSentence =
    normalizedContent && !looksLikeJudgmentOnlyContent(normalizedContent)
      ? ensureSentenceEnding(normalizedContent)
      : '';

  const fallbackSentence = options.currentQuestionTitle
    ? `围绕“${options.currentQuestionTitle}”，先把核心对象、关键关系和判断线索讲清楚，再把它们串成一条完整说明。`
    : options.planStepTitle
      ? `围绕“${options.planStepTitle}”，先把这一步真正要建立的理解地图讲清楚，再把容易混淆的边界补出来。`
      : '先把当前要说明的对象、关系和判断线索讲清楚，再决定是否补充例子或边界。';

  return [reusableSentence, fallbackSentence].filter(Boolean).join('');
}

function normalizeStandaloneJudgmentTitle(title: string) {
  const normalizedTitle = title || '判断：先明确什么算答到';

  if (/^判断[:：]/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  return `判断：${normalizedTitle}`;
}

function normalizeStandaloneJudgmentContent(
  rawContent: string,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
) {
  const normalizedContent = rawContent.trim();
  const requirementSentence = options.currentQuestionTitle
    ? `当前还没有现成回答，可以先把“${options.currentQuestionTitle}”什么才算答到、还需要验证什么写清楚。`
    : options.planStepTitle
      ? `当前还没有现成回答，可以先把“${options.planStepTitle}”这一步真正要检查的对象、关系和判断边界写清楚。`
      : '当前还没有现成回答，可以先把什么才算答到、还需要验证什么写清楚。';

  if (!normalizedContent) {
    return requirementSentence;
  }

  const completedContent = ensureSentenceEnding(normalizedContent);

  if (completedContent.includes('当前还没有现成回答')) {
    return completedContent;
  }

  return `${requirementSentence}${completedContent}`;
}

function inferActionJudgmentSufficiency(title: string, content: string) {
  const signalText = [title, content].filter(Boolean).join('\n');

  if (containsBlockingSignal(signalText)) {
    return false;
  }

  if (containsReadySignal(signalText)) {
    return true;
  }

  return false;
}

function getScaffoldActionFallbackTitle(
  actionId: Extract<
    LearningActionDraftActionId,
    'insert-scaffold' | 'rephrase-scaffold' | 'simplify-scaffold' | 'add-example'
  >,
) {
  switch (actionId) {
    case 'insert-scaffold':
      return '建立当前问题的理解地图';
    case 'rephrase-scaffold':
      return '换个说法再解释一次';
    case 'simplify-scaffold':
      return '先从更基础的直觉说起';
    case 'add-example':
      return '先举一个具体例子';
  }
}

function getScaffoldActionFallbackContent(
  actionId: Extract<
    LearningActionDraftActionId,
    'insert-scaffold' | 'rephrase-scaffold' | 'simplify-scaffold' | 'add-example'
  >,
) {
  switch (actionId) {
    case 'insert-scaffold':
      return '';
    case 'rephrase-scaffold':
      return '换个更直白的说法，把同一件事重新解释一遍，并补上最容易混淆的一处区别。';
    case 'simplify-scaffold':
      return '先退回到更基础的直觉或日常语言，再把它接回当前步骤，减少术语堆叠。';
    case 'add-example':
      return '给一个贴近当前概念的具体情境，用例子把抽象关系落到能看见的变化上。';
  }
}

function getStandaloneQuestionFallbackTitle(
  currentQuestionTitle?: string,
  planStepTitle?: string,
) {
  if (currentQuestionTitle) {
    return `围绕“${currentQuestionTitle}”再补一个关键问题`;
  }

  if (planStepTitle) {
    return `${planStepTitle}：补一个关键问题`;
  }

  return '补一个关键理解点';
}

function getStandaloneQuestionFallbackContent(
  currentQuestionTitle?: string,
  planStepTitle?: string,
) {
  if (currentQuestionTitle) {
    return `请围绕“${currentQuestionTitle}”再补一个推进理解的具体问题，优先只检查一个关键点。`;
  }

  if (planStepTitle) {
    return `请围绕“${planStepTitle}”再补一个推进理解的具体问题，优先只检查一个关键点。`;
  }

  return '请补一个真正可判断是否答到的具体问题，优先只检查一个关键理解点。';
}

function ensureUniqueTitles<T extends { title: string }>(items: T[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const currentCount = counts.get(item.title) ?? 0;

    if (currentCount > 0) {
      item.title = `${item.title}（${String(currentCount + 1)}）`;
    }

    counts.set(item.title.replace(/（\d+）$/u, ''), currentCount + 1);
  }
}

function dedupeCitations<T extends { targetNodeId: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.targetNodeId)) {
      return false;
    }

    seen.add(item.targetNodeId);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stripCodeFence(rawText: string) {
  const trimmedText = rawText.trim();

  if (!trimmedText.startsWith('```')) {
    return trimmedText;
  }

  return trimmedText
    .replace(/^```(?:json)?\s*/u, '')
    .replace(/\s*```$/u, '')
    .trim();
}
