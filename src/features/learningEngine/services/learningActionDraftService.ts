import type {
  AiProviderClient,
  LearningActionDraftInput,
  LearningActionDraftResult,
} from '../domain';
import { buildLearningActionDraftMessages } from '../prompts/learningPrompts';

import {
  normalizeLearningActionDraft,
  parseJsonObject,
} from './learningDraftNormalization';

export function createLearningActionDraftService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: LearningActionDraftInput): Promise<LearningActionDraftResult> {
      const response = await options.providerClient.generateObject({
        taskName: 'learning-action-draft',
        messages: buildLearningActionDraftMessages(input),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });
      const currentQuestionTitle =
        input.questionPath?.[input.questionPath.length - 1]?.title;

      return {
        draft: normalizeLearningActionDraft(response.content, {
          actionId: input.actionId,
          currentQuestionTitle,
          hasLearnerAnswer: Boolean(input.learnerAnswer?.trim()),
          planStepTitle: input.planStepTitle,
          questionTitles: input.existingQuestionTitles,
        }),
        metadata: {
          model: response.model,
          providerLabel: response.providerLabel,
        },
      };
    },
  };
}
