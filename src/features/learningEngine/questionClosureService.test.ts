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
  it('normalizes vague model output into explicit gaps, guided explanation and a distinct hint', async () => {
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
    expect(result.judgment.content).toContain('已答到：');
    expect(result.judgment.content).toContain('还缺的关键点：');
    expect(result.judgment.content).toContain('为什么关键：');
    expect(result.judgment.content).toContain(
      '把“为什么状态更新会被批处理？”真正依赖的关键机制、因果关系或判断边界说清楚',
    );
    expect(result.judgment.hint).toContain('先补哪块：');
    expect(result.judgment.hint).toContain('关键背景：');
    expect(result.judgment.hint).toContain('可以先想：');
    expect(result.summary.content).toContain('会卡在');
    expect(result.summary.content).toContain('继续往下想');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
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
    expect(result.judgment.content).toContain('已答到：');
    expect(result.judgment.content).toContain('当前没有新的关键缺口');
    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain('继续追问自己');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
    expect(result.summary.content).toContain('因此可以减少重复渲染');
    expect(result.followUpQuestions).toHaveLength(0);
  });

  it('still returns an answer explanation draft when the model omits summary on the first evaluation', async () => {
    const providerClient = createMockProvider({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '回答还不完整',
          content: '还没有说明为什么统一提交会减少重复渲染。',
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
      learnerAnswer: '因为 React 会把多个更新放在一起。',
    });

    expect(result.summary.title).toBe('标准理解');
    expect(result.judgment.hint).toContain('先补哪块：');
    expect(result.summary.content).toContain('会卡在');
    expect(result.summary.content).toContain('继续往下想');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
  });

  it('asks the provider for a structured judgment plus an independent hint in the closure request', async () => {
    let capturedPrompt = '';
    const providerClient: AiProviderClient = {
      async generateObject<T>(
        request: AiProviderObjectRequest<T>,
      ): Promise<AiProviderObjectResponse<T>> {
        capturedPrompt = String(request.messages[1]?.content ?? '');
        const rawText = JSON.stringify({
          isAnswerSufficient: false,
          judgment: {
            title: '判断：还差一点',
            answered: '已经提到了会把更新放在一起。',
            gaps: ['没有解释为什么统一提交会减少重复渲染。'],
            whyItMatters: '因为少了这条因果链，就还无法证明理解完整。',
          },
          hint: {
            focus: '为什么统一提交会减少重复渲染',
            background:
              '这里缺的不是再说一遍结论，而是把“收集更新 -> 统一提交 -> 减少重复渲染”连成因果链。',
            thinkingQuestion:
              '如果只保留这个结论，中间到底省略了哪一步变化或结果？',
          },
          summary: {
            title: '标准理解',
            content:
              '同一轮事件里的更新会先被收集，再统一提交，因此不必为每次更新都重复渲染。',
          },
          followUpQuestions: [],
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
    const service = createQuestionClosureService({
      providerClient,
    });

    await service.generate({
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

    expect(capturedPrompt).toContain('hint 必须单独返回');
    expect(capturedPrompt).toContain('focus 填“先补哪块”');
    expect(capturedPrompt).toContain('thinkingQuestion');
    expect(capturedPrompt).toContain('gaps 返回 1-3 条缺口数组');
    expect(capturedPrompt).toContain(
      '"hint":{"focus":"","background":"","thinkingQuestion":"","content":""}',
    );
  });
});
