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

type HintGapKind = 'causal' | 'boundary' | 'mechanism' | 'generic';

export function normalizeClosureHintText(options: {
  rawHint: unknown;
  currentQuestionTitle?: string;
  judgmentGapItems: string[];
  judgmentContent: string;
  summaryContent: string;
}) {
  const sectionDraft = extractHintSectionDraft(options.rawHint);
  const focus = resolveHintFocus(sectionDraft, options);
  const background = resolveHintBackground(sectionDraft, focus, options);
  const thinkingQuestion = resolveHintThinkingQuestion(
    sectionDraft,
    focus,
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

  const fallbackGap = sanitizeGapItem(
    content
      .replace(/^已答到[:：][\s\S]*?(?=\n|$)/u, '')
      .replace(/^为什么关键[:：][\s\S]*?(?=\n|$)/u, '')
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
) {
  const focusCandidate = normalizeHintFocusCandidate(sectionDraft.focus);

  if (isUsableHintFocus(focusCandidate)) {
    return ensureSentenceEnding(focusCandidate);
  }

  const primaryGapCandidate = normalizeHintFocusCandidate(
    options.judgmentGapItems[0] ?? '',
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
  focus: string,
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

  return buildHintBackgroundFromGap(focus);
}

function resolveHintThinkingQuestion(
  sectionDraft: HintSectionDraft,
  focus: string,
  currentQuestionTitle?: string,
) {
  const questionCandidate = normalizeHintQuestionCandidate(
    sectionDraft.thinkingQuestion,
  );

  if (isUsableHintQuestion(questionCandidate)) {
    return ensureQuestionEnding(questionCandidate);
  }

  return buildHintThinkingQuestionFromGap(focus, currentQuestionTitle);
}

function buildHintBackgroundFromGap(focus: string) {
  const focusLabel = stripTrailingSentencePunctuation(focus);

  switch (classifyGapKind(focus)) {
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
      return ensureSentenceEnding(
        `围绕“${focusLabel}”，先别急着补更多结论，当前真正要补的是能把对象、关系和判断线索串起来的最小解释链`,
      );
  }
}

function buildHintThinkingQuestionFromGap(
  focus: string,
  currentQuestionTitle?: string,
) {
  const focusLabel = stripTrailingSentencePunctuation(focus);

  switch (classifyGapKind(focus)) {
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

function classifyGapKind(focus: string): HintGapKind {
  if (
    focus.includes('为什么') ||
    focus.includes('因果') ||
    focus.includes('结果')
  ) {
    return 'causal';
  }

  if (
    focus.includes('边界') ||
    focus.includes('条件') ||
    focus.includes('前提') ||
    focus.includes('什么时候') ||
    focus.includes('何时')
  ) {
    return 'boundary';
  }

  if (
    focus.includes('机制') ||
    focus.includes('关系') ||
    focus.includes('对象') ||
    focus.includes('流程') ||
    focus.includes('顺序')
  ) {
    return 'mechanism';
  }

  return 'generic';
}

function normalizeHintFocusCandidate(content: string) {
  return stripTrailingSentencePunctuation(
    content
      .replace(/^(先补哪块|优先补哪块|先补什么)[:：]?\s*/u, '')
      .replace(/^还缺(?:的关键点)?[:：]?\s*/u, '')
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
    .replace(/^还缺(?:的关键点)?[:：]?\s*/u, '')
    .replace(/^当前最关键缺口[:：]?\s*/u, '')
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

function normalizeCompareText(content: string) {
  return content.replace(/\s+/gu, '').replace(/[。！？!?；;:：]/gu, '').trim();
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
