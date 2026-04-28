import { describe, expect, it } from 'vitest';

import {
  attachTagToNode,
  addNodeReference,
  createNode,
  createNodeReference,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
} from '../nodeDomain';
import { suggestPlanStepCompletion } from './services';

describe('completionSuggestionService', () => {
  it('suggests completion when every leaf question has answer, judgment and summary', () => {
    let tree = createBaseTree({
      stepId: 'plan-step-pass',
      moduleId: 'module-pass',
      questionId: 'question-pass',
    });

    tree = insertChildNode(
      tree,
      'question-pass',
      createNode({
        type: 'answer',
        id: 'answer-pass',
        title: '回答',
        content: '并发渲染是调度更新的方式。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-pass',
      createNode({
        type: 'judgment',
        id: 'judgment-pass',
        title: '判断：已答到当前问题',
        content: '回答已经覆盖当前问题的关键点。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-pass',
      createNode({
        type: 'summary',
        id: 'summary-pass',
        title: '总结：标准理解',
        content: '已经能够概括核心概念。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const result = suggestPlanStepCompletion(tree, 'plan-step-pass');

    expect(result.shouldSuggestComplete).toBe(true);
    expect(result.reasonSummary).toBe('当前步骤已满足最小学习闭环。');
    expect(result.evidence.questionCount).toBe(1);
    expect(result.evidence.leafQuestionCount).toBe(1);
    expect(result.evidence.closedLeafQuestionCount).toBe(1);
  });

  it('does not treat scaffold introductions as learning summaries', () => {
    const result = suggestPlanStepCompletion(
      createBaseTree({
        stepId: 'plan-step-scaffold',
        moduleId: 'module-scaffold',
        questionId: 'question-scaffold',
        withIntroduction: true,
      }),
      'plan-step-scaffold',
    );

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.scaffoldSummaryCount).toBe(1);
    expect(result.evidence.summaryCount).toBe(0);
    expect(result.reasonSummary).toContain('骨架阶段');
  });

  it('does not count question-only citations as learning progress evidence', () => {
    let tree = createBaseTree({
      stepId: 'plan-step-question-citation',
      moduleId: 'module-question-citation',
      questionId: 'question-question-citation',
      withIntroduction: true,
    });

    tree = insertChildNode(
      tree,
      tree.rootId,
      createNode({
        type: 'resource',
        id: 'resource-question-citation',
        title: 'Reference',
        content: 'Question scaffold reference.',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = addNodeReference(
      tree,
      createNodeReference({
        sourceNodeId: 'question-question-citation',
        targetNodeId: 'resource-question-citation',
        id: 'reference-question-citation',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const result = suggestPlanStepCompletion(tree, 'plan-step-question-citation');

    expect(result.evidence.referencedNodeCount).toBe(0);
    expect(result.reasonSummary).toContain('尚未出现真实学习证据');
  });

  it('does not suggest completion when there are unresolved leaf questions or blocking tags', () => {
    let tree = createBaseTree({
      stepId: 'plan-step-blocked',
      moduleId: 'module-blocked',
      questionId: 'question-blocked-1',
    });

    tree = insertChildNode(
      tree,
      'plan-step-blocked',
      createNode({
        type: 'question',
        id: 'question-blocked-2',
        title: '闭包为什么会导致内存问题？',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-blocked-1',
      createNode({
        type: 'answer',
        id: 'answer-blocked',
        title: '回答',
        content: '闭包会保留外部词法环境。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-blocked-1',
      createNode({
        type: 'judgment',
        id: 'judgment-blocked-1',
        title: '判断：已答到当前问题',
        content: '第一个问题已经回答到位。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-blocked-1',
      createNode({
        type: 'summary',
        id: 'summary-blocked-1',
        title: '总结：标准理解',
        content: '已经补全第一个问题的标准理解。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = upsertTag(
      tree,
      createTag('待验证', {
        id: 'tag-blocked',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = attachTagToNode(tree, 'question-blocked-2', 'tag-blocked');

    const result = suggestPlanStepCompletion(tree, 'plan-step-blocked');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.reasonSummary).toContain('仍有未闭环问题');
    expect(result.reasonSummary).toContain('存在阻塞标签');
    expect(result.evidence.unresolvedQuestionTitles).toEqual([
      '闭包为什么会导致内存问题？',
    ]);
  });

  it('does not treat direct step-level closure nodes as question closure', () => {
    let tree = createBaseTree({
      stepId: 'plan-step-direct-only',
      moduleId: 'module-direct-only',
      questionId: 'question-direct-only',
    });

    tree = insertChildNode(
      tree,
      'plan-step-direct-only',
      createNode({
        type: 'summary',
        id: 'summary-direct-only',
        title: '步骤总结',
        content: '先给一个总结。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'plan-step-direct-only',
      createNode({
        type: 'judgment',
        id: 'judgment-direct-only',
        title: '步骤判断',
        content: '先给一个判断。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const result = suggestPlanStepCompletion(tree, 'plan-step-direct-only');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.directClosureCount).toBe(2);
    expect(result.evidence.closedLeafQuestionCount).toBe(0);
    expect(result.reasonSummary).toContain('不能替代具体 question 的闭环');
  });

  it('keeps the parent answer as the closure target after follow-up is generated', () => {
    let tree = createBaseTree({
      stepId: 'plan-step-follow-up',
      moduleId: 'module-follow-up',
      questionId: 'question-parent',
    });

    tree = insertChildNode(
      tree,
      'question-parent',
      createNode({
        type: 'answer',
        id: 'answer-parent',
        title: '回答',
        content: '先给出一版不完整回答。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-parent',
      createNode({
        type: 'judgment',
        id: 'judgment-parent',
        title: '判断：回答还不完整',
        content: '还缺少关键因果关系。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-parent',
      createNode({
        type: 'summary',
        id: 'summary-parent',
        title: '总结：标准理解',
        content: '先把正确思路补全出来。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-parent',
      createNode({
        type: 'question',
        id: 'question-follow-up',
        title: '追问：还缺哪条因果关系？',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const result = suggestPlanStepCompletion(tree, 'plan-step-follow-up');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.questionCount).toBe(2);
    expect(result.evidence.leafQuestionCount).toBe(1);
    expect(result.evidence.unresolvedQuestionTitles).toEqual([
      '什么是并发渲染？',
    ]);
  });
});

function createBaseTree(options: {
  moduleId: string;
  questionId: string;
  stepId: string;
  withIntroduction?: boolean;
}) {
  const snapshot = createWorkspaceSnapshot({
    title: 'Completion suggestion',
    workspaceId: `workspace-${options.stepId}`,
    rootId: `root-${options.stepId}`,
    createdAt: '2026-04-27T00:00:00.000Z',
  });
  const moduleNode = createNode({
    type: 'module',
    id: options.moduleId,
    title: 'Module',
    createdAt: '2026-04-27T00:00:00.000Z',
  });
  const planStepNode = createNode({
    type: 'plan-step',
    id: options.stepId,
    title: 'Step',
    status: 'doing',
    createdAt: '2026-04-27T00:00:00.000Z',
  });
  const questionNode = createNode({
    type: 'question',
    id: options.questionId,
    title: '什么是并发渲染？',
    createdAt: '2026-04-27T00:00:00.000Z',
  });

  let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
  tree = insertChildNode(tree, options.moduleId, planStepNode);

  if (options.withIntroduction) {
    tree = insertChildNode(
      tree,
      options.stepId,
      createNode({
        type: 'summary',
        id: `${options.stepId}-introduction`,
        title: '铺垫：先建立基本图景',
        content: '这是当前步骤的前置讲解。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );
  }

  tree = insertChildNode(tree, options.stepId, questionNode);

  return tree;
}
