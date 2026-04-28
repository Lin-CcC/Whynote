export type OpenAiCompatibleResponseFormat = 'json_object' | 'text';

export interface OpenAiCompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface OpenAiCompatibleRequestBody {
  model: string;
  messages: OpenAiCompatibleMessage[];
  temperature?: number;
  response_format?: {
    type: 'json_object';
  };
}

interface OpenAiCompatibleMessagePart {
  type: 'text';
  text?: string;
}

interface OpenAiCompatibleChoice {
  message?: {
    content?: string | OpenAiCompatibleMessagePart[];
  };
}

interface OpenAiCompatibleResponseBody {
  model?: string;
  choices?: OpenAiCompatibleChoice[];
}

export interface OpenAiCompatibleRequestOptions {
  config: OpenAiCompatibleConfig;
  messages: OpenAiCompatibleMessage[];
  temperature?: number;
  responseFormat?: OpenAiCompatibleResponseFormat;
  fetchFn?: typeof fetch;
}

export interface OpenAiCompatibleRequestDescriptor {
  url: string;
  body: OpenAiCompatibleRequestBody;
  init: RequestInit;
}

export interface OpenAiCompatibleChatCompletionResult {
  model: string;
  rawText: string;
}

export function buildOpenAiCompatibleEndpoint(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return `${normalizedBaseUrl}/chat/completions`;
}

export function buildOpenAiCompatibleRequest(
  options: OpenAiCompatibleRequestOptions,
): OpenAiCompatibleRequestDescriptor {
  const body: OpenAiCompatibleRequestBody = {
    model: options.config.model,
    messages: options.messages,
  };

  if (typeof options.temperature === 'number') {
    body.temperature = options.temperature;
  }

  if ((options.responseFormat ?? 'json_object') === 'json_object') {
    body.response_format = {
      type: 'json_object',
    };
  }

  return {
    url: buildOpenAiCompatibleEndpoint(options.config.baseUrl),
    body,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.config.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  };
}

export async function requestOpenAiCompatibleChatCompletion(
  options: OpenAiCompatibleRequestOptions,
): Promise<OpenAiCompatibleChatCompletionResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const request = buildOpenAiCompatibleRequest(options);

  let response: Response;

  try {
    response = await fetchFn(request.url, request.init);
  } catch (error) {
    throw new Error(buildTransportErrorMessage(error));
  }

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(response, rawBody));
  }

  const payload = parseResponseBody(rawBody);
  const rawText = extractMessageText(payload);

  if (!rawText.trim()) {
    throw new Error('AI 服务响应缺少可用文本内容。');
  }

  return {
    model: payload.model ?? options.config.model,
    rawText,
  };
}

function extractMessageText(payload: OpenAiCompatibleResponseBody) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((item) => item.type === 'text')
      .map((item) => item.text ?? '')
      .join('\n');
  }

  return '';
}

function parseResponseBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as OpenAiCompatibleResponseBody;
  } catch {
    throw new Error(
      `AI 服务返回了无法解析的响应 JSON。响应片段：${truncateForError(rawBody)}`,
    );
  }
}

function buildTransportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `AI 服务请求失败：${error.message}`;
  }

  return 'AI 服务请求失败，请检查网络、跨域策略或 baseUrl 配置。';
}

function buildHttpErrorMessage(response: Response, rawBody: string) {
  const statusText = normalizeErrorText(response.statusText);
  const bodyMessage = extractErrorMessageFromBody(rawBody);
  const statusLabel = statusText
    ? `${String(response.status)} ${statusText}`
    : String(response.status);
  const normalizedBodyMessage = normalizeProviderFailureMessage(
    response.status,
    bodyMessage,
  );

  if (normalizedBodyMessage) {
    return `AI 服务请求失败（${statusLabel}）：${normalizedBodyMessage}`;
  }

  return `AI 服务请求失败（${statusLabel}）。`;
}

function extractErrorMessageFromBody(rawBody: string) {
  const normalizedRawBody = normalizeErrorText(rawBody);

  if (!normalizedRawBody) {
    return '';
  }

  try {
    const payload = JSON.parse(rawBody) as {
      error?: {
        message?: unknown;
        status?: unknown;
      };
      message?: unknown;
    };
    const errorMessage = normalizeErrorText(payload.error?.message);
    const topLevelMessage = normalizeErrorText(payload.message);
    const errorStatus = normalizeErrorText(payload.error?.status);

    return errorMessage || topLevelMessage || errorStatus || truncateForError(rawBody);
  } catch {
    return truncateForError(rawBody);
  }
}

function normalizeProviderFailureMessage(status: number, bodyMessage: string) {
  if (!bodyMessage) {
    return '';
  }

  const normalizedMessage = bodyMessage.toLowerCase();

  if (
    status === 429 &&
    (
      normalizedMessage.includes('quota') ||
      normalizedMessage.includes('billing') ||
      normalizedMessage.includes('insufficient_quota') ||
      normalizedMessage.includes('exceeded your current quota')
    )
  ) {
    return '当前 AI 配额已用尽，请检查 provider 的 plan / billing，或切换到仍可用的模型与密钥。';
  }

  if (
    status === 429 &&
    (
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('too many requests')
    )
  ) {
    return '当前 AI 请求过于频繁，请稍后重试。';
  }

  return bodyMessage;
}

function truncateForError(value: string, maxLength = 160) {
  const normalizedValue = normalizeErrorText(value);

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.length <= maxLength
    ? normalizedValue
    : `${normalizedValue.slice(0, maxLength - 1)}…`;
}

function normalizeErrorText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/gu, ' ').trim();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/u, '');
}
