import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createPlanStepGenerationService } from './services';

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

describe('planStepGenerationService', () => {
  it('pads learning-path drafts to the current mode minimum and keeps introductions/question drafts node-ready', async () => {
    const providerClient = createMockProvider({
      'plan-step-generation': {
        planSteps: [
          {
            title: '建立整体认识',
            content: '先知道这个模块要解决什么问题。',
            prerequisites: [
              {
                title: '什么是并发渲染的基础术语？',
                content:
                  '并发渲染先把渲染工作拆成可中断、可恢复的调度任务，让更新不再只能一次性跑完。理解这一步的关键，是先区分渲染过程和提交过程各自承担什么角色。',
              },
            ],
            questions: [
              {
                title: '并发渲染到底改变了什么？',
                content: '围绕关键问题继续学习。',
              },
            ],
          },
        ],
      },
    });
    const service = createPlanStepGenerationService({
      providerClient,
    });

    const result = await service.generate({
      topic: 'React 并发渲染',
      moduleTitle: '理解调度模型',
      mode: 'deep',
    });

    expect(result.mode).toBe('deep');
    expect(result.planSteps).toHaveLength(4);
    expect(result.planSteps[0].title).toBe('建立整体认识');
    expect(result.planSteps.every((planStep) => planStep.status === 'todo')).toBe(
      true,
    );
    expect(result.planSteps[0].introductions).toHaveLength(1);
    expect(result.planSteps[0].questions).toHaveLength(1);
    expect(result.planSteps[0].introductions[0].title).toContain('铺垫：');
    expect(result.planSteps[0].introductions[0].content).toContain(
      '并发渲染先把渲染工作拆成可中断、可恢复的调度任务',
    );
    expect(result.planSteps[0].introductions[0].content).toContain(
      '并发渲染到底改变了什么？',
    );
    expect(result.planSteps[0].questions[0].content).toContain(
      '说明最关键的对象、关系或判断标准',
    );
  });
});
