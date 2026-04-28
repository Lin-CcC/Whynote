interface RawClosureHintNode {
  content?: unknown;
  text?: unknown;
  description?: unknown;
  focus?: unknown;
  primaryGap?: unknown;
  gapFocus?: unknown;
  background?: unknown;
  keyBackground?: unknown;
  primer?: unknown;
  mechanismBackground?: unknown;
  thinkingQuestion?: unknown;
  question?: unknown;
  thoughtStarter?: unknown;
  startingQuestion?: unknown;
}

interface HintSectionDraft {
  focus: string;
  background: string;
  thinkingQuestion: string;
  legacyThinking: string;
}

interface ClosureHintRenderDetails {
  focus: string;
  background: string;
  thinkingQuestion: string;
}

interface GapInsight {
  raw: string;
  focusLabel: string;
  detail: string;
}

const HINT_SECTION_LABEL_PATTERNS = {
  focus: [/^(先补哪块|优先补哪块|先补什么)[:：]\s*/u],
  background: [/^(关键背景|最小背景|必要背景)[:：]\s*/u],
  thinkingQuestion: [/^(可以先想|先从这个问题想|思考抓手)[:：]\s*/u],
  legacyThinking: [/^(先想清|先想一想)[:：]\s*/u],
} as const;

const GENERIC_HINT_PATTERNS = [
  /继续补充/u,
  /再想想/u,
  /继续思考/u,
  /先补缺口/u,
  /给一点提示/u,
  /看答案解析/u,
  /不要直接看答案/u,
  /回到回答修改/u,
] as const;

type HintGapKind =
  | 'combinatorial-explosion'
  | 'feedback-direction'
  | 'causal'
  | 'boundary'
  | 'mechanism'
  | 'generic';

export function normalizeClosureHintText(options: {
  rawHint: unknown;
  currentQuestionTitle?: string;
  judgmentGapItems: string[];
  judgmentContent: string;
  summaryContent: string;
}) {
  const sectionDraft = extractHintSectionDraft(options.rawHint);
  const normalizedFocusCandidate = normalizeHintFocusCandidate(sectionDraft.focus);
  const primaryGapInsight = buildPrimaryGapInsight(
    isUsableHintFocus(normalizedFocusCandidate)
      ? normalizedFocusCandidate
      : options.judgmentGapItems[0] || sectionDraft.focus || '',
    options.currentQuestionTitle,
  );
  const focus = resolveHintFocus(sectionDraft, options, primaryGapInsight);
  const background = resolveHintBackground(
    sectionDraft,
    primaryGapInsight,
    options,
  );
  const thinkingQuestion = resolveHintThinkingQuestion(
    sectionDraft,
    primaryGapInsight,
    options.currentQuestionTitle,
  );

  return renderHint({
    focus,
    background,
    thinkingQuestion,
  });
}

export function buildFallbackClosureHintText(options: {
  currentQuestionTitle?: string;
  judgmentGapItems?: string[];
  judgmentContent?: string;
  summaryContent?: string;
}) {
  const judgmentGapItems =
    options.judgmentGapItems && options.judgmentGapItems.length > 0
      ? options.judgmentGapItems
      : extractJudgmentGapItemsFromText(
          options.judgmentContent ?? '',
          options.currentQuestionTitle,
        );

  return normalizeClosureHintText({
    rawHint: null,
    currentQuestionTitle: options.currentQuestionTitle,
    judgmentGapItems,
    judgmentContent: options.judgmentContent ?? '',
    summaryContent: options.summaryContent ?? '',
  });
}

