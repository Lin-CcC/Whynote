import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createLearningActionDraftService } from './services';

function createMockProvider(
  payloadByTaskName: Record<string, unknown>,
): AiProviderClient {
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

describe('learningActionDraftService', () => {
  it('normalizes scaffold补讲动作为可读的 summary 草稿', async () => {
    const providerClient = createMockProvider({
      'learning-action-draft': {
        title: '更好懂的版本',
        content: '先把它理解成把同一轮里的更新放进同一个待处理队列。',
      },
    });
    const service = createLearningActionDraftService({
      providerClient,
    });

    const result = await service.generate({
      actionId: 'simplify-scaffold',
      topic: 'React 批处理',
      planStepTitle: '解释批处理为什么成立',
      introductions: ['铺垫：先知道它发生在同一轮事件里。'],
      existingQuestionTitles: ['为什么状态更新会被批处理？'],
    });

    expect(result.draft.type).toBe('summary');
    expect(result.draft.title).toBe('铺垫：更好懂的版本');
    expect(result.draft.content).toContain('放进同一个待处理队列');
    expect(result.draft.content).toContain('解释批处理为什么成立');
    expect(result.draft.content).not.toContain('接下来会围绕');
    expect(result.draft.content).not.toContain('理解地图');
  });

  it('在没有现成回答时也会为 insert-judgment 生成可编辑判断草稿', async () => {
    const providerClient = createMockProvider({
      'learning-action-draft': {},
    });
    const service = createLearningActionDraftService({
      providerClient,
    });

    const result = await service.generate({
      actionId: 'insert-judgment',
      topic: 'React 批处理',
      planStepTitle: '解释批处理为什么成立',
      questionPath: [
        {
          title: '为什么状态更新会被批处理？',
          content: '请解释它为什么能减少重复渲染。',
        },
      ],
      learnerAnswer: '',
    });

    expect(result.draft.type).toBe('judgment');
    expect(result.draft.title).toBe('判断：先明确什么算答到');
    expect(result.draft.content).toContain('当前还没有现成回答');
    expect(result.draft.content).toContain('为什么状态更新会被批处理？');
  });

  it('在 provider 失败时回退到本地可编辑判断草稿而不是直接报错', async () => {
    const service = createLearningActionDraftService({
      providerClient: createThrowingProvider(
        'AI 服务请求失败（429）：当前 AI 配额已用尽。',
      ),
    });

    const result = await service.generate({
      actionId: 'insert-judgment',
      topic: 'React 批处理',
      planStepTitle: '解释批处理为什么成立',
      questionPath: [
        {
          title: '为什么状态更新会被批处理？',
          content: '请解释它为什么能减少重复渲染。',
        },
      ],
      learnerAnswer: '因为 React 会把多个更新放在一起。',
    });

    expect(result.draft.type).toBe('judgment');
    expect(result.draft.title).toBe('判断：回答还不完整');
    expect(result.draft.content).toContain('这次回答还不完整');
    expect(result.draft.content).toContain('为什么状态更新会被批处理？');
    expect(result.metadata.providerLabel).toBe('local-fallback');
    expect(result.metadata.model).toBe('heuristic-draft');
  });
});
