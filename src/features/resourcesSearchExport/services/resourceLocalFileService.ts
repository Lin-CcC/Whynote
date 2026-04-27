export interface LocalFileResourceDraft {
  content: string;
  sourceUri: string;
  title: string;
}

const SUPPORTED_EXTENSIONS = ['.txt', '.md'] as const;
const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const;

export async function buildResourceDraftFromLocalFile(
  file: File,
): Promise<LocalFileResourceDraft> {
  assertSupportedFile(file);

  const rawText = await file.text();
  const title = extractLocalFileTitle(file.name, rawText);
  const content =
    extractLocalFileSummary(rawText, title) ??
    `导入自本地文件 ${file.name}，请手动补充资料概况。`;

  return {
    content,
    sourceUri: `本地文件：${file.name}`,
    title,
  };
}

function assertSupportedFile(file: File) {
  const normalizedName = file.name.toLocaleLowerCase();
  const normalizedType = file.type.toLocaleLowerCase();
  const isSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  );
  const isSupportedMimeType = SUPPORTED_MIME_TYPES.includes(
    normalizedType as (typeof SUPPORTED_MIME_TYPES)[number],
  );

  if (isSupportedExtension || isSupportedMimeType) {
    return;
  }

  throw new Error('当前只支持导入 .txt / .md 文件。PDF / DOCX 暂不在这版范围内。');
}

function extractLocalFileTitle(fileName: string, rawText: string) {
  const markdownHeading = extractMarkdownHeading(rawText);

  if (markdownHeading) {
    return markdownHeading;
  }

  const firstMeaningfulLine = rawText
    .split(/\r?\n/gu)
    .map((line) => normalizeText(stripMarkdownSyntax(line)))
    .find((line) => line && line.length <= 80);

  if (firstMeaningfulLine) {
    return firstMeaningfulLine;
  }

  return normalizeText(
    fileName.replace(/\.[a-z0-9]{1,8}$/iu, '').replace(/[-_]+/gu, ' '),
  ) ?? fileName;
}

function extractLocalFileSummary(rawText: string, title: string) {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return null;
  }

  const summaryParagraphs = normalizedText
    .split(/\r?\n\s*\r?\n/gu)
    .map((paragraph) => normalizeText(stripMarkdownSyntax(paragraph)))
    .filter(
      (paragraph): paragraph is string =>
        Boolean(paragraph) && paragraph !== title,
    );

  if (summaryParagraphs.length > 0) {
    return truncateText(summaryParagraphs.slice(0, 2).join(' '), 240);
  }

  const collapsedText = normalizeText(stripMarkdownSyntax(normalizedText));

  if (!collapsedText || collapsedText === title) {
    return null;
  }

  return truncateText(collapsedText, 240);
}

function extractMarkdownHeading(rawText: string) {
  const headingMatch = rawText.match(/^\s*#\s+(.+?)\s*$/mu);

  if (!headingMatch) {
    return null;
  }

  return normalizeText(stripMarkdownSyntax(headingMatch[1]));
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gmu, '')
    .replace(/^>\s?/gmu, '')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '$1')
    .replace(/[*_~#]+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
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
