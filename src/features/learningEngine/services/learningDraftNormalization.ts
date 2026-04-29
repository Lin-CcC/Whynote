import type {
  AnswerNodeDraft,
  LearningActionDraftActionId,
  LearningNodeCitationDraft,
  JudgmentNodeDraft,
  LearningMode,
  ModuleNodeDraft,
  PlanStepNodeDraft,
  QuestionClosureResult,
  QuestionNodeDraft,
  SummaryNodeDraft,
  SummaryEvaluationResult,
} from '../domain';
import { getLearningModeLimits } from '../domain';
import type { CitationPurpose } from '../../nodeDomain';

import { normalizeClosureHintText } from './closureHint';
import { parseJsonObjectWithTolerance } from './jsonObjectParsing';

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
const CITATION_PURPOSE_VALUES = new Set([
  'definition',
  'mechanism',
  'behavior',
  'example',
  'judgment',
  'background',
] as const);
const MIN_INTRODUCTION_LENGTH = 42;
const MIN_INTRODUCTION_SENTENCE_COUNT = 2;
const MIN_QUESTION_GUIDANCE_LENGTH = 18;
const MIN_SUMMARY_EXPLANATION_LENGTH = 20;
const FORMULAIC_INTRODUCTION_SENTENCE_PATTERNS = [
  /接下来/u,
  /后面会/u,
  /下面会问/u,
  /继续追问/u,
  /理解地图/u,
  /整体图景/u,
  /宏观视角/u,
  /宏观理解/u,
  /这一步我们要建立/u,
  /先把核心对象、关键关系和判断线索/u,
] as const;

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
  hint?: unknown;
  guidanceHint?: unknown;
  summary?: unknown;
  explanation?: unknown;
  followUpQuestions?: unknown;
  followUps?: unknown;
  nextQuestions?: unknown;
}

interface RawSummaryEvaluationPayload {
  judgment?: unknown;
  evaluation?: unknown;
  hint?: unknown;
  guidanceHint?: unknown;
}

interface NormalizedJudgmentDetails {
  answeredText: string;
  gapItems: string[];
  whyItMattersText: string;
}

interface NormalizedJudgmentDraftResult {
  details: NormalizedJudgmentDetails;
  draft: JudgmentNodeDraft;
}

export function parseJsonObject(rawText: string): unknown {
  const normalizedText = stripCodeFence(rawText);
  return parseJsonObjectWithTolerance(normalizedText);
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
    learnerAnswer?: string;
  },
): QuestionClosureResult {
  const rawPayload = isRecord(payload) ? (payload as RawQuestionClosurePayload) : {};
  const isAnswerSufficient = resolveAnswerSufficiency(rawPayload);
  const normalizedJudgment = normalizeJudgmentDraft(
    rawPayload.judgment ?? rawPayload.evaluation,
    {
      currentQuestionTitle: options?.currentQuestionTitle,
      isAnswerSufficient,
      learnerAnswer: options?.learnerAnswer,
    },
  );
  const summary = normalizeClosureSummaryDraft(
    rawPayload.summary ?? rawPayload.explanation,
    {
      currentQuestionTitle: options?.currentQuestionTitle,
      isAnswerSufficient,
      judgment: normalizedJudgment.details,
      learnerAnswer: options?.learnerAnswer,
    },
  );
  const hint = normalizeClosureHint(
    rawPayload.hint ?? rawPayload.guidanceHint,
    {
      currentQuestionTitle: options?.currentQuestionTitle,
      judgment: normalizedJudgment.details,
      judgmentContent: normalizedJudgment.draft.content,
      summaryContent: summary.content,
    },
  );
  const hintCitations = normalizeHintCitationDrafts(
    rawPayload.hint ?? rawPayload.guidanceHint,
    hint,
  );
  const followUpQuestions = normalizeFollowUpQuestionDrafts(
    rawPayload,
    isAnswerSufficient,
    options?.currentQuestionTitle,
  );

  return {
    isAnswerSufficient,
    judgment: {
      ...normalizedJudgment.draft,
      hint,
      citations: dedupeCitations([
        ...normalizedJudgment.draft.citations,
        ...hintCitations,
      ]),
    },
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
      });
    case 'insert-question':
      return normalizeStandaloneQuestionDraft(rawNode, options);
    case 'insert-answer':
      return normalizeActionAnswerDraft(rawNode, options);
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
    introductions: normalizeIntroductionDrafts(rawPlanStep, normalizedTitle),
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
    introductions: createFallbackIntroductionDrafts(title),
    questions,
    status: 'todo',
  };
}

function normalizeIntroductionDrafts(
  rawPlanStep: RawPlanStepDraft,
  planStepTitle: string,
) {
  const rawIntroductions = extractRawLearningNodeDrafts(
    rawPlanStep.introductions ??
      rawPlanStep.prerequisites ??
      rawPlanStep.prerequisiteQuestions,
  );
  const normalizedIntroductions = rawIntroductions.map((rawIntroduction, index) =>
    normalizeIntroductionDraft(rawIntroduction, index, planStepTitle),
  );

  if (normalizedIntroductions.length === 0) {
    return createFallbackIntroductionDrafts(planStepTitle);
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
    summaryKind: 'scaffold',
    title: normalizeIntroductionTitle(rawTitle, planStepTitle, index),
    content: normalizeIntroductionContent(rawContent, planStepTitle),
    citations: normalizeCitationDrafts(
      rawIntroduction.citations ?? rawIntroduction.references,
      'summary',
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
      'question',
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
    summaryKind: 'scaffold',
    title: normalizeIntroductionTitle(title, planStepLabel, 0),
    content: normalizeIntroductionContent(rawContent, planStepLabel),
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
      'summary',
    ),
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
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
      'question',
    ),
  };
}

