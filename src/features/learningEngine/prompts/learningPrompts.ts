import type {
  AiMessage,
  CompoundQuestionSplitInput,
  LearningMode,
  LearningModeLimits,
  ModuleGenerationInput,
  PlanStepGenerationInput,
  QuestionClosureInput,
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
        '你是 Whynote 的学习路径规划器。只输出 JSON，只能围绕 module / plan-step / summary / question 组织内容，不要发明新的产品概念。',
    },
    {
      role: 'user',
      content: [
        `学习主题：${input.topic.trim()}`,
        `学习模式：${getLearningModeLabel(mode)}`,
        optionalLine('资料概况', input.resourceSummary),
        optionalLine('用户偏好', input.userPreferences),
        optionalLine(
          '可引用资料候选',
          formatReferenceCandidates(input.referenceCandidates),
        ),
        `模块数量必须在 ${limits.moduleCount.min}-${limits.moduleCount.max} 之间。`,
        `每个模块的 plan-step 数量必须在 ${limits.planStepCount.min}-${limits.planStepCount.max} 之间。`,
        '每个模块需要简洁标题与一句目标说明。',
        '每个 plan-step 先给 1-2 个 introductions。它们会落成 summary 节点，必须是真正可读的前置讲解，不是问题标题，也不能只有一句空泛提示。',
        'introductions 至少要帮助用户建立这一步的宏观理解：它在整个主题里解决什么问题、先要抓住哪些关键概念/关系、后续 questions 会从什么角度继续追问。',
        'introductions 不是定义摘抄，也不要只重复后面的 question；要先解释这一步为什么存在，再自然把用户带到后续问题上。',
        '优先写成 3-5 句、约 80-180 个中文字符，让用户在看到问题前已经有一张粗略但可用的理解地图。',
        '每个 plan-step 再给 1-3 个具体 questions。问题要逐步递进、指向明确、可以判断是否答到点。',
        '每个 question 尽量只检查一个主要理解点，不要使用“谈谈理解”“总结全部内容”“列举几个方面”这类空泛问法。',
        '不要把 prerequisites 伪装成 question，也不要只列空泛名词。',
        '如果资料候选能支撑 introductions 或 questions，可在 citations 中填精确 targetNodeId；能定位 fragment 时优先 fragment，否则可以退回 resource。',
        '返回格式：{"modules":[{"title":"","content":"","planSteps":[{"title":"","content":"","introductions":[{"title":"","content":"","citations":[{"targetNodeId":""}]}],"questions":[{"title":"","content":"","citations":[{"targetNodeId":""}]}]}]}]}',
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
        '你是 Whynote 的模块内学习路径规划器。只输出 JSON，只生成 plan-step 草案，且只能使用现有 summary / question 语义。',
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
        optionalLine(
          '可引用资料候选',
          formatReferenceCandidates(input.referenceCandidates),
        ),
        `plan-step 数量必须在 ${limits.planStepCount.min}-${limits.planStepCount.max} 之间。`,
        '每个步骤至少给出标题和一句目标说明。',
        '每个步骤必须先给至少 1 个 introductions。它们会直接落成 summary 节点，承担铺垫讲解，不是问题，也不能只是随手补一句提示。',
        'introductions 至少要帮助用户建立这一步的宏观理解：这一步在整个模块里负责解决什么、先要抓住哪些关键概念/关系、后续 questions 会从什么角度继续追问。',
        'introductions 不是定义摘抄，也不要只把后续 question 换个说法复述；要先让用户理解这一步为什么存在，再自然引出后续问题。',
        '优先写成 3-5 句、约 80-180 个中文字符，让用户在进入问题前已经具备粗略但可用的理解地图。',
        '每个步骤再给 1-3 个具体 questions，问题要围绕当前 step，彼此递进，并且可以根据回答判断是否答到点。',
        '每个 question 尽量只检查一个主要理解点，不要使用“谈谈理解”“总结全部内容”“列举几个方面”这类空泛问法。',
        '如果资料适合支撑讲解或问题，请在 citations 中返回 targetNodeId；无法精确到 fragment 时可以引用 resource。',
        '不要输出 prerequisites 数组来伪装铺垫问题。',
        '返回格式：{"planSteps":[{"title":"","content":"","introductions":[{"title":"","content":"","citations":[{"targetNodeId":""}]}],"questions":[{"title":"","content":"","citations":[{"targetNodeId":""}]}]}]}',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function buildQuestionClosureMessages(
  input: QuestionClosureInput,
): AiMessage[] {
  const currentQuestion =
    input.questionPath[input.questionPath.length - 1] ?? null;

  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的学习闭环评估器。只输出 JSON，只能使用 judgment / summary / question 三种现有节点语义完成“评估-解释-推进下一步”。',
    },
    {
      role: 'user',
      content: [
        `学习主题：${input.topic.trim()}`,
        optionalLine('模块标题', input.moduleTitle),
        optionalLine('步骤标题', input.planStepTitle),
        optionalLine('步骤目标', input.planStepSummary),
        optionalLine(
          '前置讲解',
          input.introductions?.filter(Boolean).join('\n\n'),
        ),
        optionalLine('问题路径', formatQuestionPath(input.questionPath)),
        optionalLine(
          '当前问题',
          currentQuestion
            ? formatTitledContent(currentQuestion.title, currentQuestion.content)
            : '',
        ),
        `用户回答：${input.learnerAnswer.trim()}`,
        optionalLine(
          '可引用资料候选',
          formatReferenceCandidates(input.referenceCandidates),
        ),
        '任务：先判断这次回答是否已经覆盖当前问题的关键点，再给出更好的标准理解；如果回答不足，只追问缺失点，不要重复已经答对的部分。',
        'judgment 只负责判断是否“已答到”或“还不完整”，并指出主要缺口；不要把完整讲解写进 judgment。',
        'summary 只负责给出更好的标准理解或纠错讲解，不要只重复“回答还不完整”或“已经答到”。',
        '如果回答不足，followUpQuestions 返回 1-2 个具体追问；如果回答充分，followUpQuestions 返回空数组。',
        'followUpQuestions 只能补当前回答缺失的关键点，不要把主问题原样重复，也不要要求用户把整道题完整重答一遍。',
        '如果资料候选能支撑 judgment 或 summary，请在 citations 中返回 targetNodeId；能用 fragment 时优先 fragment。',
        '返回格式：{"isAnswerSufficient":true,"judgment":{"title":"","content":"","citations":[{"targetNodeId":""}]},"summary":{"title":"","content":"","citations":[{"targetNodeId":""}]},"followUpQuestions":[{"title":"","content":"","citations":[{"targetNodeId":""}]}]}',
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
        '如果存在理解依赖，用 dependsOnIndices 标出依赖的原始序号，并给每个子问题一个 0-1 的 confidence。',
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

function formatReferenceCandidates(
  candidates: ModuleGenerationInput['referenceCandidates'],
) {
  if (!candidates?.length) {
    return '';
  }

  return candidates
    .map((candidate) => {
      const sourceLabel = candidate.sourceResourceTitle
        ? ` | 来源资料：${candidate.sourceResourceTitle}`
        : '';
      const locatorLabel = candidate.locator ? ` | 定位：${candidate.locator}` : '';

      return [
        `- targetNodeId=${candidate.targetNodeId}`,
        `type=${candidate.targetType}`,
        `title=${candidate.title}`,
        `content=${candidate.content}`,
        `${sourceLabel}${locatorLabel}`.trim(),
      ]
        .filter(Boolean)
        .join(' | ');
    })
    .join('\n');
}

function formatQuestionPath(
  questionPath: QuestionClosureInput['questionPath'],
) {
  return questionPath
    .map((question, index) =>
      `${String(index + 1)}. ${formatTitledContent(question.title, question.content)}`,
    )
    .join('\n');
}

function formatTitledContent(title: string, content?: string) {
  const normalizedContent = content?.trim();

  if (!normalizedContent) {
    return title.trim();
  }

  return `${title.trim()}\n${normalizedContent}`;
}
