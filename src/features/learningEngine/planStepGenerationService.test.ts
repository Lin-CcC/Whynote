import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createPlanStepGenerationService } from './services';

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

describe('planStepGenerationService', () => {
  it('pads plan-step drafts to the current mode minimum and keeps todo status', async () => {
    const providerClient = createMockProvider({
      'plan-step-generation': {
        planSteps: [
          {
            title: '建立整体认识',
            content: '先知道这个模块要解决什么问题。',
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
  });
});
