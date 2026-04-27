import { describe, expect, it } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
} from '../nodeDomain';
import { attachResourceCitation } from '../resourcesSearchExport/services/resourceCitationService';
import {
  reconcilePlanStepStatuses,
  resolvePlanStepRuntimeStatus,
} from './services';

describe('planStepRuntimeStatusService', () => {
  it('keeps a freshly planned step in todo when it only has introductions and question scaffolding', () => {
    const tree = createPlanStepTree({
      withIntroduction: true,
    });

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('todo');
    expect(result.reasonSummary).toContain('骨架阶段');
  });

  it('keeps a step in todo when only scaffold questions cite resources', () => {
    const tree = attachResourceCitation(
      createPlanStepTree({
        withIntroduction: true,
      }),
      {
        sourceNodeId: 'question-runtime-status',
        targetNodeId: 'resource-runtime-status',
      },
    ).tree;

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('todo');
    expect(result.evidence.referencedNodeCount).toBe(0);
  });

  it('moves a step to doing once post-answer learning evidence starts citing resources', () => {
    let tree = createPlanStepTree({
      withIntroduction: true,
    });

    tree = insertChildNode(
      tree,
      'question-runtime-status',
      createNode({
        type: 'answer',
        id: 'answer-runtime-status-cited',
        title: 'Answer',
        content: 'The learner answered and attached evidence.',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );
    tree = attachResourceCitation(tree, {
      sourceNodeId: 'answer-runtime-status-cited',
      targetNodeId: 'resource-runtime-status',
    }).tree;

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('doing');
    expect(result.evidence.referencedNodeCount).toBe(1);
  });

  it('moves a step to done when a leaf question has answer, judgment and summary', () => {
    let tree = createPlanStepTree({
      withIntroduction: true,
    });

    tree = insertChildNode(
      tree,
      'question-runtime-status',
      createNode({
        type: 'answer',
        id: 'answer-runtime-status',
        title: 'Answer',
        content: 'The learner answered the key question.',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-runtime-status',
      createNode({
        type: 'judgment',
        id: 'judgment-runtime-status',
        title: '判断：已答到当前问题',
        content: 'This answer is sufficient for the current question.',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-runtime-status',
      createNode({
        type: 'summary',
        id: 'summary-runtime-status',
        title: '总结：标准理解',
        content: 'The learner summarized the step clearly.',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('done');
    expect(result.reasonSummary).toBe('当前步骤已满足最小学习闭环。');
  });

  it('reconciles stale manual statuses back to the system-managed value', () => {
    const tree = createPlanStepTree({
      stepStatus: 'done',
      withIntroduction: true,
    });

    const reconciledTree = reconcilePlanStepStatuses(tree);
    const stepNode = reconciledTree.nodes['step-runtime-status'];

    expect(stepNode.type).toBe('plan-step');

    if (stepNode.type !== 'plan-step') {
      throw new Error('Expected reconciled node to remain a plan step.');
    }

    expect(stepNode.status).toBe('todo');
  });
});

function createPlanStepTree(options?: {
  stepStatus?: 'todo' | 'doing' | 'done';
  withIntroduction?: boolean;
}): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Runtime status',
    workspaceId: 'workspace-runtime-status',
    rootId: 'theme-runtime-status',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-runtime-status',
      title: 'Module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-runtime-status',
    createNode({
      type: 'plan-step',
      id: 'step-runtime-status',
      title: 'Step',
      status: options?.stepStatus ?? 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  if (options?.withIntroduction) {
    tree = insertChildNode(
      tree,
      'step-runtime-status',
      createNode({
        type: 'summary',
        id: 'intro-runtime-status',
        title: '铺垫：先看调用栈和任务队列',
        content: '这是进入当前问题前的前置讲解。',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );
  }

  tree = insertChildNode(
    tree,
    'step-runtime-status',
    createNode({
      type: 'question',
      id: 'question-runtime-status',
      title: 'Question',
      content: '',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-runtime-status',
      title: 'Resource',
      content: 'Resource summary',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}
