import type {
  AiProviderClient,
  JudgmentHintInput,
  JudgmentHintResult,
} from '../domain';
import { buildJudgmentHintMessages } from '../prompts/learningPrompts';

import {
  extractJudgmentGapItemsFromText,
  normalizeClosureHintText,
} from './closureHint';
import {
  normalizeHintCitationDrafts,
  parseJsonObject,
} from './learningDraftNormalization';

interface RawJudgmentHintPayload {
  hint?: unknown;
  citations?: unknown;
  references?: unknown;
}

export function createJudgmentHintService(options: {
  providerClient: AiProviderClient;
}) {
  return {
    async generate(input: JudgmentHintInput): Promise<JudgmentHintResult> {
      const currentQuestionTitle =
        input.questionPath[input.questionPath.length - 1]?.title;
      const response = await options.providerClient.generateObject({
        taskName: 'judgment-hint',
        messages: buildJudgmentHintMessages(input),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });
      const rawPayload = isRecord(response.content)
        ? (response.content as RawJudgmentHintPayload)
        : {};
      const hint = normalizeClosureHintText({
        rawHint: rawPayload.hint ?? response.content,
        currentQuestionTitle,
        judgmentGapItems: extractJudgmentGapItemsFromText(
          input.judgmentContent,
          currentQuestionTitle,
        ),
        judgmentContent: input.judgmentContent,
        summaryContent: input.summaryContent ?? '',
      });
      const citations = normalizeHintCitationDrafts(
        rawPayload.hint ?? rawPayload,
        hint,
      );

      return {
        hint,
        citations,
        metadata: {
          model: response.model,
          providerLabel: response.providerLabel,
        },
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
