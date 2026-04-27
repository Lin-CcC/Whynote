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
  it('keeps a freshly planned step in todo when it only has question scaffolding', () => {
    const tree = createPlanStepTree();

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('todo');
    expect(result.reasonSummary).toContain('当前仍处于学习路径骨架阶段');
  });

  it('moves a step to doing once learning nodes start citing resources', () => {
    const tree = attachResourceCitation(createPlanStepTree(), {
      sourceNodeId: 'question-runtime-status',
      targetNodeId: 'resource-runtime-status',
    }).tree;

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('doing');
    expect(result.evidence.referencedNodeCount).toBe(1);
  });

  it('moves a step to done when closure evidence is complete', () => {
    let tree = createPlanStepTree();

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
      'step-runtime-status',
      createNode({
        type: 'summary',
        id: 'summary-runtime-status',
        title: 'Summary',
        content: 'The learner summarized the step clearly.',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      }),
    );

    const result = resolvePlanStepRuntimeStatus(tree, 'step-runtime-status');

    expect(result.suggestedStatus).toBe('done');
    expect(result.reasonSummary).toBe('当前步骤已具备完成信号。');
  });

  it('reconciles stale manual statuses back to the system-managed value', () => {
    const tree = createPlanStepTree('done');

    const reconciledTree = reconcilePlanStepStatuses(tree);
    const stepNode = reconciledTree.nodes['step-runtime-status'];

    expect(stepNode.type).toBe('plan-step');

    if (stepNode.type !== 'plan-step') {
      throw new Error('Expected reconciled node to remain a plan step.');
    }

    expect(stepNode.status).toBe('todo');
  });
});

function createPlanStepTree(stepStatus: 'todo' | 'doing' | 'done' = 'todo'): NodeTree {
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
      status: stepStatus,
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
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