export function extractJudgmentGapItemsFromText(
  content: string,
  currentQuestionTitle?: string,
) {
  const structuredGapText = extractStructuredSection(content, [
    '还没答到的关键点',
    '还缺的关键点',
    '当前最关键缺口',
    '还缺',
  ]);

  if (structuredGapText) {
    const structuredItems = splitStructuredList(structuredGapText).map((item) =>
      sanitizeGapItem(item),
    );

    if (structuredItems.length > 0) {
      return structuredItems.slice(0, 3).map(ensureSentenceEnding);
    }
  }

  const enumeratedGapItems = extractEnumeratedGapItems(content);

  if (enumeratedGapItems.length > 0) {
    return enumeratedGapItems;
  }

  const fallbackGap = sanitizeGapItem(
    content
      .replace(/^这次答得好的地方[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^做得好的地方[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^已答到[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^不补上会卡在哪里[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^少了这些会带来什么问题[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^为什么关键[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^接下来可以往哪想[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^下一步往哪想[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^这次回答(?:还不完整|已答到[^。！？!?；]*?)，?/u, '')
      .replace(/^这版(?:只差把)?/u, '')
      .replace(/^回答方向对了，但/u, '')
      .trim(),
  );

  if (fallbackGap) {
    return splitStructuredList(fallbackGap).map(ensureSentenceEnding);
  }

  return [
    ensureSentenceEnding(
      currentQuestionTitle
        ? `把“${currentQuestionTitle}”真正依赖的关键机制、因果关系或判断边界说清楚`
        : '把当前问题真正依赖的关键机制、因果关系或判断边界说清楚',
    ),
  ];
}

function extractHintSectionDraft(rawHint: unknown): HintSectionDraft {
  const rawNode = isRecord(rawHint) ? (rawHint as RawClosureHintNode) : {};
  const rawText =
    typeof rawHint === 'string'
      ? rawHint.trim()
      : getText(rawNode.content) ||
        getText(rawNode.text) ||
        getText(rawNode.description);
  const parsedSections = parseHintSections(rawText);

  return {
    focus:
      getText(rawNode.focus) ||
      getText(rawNode.primaryGap) ||
      getText(rawNode.gapFocus) ||
      parsedSections.focus,
    background:
      getText(rawNode.background) ||
      getText(rawNode.keyBackground) ||
      getText(rawNode.primer) ||
      getText(rawNode.mechanismBackground) ||
      parsedSections.background,
    thinkingQuestion:
      getText(rawNode.thinkingQuestion) ||
      getText(rawNode.question) ||
      getText(rawNode.thoughtStarter) ||
      getText(rawNode.startingQuestion) ||
      parsedSections.thinkingQuestion,
    legacyThinking: parsedSections.legacyThinking,
  };
}

function parseHintSections(content: string): HintSectionDraft {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: HintSectionDraft = {
    focus: '',
    background: '',
    thinkingQuestion: '',
    legacyThinking: '',
  };

  for (const line of lines) {
    const [sectionKey, strippedLine] = matchHintSectionLabel(line);

    if (!sectionKey) {
      continue;
    }

    sections[sectionKey] = strippedLine;
  }

  return sections;
}

function matchHintSectionLabel(line: string) {
  for (const [sectionKey, patterns] of Object.entries(HINT_SECTION_LABEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return [
          sectionKey as keyof HintSectionDraft,
          line.replace(pattern, '').trim(),
        ] as const;
      }
    }
  }

  return [null, ''] as const;
}

function resolveHintFocus(
  sectionDraft: HintSectionDraft,
  options: {
    currentQuestionTitle?: string;
    judgmentGapItems: string[];
  },
  primaryGapInsight: GapInsight,
) {
  const focusCandidate = normalizeHintFocusCandidate(sectionDraft.focus);

  if (isUsableHintFocus(focusCandidate)) {
    return ensureSentenceEnding(focusCandidate);
  }

  const primaryGapCandidate = normalizeHintFocusCandidate(
    primaryGapInsight.focusLabel,
  );

  if (isUsableHintFocus(primaryGapCandidate)) {
    return ensureSentenceEnding(primaryGapCandidate);
  }

  return ensureSentenceEnding(
    options.currentQuestionTitle
      ? `把“${options.currentQuestionTitle}”里还缺的关键点补清楚`
      : '把当前问题里还缺的关键点补清楚',
  );
}

function resolveHintBackground(
  sectionDraft: HintSectionDraft,
  primaryGapInsight: GapInsight,
  options: {
    judgmentContent: string;
    summaryContent: string;
  },
) {
  const backgroundCandidate = normalizeHintBackgroundCandidate(sectionDraft.background);

  if (isUsableHintBackground(backgroundCandidate, options)) {
    return ensureSentenceEnding(backgroundCandidate);
  }

  const legacyThinkingCandidate = normalizeHintBackgroundCandidate(
    sectionDraft.legacyThinking,
  );

  if (isUsableHintBackground(legacyThinkingCandidate, options)) {
    return ensureSentenceEnding(
      `这里缺的不是再说一遍结论，而是${stripTrailingSentencePunctuation(
        legacyThinkingCandidate,
      )}`,
    );
  }

  return buildHintBackgroundFromGap(primaryGapInsight);
}

function resolveHintThinkingQuestion(
  sectionDraft: HintSectionDraft,
  primaryGapInsight: GapInsight,
  currentQuestionTitle?: string,
) {
  const questionCandidate = normalizeHintQuestionCandidate(
    sectionDraft.thinkingQuestion,
  );

  if (isUsableHintQuestion(questionCandidate)) {
    return ensureQuestionEnding(questionCandidate);
  }

  return buildHintThinkingQuestionFromGap(
    primaryGapInsight,
    currentQuestionTitle,
  );
}

function buildHintBackgroundFromGap(gapInsight: GapInsight) {
  const focusLabel = stripTrailingSentencePunctuation(gapInsight.focusLabel);
  const gapDetail = stripTrailingSentencePunctuation(gapInsight.detail);

  switch (classifyGapKind(gapInsight)) {
    case 'combinatorial-explosion':
      return ensureSentenceEnding(
        '这里的关键不是“参数很多所以会慢”这么简单，而是参数一多，可能的组合空间会爆炸式增长。哪怕每个参数只允许极少几种可能，60,000,000 个参数拼在一起也已经远远超出靠逐个试错能覆盖的范围。',
      );
    case 'feedback-direction':
      return ensureSentenceEnding(
        '训练不是只要知道“这次错了”就够了，而是要有一个连续的方向信号，告诉大量参数各自该往哪边微调。没有方向，下一次尝试和随机乱试在本质上没有区别。',
      );
    case 'causal':
      return ensureSentenceEnding(
        `围绕“${focusLabel}”，这里缺的不是再换个说法重述结论，而是把“发生了什么变化 -> 为什么会这样 -> 最后带来什么结果”连成因果链`,
      );
    case 'boundary':
      return ensureSentenceEnding(
        `围绕“${focusLabel}”，关键不是多举例子，而是先分清这条说法依赖什么前提、离开哪些条件就会失效`,
      );
    case 'mechanism':
      return ensureSentenceEnding(
        `围绕“${focusLabel}”，机制类问题要先分清相关对象各自做什么，再说明它们怎样发生联系；不把角色和顺序摆清楚，后面就只能背结论`,
      );
    default:
      if (gapDetail) {
        return ensureSentenceEnding(
          `这里真正要补的不是再复读评价，而是把“${gapDetail}”背后的对象、关系和判断线索串起来，让这条缺口从标签变成可解释的理解。`,
        );
      }

      return ensureSentenceEnding(
        `围绕“${focusLabel}”，先别急着补更多结论，当前真正要补的是能把对象、关系和判断线索串起来的最小解释链`,
      );
  }
}

function buildHintThinkingQuestionFromGap(
  gapInsight: GapInsight,
  currentQuestionTitle?: string,
) {
  const focusLabel = stripTrailingSentencePunctuation(gapInsight.focusLabel);

  switch (classifyGapKind(gapInsight)) {
    case 'combinatorial-explosion':
      return ensureQuestionEnding(
        '如果每个参数哪怕只看两种可能，60,000,000 个参数一共会有多少种组合，这还可能靠逐个试出来吗',
      );
    case 'feedback-direction':
      return ensureQuestionEnding(
        '如果系统只告诉你“这次错了”，却不告诉你错在哪、该往哪个方向调，下一次尝试和随机试参数到底差在哪里',
      );
    case 'causal':
      return ensureQuestionEnding(
        `如果只保留“${focusLabel}”这个结论，你中间到底省略了哪一步变化或结果`,
      );
    case 'boundary':
      return ensureQuestionEnding(
        `这条说法到底依赖哪个前提，一旦少掉它为什么就不成立`,
      );
    case 'mechanism':
      return ensureQuestionEnding(
        `相关对象各自先做什么、后做什么，少掉哪一环这个结果就不会出现`,
      );
    default:
      if (currentQuestionTitle) {
        return ensureQuestionEnding(
          `围绕“${currentQuestionTitle}”，如果只补一句最关键的话，你准备先补哪一层机制、因果或边界`,
        );
      }

      return ensureQuestionEnding(
        '如果只补一句最关键的话，你准备先补哪一层机制、因果或边界',
      );
  }
}

function renderHint(details: ClosureHintRenderDetails) {
  return [
    `先补哪块：${ensureSentenceEnding(details.focus)}`,
    `关键背景：${ensureSentenceEnding(details.background)}`,
    `可以先想：${ensureQuestionEnding(details.thinkingQuestion)}`,
  ].join('\n');
}

function classifyGapKind(gapInsight: GapInsight): HintGapKind {
  const combinedText = [
    gapInsight.raw,
    gapInsight.focusLabel,
    gapInsight.detail,
  ].join(' ');

  if (
    combinedText.includes('组合爆炸') ||
    combinedText.includes('排列组合') ||
    combinedText.includes('量级') ||
    combinedText.includes('几辈子') ||
    combinedText.includes('6000 万') ||
    combinedText.includes('6000万')
  ) {
    return 'combinatorial-explosion';
  }

  if (
    combinedText.includes('反馈') ||
    combinedText.includes('导向') ||
    combinedText.includes('往哪调') ||
    combinedText.includes('损失函数') ||
    combinedText.includes('指南针') ||
    combinedText.includes('只知道“错了”') ||
    combinedText.includes('只知道错了')
  ) {
    return 'feedback-direction';
  }

  if (
    combinedText.includes('为什么') ||
    combinedText.includes('因果') ||
    combinedText.includes('结果')
  ) {
    return 'causal';
  }

  if (
    combinedText.includes('边界') ||
    combinedText.includes('条件') ||
    combinedText.includes('前提') ||
    combinedText.includes('什么时候') ||
    combinedText.includes('何时')
  ) {
    return 'boundary';
  }

  if (
    combinedText.includes('机制') ||
    combinedText.includes('关系') ||
    combinedText.includes('对象') ||
    combinedText.includes('流程') ||
    combinedText.includes('顺序')
  ) {
    return 'mechanism';
  }

  return 'generic';
}

function normalizeHintFocusCandidate(content: string) {
  const normalizedContent = stripEvaluationLeadIn(
    content
      .replace(/^(先补哪块|优先补哪块|先补什么)[:：]?\s*/u, '')
      .replace(/^还缺(?:的关键点)?[:：]?\s*/u, '')
      .replace(/^还没答到的关键点[:：]?\s*/u, '')
      .replace(/^当前最关键缺口[:：]?\s*/u, '')
      .replace(/^你还没有(?:解释|说明|交代)?/u, '')
      .replace(/^还没有(?:解释|说明|交代)?/u, '')
      .replace(/^(没有|没)(解释|说明|交代)/u, '')
      .replace(/^需要继续把/u, '')
      .replace(/^需要把/u, '')
      .replace(/^只差把/u, '')
      .replace(/^(解释|说明)/u, '')
      .replace(/^把/u, '')
      .replace(/(?:说清楚|讲清楚|补清楚)$/u, '')
      .trim(),
  );

  if (!normalizedContent) {
    return '';
  }

  const enumeratedGapItems = extractEnumeratedGapItems(normalizedContent);

  if (enumeratedGapItems.length > 0) {
    return stripTrailingSentencePunctuation(enumeratedGapItems[0]);
  }

  const structuredGapText = extractStructuredSection(normalizedContent, [
    '还没答到的关键点',
    '还缺的关键点',
    '当前最关键缺口',
    '还缺',
  ]);

  if (structuredGapText) {
    const firstStructuredGap = splitStructuredList(structuredGapText)[0];

    if (firstStructuredGap) {
      return stripTrailingSentencePunctuation(firstStructuredGap);
    }
  }

  const insight = buildPrimaryGapInsight(normalizedContent);

  return stripTrailingSentencePunctuation(
    insight.focusLabel || normalizedContent,
  );
}

function normalizeHintBackgroundCandidate(content: string) {
  return stripHintSectionLabel(content)
    .replace(/^这里缺的不是再说一遍结论，而是/u, '')
    .trim();
}

function normalizeHintQuestionCandidate(content: string) {
  return stripHintSectionLabel(content).trim();
}

function stripHintSectionLabel(content: string) {
  return content
    .replace(/^(关键背景|最小背景|必要背景)[:：]?\s*/u, '')
    .replace(/^(可以先想|先从这个问题想|思考抓手)[:：]?\s*/u, '')
    .replace(/^(先想清|先想一想)[:：]?\s*/u, '')
    .trim();
}

function isUsableHintFocus(content: string) {
  return Boolean(content) && content.length >= 6 && !looksGenericHintFragment(content);
}

function isUsableHintBackground(
  content: string,
  options: {
    judgmentContent: string;
    summaryContent: string;
  },
) {
  if (!content || content.length < 16 || looksGenericHintFragment(content)) {
    return false;
  }

  return !looksCopiedFromSource(content, [
    options.judgmentContent,
    options.summaryContent,
  ]);
}

function isUsableHintQuestion(content: string) {
  return Boolean(content) && isQuestionLike(content) && !looksGenericHintFragment(content);
}

function looksGenericHintFragment(content: string) {
  return GENERIC_HINT_PATTERNS.some((pattern) => pattern.test(content));
}

function looksCopiedFromSource(content: string, sources: string[]) {
  const normalizedContent = normalizeCompareText(content);

  if (!normalizedContent || normalizedContent.length < 12) {
    return false;
  }

  return sources
    .map((source) => normalizeCompareText(source))
    .filter(Boolean)
    .some((normalizedSource) => normalizedSource.includes(normalizedContent));
}

function isQuestionLike(content: string) {
  return (
    /[？?]$/u.test(content) ||
    /^(为什么|如何|怎样|什么|哪|能否|是否|如果)/u.test(content) ||
    /吗[？?]?$/u.test(content)
  );
}

function extractStructuredSection(content: string, labels: string[]) {
  for (const label of labels) {
    const sectionPattern = new RegExp(
      `${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:这次答得好的地方|做得好的地方|已答到|还没答到的关键点|还缺的关键点|当前最关键缺口|还缺|不补上会卡在哪里|少了这些会带来什么问题|为什么关键|接下来可以往哪想|下一步往哪想|继续修改时可以先想|接下来的重点应放在)[:：]|$)`,
      'u',
    );
    const matched = content.match(sectionPattern)?.[1]?.trim();

    if (matched) {
      return matched;
    }
  }

  return '';
}

function buildPrimaryGapInsight(
  content: string,
  currentQuestionTitle?: string,
): GapInsight {
  const normalizedContent = normalizeGapPhrase(content);

  if (!normalizedContent) {
    return {
      raw: '',
      focusLabel: currentQuestionTitle
        ? `把“${currentQuestionTitle}”里还缺的关键点补清楚`
        : '把当前问题里还缺的关键点补清楚',
      detail: '',
    };
  }

  const [rawLabel, ...detailParts] = normalizedContent.split(/[:：]/u);
  const focusLabel = stripMarkdownDecoration(rawLabel);
  const detail = stripMarkdownDecoration(detailParts.join('：'));

  if (
    focusLabel &&
    focusLabel.length <= 22 &&
    !/[，。！？!?]/u.test(focusLabel) &&
    detail
  ) {
    return {
      raw: normalizedContent,
      focusLabel,
      detail,
    };
  }

  return {
    raw: normalizedContent,
    focusLabel: normalizedContent,
    detail: '',
  };
}

function extractEnumeratedGapItems(content: string) {
  const listItems = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(\d+[.)、]|[-*•])\s+/u.test(line))
    .map((line) => sanitizeGapItem(line));

  if (listItems.length > 0) {
    return listItems.slice(0, 3).map(ensureSentenceEnding);
  }

  return [] satisfies string[];
}

function splitStructuredList(content: string) {
  return content
    .split(/\n|[；;]+/u)
    .map((item) =>
      item
        .replace(/^\s*[-*•]\s*/u, '')
        .replace(/^\s*\d+[.)、]\s*/u, '')
        .trim(),
    )
    .filter(Boolean);
}

function sanitizeGapItem(item: string) {
  return item
    .replace(/\*\*/gu, '')
    .replace(/^\s*[-*•]\s*/u, '')
    .replace(/^\s*\d+[.)、]\s*/u, '')
    .replace(/^还缺(?:的关键点)?[:：]?\s*/u, '')
    .replace(/^当前最关键缺口[:：]?\s*/u, '')
    .replace(/^以下(?:两个|几个|这些)?关键点[:：]?\s*/u, '')
    .replace(/^你还没有(?:解释|说明|交代)?/u, '')
    .replace(/^还没有(?:解释|说明|交代)?/u, '')
    .replace(/^需要继续把/u, '')
    .replace(/^需要把/u, '')
    .replace(/^只差把/u, '')
    .replace(/[。！？!?；;]+$/u, '')
    .trim();
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

function ensureQuestionEnding(content: string) {
  if (!content) {
    return '';
  }

  const normalizedContent = content.trim();

  if (/[？?]$/u.test(normalizedContent)) {
    return normalizedContent;
  }

  return `${stripTrailingSentencePunctuation(normalizedContent)}？`;
}

function stripTrailingSentencePunctuation(content: string) {
  return content.replace(/[。！？!?；;]+$/u, '').trim();
}

function normalizeGapPhrase(content: string) {
  return stripTrailingSentencePunctuation(
    sanitizeGapItem(stripEvaluationLeadIn(content))
      .replace(/^当前问题里仍有关键点没有说清楚[:：]?\s*/u, '')
      .replace(/^当前问题里仍有关键点没有答到[:：]?\s*/u, '')
      .replace(/^这次回答还不完整[,，]?\s*/u, '')
      .replace(/^目前你已触及问题的表层[,，]但还缺少对以下(?:两个|几个)?关键点的认知[:：]?\s*/u, '')
      .trim(),
  );
}

function stripEvaluationLeadIn(content: string) {
  const normalizedContent = content
    .replace(/^学习现状评价[:：]\s*/u, '')
    .replace(/^这次答得好的地方[:：]\s*/u, '')
    .replace(/^做得好的地方[:：]\s*/u, '')
    .replace(/^不补上会卡在哪里[:：]\s*/u, '')
    .replace(/^少了这些会带来什么问题[:：]\s*/u, '')
    .replace(/^接下来可以往哪想[:：]\s*/u, '')
    .replace(/^下一步往哪想[:：]\s*/u, '')
    .replace(/^继续修改时可以先想[:：]\s*/u, '')
    .replace(/^接下来的重点应放在[:：]\s*/u, '')
    .trim();
  const contentAfterGapLeadIn =
    normalizedContent.match(
      /(?:主要存在以下缺口|当前主要缺口|还没答到的关键点|还缺的关键点|当前最关键缺口|还缺)[:：]\s*([\s\S]*)/u,
    )?.[1] ?? normalizedContent;

  return contentAfterGapLeadIn
    .replace(/^你提到的“[^”]+”确实抓住了[^。！？!?]*[。！？!?]\s*/u, '')
    .replace(/^你已经[^。！？!?]*[。！？!?]\s*/u, '')
    .replace(/^目前的回答已经[^。！？!?]*[。！？!?]\s*/u, '')
    .replace(/^这次回答已经[^。！？!?]*[。！？!?]\s*/u, '')
    .replace(/^这次回答还不完整[^。！？!?]*[。！？!?]\s*/u, '')
    .trim();
}

function stripMarkdownDecoration(content: string) {
  return content.replace(/\*\*/gu, '').replace(/`/gu, '').trim();
}

function normalizeCompareText(content: string) {
  return content.replace(/\s+/gu, '').replace(/[。！？!?；;:：]/gu, '').trim();
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
