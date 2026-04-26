export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerLabel?: string;
  providerName?: string;
}

export interface AiExecutionMetadata {
  providerLabel: string;
  model: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderObjectRequest<T> {
  taskName: string;
  messages: AiMessage[];
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  parse: (rawText: string) => T;
}

export interface AiProviderObjectResponse<T> {
  taskName: string;
  content: T;
  rawText: string;
  model: string;
  providerLabel: string;
}

export interface AiProviderClient {
  generateObject<T>(
    request: AiProviderObjectRequest<T>,
  ): Promise<AiProviderObjectResponse<T>>;
}

export function normalizeAiConfig(config: AiConfig): AiConfig {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/u, '');
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();

  if (!baseUrl) {
    throw new Error('AI 配置缺少 baseUrl。');
  }

  if (!apiKey) {
    throw new Error('AI 配置缺少 apiKey。');
  }

  if (!model) {
    throw new Error('AI 配置缺少 model。');
  }

  return {
    ...config,
    baseUrl,
    apiKey,
    model,
    providerLabel: config.providerLabel?.trim(),
    providerName: config.providerName?.trim(),
  };
}

export function getAiProviderLabel(config: AiConfig) {
  return (
    config.providerLabel?.trim() ??
    config.providerName?.trim() ??
    config.baseUrl.trim().replace(/\/+$/u, '')
  );
}
