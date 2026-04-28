import type {
  AiProviderClient,
  QuestionClosureInput,
  QuestionClosureResult,
} from '../domain';
import { buildQuestionClosureMessages } from '../prompts/learningPrompts';

import { normalizeQuestionClosure, parseJsonObject } from './learningDraftNormalization';

export function createQuestionClosureService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: QuestionClosureInput): Promise<QuestionClosureResult> {
      const currentQuestionTitle =
        input.questionPath[input.questionPath.length - 1]?.title;
      const response = await options.providerClient.generateObject({
        taskName: 'question-closure',
        messages: buildQuestionClosureMessages(input),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });
      const normalizedResult = normalizeQuestionClosure(response.content, {
        currentQuestionTitle,
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
