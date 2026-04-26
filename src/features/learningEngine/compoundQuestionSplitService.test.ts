import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createCompoundQuestionSplitService } from './services';

function createMockProvider(payloadByTaskName: Record<string, unknown>): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName];
      const rawText = JSON.stringify(payload);

      return {
        taskName: request.taskName,
        content: request.parse(rawText) as T,
        rawText,
        model: 'mock-model',
        providerLabel: 'mock-provider',
      };
    },
  };
}

describe('compoundQuestionSplitService', () => {
  it('reorders child questions by dependency when confidence is high', async () => {
    const providerClient = createMockProvider({
      'compound-question-split': {
        questions: [
          {
            title: '如何在浏览器里验证事件循环行为？',
            dependsOnIndices: [2],
            confidence: 0.95,
          },
          {
            title: '为什么它会影响任务执行顺序？',
            dependsOnIndices: [2],
            confidence: 0.9,
          },
          {
            title: '什么是事件循环？',
            confidence: 1,
          },
        ],
      },
    });
    const service = createCompoundQuestionSplitService({
      providerClient,
    });

    const result = await service.split({
      question: '什么是事件循环，它为什么影响任务执行顺序，以及如何在浏览器里验证？',
    });

    expect(result.parentQuestion.title).toBe(
      '什么是事件循环，它为什么影响任务执行顺序，以及如何在浏览器里验证？',
    );
    expect(result.orderingStrategy).toBe('dependency');
    expect(result.childQuestions.map((item) => item.title)).toEqual([
      '什么是事件循环？',
      '如何在浏览器里验证事件循环行为？',
      '为什么它会影响任务执行顺序？',
    ]);
  });

  it('falls back to the original order when dependency confidence is low', async () => {
    const providerClient = createMockProvider({
      'compound-question-split': {
        questions: [
          {
            title: '它和闭包有什么关系？',
            dependsOnIndices: [1],
            confidence: 0.45,
          },
          {
            title: '什么是闭包？',
            confidence: 1,
          },
        ],
      },
    });
    const service = createCompoundQuestionSplitService({
      providerClient,
    });

    const result = await service.split({
      question: '什么是闭包，它和闭包有什么关系？',
    });

    expect(result.orderingStrategy).toBe('original');
    expect(result.fallbackReason).toContain('置信度过低');
    expect(result.childQuestions.map((item) => item.title)).toEqual([
      '它和闭包有什么关系？',
      '什么是闭包？',
    ]);
  });
});
