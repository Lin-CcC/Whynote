import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createModuleGenerationService } from './services';

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

describe('moduleGenerationService', () => {
  it.each([
    {
      mode: 'quick' as const,
      expectedModuleCount: 3,
      expectedPlanStepCount: 3,
    },
    {
      mode: 'standard' as const,
      expectedModuleCount: 5,
      expectedPlanStepCount: 5,
    },
    {
      mode: 'deep' as const,
      expectedModuleCount: 7,
      expectedPlanStepCount: 6,
    },
  ])(
    'keeps module and learning-path counts inside the $mode mode range',
    async ({ mode, expectedModuleCount, expectedPlanStepCount }) => {
      const providerClient = createMockProvider({
        'module-generation': {
          modules: Array.from({ length: 8 }, (_, moduleIndex) => ({
            title: `模块 ${String(moduleIndex + 1)}`,
            content: `模块说明 ${String(moduleIndex + 1)}`,
            planSteps: Array.from({ length: 8 }, (_, planStepIndex) => ({
              title: `步骤 ${String(planStepIndex + 1)}`,
              content: `步骤说明 ${String(planStepIndex + 1)}`,
              prerequisites: [
                {
                  title: `前置问题 ${String(planStepIndex + 1)}`,
                  content: '先确认背景。',
                },
              ],
              questions: [
                {
                  title: `关键问题 ${String(planStepIndex + 1)}`,
                  content: '继续展开核心问题。',
                },
              ],
            })),
          })),
        },
      });
      const service = createModuleGenerationService({
        providerClient,
      });

      const result = await service.generate({
        topic: '事件循环',
        mode,
      });

      expect(result.mode).toBe(mode);
      expect(result.modules).toHaveLength(expectedModuleCount);
      expect(result.modules.every((module) => module.type === 'module')).toBe(true);
      expect(
        result.modules.every(
          (module) => module.planSteps.length === expectedPlanStepCount,
        ),
      ).toBe(true);
      expect(
        result.modules.every((module) =>
          module.planSteps.every(
            (planStep) =>
              planStep.type === 'plan-step' &&
              planStep.status === 'todo' &&
              planStep.questions.length >= 2,
          ),
        ),
      ).toBe(true);
      expect(result.modules[0].planSteps[0].questions[0].title).toContain('铺垫：');
    },
  );

  it('defaults to standard mode and fills missing modules with node-ready drafts', async () => {
    const providerClient = createMockProvider({
      'module-generation': {
        modules: [],
      },
    });
    const service = createModuleGenerationService({
      providerClient,
    });

    const result = await service.generate({
      topic: 'TypeScript 类型系统',
    });

    expect(result.mode).toBe('standard');
    expect(result.modules).toHaveLength(4);
    expect(result.modules[0].title).toContain('TypeScript 类型系统');
    expect(result.modules[0].planSteps).toHaveLength(4);
    expect(result.modules[0].planSteps[0].questions.length).toBeGreaterThanOrEqual(2);
  });
});
