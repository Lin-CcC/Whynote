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
  it('asks the provider for a hint that complements judgment and explanation without rewriting either', async () => {
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
            citations: [
              {
                targetNodeId: 'resource-search-space',
                purpose: 'judgment',
                note: '如果卡住，可以看资料里解释搜索空间量级的那一段。',
                sourceLocator: '第 2 节 搜索空间',
              },
            ],
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
          title: '如果没有反向传播，面对海量参数，模型训练为什么几乎不可能成立？',
          content: '请解释单纯试错为什么不构成可行训练方法。',
        },
      ],
      learnerAnswer: '因为参数太多了，靠人工试会很慢。',
      judgmentContent:
        '已答到的部分：\n- 你已经意识到参数规模会让训练成本失控。\n\n还缺的关键点：\n1. 组合爆炸的量级。\n2. 方向信息为什么必要。\n\n为什么这些缺口关键：\n- 不把这两点说清楚，就还是停留在“成本高”。',
      summaryContent:
        '反向传播把误差逐层传回去，让每个参数都拿到和自己相关的调整信号。',
    });

    expect(capturedPrompt).toContain('先读 judgment 里“还缺的关键点 / 为什么这些缺口关键”');
    expect(capturedPrompt).toContain('hint 只做三件事');
    expect(capturedPrompt).toContain('focus 只能指向一个具体缺口');
    expect(capturedPrompt).toContain('background 要补的不是结论本身');
    expect(capturedPrompt).toContain(
      '"hint":{"focus":"","background":"","thinkingQuestion":"","content":"","citations":[{"targetNodeId":"","focusText":"","purpose":"mechanism","note":"","sourceExcerpt":"","sourceLocator":""}]}}',
    );
    expect(result.hint).toContain('先补哪块：组合爆炸的量级');
    expect(result.hint).toContain('关键背景：参数一多，搜索空间会指数级膨胀');
    expect(result.hint).toContain('可以先想：如果每个参数只看两种可能');
    expect(result.citations).toEqual([
      {
        targetNodeId: 'resource-search-space',
        focusText: '组合爆炸的量级',
        note: '如果卡住，可以看资料里解释搜索空间量级的那一段。',
        purpose: 'background',
        sourceLocator: '第 2 节 搜索空间',
      },
    ]);
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
          title: '如果没有反向传播，面对海量参数，模型训练为什么几乎不可能成立？',
          content: '请解释单纯试错为什么不构成可行训练方法。',
        },
      ],
      learnerAnswer: '因为参数太多了，靠人工试会很慢。',
      judgmentContent:
        '已答到的部分：\n- 你已经意识到参数多会带来训练成本。\n\n还缺的关键点：\n1. 组合爆炸的量级。\n2. 方向信息为什么必要。\n\n为什么这些缺口关键：\n- 不把这两点说清楚，就还是停留在“成本高”。',
      summaryContent:
        '训练不只需要知道结果对错，还需要知道每个参数该往哪个方向调。',
    });

    expect(result.hint).toContain('先补哪块：');
    expect(result.hint).toContain('关键背景：');
    expect(result.hint).toContain('可以先想：');
    expect(result.hint).not.toContain('继续想想损失函数');
  });
});
