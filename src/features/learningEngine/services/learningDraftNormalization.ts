import type {
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
): QuestionClosureResult {
  const rawPayload = isRecord(payload) ? (payload as RawQuestionClosurePayload) : {};
  const isAnswerSufficient = resolveAnswerSufficiency(rawPayload);
  const judgment = normalizeJudgmentDraft(
    rawPayload.judgment ?? rawPayload.evaluation,
    isAnswerSufficient,
  );
  const summary = normalizeClosureSummaryDraft(
    rawPayload.summary ?? rawPayload.explanation,
  );
  const followUpQuestions = normalizeFollowUpQuestionDrafts(
    rawPayload,
    isAnswerSufficient,
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

  return {
    type: 'plan-step',
    title: normalizedTitle,
    content,
    introductions: normalizeIntroductionDrafts(rawPlanStep, normalizedTitle),
    questions: normalizeQuestionDrafts(rawPlanStep, normalizedTitle),
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

  return {
    type: 'plan-step',
    title,
    content: '',
    introductions: createFallbackIntroductionDrafts(title),
    questions: createFallbackQuestionDrafts(title),
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
  const content =
    getText(rawIntroduction.content) ||
    getText(rawIntroduction.description) ||
    '先说明这个 step 在解决什么问题、涉及哪些关键概念，再进入后续问题。';

  return {
    type: 'summary',
    title: normalizeIntroductionTitle(rawTitle, planStepTitle, index),
    content,
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
    content,
    citations: normalizeCitationDrafts(
      rawQuestion.citations ?? rawQuestion.references,
    ),
  };
}

function normalizeJudgmentDraft(
  rawJudgment: unknown,
  isAnswerSufficient: boolean,
): JudgmentNodeDraft {
  const rawNode = isRecord(rawJudgment)
    ? (rawJudgment as RawLearningNodeDraft)
    : {};
  const title = getText(rawNode.title);
  const content =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    (isAnswerSufficient
      ? '你的回答已经覆盖当前问题的关键点，可以进入下一步。'
      : '你的回答还不完整，关键点没有全部答到，需要继续补充。');

  return {
    type: 'judgment',
    title: normalizeJudgmentTitle(title, isAnswerSufficient),
    content,
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeClosureSummaryDraft(rawSummary: unknown): SummaryNodeDraft {
  const rawNode = isRecord(rawSummary)
    ? (rawSummary as RawLearningNodeDraft)
    : {};
  const title = getText(rawNode.title);
  const content =
    getText(rawNode.content) ||
    getText(rawNode.description) ||
    '请把更准确的标准理解补全为一段可以直接复用的讲解。';

  return {
    type: 'summary',
    title: title || '总结：标准理解',
    content,
    citations: normalizeCitationDrafts(rawNode.citations ?? rawNode.references),
  };
}

function normalizeFollowUpQuestionDrafts(
  rawPayload: RawQuestionClosurePayload,
  isAnswerSufficient: boolean,
) {
  if (isAnswerSufficient) {
    return [] satisfies QuestionNodeDraft[];
  }

  const rawQuestions = extractRawLearningNodeDrafts(
    rawPayload.followUpQuestions ??
      rawPayload.followUps ??
      rawPayload.nextQuestions,
  );
  const normalizedQuestions = rawQuestions.map((rawQuestion, index) => ({
    ...normalizeQuestionDraft(rawQuestion, index, '补充回答'),
    title: normalizeFollowUpQuestionTitle(
      getText(rawQuestion.title) ||
        getText(rawQuestion.prompt) ||
        `补充问题 ${String(index + 1)}`,
    ),
  }));

  if (normalizedQuestions.length === 0) {
    return [
      {
        type: 'question',
        title: '追问：补上缺失的关键点',
        content: '请只补充这次判断里指出的缺失点，不需要重复已经答对的部分。',
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
      title: normalizeIntroductionTitle('建立当前问题的基本图景', planStepTitle, 0),
      content:
        '先交代这个 step 为什么重要、需要抓住哪两个核心概念，再进入后面的具体问题。',
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
