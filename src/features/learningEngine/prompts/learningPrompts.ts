import type {
  AiMessage,
  CompoundQuestionSplitInput,
  JudgmentHintInput,
  LearningActionDraftInput,
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
        'introductions 必须像以后可以直接保留进笔记的自然解释，优先写概念关系、背景、直觉、例子或常见混淆点，而不是课堂串场。',
        'introductions 先解释这一步为什么重要、在当前主题里到底要看清什么，再把关键对象、关系、因果或边界讲出来；不要只重复后面的 question。',
        '不要出现“接下来会围绕……继续追问”“先把核心对象、关键关系和判断线索放到同一张理解地图里”“这一步我们要建立一个宏观视角”这类转场句。',
        '可以自然点到后续关注点，但不要用“后面我会问什么”来解释 introductions。',
        '优先写成 3-5 句、约 80-180 个中文字符，让用户在看到问题前已经形成一版粗略但可用的理解。',
        '每个 plan-step 再给 1-3 个具体 questions。问题要逐步递进、指向明确、可以判断是否答到点。',
        '每个 question 尽量只检查一个主要理解点，不要使用“谈谈理解”“总结全部内容”“列举几个方面”这类空泛问法。',
        '不要把 prerequisites 伪装成 question，也不要只列空泛名词。',
        '如果资料候选能支撑 introductions 或 questions，可在 citations 中填精确 targetNodeId；能定位 fragment 时优先 fragment，否则可以退回 resource。',
        buildTeachingCitationInstruction(),
        `返回格式：{"modules":[{"title":"","content":"","planSteps":[{"title":"","content":"","introductions":[{"title":"","content":"","citations":[${buildCitationJsonShape()}]}],"questions":[{"title":"","content":"","citations":[${buildCitationJsonShape()}]}]}]}]}`,
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
        'introductions 必须像以后可以直接保留进笔记的自然解释，优先写概念关系、背景、直觉、例子或常见混淆点，而不是课堂串场。',
        'introductions 先解释这一步为什么重要、在当前模块里到底要看清什么，再把关键对象、关系、因果或边界讲出来；不要只把后续 question 换个说法复述。',
        '不要出现“接下来会围绕……继续追问”“先把核心对象、关键关系和判断线索放到同一张理解地图里”“这一步我们要建立一个宏观视角”这类转场句。',
        '可以自然点到后续关注点，但不要用“后面我会问什么”来解释 introductions。',
        '优先写成 3-5 句、约 80-180 个中文字符，让用户在进入问题前已经具备一版粗略但可用的理解。',
        '每个步骤再给 1-3 个具体 questions，问题要围绕当前 step，彼此递进，并且可以根据回答判断是否答到点。',
        '每个 question 尽量只检查一个主要理解点，不要使用“谈谈理解”“总结全部内容”“列举几个方面”这类空泛问法。',
        '如果资料适合支撑讲解或问题，请在 citations 中返回 targetNodeId；无法精确到 fragment 时可以引用 resource。',
        buildTeachingCitationInstruction(),
        '不要输出 prerequisites 数组来伪装铺垫问题。',
        `返回格式：{"planSteps":[{"title":"","content":"","introductions":[{"title":"","content":"","citations":[${buildCitationJsonShape()}]}],"questions":[{"title":"","content":"","citations":[${buildCitationJsonShape()}]}]}]}`,
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
        'judgment 只负责三件事：1. 你已经答到什么；2. 你还缺哪 1-3 个关键点；3. 为什么这些缺口关键。',
        '优先把 judgment 写成结构化内容：answered 填“已答到什么”，gaps 返回 1-3 条缺口数组，whyItMatters 说明为什么这些缺口决定理解是否完整；如果只写 judgment.content，也必须按“已答到 / 还缺的关键点 / 为什么关键”三段来写。',
        '不要把完整讲解、标准答案或大段纠错塞进 judgment。',
        'hint 必须单独返回。它不是 judgment 的改写，也不是答案解析的缩写，而是围绕当前缺口的微型铺垫。',
        'hint 只做三件事：1. 明确这次先补哪一个缺口；2. 补一小段必要知识背景；3. 给一个可以继续思考的问题抓手。',
        '优先把 hint 写成结构化内容：focus 填“先补哪块”，background 填“关键背景”，thinkingQuestion 填“可以先想”；如果只写 hint.content，也必须按“先补哪块 / 关键背景 / 可以先想”三段来写。',
        'hint 不要直接给完整标准答案，不要把 judgment 的“已答到 / 还缺 / 为什么关键”换个格式重复，也不要摘抄 summary 里的标准理解句子。',
        'summary 只负责给出答案解析 / 标准理解，不要只重复“回答还不完整”或“已经答到”，也不允许留空。',
        'summary 要写成引导式解析：先承认用户当前思路里已经对的部分，再指出如果沿当前思路继续推会卡在哪里，再用问题式引导推进，必要时最后整理成更稳妥的标准理解；如果用户有误，不要迎合错误表述。',
        '如果回答不足，followUpQuestions 返回 1-2 个具体追问；如果回答充分，followUpQuestions 返回空数组。',
        'followUpQuestions 只能补当前回答缺失的关键点，不要把主问题原样重复，也不要要求用户把整道题完整重答一遍。',
        '如果资料候选能支撑 judgment 或 summary，请在 citations 中返回 targetNodeId；能用 fragment 时优先 fragment。',
        buildTeachingCitationInstruction(),
        `返回格式：{"isAnswerSufficient":true,"judgment":{"title":"","answered":"","gaps":[""],"whyItMatters":"","content":"","citations":[${buildCitationJsonShape()}]},"hint":{"focus":"","background":"","thinkingQuestion":"","content":""},"summary":{"title":"","content":"","citations":[${buildCitationJsonShape()}]},"followUpQuestions":[{"title":"","content":"","citations":[${buildCitationJsonShape()}]}]}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function buildJudgmentHintMessages(input: JudgmentHintInput): AiMessage[] {
  const currentQuestion =
    input.questionPath[input.questionPath.length - 1] ?? null;

  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的思考提示生成器。只输出 JSON，只生成围绕当前缺口的微型铺垫，不要改写 judgment，也不要复述答案解析。',
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
        optionalLine('用户当前回答', input.learnerAnswer),
        optionalLine('已有判断评价', input.judgmentContent),
        optionalLine('已有答案解析', input.summaryContent),
        optionalLine(
          '可引用资料候选',
          formatReferenceCandidates(input.referenceCandidates),
        ),
        '任务：基于上面的 judgment，补一条真正帮助用户继续修改回答的提示。',
        '这条 hint 要和 judgment / 答案解析相辅相成：judgment 负责指出缺口，hint 负责补继续思考所需的最小知识背景。',
        '优先只抓当前最关键的一个缺口，不要把 judgment 里整段诊断或多条缺口原样搬过来。',
        'hint 只做三件事：1. 明确这次先补哪一个缺口；2. 补一小段必要知识背景；3. 给一个可以继续思考的问题抓手。',
        '如果已有答案解析，不要摘抄里面的完整答案句子；只抽出用户继续思考前必须先明白的那层机制、因果链或边界。',
        '优先把 hint 写成结构化内容：focus 填“先补哪块”，background 填“关键背景”，thinkingQuestion 填“可以先想”；如果只写 hint.content，也必须按“先补哪块 / 关键背景 / 可以先想”三段来写。',
        'hint 不能写成“继续想想”“先补缺口”这种空提示，也不要直接把标准答案整段告诉用户。',
        `返回格式：{"hint":{"focus":"","background":"","thinkingQuestion":"","content":""}}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export function buildLearningActionDraftMessages(
  input: LearningActionDraftInput,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是 Whynote 的学习动作补全器。只输出 JSON，只为当前动作生成一个可编辑草稿，只能使用现有 summary / question / judgment 节点语义，不要返回空内容，不要发明新节点类型。',
    },
    {
      role: 'user',
      content: [
        `学习主题：${input.topic.trim()}`,
        `学习动作：${input.actionId}`,
        optionalLine('模块标题', input.moduleTitle),
        optionalLine('步骤标题', input.planStepTitle),
        optionalLine('步骤目标', input.planStepSummary),
        optionalLine(
          '当前铺垫',
          input.introductions?.filter(Boolean).join('\n\n'),
        ),
        optionalLine(
          '当前选中节点',
          input.currentNode
            ? formatTitledContent(input.currentNode.title, input.currentNode.content)
            : '',
        ),
        optionalLine(
          '当前问题路径',
          input.questionPath?.length ? formatQuestionPath(input.questionPath) : '',
        ),
        optionalLine('现有回答', input.learnerAnswer),
        optionalLine(
          '当前步骤已有问题',
          input.existingQuestionTitles?.filter(Boolean).join('；'),
        ),
        optionalLine(
          '可引用资料候选',
          formatReferenceCandidates(input.referenceCandidates),
        ),
        ...buildLearningActionInstructions(input),
        '如果资料候选能支撑这份草稿，请在 citations 中返回 targetNodeId；能用 fragment 时优先 fragment。',
        buildTeachingCitationInstruction(),
        `返回格式：{"title":"","content":"","citations":[${buildCitationJsonShape()}]}`,
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

function buildLearningActionInstructions(input: LearningActionDraftInput) {
  switch (input.actionId) {
    case 'insert-scaffold':
      return [
        '目标节点类型：summary。',
        '请为当前步骤补一段可直接编辑的铺垫 / 讲解草稿。',
        '重点先解释这一步为什么存在、要先看清哪些概念或关系，并补上必要的直觉、背景、例子或常见混淆点。',
        '不要写成“接下来会问什么”的串场句，也不要使用“理解地图”“宏观视角”这类模板表达。',
        '优先写成 3-5 句、约 80-180 个中文字符，不要只给一句空泛提示。',
      ];
    case 'rephrase-scaffold':
      return [
        '目标节点类型：summary。',
        '请基于当前铺垫换个说法再解释一次，不要改写原节点，而是生成一段新的补讲草稿。',
        '优先减少术语堆叠，把同一件事换成更直白的表达。',
      ];
    case 'simplify-scaffold':
      return [
        '目标节点类型：summary。',
        '请把当前铺垫退回到更基础的直觉层，用更简单的语言重新讲一遍。',
        '允许先补最小背景，再接回当前步骤，不要直接重复原文。',
      ];
    case 'add-example':
      return [
        '目标节点类型：summary。',
        '请为当前铺垫补一个具体例子或情境，让抽象关系更容易理解。',
        '例子要服务于理解，不要变成无关段子。',
      ];
    case 'insert-question':
      return [
        '目标节点类型：question。',
        '请补一个真正能推进当前步骤的问题草稿。',
        '问题尽量只检查一个主要理解点，不要使用“谈谈理解”“总结全部内容”这类空泛问法。',
        '如果当前步骤已有问题，尽量避开重复角度。',
      ];
    case 'insert-summary':
      return [
        '目标节点类型：summary。',
        '请补一段可编辑的总结 / 标准理解草稿。',
        input.learnerAnswer?.trim()
          ? '如果当前已经有回答，先接住用户已经答到的部分，再补缺的机制、因果或边界，最后整理成更稳妥的标准理解。'
          : '如果当前还没有回答，就直接把当前问题或当前步骤真正想说明的对象、关系、机制和边界讲清楚。',
        '不要只写“总结一下”，也不要把 judgment 换个说法再重复一遍。',
      ];
    case 'insert-judgment':
      return [
        '目标节点类型：judgment。',
        input.learnerAnswer?.trim()
          ? '如果已经有回答，请判断它最可能答到了什么、还缺哪 1-3 个关键点，以及为什么这些缺口关键，并保持 judgment 与讲解分工清晰。'
          : '当前没有现成回答，请先写一份“什么才算答到 / 还需要验证什么”的判断草稿，帮助用户知道作答标准。',
        '不要把完整讲解塞进 judgment；判断只负责指出当前掌握情况、关键缺口和待验证点。',
      ];
  }
}

function buildTeachingCitationInstruction() {
  return '只给确实承担定义、机制说明、代码行为解释、例子来源、判断支撑或背景补充作用的片段挂 citations，不要给过渡语句挂引用。每条 citation 除 targetNodeId 外，尽量补 focusText（当前讲解里被资料支撑的那一句或那一小段）、purpose（definition / mechanism / behavior / example / judgment / background）、note（为什么该看这段）；如果 citation 要支撑具体讲解片段但 targetNodeId 指向 resource，而不是 fragment，就必须补 sourceExcerpt 或 sourceLocator，否则这条引用不会被当成教学引用展示。';
}

function buildCitationJsonShape() {
  return '{"targetNodeId":"","focusText":"","purpose":"mechanism","note":"","sourceExcerpt":"","sourceLocator":""}';
}
