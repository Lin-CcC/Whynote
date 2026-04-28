import {
  createNode,
  createWorkspaceSnapshot,
  getDisplayNodeTypeLabel,
  insertChildNode,
  isAnswerClosureSummaryNode,
  isScaffoldSummaryNode,
} from '..';

test('treats plan-step summaries before the first question as scaffold introductions', () => {
  const tree = createSemanticsSnapshot().tree;

  expect(isScaffoldSummaryNode(tree, 'summary-introduction')).toBe(true);
  expect(getDisplayNodeTypeLabel(tree, tree.nodes['summary-introduction']!)).toBe(
    '铺垫',
  );
});

test('treats answer-phase summaries as answer explanations', () => {
  const tree = createSemanticsSnapshot().tree;

  expect(isAnswerClosureSummaryNode(tree, 'summary-closure')).toBe(true);
  expect(isScaffoldSummaryNode(tree, 'summary-closure')).toBe(false);
  expect(getDisplayNodeTypeLabel(tree, tree.nodes['summary-closure']!)).toBe(
    '答案解析',
  );
});

function createSemanticsSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: '语义测试',
    workspaceId: 'workspace-semantics',
    rootId: 'theme-semantics',
    createdAt: '2026-04-27T12:00:00.000Z',
    updatedAt: '2026-04-27T12:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-semantics',
      title: '模块',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-semantics',
    createNode({
      type: 'plan-step',
      id: 'step-semantics',
      title: '步骤',
      status: 'todo',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-semantics',
    createNode({
      type: 'summary',
      id: 'summary-introduction',
      title: '铺垫：先建立前置理解',
      content: '这是答题前的前置讲解。',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-semantics',
    createNode({
      type: 'question',
      id: 'question-semantics',
      title: '核心问题',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-semantics',
    createNode({
      type: 'summary',
      id: 'summary-closure',
      title: '总结：标准理解',
      content: '这是答题后的总结。',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