export function normalizeSummaryEvaluation(
  payload: unknown,
  options?: {
    currentQuestionTitle?: string;
    learnerSummary?: string;
  },
): SummaryEvaluationResult {
  const rawPayload = isRecord(payload) ? (payload as RawSummaryEvaluationPayload) : {};
  const normalizedJudgment = normalizeSummaryEvaluationJudgmentDraft(
    rawPayload.judgment ?? rawPayload.evaluation,
    options,
  );
  const hint = normalizeClosureHint(rawPayload.hint ?? rawPayload.guidanceHint, {
    currentQuestionTitle: options?.currentQuestionTitle,
    judgment: normalizedJudgment.hintDetails,
    judgmentContent: normalizedJudgment.draft.content,
    summaryContent: options?.learnerSummary ?? '',
  });
  const hintCitations = normalizeHintCitationDrafts(
    rawPayload.hint ?? rawPayload.guidanceHint,
    hint,
  );

  return {
    judgment: {
      ...normalizedJudgment.draft,
      hint,
      citations: dedupeCitations([
        ...normalizedJudgment.draft.citations,
        ...hintCitations,
      ]),
    },
    metadata: {
      model: '',
      providerLabel: '',
    },
  };
}

function normalizeActionAnswerDraft(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
): AnswerNodeDraft {
  const title = normalizeActionAnswerTitle(
    getText(rawNode.title) || getText(rawNode.prompt),
  );
  const rawContent =
    getText(rawNode.content) || getText(rawNode.description) || '';

  return {
    type: 'answer',
    title,
    content: normalizeActionAnswerContent(rawContent, options),
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
    ),
  };
}

function normalizeJudgmentDraft(
  rawJudgment: unknown,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
    learnerAnswer?: string;
  },
): NormalizedJudgmentDraftResult {
  const rawNode = isRecord(rawJudgment)
    ? (rawJudgment as RawLearningNodeDraft)
    : {};
  const title = getText(rawNode.title);
  const details = normalizeJudgmentDetails(rawNode, options);

  return {
    details,
    draft: {
      type: 'judgment',
      judgmentKind: 'answer-closure',
      title: normalizeJudgmentTitle(title, options.isAnswerSufficient),
      content: formatStructuredJudgmentContent(details, options.isAnswerSufficient),
      citations: normalizeCitationDrafts(
        rawNode.citations ?? rawNode.references,
        'judgment',
      ),
    },
  };
}

