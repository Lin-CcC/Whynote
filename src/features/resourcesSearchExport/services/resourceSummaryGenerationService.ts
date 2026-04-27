import type { AiProviderClient } from '../../learningEngine';
import type {
  ResourceBodyFormat,
  ResourceImportMethod,
} from '../../nodeDomain';

const MAX_BODY_LENGTH = 12_000;
const MAX_SUMMARY_LENGTH = 240;
const MAX_TITLE_LENGTH = 80;

interface ResourceSummaryGenerationInput {
  bodyFormat?: ResourceBodyFormat;
  bodyText: string;
  fallbackSummary: string;
  fallbackTitle: string;
  importMethod: ResourceImportMethod;
  mimeType?: string;
  sourceUri: string;
}

export interface ResourceSummaryGenerationResult {
  summary: string;
  title: string;
}

interface RawResourceSummaryPayload {
  summary?: unknown;
  title?: unknown;
}

export function createResourceSummaryGenerationService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(
      input: ResourceSummaryGenerationInput,
    ): Promise<ResourceSummaryGenerationResult> {
      const response = await options.providerClient.generateObject({
        taskName: 'resource-summary-generation',
        messages: buildResourceSummaryMessages(input),
        responseFormat: 'json_object',
        parse: parseResourceSummaryPayload,
      });
      const title = truncateText(
        normalizeText(response.content.title) ?? input.fallbackTitle.trim(),
        MAX_TITLE_LENGTH,
      );
      const summary = truncateText(
        normalizeText(response.content.summary) ?? input.fallbackSummary.trim(),
        MAX_SUMMARY_LENGTH,
      );

      if (!title) {
        throw new Error('AI 摘要结果缺少可用标题。');
      }

      if (!summary) {
        throw new Error('AI 摘要结果缺少可用概况。');
      }

      return {
        summary,
        title,
      };
    },
  };
}

function buildResourceSummaryMessages(input: ResourceSummaryGenerationInput) {
  return [
    {
      role: 'system' as const,
      content:
        '你是 Whynote 的资料摘要器。只输出 JSON，不要编造正文中不存在的信息。生成一个用户可直接理解的资料标题，以及一段 2-3 句的资料概况。资料概况必须优先回答“这份资料讲什么、适合在什么问题下被引用”。',
    },
    {
      role: 'user' as const,
      content: [
        `导入方式：${input.importMethod}`,
        optionalLine('来源', input.sourceUri),
        optionalLine('MIME', input.mimeType),
        optionalLine('正文格式', input.bodyFormat),
        optionalLine('当前 fallback 标题', input.fallbackTitle),
        optionalLine('当前 fallback 概况', input.fallbackSummary),
        '请基于下面正文生成更像资料卡片的标题和概况。',
        '返回格式：{"title":"","summary":""}',
        '正文：',
        truncateText(input.bodyText.trim(), MAX_BODY_LENGTH) ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

function parseResourceSummaryPayload(rawText: string) {
  const normalizedText = stripCodeFence(rawText);

  let payload: unknown;

  try {
    payload = JSON.parse(normalizedText) as unknown;
  } catch {
    throw new Error('资源摘要 AI 返回不是合法 JSON。');
  }

  if (!isRecord(payload)) {
    throw new Error('资源摘要 AI 返回结构不合法。');
  }

  return payload satisfies RawResourceSummaryPayload;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.replace(/\s+/gu, ' ').trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function truncateText(value: string | null, maxLength: number) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function optionalLine(label: string, value?: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return '';
  }

  return `${label}：${normalizedValue}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
