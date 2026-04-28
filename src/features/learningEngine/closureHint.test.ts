import { describe, expect, it } from 'vitest';

import {
  buildFallbackClosureHintText,
  extractJudgmentGapItemsFromText,
} from './services/closureHint';

describe('closureHint fallback', () => {
  it('extracts gaps from the new user-facing judgment sections', () => {
    const gapItems = extractJudgmentGapItemsFromText(
      [
        '这次答得好的地方：',
        '- 你已经抓住了“学习成本高”这个方向。',
        '',
        '还没答到的关键点：',
        '1. 组合爆炸的量级认知：需要明确 6000 万个参数意味着何种程度的搜索空间。',
        '2. 反馈的导向作用：只知道“错了”还不够，还需要知道“往哪调”。',
        '',
        '不补上会卡在哪里：',
        '- 如果不补这两点，回答会停在“成本高”的直觉层。',
        '',
        '接下来可以往哪想：',
        '- 先量化盲目尝试为什么在搜索空间上走不通。',
      ].join('\n'),
      '参数调整的挑战',
    );

    expect(gapItems).toEqual([
      '组合爆炸的量级认知：需要明确 6000 万个参数意味着何种程度的搜索空间。',
      '反馈的导向作用：只知道“错了”还不够，还需要知道“往哪调”。',
    ]);
  });

  it('extracts numbered judgment gaps instead of treating the whole judgment paragraph as one gap', () => {
    const gapItems = extractJudgmentGapItemsFromText(
      [
        '这次回答还不完整，“参数调整的挑战”里仍有关键点没有答到。你捕捉到了“成本”这个核心直觉。',
        '确实，面对 6000 万个参数，单纯的“盲目尝试”在计算量级上是完全不可行的。',
        '目前你已触及问题的表层，但还缺少对以下两个关键点的认知：',
        '',
        '1. **组合爆炸的量级**：你需要理解为什么 6000 万个参数的排列组合会让训练时间从“几天”变成“几辈子”。',
        '2. **反馈的导向作用**：仅仅知道“错了”是不够的，如果不知道“往哪调”，每一次尝试依然是盲目的。',
      ].join('\n'),
      '参数调整的挑战',
    );

    expect(gapItems).toEqual([
      '组合爆炸的量级：你需要理解为什么 6000 万个参数的排列组合会让训练时间从“几天”变成“几辈子”。',
      '反馈的导向作用：仅仅知道“错了”是不够的，如果不知道“往哪调”，每一次尝试依然是盲目的。',
    ]);
  });

  it('builds a complementary hint from combinatorial-explosion feedback', () => {
    const hint = buildFallbackClosureHintText({
      currentQuestionTitle: '参数调整的挑战',
      judgmentContent: [
        '这次回答还不完整，“参数调整的挑战”里仍有关键点没有答到。',
        '1. **组合爆炸的量级**：你需要理解为什么 6000 万个参数的排列组合会让训练时间从“几天”变成“几辈子”。',
        '2. **反馈的导向作用**：仅仅知道“错了”是不够的，如果不知道“往哪调”，每一次尝试依然是盲目的。',
      ].join('\n'),
    });

    expect(hint).toContain('先补哪块：组合爆炸的量级。');
    expect(hint).toContain('关键背景：');
    expect(hint).toContain('组合空间会爆炸式增长');
    expect(hint).toContain('可以先想：');
    expect(hint).toContain('如果每个参数哪怕只看两种可能');
    expect(hint).not.toContain('这次回答还不完整');
    expect(hint).not.toContain('参数调整的挑战”里仍有关键点没有答到');
  });

  it('builds a complementary hint from feedback-direction gaps', () => {
    const hint = buildFallbackClosureHintText({
      currentQuestionTitle: '为什么需要损失函数',
      judgmentGapItems: [
        '反馈的导向作用：仅仅知道“错了”是不够的，如果不知道“往哪调”，每一次尝试依然是盲目的。',
      ],
    });

    expect(hint).toContain('先补哪块：反馈的导向作用。');
    expect(hint).toContain('关键背景：');
    expect(hint).toContain('告诉大量参数各自该往哪边微调');
    expect(hint).toContain('可以先想：');
    expect(hint).toContain('如果系统只告诉你“这次错了”');
  });
});
