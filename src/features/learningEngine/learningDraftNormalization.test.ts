import { describe, expect, it } from 'vitest';

import {
  normalizeQuestionClosure,
  normalizePlanStepDrafts,
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

  it('parses the first complete JSON object when short explanation text surrounds it', () => {
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

  it('reports when no JSON object can be found at all', () => {
    expect(() =>
      parseJsonObject('Service temporarily unavailable, please retry later.'),
    ).toThrow('AI 返回的内容里没有可解析的 JSON 对象。');
  });

  it('reports when the response looks like JSON but is truncated', () => {
    expect(() => parseJsonObject('结果如下：\n{"value":"ok"')).toThrow(
      'AI 返回的内容看起来像 JSON，但对象不完整或已被截断。',
    );
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

  it('keeps teaching citation metadata and only dedupes identical citation signatures', () => {
    const result = normalizeQuestionClosure({
      followUpQuestions: [],
      isAnswerSufficient: false,
      judgment: {
        title: '判断：还缺关键因果',
        content: '你还没有解释为什么批处理会减少重复渲染。',
        citations: [
          {
            targetNodeId: 'fragment-batching',
            focusText: '这里在指出你漏掉了“批处理为什么会减少重复渲染”这条因果链。',
            purpose: 'judgment',
            reason: '这里在支撑判断。',
            excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
            locator: 'useState > batching',
          },
          {
            targetNodeId: 'fragment-batching',
            focusText: '这里在指出你漏掉了“批处理为什么会减少重复渲染”这条因果链。',
            purpose: 'judgment',
            reason: '这里在支撑判断。',
            excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
            locator: 'useState > batching',
          },
          {
            targetNodeId: 'fragment-batching',
            focusText: '这里在解释“同一轮事件里先收集更新，再统一提交”。',
            purpose: 'mechanism',
            note: '这里在说明机制。',
            sourceExcerpt: 'React 会把多个 state 更新批处理后再统一提交。',
            sourceLocator: 'useState > batching',
          },
        ],
      },
      summary: {
        title: '标准理解',
        content: '批处理会先合并同一轮事件中的更新，再统一提交。',
      },
    });

    expect(result.judgment.citations).toEqual([
      {
        targetNodeId: 'fragment-batching',
        focusText: '这里在指出你漏掉了“批处理为什么会减少重复渲染”这条因果链。',
        purpose: 'judgment',
        note: '这里在支撑判断。',
        sourceExcerpt: 'React 会把多个 state 更新批处理后再统一提交。',
        sourceLocator: 'useState > batching',
      },
      {
        targetNodeId: 'fragment-batching',
        focusText: '这里在解释“同一轮事件里先收集更新，再统一提交”。',
        purpose: 'mechanism',
        note: '这里在说明机制。',
        sourceExcerpt: 'React 会把多个 state 更新批处理后再统一提交。',
        sourceLocator: 'useState > batching',
      },
    ]);
  });

  it('creates a fallback answer explanation when summary is missing', () => {
    const result = normalizeQuestionClosure(
      {
        followUpQuestions: [],
        isAnswerSufficient: false,
        judgment: {
          title: '判断：还缺关键因果',
          content: '你还没有解释为什么统一提交会减少重复渲染。',
        },
      },
      {
        currentQuestionTitle: '为什么状态更新会被批处理？',
        learnerAnswer: '因为 React 会把多个更新放在一起。',
      },
    );

    expect(result.summary.title).toBe('标准理解');
    expect(result.summary.content).toContain(
      '你的回答已经碰到了这个问题的一部分方向',
    );
    expect(result.summary.content).toContain('更稳妥的标准理解是');
    expect(result.summary.content).toContain('为什么状态更新会被批处理？');
  });
});
