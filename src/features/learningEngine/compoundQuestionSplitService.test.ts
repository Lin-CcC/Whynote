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

function createThrowingProvider(message: string): AiProviderClient {
  return {
    async generateObject<T>(
      _request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      throw new Error(message);
    },
  };
}

function createInvalidJsonProvider(): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      request.parse('{invalid-json');

      throw new Error('unreachable');
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

  it('falls back to heuristic split when the provider throws instead of rejecting', async () => {
    const service = createCompoundQuestionSplitService({
      providerClient: createThrowingProvider('network timeout'),
    });

    const result = await service.split({
      question: '什么是事件循环，它为什么重要？',
    });

    expect(result.childQuestions).not.toHaveLength(0);
    expect(result.childQuestions.map((item) => item.title)).toEqual([
      '什么是事件循环',
      '它为什么重要',
    ]);
    expect(result.fallbackReason).toBe(
      'AI provider 调用失败，已回退到本地启发式拆分。',
    );
    expect(result.metadata).toEqual({
      providerLabel: 'local-fallback',
      model: 'heuristic-splitter',
    });
  });

  it('falls back to heuristic split when the provider returns invalid JSON instead of rejecting', async () => {
    const service = createCompoundQuestionSplitService({
      providerClient: createInvalidJsonProvider(),
    });

    const result = await service.split({
      question: '什么是闭包，它为什么会保留外部作用域？',
    });

    expect(result.childQuestions).not.toHaveLength(0);
    expect(result.childQuestions.map((item) => item.title)).toEqual([
      '什么是闭包',
      '它为什么会保留外部作用域',
    ]);
    expect(result.fallbackReason).toBe(
      'AI 返回不是合法 JSON，已回退到本地启发式拆分。',
    );
    expect(result.metadata).toEqual({
      providerLabel: 'local-fallback',
      model: 'heuristic-splitter',
    });
  });

  it('keeps the existing heuristic fallback when the provider returns empty questions', async () => {
    const service = createCompoundQuestionSplitService({
      providerClient: createMockProvider({
        'compound-question-split': {
          questions: [],
        },
      }),
    });

    const result = await service.split({
      question: '什么是微任务，它和宏任务有什么区别？',
    });

    expect(result.childQuestions).not.toHaveLength(0);
    expect(result.childQuestions.map((item) => item.title)).toEqual([
      '什么是微任务',
      '它和宏任务有什么区别',
    ]);
    expect(result.fallbackReason).toBe(
      'AI 未返回有效子问题，已回退到本地启发式拆分。',
    );
    expect(result.metadata).toEqual({
      providerLabel: 'mock-provider',
      model: 'mock-model',
    });
  });
});
