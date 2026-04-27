import type { ResourceImportDraft } from './resourceIngestTypes';

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

const CANONICAL_SELECTORS = [
  'link[rel="canonical"]',
  'meta[property="og:url"]',
] as const;

const BODY_TEXT_SELECTORS = ['article p', 'main p', 'section p', 'p'] as const;
const MAX_SUMMARY_LENGTH = 240;
const MAX_BODY_LENGTH = 20_000;

export async function autoFillResourceDraftFromUrl({
  fetchFn = fetch,
  sourceUrl,
}: AutoFillResourceDraftOptions): Promise<ResourceImportDraft> {
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

    return buildAutoFillDraft(rawText, normalizedUrl, response.url);
  } catch (error) {
    throw new Error(buildBrowserLimitedAutoFillFailureMessage(error));
  }
}

function buildAutoFillDraft(
  rawText: string,
  sourceUrl: URL,
  resolvedUrl?: string,
): ResourceImportDraft {
  const document = new DOMParser().parseFromString(rawText, 'text/html');
  const titleResult = extractTitle(document, sourceUrl);
  const summaryResult = extractSummary(document, sourceUrl);
  const canonicalSource =
    extractCanonicalSource(document, sourceUrl) ??
    tryNormalizeHttpUrl(resolvedUrl) ??
    sourceUrl.toString();

  return {
    content: summaryResult.value,
    ingest: {
      bodyFormat: 'plain-text',
      bodyText: extractBodyText(document),
      canonicalSource,
      importMethod: 'url',
      ingestStatus: 'ready',
      mimeType: 'text/html',
      summarySource: summaryResult.source,
      titleSource: titleResult.source,
    },
    sourceUri: sourceUrl.toString(),
    title: titleResult.value,
  };
}

function normalizeResourceUrl(sourceUrl: string) {
  const normalizedSourceUrl = sourceUrl.trim();

  if (!normalizedSourceUrl) {
    throw new Error('请先输入 URL，再触发自动补全。');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedSourceUrl);
  } catch {
    throw new Error('请输入合法的 http(s) URL。');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('当前只支持 http(s) URL 自动补全。');
  }

  return parsedUrl;
}

function extractTitle(document: Document, sourceUrl: URL) {
  for (const selector of TITLE_META_SELECTORS) {
    const value = readMetaContent(document, selector);

    if (value) {
      return {
        source: 'url-meta' as const,
        value,
      };
    }
  }

  const headingTitle = normalizeText(document.querySelector('h1')?.textContent ?? '');

  if (headingTitle) {
    return {
      source: 'url-heading' as const,
      value: headingTitle,
    };
  }

  const documentTitle = normalizeText(document.title);

  if (documentTitle) {
    return {
      source: 'url-document-title' as const,
      value: documentTitle,
    };
  }

  return {
    source: 'url-path' as const,
    value: buildTitleFromUrl(sourceUrl) ?? sourceUrl.hostname,
  };
}

function extractSummary(document: Document, sourceUrl: URL) {
  for (const selector of SUMMARY_META_SELECTORS) {
    const value = readMetaContent(document, selector);

    if (value) {
      return {
        source: 'url-meta' as const,
        value: truncateText(value, MAX_SUMMARY_LENGTH),
      };
    }
  }

  const paragraphTexts = collectBodyParagraphTexts(document);

  if (paragraphTexts.length > 0) {
    return {
      source: 'url-body' as const,
      value: truncateText(
        paragraphTexts.slice(0, 2).join(' '),
        MAX_SUMMARY_LENGTH,
      ),
    };
  }

  const fallbackTitle = buildTitleFromUrl(sourceUrl) ?? sourceUrl.hostname;

  return {
    source: 'url-fallback' as const,
    value: `来自 ${sourceUrl.hostname} 的网页资料。当前只能做浏览器受限自动补全，建议手动补充标题和资料概况。${fallbackTitle}`,
  };
}

function extractCanonicalSource(document: Document, sourceUrl: URL) {
  for (const selector of CANONICAL_SELECTORS) {
    const attributeName = selector.startsWith('link[') ? 'href' : 'content';
    const rawValue =
      document.querySelector(selector)?.getAttribute(attributeName) ?? '';
    const normalizedValue = normalizeText(rawValue);

    if (!normalizedValue) {
      continue;
    }

    try {
      return new URL(normalizedValue, sourceUrl).toString();
    } catch {
      continue;
    }
  }

  return null;
}

function extractBodyText(document: Document) {
  const paragraphTexts = collectBodyParagraphTexts(document);

  if (paragraphTexts.length > 0) {
    return truncateText(paragraphTexts.join('\n\n'), MAX_BODY_LENGTH);
  }

  const bodyText = normalizeText(document.body?.textContent ?? '');

  if (!bodyText) {
    return undefined;
  }

  return truncateText(bodyText, MAX_BODY_LENGTH);
}

function collectBodyParagraphTexts(document: Document) {
  const uniqueParagraphTexts = new Set<string>();

  for (const selector of BODY_TEXT_SELECTORS) {
    for (const paragraph of document.querySelectorAll(selector)) {
      const normalizedParagraph = normalizeText(paragraph.textContent ?? '');

      if (!normalizedParagraph || normalizedParagraph.length < 24) {
        continue;
      }

      uniqueParagraphTexts.add(normalizedParagraph);
    }
  }

  return [...uniqueParagraphTexts];
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
  const content = document.querySelector(selector)?.getAttribute('content');

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

function tryNormalizeHttpUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildBrowserLimitedAutoFillFailureMessage(error: unknown) {
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : '未知错误。';

  return `受限自动填充未完成：这是浏览器内的受限能力，很多第三方网页会因 CORS 或站点访问策略而无法直接读取。这不代表链接本身无效；请继续手动填写标题和资料概况。原因：${detail}`;
}
