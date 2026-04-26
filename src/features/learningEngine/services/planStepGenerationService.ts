import type {
  AiProviderClient,
  PlanStepGenerationInput,
  PlanStepGenerationResult,
} from '../domain';
import { getLearningModeLimits, normalizeLearningMode } from '../domain';
import { buildPlanStepGenerationMessages } from '../prompts/learningPrompts';

import { normalizePlanStepDrafts, parseJsonObject } from './learningDraftNormalization';

export function createPlanStepGenerationService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(
      input: PlanStepGenerationInput,
    ): Promise<PlanStepGenerationResult> {
      const mode = normalizeLearningMode(input.mode);
      const response = await options.providerClient.generateObject({
        taskName: 'plan-step-generation',
        messages: buildPlanStepGenerationMessages(
          input,
          mode,
          getLearningModeLimits(mode),
        ),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });

      return {
        mode,
        moduleTitle: input.moduleTitle,
        planSteps: normalizePlanStepDrafts(
          response.content,
          input.moduleTitle,
          mode,
        ),
        metadata: {
          providerLabel: response.providerLabel,
          model: response.model,
        },
      };
    },
  };
}
