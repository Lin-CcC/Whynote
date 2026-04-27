export interface AutoFillResourceDraft {
  content: string;
  sourceUri: string;
  title: string;
}

interface AutoFillResourceDraftOptions {
  fetchFn?: typeof fetch;
  sourceUrl: string;
}

const TITLE_META_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'meta[name="title"]',
] as const;

const SUMMARY_META_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
  'meta[name="description:zh"]',
] as const;

const BODY_SUMMARY_SELECTORS = [
  'article p',
  'main p',
  'section p',
  'p',
] as const;

export async function autoFillResourceDraftFromUrl({
  fetchFn = fetch,
  sourceUrl,
}: AutoFillResourceDraftOptions): Promise<AutoFillResourceDraft> {
  const normalizedUrl = normalizeResourceUrl(sourceUrl);

  try {
    const response = await fetchFn(normalizedUrl.toString(), {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`请求失败：${String(response.status)}`);
    }

    const rawText = await response.text();

    if (!rawText.trim()) {
      throw new Error('返回内容为空。');
    }

    return buildAutoFillDraft(rawText, normalizedUrl);
  } catch (error) {
    throw new Error(buildBrowserLimitedAutoFillFailureMessage(error));
  }
}

function buildAutoFillDraft(rawText: string, sourceUrl: URL): AutoFillResourceDraft {
  const document = new DOMParser().parseFromString(rawText, 'text/html');
  const title =
    extractTitle(document) ?? buildTitleFromUrl(sourceUrl) ?? sourceUrl.hostname;
  const content =
    extractSummary(document) ??
    buildBodySummary(document) ??
    `来自 ${sourceUrl.hostname} 的网页资料，建议手动补充资料概况。`;

  return {
    content,
    sourceUri: sourceUrl.toString(),
    title,
  };
}

function normalizeResourceUrl(sourceUrl: string) {
  const normalizedSourceUrl = sourceUrl.trim();

  if (!normalizedSourceUrl) {
    throw new Error('请先输入 URL，再触发自动填充。');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedSourceUrl);
  } catch {
    throw new Error('请输入合法的 http(s) URL。');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('当前只支持 http(s) URL 自动填充。');
  }

  return parsedUrl;
}

function extractTitle(document: Document) {
  for (const selector of TITLE_META_SELECTORS) {
    const value = readMetaContent(document, selector);

    if (value) {
      return value;
    }
  }

  const headingTitle = normalizeText(document.querySelector('h1')?.textContent ?? '');

  if (headingTitle) {
    return headingTitle;
  }

  return normalizeText(document.title);
}

function extractSummary(document: Document) {
  for (const selector of SUMMARY_META_SELECTORS) {
    const value = readMetaContent(document, selector);

    if (value) {
      return truncateText(value, 240);
    }
  }

  return null;
}

function buildBodySummary(document: Document) {
  const paragraphTexts = BODY_SUMMARY_SELECTORS.flatMap((selector) =>
    [...document.querySelectorAll(selector)].map((paragraph) =>
      normalizeText(paragraph.textContent ?? ''),
    ),
  ).filter(
    (paragraphText): paragraphText is string =>
      paragraphText !== null && paragraphText.length >= 24,
  );

  if (paragraphTexts.length > 0) {
    return truncateText(paragraphTexts.slice(0, 2).join(' '), 240);
  }

  const bodyText = normalizeText(document.body?.textContent ?? '');

  if (!bodyText) {
    return null;
  }

  return truncateText(bodyText, 240);
}

function buildTitleFromUrl(sourceUrl: URL) {
  const pathSegments = sourceUrl.pathname
    .split('/')
    .map((segment) => decodeURIComponent(segment.trim()))
    .filter(Boolean);
  const lastSegment = pathSegments.at(-1);

  if (!lastSegment) {
    return normalizeText(sourceUrl.hostname.replace(/^www\./u, ''));
  }

  return normalizeText(
    lastSegment
      .replace(/\.[a-z0-9]{1,8}$/iu, '')
      .replace(/[-_]+/gu, ' '),
  );
}

function readMetaContent(document: Document, selector: string) {
  const content = document
    .querySelector(selector)
    ?.getAttribute('content');

  return normalizeText(content ?? '');
}

function normalizeText(value: string) {
  const normalizedValue = value.replace(/\s+/gu, ' ').trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildBrowserLimitedAutoFillFailureMessage(error: unknown) {
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : '未知错误。';

  return `受限自动填充未完成：这是浏览器内的受限能力，很多第三方网页会因 CORS 或站点访问策略而无法直接读取。这不代表链接本身无效；请继续手动填写标题和资料概况。原因：${detail}`;
}
