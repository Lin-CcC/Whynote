import { describe, expect, it } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from './domain';
import { createQuestionClosureService } from './services';

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

describe('questionClosureService', () => {
  it('separates judgment, summary and follow-up responsibilities when the model output is vague', async () => {
    const providerClient = createMockProvider({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '回答还差一点',
          content: '继续补充。',
        },
        summary: {
          title: '总结',
          content: '回答还不完整。',
        },
        followUpQuestions: [
          {
            title: '再想想',
            content: '继续补充。',
          },
        ],
      },
    });
    const service = createQuestionClosureService({
      providerClient,
    });

    const result = await service.generate({
      topic: 'React 批处理',
      moduleTitle: '理解更新合并',
      planStepTitle: '解释批处理为什么成立',
      questionPath: [
        {
          title: '为什么状态更新会被批处理？',
          content: '请解释它为什么能减少重复渲染。',
        },
      ],
      learnerAnswer: '因为 React 会把多个更新放在一起。',
    });

    expect(result.isAnswerSufficient).toBe(false);
    expect(result.judgment.title).toBe('判断：回答还差一点');
    expect(result.judgment.content).toContain('这次回答还不完整');
    expect(result.summary.content).toContain('更稳妥的理解是');
    expect(result.summary.content).toContain('为什么状态更新会被批处理？');
    expect(result.followUpQuestions).toHaveLength(1);
    expect(result.followUpQuestions[0].title).toBe('追问：再想想');
    expect(result.followUpQuestions[0].content).toContain(
      '不需要重复已经答对的部分',
    );
    expect(result.followUpQuestions[0].content).toContain(
      '为什么状态更新会被批处理？',
    );
  });

  it('keeps an explanatory summary while making the judgment explicitly pass/fail', async () => {
    const providerClient = createMockProvider({
      'question-closure': {
        isAnswerSufficient: true,
        judgment: {
          title: '已经可以了',
          content: '关键点都提到了。',
        },
        summary: {
          title: '标准理解',
          content:
            '批处理会把同一轮事件中的多次更新合并提交，因此可以减少重复渲染，并让状态变化在一次提交里保持一致。',
        },
        followUpQuestions: [],
      },
    });
    const service = createQuestionClosureService({
      providerClient,
    });

    const result = await service.generate({
      topic: 'React 批处理',
      moduleTitle: '理解更新合并',
      planStepTitle: '解释批处理为什么成立',
      questionPath: [
        {
          title: '为什么状态更新会被批处理？',
          content: '请解释它为什么能减少重复渲染。',
        },
      ],
      learnerAnswer: '因为 React 会把同一轮事件里的更新合并后再提交。',
    });

    expect(result.isAnswerSufficient).toBe(true);
    expect(result.judgment.title).toBe('判断：已经可以了');
    expect(result.judgment.content).toContain('这次回答已答到');
    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain('因此可以减少重复渲染');
    expect(result.followUpQuestions).toHaveLength(0);
  });
});
