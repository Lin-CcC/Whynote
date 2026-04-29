import type {
  AiProviderClient,
  SummaryEvaluationInput,
  SummaryEvaluationResult,
} from '../domain';
import { buildSummaryEvaluationMessages } from '../prompts/learningPrompts';

import {
  normalizeSummaryEvaluation,
  parseJsonObject,
} from './learningDraftNormalization';

export function createSummaryEvaluationService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: SummaryEvaluationInput): Promise<SummaryEvaluationResult> {
      const currentQuestionTitle =
        input.questionPath[input.questionPath.length - 1]?.title;
      const response = await options.providerClient.generateObject({
        taskName: 'summary-evaluation',
        messages: buildSummaryEvaluationMessages(input),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });
      const normalizedResult = normalizeSummaryEvaluation(response.content, {
        currentQuestionTitle,
        learnerSummary: input.learnerSummary,
      });

      return {
        ...normalizedResult,
        metadata: {
          model: response.model,
          providerLabel: response.providerLabel,
        },
      };
    },
  };
}
