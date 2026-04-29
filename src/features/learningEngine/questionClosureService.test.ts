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
  it('normalizes vague model output into a strict judgment contract, distinct hint, and guided explanation', async () => {
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
    expect(result.judgment.content).toContain('已答到的部分：');
    expect(result.judgment.content).toContain('还缺的关键点：');
    expect(result.judgment.content).toContain('为什么这些缺口关键：');
    expect(result.judgment.content).not.toContain('接下来可以往哪想');
    expect(result.judgment.hint).toContain('先补哪块：');
    expect(result.judgment.hint).toContain('关键背景：');
    expect(result.judgment.hint).toContain('可以先想：');
    expect(result.summary.content).toContain('会卡在');
    expect(result.summary.content).toContain('你可以先追问自己：');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
    expect(result.followUpQuestions).toHaveLength(1);
    expect(result.followUpQuestions[0].title).toBe('追问：再想想');
  });

  it('keeps answer-sufficient closures concise while still producing an explanation layer', async () => {
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
            '批处理会把同一轮事件中的多次更新合并提交，因此可以减少不必要的重复渲染。',
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
      learnerAnswer: '因为同一轮里的更新会先合并再提交。',
    });

    expect(result.isAnswerSufficient).toBe(true);
    expect(result.judgment.title).toBe('判断：已经可以了');
    expect(result.judgment.content).toContain('已答到的部分：');
    expect(result.judgment.content).toContain('当前没有新的关键缺口');
    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain('继续追问自己：');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
    expect(result.followUpQuestions).toHaveLength(0);
  });

  it('merges hint citations into the judgment result as light background references', async () => {
    const providerClient = createMockProvider({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：还差关键机制',
          strengths: '你已经答到了“盲目试错不现实”。',
          gaps: ['没有解释为什么还必须知道每个参数该往哪个方向改。'],
          impact: '如果没有方向信息，训练仍然接近随机搜索。',
          citations: [
            {
              targetNodeId: 'fragment-feedback',
              purpose: 'judgment',
              note: '这里支撑当前缺口判断。',
              sourceExcerpt: '误差必须被分配到各层参数。',
            },
          ],
        },
        hint: {
          focus: '为什么只知道结果错了还不够',
          background: '关键在于训练还需要方向信息。',
          thinkingQuestion: '如果误差不能传回隐藏层，参数怎么知道自己该怎么改？',
          citations: [
            {
              targetNodeId: 'fragment-feedback',
              purpose: 'judgment',
              note: '如果卡住，可以看“误差如何回传”的那一段。',
              sourceLocator: '第 3 节 误差回传',
            },
          ],
        },
        summary: {
          title: '标准理解',
          content:
            '反向传播把误差逐层传回去，让每个参数都拿到和自己相关的调整信号。',
        },
        followUpQuestions: [],
      },
    });
    const service = createQuestionClosureService({
      providerClient,
    });

    const result = await service.generate({
      topic: '神经网络训练',
      moduleTitle: '理解反向传播',
      planStepTitle: '先看盲目试错为什么走不通',
      questionPath: [
        {
          title: '反向传播到底解决了什么问题？',
          content: '如果没有反向传播，海量参数为什么几乎不可能训练起来？',
        },
      ],
      learnerAnswer: '它让训练不用再盲目试错。',
    });

    expect(result.judgment.citations).toHaveLength(2);
    expect(result.judgment.citations[0]).toMatchObject({
      targetNodeId: 'fragment-feedback',
      purpose: 'judgment',
    });
    expect(result.judgment.citations[1]).toMatchObject({
      targetNodeId: 'fragment-feedback',
      purpose: 'background',
      sourceLocator: '第 3 节 误差回传',
    });
  });

  it('asks the provider for the tightened four-layer contract', async () => {
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
            strengths: '已经碰到了主线。',
            gaps: ['还缺关键因果链。'],
            impact: '不补上就会停在现象层。',
          },
          hint: {
            focus: '先补关键因果链',
            background: '先补最小背景，不直接给完整答案。',
            thinkingQuestion: '如果中间那一环拿掉，结论为什么立不住？',
            citations: [],
          },
          summary: {
            title: '标准理解',
            content: '把因果链补齐后，再给出更完整的标准理解。',
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

    expect(capturedPrompt).toContain('已答到的部分 / 还缺的关键点 / 为什么这些缺口关键');
    expect(capturedPrompt).toContain('hint 只做三件事');
    expect(capturedPrompt).toContain('summary 要写成引导式解析');
    expect(capturedPrompt).toContain(
      '"hint":{"focus":"","background":"","thinkingQuestion":"","content":"","citations":[{"targetNodeId":"","focusText":"","purpose":"mechanism","note":"","sourceExcerpt":"","sourceLocator":""}]}',
    );
    expect(capturedPrompt).toContain(
      '"judgment":{"title":"","strengths":"","gaps":[""],"impact":"","content":"","citations":[{"targetNodeId":"","focusText":"","purpose":"mechanism","note":"","sourceExcerpt":"","sourceLocator":""}]}',
    );
  });
});
