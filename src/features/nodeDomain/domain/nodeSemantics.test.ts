import {
  createNode,
  createWorkspaceSnapshot,
  getDisplayNodeTitle,
  getDisplayNodeTypeLabel,
  insertChildNode,
  isAnswerClosureSummaryNode,
  isScaffoldSummaryNode,
  stripRedundantDisplayTypePrefix,
} from '..';

test('treats plan-step summaries before the first question as scaffold introductions', () => {
  const tree = createSemanticsSnapshot().tree;

  expect(isScaffoldSummaryNode(tree, 'summary-introduction')).toBe(true);
  expect(getDisplayNodeTypeLabel(tree, tree.nodes['summary-introduction']!)).toBe(
    '铺垫',
  );
});

test('treats post-judgment summaries as answer explanations', () => {
  const tree = createSemanticsSnapshot().tree;

  expect(isAnswerClosureSummaryNode(tree, 'summary-closure')).toBe(true);
  expect(isScaffoldSummaryNode(tree, 'summary-closure')).toBe(false);
  expect(getDisplayNodeTypeLabel(tree, tree.nodes['summary-closure']!)).toBe(
    '答案解析',
  );
});

test('treats manually inserted question summaries as answer explanations even before a judgment exists', () => {
  const tree = createManualSummaryFirstSnapshot().tree;

  expect(isAnswerClosureSummaryNode(tree, 'summary-manual-first')).toBe(true);
  expect(
    getDisplayNodeTypeLabel(tree, tree.nodes['summary-manual-first']!),
  ).toBe('答案解析');
});

test('strips only the redundant type prefix from display titles when the label is already visible', () => {
  const tree = createSemanticsSnapshot().tree;

  expect(getDisplayNodeTitle(tree, tree.nodes['summary-introduction']!)).toBe(
    '先建立前置理解',
  );
  expect(getDisplayNodeTitle(tree, tree.nodes['question-semantics']!)).toBe(
    '从参数到学习：AI 的物理基础',
  );
  expect(getDisplayNodeTitle(tree, tree.nodes['answer-semantics']!)).toBe(
    '第一版理解',
  );
  expect(getDisplayNodeTitle(tree, tree.nodes['judgment-semantics']!)).toBe(
    '还差一点',
  );
  expect(getDisplayNodeTitle(tree, tree.nodes['summary-closure']!)).toBe(
    '标准理解',
  );
});

test('keeps body colons intact when they are not a redundant type prefix', () => {
  expect(
    stripRedundantDisplayTypePrefix('从参数到学习：AI 的物理基础', '铺垫'),
  ).toBe('从参数到学习：AI 的物理基础');
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
      title: '问题：从参数到学习：AI 的物理基础',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-semantics',
    createNode({
      type: 'answer',
      id: 'answer-semantics',
      title: '回答：第一版理解',
      content: '先给出一版回答。',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-semantics',
    createNode({
      type: 'judgment',
      id: 'judgment-semantics',
      title: '判断：还差一点',
      content: '还缺一个关键因果关系。',
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
      title: '答案解析：标准理解',
      content: '这是答题后的答案解析。',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createManualSummaryFirstSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: '手动答案解析语义',
    workspaceId: 'workspace-semantics-manual-summary',
    rootId: 'theme-semantics-manual-summary',
    createdAt: '2026-04-27T12:30:00.000Z',
    updatedAt: '2026-04-27T12:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-summary',
      title: '手动语义模块',
      createdAt: '2026-04-27T12:30:00.000Z',
      updatedAt: '2026-04-27T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-summary',
    createNode({
      type: 'plan-step',
      id: 'step-manual-summary',
      title: '手动语义步骤',
      status: 'todo',
      createdAt: '2026-04-27T12:30:00.000Z',
      updatedAt: '2026-04-27T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-summary',
    createNode({
      type: 'question',
      id: 'question-manual-summary',
      title: '手动问题',
      createdAt: '2026-04-27T12:30:00.000Z',
      updatedAt: '2026-04-27T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-manual-summary',
    createNode({
      type: 'answer',
      id: 'answer-manual-summary',
      title: '手动回答',
      content: '先给出一版手动回答。',
      createdAt: '2026-04-27T12:30:00.000Z',
      updatedAt: '2026-04-27T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-manual-summary',
    createNode({
      type: 'summary',
      id: 'summary-manual-first',
      title: '手动标准理解',
      content: '这是用户先手动补的答案解析。',
      createdAt: '2026-04-27T12:30:00.000Z',
      updatedAt: '2026-04-27T12:30:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
