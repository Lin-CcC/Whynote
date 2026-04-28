import type { ResourceImportDraft } from './resourceIngestTypes';

const SUPPORTED_EXTENSIONS = ['.txt', '.md'] as const;
const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const;
const MAX_SUMMARY_LENGTH = 240;
const LOCAL_FILE_SOURCE_PREFIX = '本地文件：';

interface BuildResourceDraftFromLocalFileOptions {
  importBatchId?: string;
  importMethod?: 'local-file' | 'batch' | 'folder';
  sourceRelativePath?: string | null;
}

export async function buildResourceDraftFromLocalFile(
  file: File,
  options?: BuildResourceDraftFromLocalFileOptions,
): Promise<ResourceImportDraft> {
  const normalizedMimeType = assertSupportedFile(file);
  const rawText = await file.text();
  const titleResult = extractLocalFileTitle(file.name, rawText);
  const summaryResult = extractLocalFileSummary(rawText, titleResult.value);
  const sourceRelativePath = normalizeLocalFileRelativePath(
    options?.sourceRelativePath ?? getLocalFileRelativePath(file),
  );

  return {
    content:
      summaryResult.value ?? `导入自本地文件 ${file.name}，请手动补充资料概况。`,
    ingest: {
      bodyFormat: file.name.toLocaleLowerCase().endsWith('.md')
        ? 'markdown'
        : 'plain-text',
      bodyText: rawText,
      importBatchId: options?.importBatchId,
      importMethod: options?.importMethod ?? 'local-file',
      ingestStatus: 'ready',
      mimeType: normalizedMimeType,
      originalFileName: file.name,
      sourceRelativePath: sourceRelativePath ?? undefined,
      summarySource: summaryResult.source ?? 'file-fallback',
      titleSource: titleResult.source,
    },
    sourceUri: buildLocalFileSourceUri(file.name, sourceRelativePath),
    title: titleResult.value,
  };
}

export function buildLocalFileSourceUri(
  fileName: string,
  sourceRelativePath?: string | null,
) {
  return `${LOCAL_FILE_SOURCE_PREFIX}${sourceRelativePath ?? fileName}`;
}

export function getLocalFileRelativePath(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath;

  return normalizeLocalFileRelativePath(relativePath);
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

  if (!isSupportedExtension && !isSupportedMimeType) {
    throw new Error(
      '当前只支持导入 .txt / .md 文件。PDF / DOCX 暂不在这版范围内。',
    );
  }

  if (isSupportedMimeType) {
    return normalizedType;
  }

  return normalizedName.endsWith('.md') ? 'text/markdown' : 'text/plain';
}

function extractLocalFileTitle(fileName: string, rawText: string) {
  const markdownHeading = extractMarkdownHeading(rawText);

  if (markdownHeading) {
    return {
      source: 'file-heading' as const,
      value: markdownHeading,
    };
  }

  const firstMeaningfulLine = rawText
    .split(/\r?\n/gu)
    .map((line) => normalizeText(stripMarkdownSyntax(line)))
    .find((line) => line && line.length <= 80);

  if (firstMeaningfulLine) {
    return {
      source: 'file-first-line' as const,
      value: firstMeaningfulLine,
    };
  }

  return {
    source: 'file-name' as const,
    value:
      normalizeText(
        fileName.replace(/\.[a-z0-9]{1,8}$/iu, '').replace(/[-_]+/gu, ' '),
      ) ?? fileName,
  };
}

function extractLocalFileSummary(rawText: string, title: string) {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return {
      source: null,
      value: null,
    };
  }

  const summaryParagraphs = normalizedText
    .split(/\r?\n\s*\r?\n/gu)
    .map((paragraph) => normalizeText(stripMarkdownSyntax(paragraph)))
    .filter(
      (paragraph): paragraph is string =>
        Boolean(paragraph) && paragraph !== title,
    );

  if (summaryParagraphs.length > 0) {
    return {
      source: 'file-body' as const,
      value: truncateText(
        summaryParagraphs.slice(0, 2).join(' '),
        MAX_SUMMARY_LENGTH,
      ),
    };
  }

  const collapsedText = normalizeText(stripMarkdownSyntax(normalizedText));

  if (!collapsedText || collapsedText === title) {
    return {
      source: null,
      value: null,
    };
  }

  return {
    source: 'file-body' as const,
    value: truncateText(collapsedText, MAX_SUMMARY_LENGTH),
  };
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

function normalizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(/\s+/gu, ' ').trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeLocalFileRelativePath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value
    .replace(/\\/gu, '/')
    .replace(/^\/+/u, '')
    .trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}
