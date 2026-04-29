import { describe, expect, it } from 'vitest';

import {
  normalizePlanStepDrafts,
  normalizeQuestionClosure,
  parseJsonObject,
} from './services/learningDraftNormalization';

describe('parseJsonObject', () => {
  it('parses JSON wrapped in a code fence', () => {
    expect(
      parseJsonObject(`\`\`\`json
{"value":"ok","nested":{"count":1}}
\`\`\``),
    ).toEqual({
      value: 'ok',
      nested: {
        count: 1,
      },
    });
  });

  it('parses the first complete JSON object when explanation text surrounds it', () => {
    expect(
      parseJsonObject(`下面是最终结果：
{"value":"ok","nested":{"count":1}}
请按这个对象继续处理。`),
    ).toEqual({
      value: 'ok',
      nested: {
        count: 1,
      },
    });
  });

  it('rejects a parseable non-object root as a contract mismatch', () => {
    expect(() => parseJsonObject('["ok"]')).toThrow(
      'AI 返回的 JSON 能解析，但根节点不是对象，和当前任务约定不符。',
    );
  });
});

describe('normalizeQuestionClosure', () => {
  it('removes formulaic scaffold bridge sentences during introduction normalization', () => {
    const [planStep] = normalizePlanStepDrafts(
      {
        planSteps: [
          {
            title: '理解批处理',
            introductions: [
              {
                title: '铺垫：串场版',
                content:
                  '接下来会围绕“为什么状态更新会被批处理？”继续追问，所以先把核心对象、关键关系和判断线索放到同一张理解地图里。',
              },
            ],
            questions: [
              {
                title: '为什么状态更新会被批处理？',
                content: '请解释它为什么能减少重复渲染。',
              },
            ],
          },
        ],
      },
      '理解更新合并',
      'standard',
    );

    expect(planStep.introductions[0].content).not.toMatch(
      /接下来会围绕|继续追问|理解地图|核心对象、关键关系和判断线索/u,
    );
    expect(planStep.introductions[0].content).toContain(
      '这一小步先把“理解批处理”说清楚',
    );
  });

  it('builds a three-part judgment, a distinct hint, and a guided answer explanation', () => {
    const result = normalizeQuestionClosure(
      {
        followUpQuestions: [],
        hint: {
          content:
            '先补哪块：为什么统一提交会减少重复渲染。\n关键背景：这里先别急着背最终结论，先把“同一轮里先收集更新，再统一提交”连成一条因果链。\n可以先想：如果中间没有“统一提交”这一步，界面为什么会更容易重复计算？',
        },
        isAnswerSufficient: false,
        judgment: {
          strengths:
            '你已经抓住了“会把更新放在一起”这个方向，说明你意识到了批处理和合并更新有关。',
          gaps: [
            '没有解释为什么统一提交会减少重复渲染。',
            '没有说明这条机制依赖什么边界条件。',
          ],
          impact:
            '如果不把这两点补上，回答就会停在现象层，后面一旦要解释为什么这个机制成立就会断掉。',
        },
        summary: {
          title: '标准理解',
          content:
            'React 会先收集同一轮事件里的更新，再统一提交，因此不必为每次局部变化都单独重跑渲染。',
        },
      },
      {
        currentQuestionTitle: '为什么状态更新会被批处理？',
        learnerAnswer: '因为 React 会把多个更新放在一起。',
      },
    );

    expect(result.judgment.content).toContain('已答到的部分：');
    expect(result.judgment.content).toContain('还缺的关键点：');
    expect(result.judgment.content).toContain('为什么这些缺口关键：');
    expect(result.judgment.content).not.toContain('接下来可以往哪想');
    expect(result.judgment.content).not.toContain('下一步往哪想');
    expect(result.judgment.content).toContain(
      '没有解释为什么统一提交会减少重复渲染。',
    );

    expect(result.judgment.hint).toContain('先补哪块：');
    expect(result.judgment.hint).toContain('关键背景：');
    expect(result.judgment.hint).toContain('可以先想：');
    expect(result.judgment.hint).not.toContain('为什么这些缺口关键：');
    expect(result.judgment.hint).not.toContain(
      '如果不把这两点补上，回答就会停在现象层',
    );

    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain('你现在的思路已经抓到了');
    expect(result.summary.content).toContain('会卡在');
    expect(result.summary.content).toContain('你可以先追问自己：');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
  });

  it('keeps hint citations light, rewrites them to background purpose, and drops fake excerpts', () => {
    const result = normalizeQuestionClosure(
      {
        followUpQuestions: [],
        hint: {
          content:
            '先补哪块：误差如何回传到隐藏层。\n关键背景：先想清楚系统为什么不能只知道“结果错了”。\n可以先想：如果误差不能一路传回去，隐藏层参数凭什么知道自己该怎么改？',
          citations: [
            {
              targetNodeId: 'resource-backprop',
              purpose: 'judgment',
              note: '如果卡住，可以看资料里解释“误差如何回传”的那一段。',
              sourceExcerpt: 'AI 资料概况：这篇资料整体介绍了反向传播。',
              sourceLocator: '第 3 节 误差回传',
            },
          ],
        },
        isAnswerSufficient: false,
        judgment: {
          strengths: '你已经意识到只靠盲目试错不够。',
          gaps: ['没有解释误差为什么必须分配到每个参数。'],
          impact:
            '如果只知道结果错了，却不能把误差分配到具体参数，训练就仍然没有方向。',
        },
        summary: {
          title: '标准理解',
          content:
            '反向传播会把输出端的误差逐层传回去，让每个参数都拿到和自己相关的调整信号。',
        },
      },
      {
        currentQuestionTitle: '反向传播到底解决了什么问题？',
        learnerAnswer: '它让训练不用再盲目试错。',
      },
    );

    expect(result.judgment.citations).toHaveLength(1);
    expect(result.judgment.citations[0]).toMatchObject({
      targetNodeId: 'resource-backprop',
      purpose: 'background',
      sourceLocator: '第 3 节 误差回传',
    });
    expect(result.judgment.citations[0]?.focusText).toBe(
      '误差如何回传到隐藏层',
    );
    expect(result.judgment.citations[0]?.sourceExcerpt).toBeUndefined();
  });

  it('prefers real explanation anchors for summary citations instead of resource-overview text', () => {
    const result = normalizeQuestionClosure(
      {
        followUpQuestions: [],
        isAnswerSufficient: false,
        judgment: {
          strengths: '你已经意识到盲目试错不可行。',
          gaps: ['没有解释为什么需要方向信息。'],
          impact: '不补这一点，就无法说明训练为什么能够收敛。',
        },
        summary: {
          title: '标准理解',
          content:
            '反向传播把误差逐层传回去，因此更新不是随机碰运气，而是沿着能减小误差的方向推进。',
          citations: [
            {
              targetNodeId: 'resource-backprop',
              focusText: '反向传播把误差逐层传回去，因此更新不是随机碰运气。',
              purpose: 'mechanism',
              note: '这里引用的是“误差如何回传到隐藏层”那段说明。',
              sourceExcerpt: '资料概况：本文介绍反向传播与梯度下降。',
              sourceLocator: '第 4 节 梯度方向',
            },
          ],
        },
      },
      {
        currentQuestionTitle: '反向传播到底解决了什么问题？',
        learnerAnswer: '它让训练不用再盲目试错。',
      },
    );

    expect(result.summary.citations).toHaveLength(1);
    expect(result.summary.citations[0]).toMatchObject({
      targetNodeId: 'resource-backprop',
      purpose: 'mechanism',
      sourceLocator: '第 4 节 梯度方向',
    });
    expect(result.summary.citations[0]?.sourceExcerpt).toBeUndefined();
  });

  it('creates a fallback answer explanation when summary is missing', () => {
    const result = normalizeQuestionClosure(
      {
        followUpQuestions: [],
        isAnswerSufficient: false,
        judgment: {
          title: '判断：还缺关键机制',
          content:
            '已答到的部分：\n- 你已经意识到盲目试错成本太高。\n\n还缺的关键点：\n1. 没有解释为什么系统还必须知道每个参数该往哪个方向改。\n\n为什么这些缺口关键：\n- 如果只有“结果错了”而没有方向信息，训练仍然接近随机搜索。',
        },
      },
      {
        currentQuestionTitle: '反向传播到底解决了什么问题？',
        learnerAnswer: '它让训练不用再盲目试错。',
      },
    );

    expect(result.judgment.hint).toContain('先补哪块：');
    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain('你现在的思路已经抓到了');
    expect(result.summary.content).toContain('会卡在');
    expect(result.summary.content).toContain('更稳妥的标准理解是：');
  });
});
