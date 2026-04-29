import { expect, test } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
} from '../../nodeDomain';
import { resolveLearningActionPlacement } from './learningActions';

test('keeps AI/manual answers inside the selected question answer block before summary and judgment', () => {
  const snapshot = createWorkspaceSnapshot({
    title: 'Answer placement test',
    workspaceId: 'workspace-answer-placement',
    rootId: 'theme-answer-placement',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });
  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-answer-placement',
      title: '模块',
      content: '验证 answer 落点。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-answer-placement',
    createNode({
      type: 'plan-step',
      id: 'step-answer-placement',
      title: '步骤',
      content: '验证 question 下的 answer 区。',
      status: 'todo',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-placement',
    createNode({
      type: 'question',
      id: 'question-target',
      title: '目标问题',
      content: '这里要补新的 answer。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-target',
    createNode({
      type: 'question',
      id: 'follow-up-question',
      title: '先有追问',
      content: '追问不应把 answer 挤到别的问题里。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-target',
    createNode({
      type: 'summary',
      id: 'summary-after-answer',
      title: '已有答案解析',
      content: '新 answer 仍应插在这里之前。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-target',
    createNode({
      type: 'judgment',
      id: 'judgment-after-answer',
      title: '已有判断',
      content: '新 answer 也不应跑到 judgment 后面。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-placement',
    createNode({
      type: 'question',
      id: 'question-sibling',
      title: '另一个问题',
      content: 'answer 不能插到这里。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );

  const placement = resolveLearningActionPlacement(
    tree,
    'question-target',
    'insert-answer',
  );

  expect(placement).toEqual({
    insertIndex: 1,
    nodeType: 'answer',
    parentNodeId: 'question-target',
    title: '新回答',
  });
});

test('places a manually inserted summary at the end of the current question chain', () => {
  const snapshot = createWorkspaceSnapshot({
    title: 'Summary placement test',
    workspaceId: 'workspace-summary-placement',
    rootId: 'theme-summary-placement',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });
  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-summary-placement',
      title: '模块',
      content: '验证 summary 落点。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-summary-placement',
    createNode({
      type: 'plan-step',
      id: 'step-summary-placement',
      title: '步骤',
      content: '验证 question 闭环尾部。',
      status: 'todo',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-summary-placement',
    createNode({
      type: 'question',
      id: 'question-summary-placement',
      title: '目标问题',
      content: '这里要把手动总结放到链条末尾。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-placement',
    createNode({
      type: 'answer',
      id: 'answer-summary-placement',
      title: '已有回答',
      content: '先给一版回答。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-placement',
    createNode({
      type: 'question',
      id: 'follow-up-summary-placement',
      title: '追问',
      content: '后面还有追问。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-placement',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-placement',
      title: '已有判断',
      content: '链条末尾还有判断。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-placement',
    createNode({
      type: 'summary',
      id: 'summary-existing-tail',
      title: '已有总结',
      content: '之前已经有一条总结。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );

  const placement = resolveLearningActionPlacement(
    tree,
    'answer-summary-placement',
    'insert-summary',
  );

  expect(placement).toEqual({
    insertIndex: 4,
    nodeType: 'summary',
    parentNodeId: 'question-summary-placement',
    title: '新总结',
  });
});
