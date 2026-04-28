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

const LOCAL_FALLBACK_METADATA = {
  providerLabel: 'local-fallback',
  model: 'heuristic-draft',
} as const;

export function createLearningActionDraftService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: LearningActionDraftInput): Promise<LearningActionDraftResult> {
      const currentQuestionTitle =
        input.questionPath?.[input.questionPath.length - 1]?.title;
      const draftOptions = {
        actionId: input.actionId,
        currentQuestionTitle,
        hasLearnerAnswer: Boolean(input.learnerAnswer?.trim()),
        planStepTitle: input.planStepTitle,
      } as const;

      try {
        const response = await options.providerClient.generateObject({
          taskName: 'learning-action-draft',
          messages: buildLearningActionDraftMessages(input),
          responseFormat: 'json_object',
          parse: parseJsonObject,
        });

        return {
          draft: normalizeLearningActionDraft(response.content, draftOptions),
          metadata: {
            model: response.model,
            providerLabel: response.providerLabel,
          },
        };
      } catch {
        return {
          draft: normalizeLearningActionDraft({}, draftOptions),
          metadata: LOCAL_FALLBACK_METADATA,
        };
      }
    },
  };
}
