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

      return {
        taskName: request.taskName,
        content: request.parse(response.rawText),
        rawText: response.rawText,
        model: response.model,
        providerLabel: getAiProviderLabel(normalizedConfig),
      };
    },
  };
}