function normalizeClosureSummaryDraft(
  rawSummary: unknown,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
    judgment: NormalizedJudgmentDetails;
    learnerAnswer?: string;
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
    summaryKind: 'answer-closure',
    title: normalizeClosureSummaryTitle(title),
    content: normalizeClosureSummaryContent(rawContent, options),
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
      'summary',
    ),
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
    summaryKind: 'manual',
    title,
    content: normalizeActionSummaryContent(rawContent, options),
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
      'summary',
    ),
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
      judgmentKind: 'manual',
      title: normalizeJudgmentTitle(title, isAnswerSufficient),
      content: normalizeJudgmentContent(
        rawContent,
        isAnswerSufficient,
        options.currentQuestionTitle,
      ),
      citations: normalizeCitationDrafts(
        rawNode.citations ?? rawNode.references,
        'judgment',
      ),
    };
  }

  return {
    type: 'judgment',
    judgmentKind: 'manual',
    title: normalizeStandaloneJudgmentTitle(title),
    content: normalizeStandaloneJudgmentContent(rawContent, options),
    citations: normalizeCitationDrafts(
      rawNode.citations ?? rawNode.references,
      'judgment',
    ),
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
): SummaryNodeDraft[] {
  return [
    {
      type: 'summary',
      summaryKind: 'scaffold',
      title: normalizeIntroductionTitle('先把这一步说清楚', planStepTitle, 0),
      content: normalizeIntroductionContent('', planStepTitle),
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

type CitationDraftRole = 'generic' | 'question' | 'judgment' | 'hint' | 'summary';

function normalizeCitationDrafts(
  payload: unknown,
  role: CitationDraftRole = 'generic',
) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const citations: LearningNodeCitationDraft[] = [];

  for (const entry of payload) {
    if (typeof entry === 'string') {
      const targetNodeId = entry.trim();

      if (targetNodeId) {
        citations.push({ targetNodeId });
      }

      continue;
    }

    if (!isRecord(entry)) {
      continue;
    }

    const targetNodeId =
      getText(entry.targetNodeId) ||
      getText(entry.nodeId) ||
      getText(entry.id);

    if (!targetNodeId) {
      continue;
    }

    const sourceExcerpt = normalizeCitationSourceExcerpt(
      getText(entry.sourceExcerpt) || getText(entry.excerpt),
    );
    const sourceLocator = normalizeCitationSourceLocator(
      getText(entry.sourceLocator) || getText(entry.locator),
    );

    citations.push(
      finalizeCitationDraft(
        {
          targetNodeId,
          focusText:
            getText(entry.focusText) ||
        getText(entry.claimText) ||
        getText(entry.claim) ||
        getText(entry.segmentText) ||
        undefined,
      note:
        getText(entry.note) ||
        getText(entry.reason) ||
        getText(entry.why) ||
        getText(entry.teachingNote) ||
        undefined,
      purpose:
        normalizeCitationPurpose(
          getText(entry.purpose) ||
            getText(entry.usage) ||
            getText(entry.role),
        ) ?? undefined,
          sourceExcerpt: sourceExcerpt || undefined,
          sourceLocator: sourceLocator || undefined,
        },
        role,
      ),
    );
  }

  return dedupeCitations(citations).slice(0, getCitationRoleLimit(role));
}

function finalizeCitationDraft(
  citation: LearningNodeCitationDraft,
  role: CitationDraftRole,
): LearningNodeCitationDraft {
  const normalizedCitation = {
    ...citation,
    focusText: normalizeCitationDisplayText(citation.focusText) ?? undefined,
    note: normalizeCitationDisplayText(citation.note) ?? undefined,
    sourceExcerpt: normalizeCitationSourceExcerpt(citation.sourceExcerpt) ?? undefined,
    sourceLocator: normalizeCitationSourceLocator(citation.sourceLocator) ?? undefined,
  };

  switch (role) {
    case 'judgment':
      return {
        ...normalizedCitation,
        purpose:
          normalizedCitation.purpose && normalizedCitation.purpose !== 'background'
            ? normalizedCitation.purpose
            : 'judgment',
      };
    case 'hint':
      return {
        ...normalizedCitation,
        purpose:
          normalizedCitation.purpose &&
          normalizedCitation.purpose !== 'judgment'
            ? normalizedCitation.purpose
            : 'background',
      };
    case 'summary':
      return {
        ...normalizedCitation,
        purpose:
          normalizedCitation.purpose === 'judgment'
            ? 'background'
            : normalizedCitation.purpose,
      };
    default:
      return normalizedCitation;
  }
}

function getCitationRoleLimit(role: CitationDraftRole) {
  switch (role) {
    case 'question':
      return 1;
    case 'hint':
      return 1;
    case 'judgment':
      return 2;
    case 'summary':
      return 3;
    default:
      return 4;
  }
}

function normalizeCitationSourceExcerpt(value: string | undefined) {
  const normalizedValue = normalizeCitationDisplayText(value);

  if (!normalizedValue) {
    return null;
  }

  const withoutBodyLabel = normalizedValue.replace(
    /^正文基础（优先用于定位真实引用）[:：]\s*/u,
    '',
  );

  if (
    /资料概况/u.test(withoutBodyLabel) ||
    /不是引用正文/u.test(withoutBodyLabel) ||
    /AI 资料概况/u.test(withoutBodyLabel) ||
    /暂无资料概况/u.test(withoutBodyLabel)
  ) {
    return null;
  }

  return withoutBodyLabel;
}

function normalizeCitationSourceLocator(value: string | undefined) {
  const normalizedValue = normalizeCitationDisplayText(value);

  if (!normalizedValue || /资料概况/u.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function normalizeCitationDisplayText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ');

  return normalizedValue ? normalizedValue : null;
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
) {
  const normalizedContent = stripFormulaicIntroductionSentences(
    rawContent.trim(),
  );

  if (isSubstantialIntroductionContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const focusSentence = normalizedContent
    ? ensureSentenceEnding(normalizedContent)
    : '先知道这里到底在解释什么、为什么它会影响后面的判断，而不是直接记零散结论。';

  return [
    `这一小步先把“${planStepTitle}”说清楚：它为什么值得单独拿出来看、到底在解释哪一层问题。`,
    focusSentence,
    '先分清相关对象各自扮演的角色，再看它们怎样发生联系、产生结果或形成边界；否则很容易只记住名词，却不知道该怎么判断。',
  ].join('');
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

function stripFormulaicIntroductionSentences(content: string) {
  if (!content) {
    return content;
  }

  const remainingSentences = splitIntoSentences(content).filter(
    (sentence) => !isFormulaicIntroductionSentence(sentence),
  );

  return remainingSentences.join('').trim();
}

function splitIntoSentences(content: string) {
  return content.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? [];
}

function isFormulaicIntroductionSentence(sentence: string) {
  const normalizedSentence = sentence.trim();

  if (!normalizedSentence) {
    return false;
  }

  return FORMULAIC_INTRODUCTION_SENTENCE_PATTERNS.some((pattern) =>
    pattern.test(normalizedSentence),
  );
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

function hasUsableAnswerDraftContent(content: string) {
  return (
    Boolean(content) &&
    !looksGenericAnswerDraftContent(content) &&
    (content.length >= MIN_SUMMARY_EXPLANATION_LENGTH ||
      containsExplanatorySignal(content) ||
      countSentences(content) >= 2)
  );
}

function looksGenericAnswerDraftContent(content: string) {
  return (
    content.length < 14 ||
    [
      '请直接回答',
      '先直接回答',
      '请回答当前问题',
      '回答这个问题',
      '可以从几个方面理解',
      '我会这样回答',
      '可以这样回答',
      '先说明核心结论',
    ].some((keyword) => content.includes(keyword))
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
    judgment: NormalizedJudgmentDetails;
    learnerAnswer?: string;
  },
) {
  const normalizedContent = rawContent.trim();

  if (isGuidedExplanationContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const reusableSentence = normalizeStandardUnderstandingSentence(
    normalizedContent,
    options.currentQuestionTitle,
  );
  const learnerAngleSentence = buildClosureSummaryLearnerAngle(options);
  const breakpointSentence = buildClosureSummaryBreakpoint(options);
  const guidanceSentence = buildClosureSummaryGuidance(options);
  const standardUnderstandingSentence = `更稳妥的标准理解是：${reusableSentence}`;

  return [
    learnerAngleSentence,
    breakpointSentence,
    guidanceSentence,
    standardUnderstandingSentence,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildClosureSummaryLearnerAngle(options: {
  judgment: NormalizedJudgmentDetails;
  isAnswerSufficient: boolean;
  learnerAnswer?: string;
}) {
  const learnerAnswerFocus = extractLearnerAnswerFocus(options.learnerAnswer);
  const answeredText = stripTrailingSentencePunctuation(options.judgment.answeredText);

  if (options.isAnswerSufficient) {
    if (learnerAnswerFocus) {
      return `你这版回答已经把“${learnerAnswerFocus}”这条主线说出来了，这个方向是对的。`;
    }

    return answeredText
      ? `你这版回答已经把主线说到了：${answeredText}。`
      : '你这版回答已经把当前问题的主线说到了。';
  }

  if (learnerAnswerFocus) {
    return `你现在的思路已经抓到了“${learnerAnswerFocus}”这一层，这个方向是对的。`;
  }

  return answeredText
    ? `你这版回答已经碰到了一部分方向：${answeredText}。`
    : '你这版回答已经碰到了一部分方向，下面把缺的机制、因果或边界补齐。';
}

function isGuidedExplanationContent(content: string) {
  if (!content) {
    return false;
  }

  return (
    !looksLikeJudgmentOnlyContent(content) &&
    containsExplanatorySignal(content) &&
    containsGuidanceSignal(content) &&
    countSentences(content) >= 3
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

function containsGuidanceSignal(content: string) {
  return [
    '如果沿着',
    '会卡在',
    '继续往下想',
    '追问自己',
    '有没有考虑过',
    '如果只停在',
    '先别急着',
    '为什么不能只',
    '你可以先想',
  ].some((keyword) => content.includes(keyword));
}

function normalizeJudgmentDetails(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
    learnerAnswer?: string;
  },
): NormalizedJudgmentDetails {
  const answeredText = normalizeJudgmentAnsweredText(rawNode, options);
  const gapItems = normalizeJudgmentGapItems(rawNode, options);
  const whyItMattersText = normalizeJudgmentWhyItMattersText(
    rawNode,
    options,
    gapItems,
  );

  return {
    answeredText,
    gapItems,
    whyItMattersText,
  };
}

function formatStructuredJudgmentContent(
  details: NormalizedJudgmentDetails,
  isAnswerSufficient: boolean,
) {
  const gapLines =
    details.gapItems.length > 0
      ? details.gapItems.map((gapItem, index) => `${String(index + 1)}. ${gapItem}`)
      : [
          isAnswerSufficient
            ? '1. 当前没有新的关键缺口；如果继续打磨，只需要顺手补边界或压缩表述。'
            : '1. 当前问题里仍有关键点没有说清楚。',
        ];

  return [
    '已答到的部分：',
    `- ${details.answeredText}`,
    '',
    '还缺的关键点：',
    ...gapLines,
    '',
    '为什么这些缺口关键：',
    `- ${details.whyItMattersText}`,
  ].join('\n');
}

function normalizeJudgmentAnsweredText(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
    learnerAnswer?: string;
  },
) {
  const rawAnsweredText =
    extractStructuredTextFromRawNode(rawNode, [
      '已答到的部分',
      '这次答得好的地方',
      '做得好的地方',
      '已答到',
    ]) ||
    getText((rawNode as Record<string, unknown>).strengths) ||
    getText((rawNode as Record<string, unknown>).answered) ||
    getText((rawNode as Record<string, unknown>).covered);
  const learnerAnswerFocus = extractLearnerAnswerFocus(options.learnerAnswer);
  const fallbackText = learnerAnswerFocus
    ? `你已经抓住了“${learnerAnswerFocus}”这个方向，说明你已经碰到了这道题真正要解释的核心矛盾`
    : options.currentQuestionTitle
      ? options.isAnswerSufficient
        ? `你已经把“${options.currentQuestionTitle}”最关键的主线答到了，核心方向是对的`
        : `你已经围绕“${options.currentQuestionTitle}”抓到了一条主线直觉，但还没把它展开成完整解释`
      : options.isAnswerSufficient
        ? '你已经把当前问题的主线答到了，核心方向是对的'
        : '你已经抓到了一条有价值的解释方向，但还没把它展开成完整说明';
  const candidateText = rawAnsweredText && !isGenericAnsweredText(rawAnsweredText)
    ? rawAnsweredText
    : fallbackText;

  return ensureSentenceEnding(
    normalizeNarrativeSentence(candidateText, {
      fallbackPrefix: '你已经',
      preserveLeadingQuestionWord: false,
    }),
  );
}

function normalizeJudgmentGapItems(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
  },
) {
  const explicitGapItems = [
    ...extractTextArray((rawNode as Record<string, unknown>).gaps),
    ...extractTextArray((rawNode as Record<string, unknown>).missingKeyPoints),
    ...extractTextArray((rawNode as Record<string, unknown>).missingPoints),
  ];
  const structuredGapText = extractStructuredTextFromRawNode(rawNode, [
    '还没答到的关键点',
    '还缺的关键点',
    '当前最关键缺口',
    '还缺',
  ]);
  const contentGapItems = structuredGapText
    ? splitStructuredList(structuredGapText)
    : options.isAnswerSufficient
      ? []
      : splitStructuredList(
          stripJudgmentScaffoldText(
            getText(rawNode.content) || getText(rawNode.description),
          ),
        );
  const normalizedGapItems = [...explicitGapItems, ...contentGapItems]
    .map((item) => sanitizeGapItem(item))
    .filter((item) => item.length > 0 && !looksGenericGapItem(item));

  if (normalizedGapItems.length > 0) {
    return normalizedGapItems.slice(0, 3).map(ensureSentenceEnding);
  }

  if (options.isAnswerSufficient) {
    return [];
  }

  return [
    ensureSentenceEnding(
      options.currentQuestionTitle
        ? `把“${options.currentQuestionTitle}”真正依赖的关键机制、因果关系或判断边界说清楚`
        : '把当前问题真正依赖的关键机制、因果关系或判断边界说清楚',
    ),
  ];
}

function normalizeJudgmentWhyItMattersText(
  rawNode: RawLearningNodeDraft,
  options: {
    currentQuestionTitle?: string;
    isAnswerSufficient: boolean;
  },
  gapItems: string[],
) {
  const rawWhyText =
    extractStructuredTextFromRawNode(rawNode, [
      '为什么这些缺口关键',
      '不补上会卡在哪里',
      '少了这些会带来什么问题',
      '为什么关键',
    ]) ||
    getText((rawNode as Record<string, unknown>).impact) ||
    getText((rawNode as Record<string, unknown>).whyItMatters) ||
    getText((rawNode as Record<string, unknown>).importance) ||
    getText((rawNode as Record<string, unknown>).whyKey);

  if (rawWhyText && !looksGenericWhyItMattersText(rawWhyText)) {
    return ensureSentenceEnding(rawWhyText);
  }

  const questionLabel = options.currentQuestionTitle
    ? `“${options.currentQuestionTitle}”`
    : '当前问题';

  if (options.isAnswerSufficient) {
    return ensureSentenceEnding(
      `因为这些点已经足以支撑对${questionLabel}的完整理解，后续只剩表述压缩或顺手补边界`,
    );
  }

  return buildJudgmentImpactFallback(questionLabel, gapItems[0]);
}

function normalizeClosureHint(
  rawHint: unknown,
  options: {
    currentQuestionTitle?: string;
    judgment: NormalizedJudgmentDetails;
    judgmentContent: string;
    summaryContent: string;
  },
) {
  return normalizeClosureHintText({
    rawHint,
    currentQuestionTitle: options.currentQuestionTitle,
    judgmentGapItems: options.judgment.gapItems,
    judgmentContent: options.judgmentContent,
    summaryContent: options.summaryContent,
  });
}

export function normalizeHintCitationDrafts(
  rawHint: unknown,
  normalizedHint: string,
) {
  if (!isRecord(rawHint)) {
    return [] satisfies LearningNodeCitationDraft[];
  }

  const nestedHint = isRecord(rawHint.hint) ? rawHint.hint : null;
  const rawHintCitations =
    rawHint.citations ?? rawHint.references ?? nestedHint?.citations;
  const citations = normalizeCitationDrafts(rawHintCitations, 'hint');

  if (citations.length === 0) {
    return citations;
  }

  const hintFocusText = extractHintFocusText(normalizedHint);

  return citations.map((citation) => ({
    ...citation,
    focusText: citation.focusText ?? hintFocusText ?? undefined,
  }));
}

function extractHintFocusText(normalizedHint: string) {
  const focusMatch = normalizedHint.match(/^先补哪块[:：]\s*(.+)$/mu)?.[1]?.trim();

  return focusMatch ? stripTrailingSentencePunctuation(focusMatch) : null;
}

function buildJudgmentImpactFallback(
  questionLabel: string,
  primaryGap?: string,
) {
  const gapLabel = stripTrailingSentencePunctuation(primaryGap ?? '');

  switch (classifyJudgmentGapKind(gapLabel)) {
    case 'combinatorial-explosion':
      return ensureSentenceEnding(
        '如果不把这个量级说清楚，回答就会停在“参数很多所以很难”的直觉层，后面一旦要解释为什么盲目试错在数量级上根本走不通，就接不上了',
      );
    case 'feedback-direction':
      return ensureSentenceEnding(
        '如果不把“只知道错了还不够”说清楚，回答就会停在“试错成本高”的层面，后面解释为什么还需要损失函数或梯度方向时会少掉关键转折',
      );
    case 'causal':
      return ensureSentenceEnding(
        `如果不把“${gapLabel || `${questionLabel}里缺的因果链`}”补上，回答就会只剩结论，别人看不到它到底是怎么一步步成立的`,
      );
    case 'boundary':
      return ensureSentenceEnding(
        `如果不把“${gapLabel || `${questionLabel}里缺的边界条件`}”补上，这条说法看起来就像任何时候都成立，后面无法判断它何时有效、何时失效`,
      );
    case 'mechanism':
      return ensureSentenceEnding(
        `如果不把“${gapLabel || `${questionLabel}里缺的机制`}”补上，回答会停在名词或现象层，相关对象之间到底怎么作用仍然不清楚`,
      );
    default:
      return ensureSentenceEnding(
        `如果不把“${gapLabel || `${questionLabel}里还缺的关键点`}”说清楚，你的回答会停在当前直觉层，后面一旦要解释${questionLabel}为什么成立就接不上`,
      );
  }
}

function classifyJudgmentGapKind(content: string) {
  if (
    content.includes('组合爆炸') ||
    content.includes('排列组合') ||
    content.includes('量级') ||
    content.includes('几辈子') ||
    content.includes('6000 万') ||
    content.includes('6000万')
  ) {
    return 'combinatorial-explosion' as const;
  }

  if (
    content.includes('反馈') ||
    content.includes('导向') ||
    content.includes('往哪调') ||
    content.includes('损失函数') ||
    content.includes('只知道“错了”') ||
    content.includes('只知道错了')
  ) {
    return 'feedback-direction' as const;
  }

  if (content.includes('为什么') || content.includes('因果') || content.includes('结果')) {
    return 'causal' as const;
  }

  if (
    content.includes('边界') ||
    content.includes('条件') ||
    content.includes('前提') ||
    content.includes('什么时候') ||
    content.includes('何时')
  ) {
    return 'boundary' as const;
  }

  if (
    content.includes('机制') ||
    content.includes('关系') ||
    content.includes('对象') ||
    content.includes('流程') ||
    content.includes('顺序')
  ) {
    return 'mechanism' as const;
  }

  return 'generic' as const;
}

function normalizeStandardUnderstandingSentence(
  rawContent: string,
  currentQuestionTitle?: string,
) {
  if (hasUsableStandardUnderstandingContent(rawContent)) {
    return ensureSentenceEnding(stripLeadingSummaryLabel(rawContent));
  }

  if (currentQuestionTitle) {
    return ensureSentenceEnding(
      `围绕“${currentQuestionTitle}”，要把关键机制、因果链和成立条件连成一条完整说明，而不是只停在结论`,
    );
  }

  return ensureSentenceEnding(
    '需要把关键机制、因果链和成立条件连成一条完整说明，而不是只停在结论',
  );
}

function buildClosureSummaryBreakpoint(options: {
  currentQuestionTitle?: string;
  isAnswerSufficient: boolean;
  judgment: NormalizedJudgmentDetails;
  learnerAnswer?: string;
}) {
  if (options.isAnswerSufficient) {
    return '如果继续打磨，可以顺手检查自己有没有把适用边界也交代清楚。';
  }

  const learnerAnswerFocus = extractLearnerAnswerFocus(options.learnerAnswer);
  const primaryGap =
    options.judgment.gapItems[0]?.replace(/[。！？!?；;]+$/u, '') ||
    (options.currentQuestionTitle
      ? `“${options.currentQuestionTitle}”里还缺的关键点`
      : '当前还缺的关键点');

  if (learnerAnswerFocus) {
    return `但如果只停在“${learnerAnswerFocus}”这一步，你会卡在“${primaryGap}”这里。`;
  }

  return `如果沿着当前表述继续往下说，你会卡在“${primaryGap}”这一步。`;
}

function buildClosureSummaryGuidance(options: {
  currentQuestionTitle?: string;
  isAnswerSufficient: boolean;
  judgment: NormalizedJudgmentDetails;
}) {
  if (options.isAnswerSufficient) {
    return '继续追问自己：如果换一个场景或边界条件，这条理解还成立吗？';
  }

  const primaryGap =
    options.judgment.gapItems[0]?.replace(/[。！？!?；;]+$/u, '') ||
    (options.currentQuestionTitle
      ? `“${options.currentQuestionTitle}”里还缺的关键点`
      : '当前还缺的关键点');

  return `你可以先追问自己：${toQuestionPromptFromGap(primaryGap, options.currentQuestionTitle)}如果只说结论，会漏掉哪一环？`;
}

function hasUsableStandardUnderstandingContent(content: string) {
  return (
    Boolean(content) &&
    !looksLikeJudgmentOnlyContent(content) &&
    (content.length >= MIN_SUMMARY_EXPLANATION_LENGTH ||
      containsExplanatorySignal(content) ||
      countSentences(content) >= 2)
  );
}

function extractStructuredTextFromRawNode(
  rawNode: RawLearningNodeDraft,
  sectionLabels: string[],
) {
  const content = [getText(rawNode.content), getText(rawNode.description)]
    .filter(Boolean)
    .join('\n')
    .trim();

  for (const label of sectionLabels) {
    const sectionPattern = new RegExp(
      `${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:已答到的部分|这次答得好的地方|做得好的地方|已答到|还没答到的关键点|还缺的关键点|当前最关键缺口|还缺|为什么这些缺口关键|不补上会卡在哪里|少了这些会带来什么问题|为什么关键|接下来可以往哪想|下一步往哪想|继续修改时可以先想|接下来的重点应放在)[:：]|$)`,
      'u',
    );
    const matched = content.match(sectionPattern)?.[1]?.trim();

    if (matched) {
      return matched;
    }
  }

  return '';
}

function extractTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(getText).filter(Boolean);
  }

  if (typeof value === 'string') {
    return splitStructuredList(value);
  }

  return [] satisfies string[];
}

function splitStructuredList(content: string) {
  return content
    .split(/\n|[；;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBulletList(items: string[]) {
  return items
    .map((item) => `- ${stripTrailingSentencePunctuation(item)}`)
    .join('\n');
}

function sanitizeGapItem(item: string) {
  return item
    .replace(/^\s*[-*•]\s*/u, '')
    .replace(/^\s*\d+[.)、]\s*/u, '')
    .replace(/^还缺(?:的关键点)?[:：]?\s*/u, '')
    .replace(/^当前最关键缺口[:：]?\s*/u, '')
    .replace(/^你还没有(?:解释|说明)?/u, '')
    .replace(/^还没有(?:解释|说明)?/u, '')
    .replace(/^只差把/u, '')
    .replace(/^需要继续把/u, '')
    .replace(/^需要把/u, '')
    .replace(/[。！？!?；;]+$/u, '')
    .trim();
}

function stripJudgmentScaffoldText(content: string) {
  return content
    .replace(/^已答到的部分[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^这次答得好的地方[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^做得好的地方[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^已答到[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^为什么这些缺口关键[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^不补上会卡在哪里[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^少了这些会带来什么问题[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^为什么关键[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^接下来可以往哪想[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^下一步往哪想[:：][\s\S]*?(?=\n|$)/u, '')
    .replace(/^这次回答(?:还不完整|已答到[^。！？!?；]*?)，?/u, '')
    .replace(/^这版(?:只差把)?/u, '')
    .replace(/^回答方向对了，但/u, '')
    .trim();
}

function normalizeNarrativeSentence(
  content: string,
  options: {
    fallbackPrefix: string;
    preserveLeadingQuestionWord: boolean;
  },
) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return normalizedContent;
  }

  if (
    normalizedContent.startsWith('你') ||
    normalizedContent.startsWith('这次回答') ||
    (options.preserveLeadingQuestionWord && normalizedContent.startsWith('为什么'))
  ) {
    return stripTrailingSentencePunctuation(normalizedContent);
  }

  return `${options.fallbackPrefix}${stripTrailingSentencePunctuation(normalizedContent)}`;
}

function stripLeadingSummaryLabel(content: string) {
  return content.replace(/^(标准理解|答案解析|总结)[:：]\s*/u, '').trim();
}

function stripTrailingSentencePunctuation(content: string) {
  return content.replace(/[。！？!?；;]+$/u, '').trim();
}

function toQuestionPromptFromGap(primaryGap: string, currentQuestionTitle?: string) {
  if (primaryGap.includes('为什么')) {
    return `${stripTrailingSentencePunctuation(primaryGap)}？`;
  }

  if (currentQuestionTitle) {
    return `为什么${currentQuestionTitle}不能只停在“${primaryGap}”这一步？`;
  }

  return `“${primaryGap}”到底是怎么成立的？`;
}

function extractLearnerAnswerFocus(learnerAnswer?: string) {
  const normalizedAnswer = learnerAnswer?.trim();

  if (!normalizedAnswer) {
    return '';
  }

  const answerLines = normalizedAnswer
    .replace(/^当前回答[:：]/u, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const contentLine = answerLines[answerLines.length - 1] ?? '';
  const normalizedLine = stripTrailingSentencePunctuation(contentLine);

  if (!normalizedLine) {
    return '';
  }

  return normalizedLine.length <= 28
    ? normalizedLine
    : `${normalizedLine.slice(0, 28).trimEnd()}…`;
}

function looksGenericGapItem(content: string) {
  return [
    '继续补充',
    '再想想',
    '补充说明',
    '还有遗漏',
    '需要继续',
    '关键点',
  ].some((keyword) => content.includes(keyword));
}

function looksGenericWhyItMattersText(content: string) {
  return [
    '比较重要',
    '需要完整',
    '继续补充',
    '答案还不完整',
  ].some((keyword) => content.includes(keyword));
}

function isGenericAnsweredText(content: string) {
  return [
    '关键点都提到了',
    '回答得不错',
    '方向是对的',
    '继续保持',
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
      'question',
    ),
  };
}

function normalizeSummaryEvaluationJudgmentDraft(
  rawJudgment: unknown,
  options?: {
    currentQuestionTitle?: string;
    learnerSummary?: string;
  },
): {
  draft: JudgmentNodeDraft;
  hintDetails: NormalizedJudgmentDetails;
} {
  const rawNode = isRecord(rawJudgment)
    ? (rawJudgment as RawLearningNodeDraft & {
        correctPoints?: unknown;
        missingPoints?: unknown;
        misunderstandings?: unknown;
        possibleMisunderstandings?: unknown;
        nextFocus?: unknown;
        repairFocus?: unknown;
      })
    : {};
  const rawContent =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    '';
  const correctPoints = normalizeSummaryEvaluationCorrectPoints(
    getText(rawNode.correctPoints) ||
      extractStructuredTextFromRawNode(rawNode, ['说对了什么', '已经说对的部分']),
    options?.currentQuestionTitle,
  );
  const missingPoints = normalizeSummaryEvaluationGapItems(
    rawNode.missingPoints,
    rawNode,
    ['还缺哪些关键点', '还缺的关键点', '缺口'],
    options?.currentQuestionTitle,
  );
  const misunderstandings = normalizeSummaryEvaluationGapItems(
    rawNode.possibleMisunderstandings ?? rawNode.misunderstandings,
    rawNode,
    ['哪些地方可能理解偏了', '可能理解偏了的地方', '可能的误解'],
    undefined,
    null,
  );
  const nextFocus = normalizeSummaryEvaluationNextFocus(
    getText(rawNode.nextFocus) ||
      getText(rawNode.repairFocus) ||
      extractStructuredTextFromRawNode(rawNode, [
        '可以补哪一层机制 / 因果 / 边界',
        '可以补哪一层',
        '下一步补哪层',
      ]),
    options?.currentQuestionTitle,
  );
  const hasBlockingSignal =
    missingPoints.length > 0 ||
    misunderstandings.length > 0 ||
    containsBlockingSignal(rawContent);
  const hintDetails = {
    answeredText: correctPoints,
    gapItems: [...missingPoints, ...misunderstandings].slice(0, 3),
    whyItMattersText: nextFocus,
  } satisfies NormalizedJudgmentDetails;

  return {
    draft: {
      type: 'judgment',
      judgmentKind: 'summary-check',
      title: normalizeSummaryEvaluationJudgmentTitle(
        getText(rawNode.title),
        hasBlockingSignal,
      ),
      content: normalizeSummaryEvaluationJudgmentContent({
        correctPoints,
        misunderstandings,
        missingPoints,
        nextFocus,
        rawContent,
      }),
      citations: normalizeCitationDrafts(
        rawNode.citations ?? rawNode.references,
        'judgment',
      ),
    },
    hintDetails,
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

function normalizeActionAnswerTitle(title: string) {
  return title.trim() || '回答草稿';
}

function normalizeClosureSummaryTitle(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle || /^(总结|答案解析)([:：]\s*)?$/u.test(normalizedTitle)) {
    return '标准理解';
  }

  if (/^(总结|答案解析)[:：]/u.test(normalizedTitle)) {
    const titleWithoutPrefix = normalizedTitle
      .replace(/^(总结|答案解析)[:：]\s*/u, '')
      .trim();

    return titleWithoutPrefix || '标准理解';
  }

  return normalizedTitle;
}

function normalizeActionSummaryContent(
  rawContent: string,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
) {
  const normalizedContent = rawContent.trim();

  if (hasUsableStandardUnderstandingContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const reusableSentence =
    normalizedContent && !looksLikeJudgmentOnlyContent(normalizedContent)
      ? ensureSentenceEnding(normalizedContent)
      : '';

  const fallbackSentence = options.currentQuestionTitle
    ? `围绕“${options.currentQuestionTitle}”，先把关键机制、因果链和判断边界讲清楚，再把它们串成一条完整说明。`
    : options.planStepTitle
      ? `围绕“${options.planStepTitle}”，先把这一步真正要说明的对象、关系和边界讲清楚，再把容易混淆的地方补出来。`
      : '先把当前要说明的对象、关系和边界讲清楚，再决定是否补充例子或机制。';

  return [reusableSentence, fallbackSentence].filter(Boolean).join('');
}

function normalizeSummaryEvaluationJudgmentTitle(
  title: string,
  hasBlockingSignal: boolean,
) {
  const normalizedTitle =
    title ||
    (hasBlockingSignal
      ? '判断：这段总结还可再补'
      : '判断：这段总结已抓到主线');

  if (/^判断[:：]/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  return `判断：${normalizedTitle}`;
}

function normalizeSummaryEvaluationJudgmentContent(options: {
  correctPoints: string;
  missingPoints: string[];
  misunderstandings: string[];
  nextFocus: string;
  rawContent: string;
}) {
  const normalizedRawContent = options.rawContent.trim();

  if (
    normalizedRawContent.includes('说对了什么') &&
    normalizedRawContent.includes('还缺')
  ) {
    return normalizedRawContent;
  }

  const missingPointsText =
    options.missingPoints.length > 0
      ? formatBulletList(options.missingPoints)
      : '这段总结暂时没有明显漏掉的大块内容，但还可以继续补足机制、因果或边界。';
  const misunderstandingsText =
    options.misunderstandings.length > 0
      ? formatBulletList(options.misunderstandings)
      : '暂时没有看到明确误解，但要继续检查自己有没有把结论说得过满。';

  return [
    `这段总结已经说对了什么：${options.correctPoints}`,
    `还缺的关键点：${missingPointsText}`,
    `哪些地方可能理解偏了：${misunderstandingsText}`,
    `下一步建议先补哪层：${options.nextFocus}`,
  ].join('\n');
}

function normalizeActionAnswerContent(
  rawContent: string,
  options: {
    currentQuestionTitle?: string;
    planStepTitle?: string;
  },
) {
  const normalizedContent = rawContent.trim();

  if (hasUsableAnswerDraftContent(normalizedContent)) {
    return ensureSentenceEnding(normalizedContent);
  }

  const questionLabel = options.currentQuestionTitle
    ? `“${options.currentQuestionTitle}”`
    : options.planStepTitle
      ? `“${options.planStepTitle}”这一步`
      : '当前问题';

  return `先直接回答${questionLabel}，至少说明核心结论、它为什么成立，以及它会带来什么结果。`;
}

function normalizeSummaryEvaluationCorrectPoints(
  rawText: string,
  currentQuestionTitle?: string,
) {
  const normalizedText = rawText.trim();

  if (normalizedText && !isGenericAnsweredText(normalizedText)) {
    return ensureSentenceEnding(normalizedText);
  }

  if (currentQuestionTitle) {
    return `这段总结已经抓住了“${currentQuestionTitle}”里最显眼的一条主线，但还可以继续补齐它为什么成立。`;
  }

  return '这段总结已经抓住了当前问题的一条主线，但还可以继续补齐它为什么成立。';
}

function normalizeSummaryEvaluationGapItems(
  rawValue: unknown,
  rawNode: RawLearningNodeDraft,
  sectionLabels: string[],
  currentQuestionTitle?: string,
  fallbackItem?: string | null,
) {
  const rawItems = [
    ...extractTextArray(rawValue),
    ...splitStructuredList(extractStructuredTextFromRawNode(rawNode, sectionLabels)),
  ]
    .map(sanitizeGapItem)
    .filter(Boolean)
    .filter((item) => !looksGenericGapItem(item));

  if (rawItems.length > 0) {
    return rawItems.slice(0, 3);
  }

  if (fallbackItem === null) {
    return [] as string[];
  }

  if (fallbackItem) {
    return [fallbackItem];
  }

  if (currentQuestionTitle) {
    return [`“${currentQuestionTitle}”里还缺一层关键机制、因果关系或边界条件`];
  }

  return ['当前总结还缺一层关键机制、因果关系或边界条件'];
}

function normalizeSummaryEvaluationNextFocus(
  rawText: string,
  currentQuestionTitle?: string,
) {
  const normalizedText = rawText.trim();

  if (normalizedText && !looksGenericWhyItMattersText(normalizedText)) {
    return ensureSentenceEnding(normalizedText);
  }

  if (currentQuestionTitle) {
    return `先把“${currentQuestionTitle}”里最容易被一句结论带过的那层机制、因果或边界补清楚。`;
  }

  return '先把最容易被一句结论带过的那层机制、因果或边界补清楚。';
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
      return '先把这一步说清楚';
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

function dedupeCitations<
  T extends {
    focusText?: string;
    sourceExcerpt?: string;
    sourceLocator?: string;
    targetNodeId: string;
  },
>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const dedupeKey = [
      item.targetNodeId,
      item.focusText ?? '',
      item.sourceExcerpt ?? '',
      item.sourceLocator ?? '',
    ].join('::');

    if (seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
}

function normalizeCitationPurpose(value: string): CitationPurpose | null {
  return CITATION_PURPOSE_VALUES.has(value as never)
    ? (value as CitationPurpose)
    : null;
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
