import type {
  AiProviderClient,
  ChildQuestionDraft,
  CompoundQuestionSplitInput,
  CompoundQuestionSplitResult,
} from '../domain';
import { buildCompoundQuestionSplitMessages } from '../prompts/learningPrompts';

import { parseJsonObject } from './learningDraftNormalization';
import { orderChildQuestions } from './subQuestionOrderingService';

interface RawQuestionDraft {
  title?: unknown;
  content?: unknown;
  dependsOnIndices?: unknown;
  dependsOn?: unknown;
  confidence?: unknown;
}

export function createCompoundQuestionSplitService(options: {
  providerClient: AiProviderClient;
  confidenceThreshold?: number;
}) {
  return {
    async split(
      input: CompoundQuestionSplitInput,
    ): Promise<CompoundQuestionSplitResult> {
      const response = await options.providerClient.generateObject({
        taskName: 'compound-question-split',
        messages: buildCompoundQuestionSplitMessages(input),
        responseFormat: 'json_object',
        parse: parseJsonObject,
      });
      const normalizedChildQuestions = normalizeChildQuestions(
        response.content,
        input.question,
      );
      const fallbackChildQuestions =
        normalizedChildQuestions.length > 0
          ? normalizedChildQuestions
          : splitQuestionHeuristically(input.question);
      const orderedChildQuestions = orderChildQuestions(
        fallbackChildQuestions,
        options.confidenceThreshold,
      );

      return {
        parentQuestion: {
          type: 'question',
          title: input.question.trim(),
          content: '',
        },
        childQuestions: orderedChildQuestions.childQuestions,
        orderingStrategy: orderedChildQuestions.orderingStrategy,
        fallbackReason: orderedChildQuestions.fallbackReason,
        metadata: {
          providerLabel: response.providerLabel,
          model: response.model,
        },
      };
    },
  };
}

function normalizeChildQuestions(
  payload: unknown,
  originalQuestion: string,
): ChildQuestionDraft[] {
  const rawQuestions = extractRawQuestions(payload);
  const childQuestions = rawQuestions
    .map((rawQuestion, index) =>
      normalizeChildQuestion(rawQuestion, index, originalQuestion),
    )
    .filter((childQuestion): childQuestion is ChildQuestionDraft =>
      Boolean(childQuestion),
    );

  deduplicateTitles(childQuestions);

  return childQuestions;
}

function normalizeChildQuestion(
  rawQuestion: RawQuestionDraft,
  index: number,
  originalQuestion: string,
) {
  const title = getText(rawQuestion.title);
  const content = getText(rawQuestion.content);

  if (!title || title === originalQuestion.trim()) {
    return null;
  }

  return {
    type: 'question' as const,
    title,
    content,
    originalIndex: index,
    dependsOnIndices: normalizeDependencyIndices(
      rawQuestion.dependsOnIndices ?? rawQuestion.dependsOn,
    ),
    dependencyConfidence: normalizeConfidence(rawQuestion.confidence),
  };
}

function extractRawQuestions(payload: unknown): RawQuestionDraft[] {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.questions)) {
    return payload.questions;
  }

  return Array.isArray(payload.subQuestions) ? payload.subQuestions : [];
}

function splitQuestionHeuristically(question: string): ChildQuestionDraft[] {
  const normalizedQuestion = question.trim().replace(/[？?]+$/u, '');
  const parts = normalizedQuestion
    .split(/[；;。!?？！]/u)
    .flatMap((part) => part.split(/[，,、]\s*/u))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 2) {
    return [];
  }

  return parts.map((part, index) => ({
    type: 'question',
    title: part,
    content: '',
    originalIndex: index,
    dependsOnIndices: [],
    dependencyConfidence: 1,
  }));
}

function normalizeDependencyIndices(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is number => typeof item === 'number')
    .map((item) => Math.trunc(item))
    .filter((item, index, items) => item >= 0 && items.indexOf(item) === index);
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 1;
  }

  return Math.min(Math.max(value, 0), 1);
}

function deduplicateTitles(childQuestions: ChildQuestionDraft[]) {
  const counts = new Map<string, number>();

  for (const childQuestion of childQuestions) {
    const baseTitle = childQuestion.title.replace(/（\d+）$/u, '');
    const currentCount = counts.get(baseTitle) ?? 0;

    if (currentCount > 0) {
      childQuestion.title = `${baseTitle}（${String(currentCount + 1)}）`;
    }

    counts.set(baseTitle, currentCount + 1);
  }
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
