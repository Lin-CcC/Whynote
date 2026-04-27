import type {
  LearningMode,
  ModuleNodeDraft,
  PlanStepNodeDraft,
  QuestionNodeDraft,
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

const CORE_QUESTION_TITLE_SUFFIXES = [
  '关键问题',
  '需要解释什么',
  '如何验证理解',
] as const;

const PREREQUISITE_QUESTION_TITLE_SUFFIXES = [
  '铺垫问题',
  '先确认什么',
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
  keyQuestions?: unknown;
  prerequisiteQuestions?: unknown;
  prerequisites?: unknown;
  questions?: unknown;
}

interface RawQuestionDraft {
  title?: unknown;
  content?: unknown;
  description?: unknown;
  prompt?: unknown;
}

export function parseJsonObject(rawText: string): unknown {
  const normalizedText = stripCodeFence(rawText);

  try {
    return JSON.parse(normalizedText) as unknown;
  } catch {
    throw new Error('AI 返回不是合法 JSON。');
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
    questions: createFallbackQuestionDrafts(title),
    status: 'todo',
  };
}

function normalizeQuestionDrafts(
  rawPlanStep: RawPlanStepDraft,
  planStepTitle: string,
) {
  const rawPrerequisiteQuestions = extractRawQuestionDrafts(
    rawPlanStep.prerequisiteQuestions ?? rawPlanStep.prerequisites,
  );
  const rawCoreQuestions = extractRawQuestionDrafts(
    rawPlanStep.questions ?? rawPlanStep.keyQuestions,
  );
  const normalizedQuestions = [
    ...rawPrerequisiteQuestions.map((rawQuestion, index) =>
      normalizeQuestionDraft(rawQuestion, index, planStepTitle, 'prerequisite'),
    ),
    ...rawCoreQuestions.map((rawQuestion, index) =>
      normalizeQuestionDraft(rawQuestion, index, planStepTitle, 'core'),
    ),
  ];

  if (normalizedQuestions.length === 0) {
    return createFallbackQuestionDrafts(planStepTitle);
  }

  ensureUniqueTitles(normalizedQuestions);

  return normalizedQuestions;
}

function normalizeQuestionDraft(
  rawQuestion: RawQuestionDraft,
  index: number,
  planStepTitle: string,
  kind: 'core' | 'prerequisite',
): QuestionNodeDraft {
  const title =
    getText(rawQuestion.title) ||
    getText(rawQuestion.prompt) ||
    createQuestionTitle(planStepTitle, index, kind);
  const content =
    getText(rawQuestion.content) || getText(rawQuestion.description);

  return {
    type: 'question',
    title:
      kind === 'prerequisite' ? normalizePrerequisiteTitle(title) : title,
    content:
      kind === 'prerequisite' ? normalizePrerequisiteContent(content) : content,
  };
}

function createFallbackQuestionDrafts(planStepTitle: string): QuestionNodeDraft[] {
  return [
    {
      type: 'question',
      title: createQuestionTitle(planStepTitle, 0, 'prerequisite'),
      content: '先确认理解这个步骤所需的前置概念或背景条件。',
    },
    {
      type: 'question',
      title: createQuestionTitle(planStepTitle, 0, 'core'),
      content: '围绕这个步骤的核心问题展开回答、总结与判断。',
    },
  ];
}

function extractRawModules(payload: unknown): RawModuleDraft[] {
  if (!isRecord(payload)) {
    return [];
  }

  return Array.isArray(payload.modules) ? payload.modules : [];
}

function extractRawPlanSteps(payload: unknown): RawPlanStepDraft[] {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.planSteps)) {
    return payload.planSteps;
  }

  return Array.isArray(payload.steps) ? payload.steps : [];
}

function extractRawQuestionDrafts(payload: unknown): RawQuestionDraft[] {
  return Array.isArray(payload) ? payload : [];
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

function createQuestionTitle(
  planStepTitle: string,
  index: number,
  kind: 'core' | 'prerequisite',
) {
  const suffixes =
    kind === 'prerequisite'
      ? PREREQUISITE_QUESTION_TITLE_SUFFIXES
      : CORE_QUESTION_TITLE_SUFFIXES;
  const suffix = suffixes[index] ?? `${kind === 'prerequisite' ? '铺垫问题' : '关键问题'} ${String(index + 1)}`;

  return `${planStepTitle.trim()}：${suffix}`;
}

function normalizePrerequisiteTitle(title: string) {
  return /^铺垫[:：]/u.test(title) ? title : `铺垫：${title}`;
}

function normalizePrerequisiteContent(content: string) {
  if (!content) {
    return '先确认这个步骤依赖的基础概念、术语或背景。';
  }

  return content;
}

function ensureUniqueTitles<T extends { title: string }>(items: T[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const baseTitle = item.title.replace(/（\d+）$/u, '');
    const currentCount = counts.get(baseTitle) ?? 0;

    if (currentCount > 0) {
      item.title = `${baseTitle}（${String(currentCount + 1)}）`;
    }

    counts.set(baseTitle, currentCount + 1);
  }
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
