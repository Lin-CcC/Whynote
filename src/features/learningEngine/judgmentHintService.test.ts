import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createJudgmentHintService } from './services';

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

describe('judgmentHintService', () => {
  it('asks the provider for a standalone hint that complements the judgment and explanation', async () => {
    let capturedPrompt = '';
    const providerClient: AiProviderClient = {
      async generateObject<T>(
        request: AiProviderObjectRequest<T>,
      ): Promise<AiProviderObjectResponse<T>> {
        capturedPrompt = String(request.messages[1]?.content ?? '');
        const rawText = JSON.stringify({
          hint: {
            focus: '组合爆炸的量级',
            background:
              '参数一多，搜索空间会指数级膨胀，所以盲试不是慢一点，而是根本没有可行路径。',
            thinkingQuestion:
              '如果每个参数只看两种可能，6000 万个参数会把尝试次数推到什么量级？',
          },
        });

        return {
          taskName: request.taskName,
          content: request.parse(rawText) as T,
          rawText,
          model: 'mock-model',
          providerLabel: 'mock-provider',
        };
      },
    };
    const service = createJudgmentHintService({
      providerClient,
    });

    const result = await service.generate({
      topic: '神经网络训练',
      moduleTitle: '理解损失函数为什么必要',
      planStepTitle: '先看盲目调参为什么不可行',
      questionPath: [
        {
          title: '为什么不能靠反复试错来训练 6000 万参数的模型？',
          content: '请解释单纯试错为什么不构成可行训练方法。',
        },
      ],
      learnerAnswer: '因为参数太多了，靠人工试会很慢。',
      judgmentContent:
        '评价：当前只答到了“成本很高”，但还缺 1. 组合爆炸的量级；2. 反馈的导向作用。',
      summaryContent:
        '标准理解：参数空间巨大，而且训练需要知道每个参数朝哪个方向微调，损失函数正是在提供这种方向信息。',
    });

    expect(capturedPrompt).toContain('已有判断评价');
    expect(capturedPrompt).toContain('已有答案解析');
    expect(capturedPrompt).toContain('不补上会卡在哪里');
    expect(capturedPrompt).toContain('接下来可以往哪想');
    expect(capturedPrompt).toContain('focus 只能指向一个具体缺口');
    expect(capturedPrompt).toContain('background 要补的不是结论本身');
    expect(capturedPrompt).toContain('thinkingQuestion 要顺着这个卡点给出下一步思考抓手');
    expect(capturedPrompt).toContain(
      '"hint":{"focus":"","background":"","thinkingQuestion":"","content":""}',
    );
    expect(result.hint).toContain('先补哪块：组合爆炸的量级。');
    expect(result.hint).toContain('关键背景：参数一多，搜索空间会指数级膨胀');
    expect(result.hint).toContain('可以先想：如果每个参数只看两种可能');
  });

  it('repairs weak model output into a usable three-part hint', async () => {
    const providerClient = createMockProvider({
      'judgment-hint': {
        hint: {
          content: '继续想想损失函数。',
        },
      },
    });
    const service = createJudgmentHintService({
      providerClient,
    });

    const result = await service.generate({
      topic: '神经网络训练',
      moduleTitle: '理解损失函数为什么必要',
      planStepTitle: '先看盲目调参为什么不可行',
      questionPath: [
        {
          title: '为什么不能靠反复试错来训练 6000 万参数的模型？',
          content: '请解释单纯试错为什么不构成可行训练方法。',
        },
      ],
      learnerAnswer: '因为参数太多了，靠人工试会很慢。',
      judgmentContent:
        '评价：当前还缺 1. 组合爆炸的量级；2. 反馈的导向作用。',
      summaryContent:
        '标准理解：训练不只需要知道结果对错，还需要知道每个参数该往哪个方向调。',
    });

    expect(result.hint).toContain('先补哪块：');
    expect(result.hint).toContain('关键背景：');
    expect(result.hint).toContain('可以先想：');
    expect(result.hint).not.toContain('继续想想损失函数');
  });
});
