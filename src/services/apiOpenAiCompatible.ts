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
  const response = await fetchFn(request.url, request.init);

  if (!response.ok) {
    throw new Error(`OpenAI-compatible 请求失败：${response.status}`);
  }

  const payload = (await response.json()) as OpenAiCompatibleResponseBody;
  const rawText = extractMessageText(payload);

  if (!rawText.trim()) {
    throw new Error('OpenAI-compatible 响应缺少可用文本内容。');
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

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/u, '');
}
