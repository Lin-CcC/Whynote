import type {
  AiMessage,
  CompoundQuestionSplitInput,
  LearningMode,
  LearningModeLimits,
  ModuleGenerationInput,
  PlanStepGenerationInput,
} from '../domain';
import { getLearningModeLabel } from '../domain';

export function buildModuleGenerationMessages(
  input: ModuleGenerationInput,
  mode: LearningMode,
  limits: LearningModeLimits,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的学习编排器。只输出 JSON，且结果只能围绕 module 与 plan-step，不要发明额外产品概念。',
    },
    {
      role: 'user',
      content: [
        `学习主题：${input.topic.trim()}`,
        `学习模式：${getLearningModeLabel(mode)}`,
        optionalLine('资料概况', input.resourceSummary),
        optionalLine('用户偏好', input.userPreferences),
        `模块数量必须在 ${limits.moduleCount.min}-${limits.moduleCount.max} 之间。`,
        `每个模块的 plan-step 数量必须在 ${limits.planStepCount.min}-${limits.planStepCount.max} 之间。`,
        '每个模块需要简洁标题与一句目标说明。',
        '每个 plan-step 不是只给标题；至少补 1 个关键 question，并可在需要时补 0-2 个铺垫 question。',
        '铺垫 question 仍然要能直接落成现有 question 节点，不要发明新的并行结构。',
        '返回格式：{"modules":[{"title":"","content":"","planSteps":[{"title":"","content":"","questions":[{"title":"","content":""}],"prerequisites":[{"title":"","content":""}]}]}]}',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function buildPlanStepGenerationMessages(
  input: PlanStepGenerationInput,
  mode: LearningMode,
  limits: LearningModeLimits,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的模块内学习计划生成器。只输出 JSON，且只生成 plan-step 草案。',
    },
    {
      role: 'user',
      content: [
        `学习主题：${input.topic.trim()}`,
        `模块标题：${input.moduleTitle.trim()}`,
        `学习模式：${getLearningModeLabel(mode)}`,
        optionalLine('模块概况', input.moduleSummary),
        optionalLine('资料概况', input.resourceSummary),
        optionalLine('用户偏好', input.userPreferences),
        `plan-step 数量必须在 ${limits.planStepCount.min}-${limits.planStepCount.max} 之间。`,
        '每个步骤至少给出标题和一句目标说明。',
        '每个步骤至少补 1 个关键 question，并在确有依赖时补 0-2 个铺垫 question。',
        '铺垫 question 仍然会落成普通 question 节点，只是排在更前面，不要输出新的节点类型。',
        '返回格式：{"planSteps":[{"title":"","content":"","questions":[{"title":"","content":""}],"prerequisites":[{"title":"","content":""}]}]}',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function buildCompoundQuestionSplitMessages(
  input: CompoundQuestionSplitInput,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的复合问题拆分器。只输出 JSON，保留原问题为父 question，显式给出子问题及理解依赖。',
    },
    {
      role: 'user',
      content: [
        `原问题：${input.question.trim()}`,
        optionalLine('所在模块', input.moduleTitle),
        optionalLine('所在步骤', input.planStepTitle),
        optionalLine('相关资料概况', input.resourceSummary),
        '请拆成多个可直接挂到父 question 下的子问题。',
        '若存在理解依赖，用 dependsOnIndices 标出依赖的原始序号，并给每个子问题一个 0-1 的 confidence。',
        '返回格式：{"questions":[{"title":"","content":"","dependsOnIndices":[0],"confidence":0.8}]}',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

function optionalLine(label: string, value?: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return '';
  }

  return `${label}：${normalizedValue}`;
}
