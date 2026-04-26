import type {
  AiProviderClient,
  ModuleGenerationInput,
  ModuleGenerationResult,
} from '../domain';
import { getLearningModeLimits, normalizeLearningMode } from '../domain';
import { buildModuleGenerationMessages } from '../prompts/learningPrompts';

import { normalizeModuleDrafts, parseJsonObject } from './learningDraftNormalization';

export function createModuleGenerationService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: ModuleGenerationInput): Promise<ModuleGenerationResult> {
      const mode = normalizeLearningMode(input.mode);
      const response = await options.providerClient.generateObject({
        taskName: 'module-generation',
        messages: buildModuleGenerationMessages(
          input,
          mode,
          getLearningModeLimits(mode),
        ),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });

      return {
        mode,
        modules: normalizeModuleDrafts(response.content, input.topic, mode),
        metadata: {
          providerLabel: response.providerLabel,
          model: response.model,
        },
      };
    },
  };
}
