import { describe, expect, it } from 'vitest';

import {
  createNode,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  attachTagToNode,
} from '../nodeDomain';
import { suggestPlanStepCompletion } from './services';

describe('completionSuggestionService', () => {
  it('suggests completion when a step has question, answer and summary without blockers', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Completion suggestion',
      workspaceId: 'workspace-completion-pass',
      rootId: 'root-completion-pass',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-pass',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-pass',
      title: 'Step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-pass',
      title: '什么是并发渲染？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const answerNode = createNode({
      type: 'answer',
      id: 'answer-pass',
      title: '回答',
      content: '并发渲染是调度更新的方式。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const summaryNode = createNode({
      type: 'summary',
      id: 'summary-pass',
      title: '总结',
      content: '已经能概括核心概念。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-pass', planStepNode);
    tree = insertChildNode(tree, 'plan-step-pass', questionNode);
    tree = insertChildNode(tree, 'question-pass', answerNode);
    tree = insertChildNode(tree, 'plan-step-pass', summaryNode);

    const result = suggestPlanStepCompletion(tree, 'plan-step-pass');

    expect(result.shouldSuggestComplete).toBe(true);
    expect(result.reasonSummary).toBe('当前步骤已具备完成信号。');
    expect(result.evidence.questionCount).toBe(1);
    expect(result.evidence.summaryCount).toBe(1);
  });

  it('does not suggest completion when there are unresolved questions or blocking tags', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Completion suggestion blocked',
      workspaceId: 'workspace-completion-blocked',
      rootId: 'root-completion-blocked',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-blocked',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-blocked',
      title: 'Step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const firstQuestionNode = createNode({
      type: 'question',
      id: 'question-blocked-1',
      title: '什么是闭包？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const secondQuestionNode = createNode({
      type: 'question',
      id: 'question-blocked-2',
      title: '闭包为什么会导致内存问题？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const answerNode = createNode({
      type: 'answer',
      id: 'answer-blocked',
      title: '回答',
      content: '闭包会保留外部词法环境。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const tag = createTag('待验证', {
      id: 'tag-blocked',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-blocked', planStepNode);
    tree = insertChildNode(tree, 'plan-step-blocked', firstQuestionNode);
    tree = insertChildNode(tree, 'plan-step-blocked', secondQuestionNode);
    tree = insertChildNode(tree, 'question-blocked-1', answerNode);
    tree = upsertTag(tree, tag);
    tree = attachTagToNode(tree, 'question-blocked-2', 'tag-blocked');

    const result = suggestPlanStepCompletion(tree, 'plan-step-blocked');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.reasonSummary).toContain('仍有未闭环问题');
    expect(result.reasonSummary).toContain('存在阻塞标签');
  });

  it('does not suggest completion when an unresolved question is only accompanied by a direct summary', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Completion unresolved with direct summary',
      workspaceId: 'workspace-completion-direct-summary',
      rootId: 'root-completion-direct-summary',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-direct-summary',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-direct-summary',
      title: 'Step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-direct-summary',
      title: '这个问题还没闭环吗？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const summaryNode = createNode({
      type: 'summary',
      id: 'summary-direct-summary',
      title: '步骤总结',
      content: '先有一个阶段总结。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-direct-summary', planStepNode);
    tree = insertChildNode(tree, 'plan-step-direct-summary', questionNode);
    tree = insertChildNode(tree, 'plan-step-direct-summary', summaryNode);

    const result = suggestPlanStepCompletion(tree, 'plan-step-direct-summary');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.answeredQuestionCount).toBe(0);
    expect(result.evidence.directClosureCount).toBe(1);
    expect(result.evidence.unresolvedQuestionTitles).toEqual([
      '这个问题还没闭环吗？',
    ]);
    expect(result.reasonSummary).toContain('仍有未闭环问题');
    expect(result.reasonSummary).toContain('不能替代 question 自身闭环');
  });

  it('keeps unresolved questions visible even when another question is closed and direct closure nodes exist', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Completion partially unresolved',
      workspaceId: 'workspace-completion-partial',
      rootId: 'root-completion-partial',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-partial',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-partial',
      title: 'Step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const closedQuestionNode = createNode({
      type: 'question',
      id: 'question-partial-closed',
      title: '已闭环问题',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const openQuestionNode = createNode({
      type: 'question',
      id: 'question-partial-open',
      title: '未闭环问题',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const answerNode = createNode({
      type: 'answer',
      id: 'answer-partial',
      title: '回答',
      content: '这个问题已经回答。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const judgmentNode = createNode({
      type: 'judgment',
      id: 'judgment-partial',
      title: '步骤判断',
      content: '已有阶段性判断。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-partial', planStepNode);
    tree = insertChildNode(tree, 'plan-step-partial', closedQuestionNode);
    tree = insertChildNode(tree, 'plan-step-partial', openQuestionNode);
    tree = insertChildNode(tree, 'question-partial-closed', answerNode);
    tree = insertChildNode(tree, 'plan-step-partial', judgmentNode);

    const result = suggestPlanStepCompletion(tree, 'plan-step-partial');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.answeredQuestionCount).toBe(1);
    expect(result.evidence.directClosureCount).toBe(1);
    expect(result.evidence.unresolvedQuestionTitles).toEqual(['未闭环问题']);
    expect(result.reasonSummary).toContain('仍有未闭环问题');
  });

  it('does not treat direct summary or judgment as question closure', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Completion direct closure only',
      workspaceId: 'workspace-completion-direct-only',
      rootId: 'root-completion-direct-only',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-direct-only',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-direct-only',
      title: 'Step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-direct-only',
      title: '还没有回答的问题',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const summaryNode = createNode({
      type: 'summary',
      id: 'summary-direct-only',
      title: '步骤总结',
      content: '先给一个总结。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const judgmentNode = createNode({
      type: 'judgment',
      id: 'judgment-direct-only',
      title: '步骤判断',
      content: '先给一个判断。',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-direct-only', planStepNode);
    tree = insertChildNode(tree, 'plan-step-direct-only', questionNode);
    tree = insertChildNode(tree, 'plan-step-direct-only', summaryNode);
    tree = insertChildNode(tree, 'plan-step-direct-only', judgmentNode);

    const result = suggestPlanStepCompletion(tree, 'plan-step-direct-only');

    expect(result.shouldSuggestComplete).toBe(false);
    expect(result.evidence.answeredQuestionCount).toBe(0);
    expect(result.evidence.directClosureCount).toBe(2);
    expect(result.evidence.unresolvedQuestionTitles).toEqual([
      '还没有回答的问题',
    ]);
    expect(result.reasonSummary).toContain('仍有未闭环问题');
  });
});
