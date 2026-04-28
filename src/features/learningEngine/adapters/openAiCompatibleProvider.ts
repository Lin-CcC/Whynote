import { requestOpenAiCompatibleChatCompletion } from '../../../services/apiOpenAiCompatible';

import {
  getAiProviderLabel,
  normalizeAiConfig,
  type AiConfig,
  type AiProviderClient,
  type AiProviderObjectRequest,
  type AiProviderObjectResponse,
} from '../domain';

export function createOpenAiCompatibleProviderClient(
  config: AiConfig,
  options?: {
    fetchFn?: typeof fetch;
  },
): AiProviderClient {
  const normalizedConfig = normalizeAiConfig(config);

  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const response = await requestOpenAiCompatibleChatCompletion({
        config: normalizedConfig,
        messages: request.messages,
        temperature: request.temperature,
        responseFormat: request.responseFormat,
        fetchFn: options?.fetchFn,
      });

      let content: T;

      try {
        content = request.parse(response.rawText);
      } catch (error) {
        throw new Error(buildProviderParseErrorMessage(error, response.rawText));
      }

      return {
        taskName: request.taskName,
        content,
        rawText: response.rawText,
        model: response.model,
        providerLabel: getAiProviderLabel(normalizedConfig),
      };
    },
  };
}

function buildProviderParseErrorMessage(error: unknown, rawText: string) {
  const baseMessage =
    error instanceof Error && error.message.trim()
      ? error.message
      : 'AI 返回内容格式不符合当前任务要求。';
  const snippet = truncateForError(rawText);

  if (!snippet) {
    return baseMessage;
  }

  return `${baseMessage} 响应片段：${snippet}`;
}

function truncateForError(value: string, maxLength = 160) {
  const normalizedValue = value.replace(/\s+/gu, ' ').trim();

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.length <= maxLength
    ? normalizedValue
    : `${normalizedValue.slice(0, maxLength - 1)}…`;
}
