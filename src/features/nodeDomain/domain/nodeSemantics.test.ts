import {
  createNode,
  createWorkspaceSnapshot,
  getCurrentQuestionAnswerNodeId,
  getJudgmentNodeKind,
  getDisplayNodeTitle,
  getDisplayNodeTypeLabel,
  getQuestionAnswerClosureSummaryNodeId,
  getQuestionSummaryCheckJudgmentNodeId,
  getSummaryNodeKind,
  isAnswerClosureResultNodeStale,
  insertChildNode,
  isAnswerClosureSummaryNode,
  moveScaffoldWithinStep,
  moveStructureMapNode,
  isScaffoldSummaryNode,
  isSummaryCheckJudgmentNodeStale,
  isSummaryCheckJudgmentNode,
  stripRedundantDisplayTypePrefix,
  validateStructureMapMove,
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

test('treats legacy question summaries without a preceding closure judgment as manual summaries', () => {
  const tree = createManualSummaryFirstSnapshot().tree;

  expect(getSummaryNodeKind(tree, 'summary-manual-first')).toBe('manual');
  expect(isAnswerClosureSummaryNode(tree, 'summary-manual-first')).toBe(false);
  expect(
    getDisplayNodeTypeLabel(tree, tree.nodes['summary-manual-first']!),
  ).toBe('总结');
});

test('treats explicitly manual summaries under question as summaries instead of answer explanations', () => {
  const tree = createExplicitManualSummarySnapshot().tree;

  expect(getSummaryNodeKind(tree, 'summary-manual-explicit')).toBe('manual');
  expect(isAnswerClosureSummaryNode(tree, 'summary-manual-explicit')).toBe(false);
  expect(getDisplayNodeTypeLabel(tree, tree.nodes['summary-manual-explicit']!)).toBe(
    '总结',
  );
});

test('treats explicitly marked summary-check judgments as a separate judgment kind', () => {
  const tree = createExplicitManualSummarySnapshot().tree;

  expect(getJudgmentNodeKind(tree, 'judgment-summary-check')).toBe('summary-check');
  expect(isSummaryCheckJudgmentNode(tree, 'judgment-summary-check')).toBe(true);
});

test('falls back to the latest filled answer when legacy questions do not have currentAnswerId', () => {
  const tree = createLegacyCurrentAnswerSnapshot().tree;

  expect(getCurrentQuestionAnswerNodeId(tree, 'question-legacy-current-answer')).toBe(
    'answer-legacy-current-answer-v2',
  );
});

test('does not synthesize a current answer when legacy questions only contain empty answers', () => {
  const tree = createLegacyEmptyAnswerOnlySnapshot().tree;

  expect(getCurrentQuestionAnswerNodeId(tree, 'question-legacy-empty-answer-only')).toBe(
    null,
  );
});

test('keeps current answer empty when legacy questions have no answers at all', () => {
  const tree = createLegacyNoAnswerSnapshot().tree;

  expect(getCurrentQuestionAnswerNodeId(tree, 'question-legacy-no-answer')).toBe(
    null,
  );
});

test('falls back to legacy sibling heuristics when explicit source fields are missing', () => {
  const tree = createLegacyClosurePairSnapshot().tree;

  expect(
    getQuestionAnswerClosureSummaryNodeId(
      tree,
      'question-legacy-closure-pair',
      'answer-legacy-closure-pair',
    ),
  ).toBe('summary-legacy-closure-pair');
  expect(
    getQuestionSummaryCheckJudgmentNodeId(
      tree,
      'question-legacy-closure-pair',
      'summary-legacy-manual',
    ),
  ).toBe('judgment-legacy-summary-check');
});

test('marks explicit answer-closure and summary-check results as stale after the source updates', () => {
  const snapshot = createExplicitSourcePairSnapshot();
  const tree = structuredClone(snapshot.tree);
  const answerNode = tree.nodes['answer-explicit-source-pair'];
  const summaryNode = tree.nodes['summary-manual-explicit-source-pair'];

  expect(answerNode?.type).toBe('answer');
  expect(summaryNode?.type).toBe('summary');

  if (answerNode?.type === 'answer') {
    answerNode.updatedAt = '2026-04-30T12:00:00.000Z';
  }

  if (summaryNode?.type === 'summary') {
    summaryNode.updatedAt = '2026-04-30T12:00:00.000Z';
  }

  expect(
    isAnswerClosureResultNodeStale(tree, 'judgment-explicit-answer-closure'),
  ).toBe(true);
  expect(
    isAnswerClosureResultNodeStale(tree, 'summary-explicit-answer-closure'),
  ).toBe(true);
  expect(
    isSummaryCheckJudgmentNodeStale(tree, 'judgment-explicit-summary-check'),
  ).toBe(true);
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

test('reorders plan steps within the same module in structure map mode', () => {
  const tree = createStructureMapSnapshot();

  const moved = moveStructureMapNode(tree, {
    index: 0,
    nodeId: 'step-structure-map-a2',
    targetParentNodeId: 'module-structure-map-a',
  });

  expect(moved.nodes['module-structure-map-a']).toMatchObject({
    type: 'module',
    childIds: ['step-structure-map-a2', 'step-structure-map-a1'],
  });
});

test('moves top-level question blocks within a step and across steps in the same module', () => {
  const tree = createStructureMapSnapshot();
  const reorderedWithinStep = moveStructureMapNode(tree, {
    index: 1,
    nodeId: 'question-structure-map-a2',
    targetParentNodeId: 'step-structure-map-a1',
  });

  expect(reorderedWithinStep.nodes['step-structure-map-a1']).toMatchObject({
    type: 'plan-step',
    childIds: [
      'summary-structure-map-scaffold-a1',
      'question-structure-map-a2',
      'question-structure-map-a1',
    ],
  });

  const movedAcrossSteps = moveStructureMapNode(reorderedWithinStep, {
    index: 0,
    nodeId: 'question-structure-map-a1',
    targetParentNodeId: 'step-structure-map-a2',
  });

  expect(movedAcrossSteps.nodes['question-structure-map-a1']).toMatchObject({
    type: 'question',
    parentId: 'step-structure-map-a2',
  });
  expect(movedAcrossSteps.nodes['step-structure-map-a2']).toMatchObject({
    type: 'plan-step',
    childIds: [
      'question-structure-map-a1',
      'question-structure-map-b1',
      'summary-structure-map-scaffold-a2',
    ],
  });
});

test('reorders scaffold summaries within a step without changing their scaffold semantics', () => {
  const tree = createStructureMapSnapshot();

  const moved = moveScaffoldWithinStep(
    tree,
    'summary-structure-map-scaffold-a2',
    0,
  );

  expect(moved.nodes['step-structure-map-a2']).toMatchObject({
    type: 'plan-step',
    childIds: [
      'summary-structure-map-scaffold-a2',
      'question-structure-map-b1',
    ],
  });
  expect(getSummaryNodeKind(moved, 'summary-structure-map-scaffold-a2')).toBe(
    'scaffold',
  );
});

test('rejects illegal structure map drop targets and standalone result nodes', () => {
  const tree = createStructureMapSnapshot();

  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'step-structure-map-a1',
      targetParentNodeId: tree.rootId,
    }),
  ).toMatchObject({
    allowed: false,
    code: 'ROOT_NOT_ALLOWED',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'question-structure-map-a1',
      targetParentNodeId: 'step-structure-map-b1',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'CROSS_MODULE',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'question-structure-map-a1',
      targetParentNodeId: 'resource-structure-map',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'RESOURCE_NOT_ALLOWED',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'answer-structure-map-current',
      targetParentNodeId: 'question-structure-map-b1',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'INVALID_PARENT_TYPE',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'question-structure-map-follow-up',
      targetParentNodeId: 'question-structure-map-b1',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'FOLLOW_UP_PARENT_LOCKED',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'summary-structure-map-answer-result',
      targetParentNodeId: 'question-structure-map-a1',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'RESULT_NODE_SINGLETON',
  });
  expect(
    validateStructureMapMove(tree, {
      index: 0,
      nodeId: 'judgment-structure-map-summary-result',
      targetParentNodeId: 'question-structure-map-a1',
    }),
  ).toMatchObject({
    allowed: false,
    code: 'RESULT_NODE_SINGLETON',
  });
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
      hint: '先把“为什么会减少重复渲染”这层因果链条补完整。',
      judgmentKind: 'answer-closure',
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
      summaryKind: 'answer-closure',
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

function createExplicitManualSummarySnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: '显式手写总结语义',
    workspaceId: 'workspace-semantics-explicit-manual-summary',
    rootId: 'theme-semantics-explicit-manual-summary',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-explicit-manual-summary',
      title: '显式手写总结模块',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-explicit-manual-summary',
    createNode({
      type: 'plan-step',
      id: 'step-explicit-manual-summary',
      title: '显式手写总结步骤',
      status: 'doing',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-explicit-manual-summary',
    createNode({
      type: 'question',
      id: 'question-explicit-manual-summary',
      title: '显式手写总结问题',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-manual-summary',
    createNode({
      type: 'summary',
      id: 'summary-manual-explicit',
      title: '我的手写总结',
      content: '这是用户自己写的总结。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-manual-summary',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-check',
      title: '判断：总结还可再补',
      content: '这是针对 summary 的理解检查结果。',
      judgmentKind: 'summary-check',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createLegacyCurrentAnswerSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'legacy current answer',
    workspaceId: 'workspace-legacy-current-answer',
    rootId: 'theme-legacy-current-answer',
    createdAt: '2026-04-30T10:00:00.000Z',
    updatedAt: '2026-04-30T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-current-answer',
      title: 'module',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-current-answer',
    createNode({
      type: 'question',
      id: 'question-legacy-current-answer',
      title: 'legacy question',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-current-answer',
    createNode({
      type: 'answer',
      id: 'answer-legacy-current-answer-v1',
      title: 'answer v1',
      content: 'first answer',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-current-answer',
    createNode({
      type: 'answer',
      id: 'answer-legacy-current-answer-v2',
      title: 'answer v2',
      content: 'second answer',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-current-answer',
    createNode({
      type: 'answer',
      id: 'answer-legacy-current-answer-v3',
      title: 'answer v3 draft',
      content: '',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );

  const questionNode = tree.nodes['question-legacy-current-answer'];

  if (questionNode?.type === 'question') {
    delete questionNode.currentAnswerId;
  }

  return {
    ...snapshot,
    tree,
  };
}

function createLegacyClosurePairSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'legacy closure pair',
    workspaceId: 'workspace-legacy-closure-pair',
    rootId: 'theme-legacy-closure-pair',
    createdAt: '2026-04-30T10:30:00.000Z',
    updatedAt: '2026-04-30T10:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-closure-pair',
      title: 'module',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-closure-pair',
    createNode({
      type: 'question',
      id: 'question-legacy-closure-pair',
      title: 'question',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-closure-pair',
    createNode({
      type: 'answer',
      id: 'answer-legacy-closure-pair',
      title: 'answer',
      content: 'answer',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-closure-pair',
    createNode({
      type: 'judgment',
      id: 'judgment-legacy-closure-pair',
      title: 'closure judgment',
      content: 'needs more detail',
      hint: 'legacy closure hint',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-closure-pair',
    createNode({
      type: 'summary',
      id: 'summary-legacy-closure-pair',
      title: 'closure summary',
      content: 'closure summary',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-closure-pair',
    createNode({
      type: 'summary',
      id: 'summary-legacy-manual',
      title: 'manual summary',
      content: 'manual summary',
      summaryKind: 'manual',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-closure-pair',
    createNode({
      type: 'judgment',
      id: 'judgment-legacy-summary-check',
      title: 'summary check judgment',
      content: 'summary check',
      judgmentKind: 'summary-check',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createLegacyEmptyAnswerOnlySnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'legacy empty answer only',
    workspaceId: 'workspace-legacy-empty-answer-only',
    rootId: 'theme-legacy-empty-answer-only',
    createdAt: '2026-04-30T10:15:00.000Z',
    updatedAt: '2026-04-30T10:15:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-empty-answer-only',
      title: 'module',
      createdAt: '2026-04-30T10:15:00.000Z',
      updatedAt: '2026-04-30T10:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-empty-answer-only',
    createNode({
      type: 'question',
      id: 'question-legacy-empty-answer-only',
      title: 'legacy empty question',
      createdAt: '2026-04-30T10:15:00.000Z',
      updatedAt: '2026-04-30T10:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-empty-answer-only',
    createNode({
      type: 'answer',
      id: 'answer-legacy-empty-answer-only-v1',
      title: 'answer v1 draft',
      content: '   ',
      createdAt: '2026-04-30T10:15:00.000Z',
      updatedAt: '2026-04-30T10:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-empty-answer-only',
    createNode({
      type: 'answer',
      id: 'answer-legacy-empty-answer-only-v2',
      title: 'answer v2 draft',
      content: '',
      createdAt: '2026-04-30T10:15:00.000Z',
      updatedAt: '2026-04-30T10:15:00.000Z',
    }),
  );

  const questionNode = tree.nodes['question-legacy-empty-answer-only'];

  if (questionNode?.type === 'question') {
    delete questionNode.currentAnswerId;
  }

  return {
    ...snapshot,
    tree,
  };
}

function createLegacyNoAnswerSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'legacy no answer',
    workspaceId: 'workspace-legacy-no-answer',
    rootId: 'theme-legacy-no-answer',
    createdAt: '2026-04-30T10:20:00.000Z',
    updatedAt: '2026-04-30T10:20:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-no-answer',
      title: 'module',
      createdAt: '2026-04-30T10:20:00.000Z',
      updatedAt: '2026-04-30T10:20:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-no-answer',
    createNode({
      type: 'question',
      id: 'question-legacy-no-answer',
      title: 'legacy question without answers',
      createdAt: '2026-04-30T10:20:00.000Z',
      updatedAt: '2026-04-30T10:20:00.000Z',
    }),
  );

  const questionNode = tree.nodes['question-legacy-no-answer'];

  if (questionNode?.type === 'question') {
    delete questionNode.currentAnswerId;
  }

  return {
    ...snapshot,
    tree,
  };
}

function createExplicitSourcePairSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'explicit source pair',
    workspaceId: 'workspace-explicit-source-pair',
    rootId: 'theme-explicit-source-pair',
    createdAt: '2026-04-30T11:00:00.000Z',
    updatedAt: '2026-04-30T11:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-explicit-source-pair',
      title: 'module',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-explicit-source-pair',
    createNode({
      type: 'question',
      id: 'question-explicit-source-pair',
      title: 'question',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-source-pair',
    createNode({
      type: 'answer',
      id: 'answer-explicit-source-pair',
      title: 'answer',
      content: 'answer',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-source-pair',
    createNode({
      type: 'judgment',
      id: 'judgment-explicit-answer-closure',
      title: 'closure judgment',
      content: 'closure judgment',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-explicit-source-pair',
      sourceAnswerUpdatedAt: '2026-04-30T11:00:00.000Z',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-source-pair',
    createNode({
      type: 'summary',
      id: 'summary-explicit-answer-closure',
      title: 'closure summary',
      content: 'closure summary',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-explicit-source-pair',
      sourceAnswerUpdatedAt: '2026-04-30T11:00:00.000Z',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-source-pair',
    createNode({
      type: 'summary',
      id: 'summary-manual-explicit-source-pair',
      title: 'manual summary',
      content: 'manual summary',
      summaryKind: 'manual',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-explicit-source-pair',
    createNode({
      type: 'judgment',
      id: 'judgment-explicit-summary-check',
      title: 'summary check judgment',
      content: 'summary check judgment',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-explicit-source-pair',
      sourceAnswerUpdatedAt: '2026-04-30T11:00:00.000Z',
      sourceSummaryId: 'summary-manual-explicit-source-pair',
      sourceSummaryUpdatedAt: '2026-04-30T11:00:00.000Z',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createStructureMapSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'structure map',
    workspaceId: 'workspace-structure-map',
    rootId: 'theme-structure-map',
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-05-01T09:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-structure-map-a',
      title: 'module a',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-structure-map-b',
      title: 'module b',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-structure-map',
      title: 'resource',
      sourceUri: 'file:///structure-map.md',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-structure-map-a',
    createNode({
      type: 'plan-step',
      id: 'step-structure-map-a1',
      title: 'step a1',
      status: 'doing',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-structure-map-a',
    createNode({
      type: 'plan-step',
      id: 'step-structure-map-a2',
      title: 'step a2',
      status: 'todo',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-structure-map-b',
    createNode({
      type: 'plan-step',
      id: 'step-structure-map-b1',
      title: 'step b1',
      status: 'doing',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-a1',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-scaffold-a1',
      title: 'scaffold a1',
      content: 'scaffold a1',
      summaryKind: 'scaffold',
      createdAt: '2026-05-01T09:01:00.000Z',
      updatedAt: '2026-05-01T09:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-a1',
    createNode({
      type: 'question',
      id: 'question-structure-map-a1',
      title: 'question a1',
      createdAt: '2026-05-01T09:02:00.000Z',
      updatedAt: '2026-05-01T09:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-a1',
    createNode({
      type: 'question',
      id: 'question-structure-map-a2',
      title: 'question a2',
      createdAt: '2026-05-01T09:03:00.000Z',
      updatedAt: '2026-05-01T09:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-a2',
    createNode({
      type: 'question',
      id: 'question-structure-map-b1',
      title: 'question b1',
      createdAt: '2026-05-01T09:04:00.000Z',
      updatedAt: '2026-05-01T09:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-a2',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-scaffold-a2',
      title: 'scaffold a2',
      content: 'scaffold a2',
      summaryKind: 'scaffold',
      createdAt: '2026-05-01T09:05:00.000Z',
      updatedAt: '2026-05-01T09:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-b1',
    createNode({
      type: 'question',
      id: 'question-structure-map-c1',
      title: 'question c1',
      createdAt: '2026-05-01T09:06:00.000Z',
      updatedAt: '2026-05-01T09:06:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'answer',
      id: 'answer-structure-map-current',
      title: 'current answer',
      content: 'current answer',
      createdAt: '2026-05-01T09:07:00.000Z',
      updatedAt: '2026-05-01T09:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'judgment',
      id: 'judgment-structure-map-answer-result',
      title: 'answer result',
      content: 'answer result',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-current',
      sourceAnswerUpdatedAt: '2026-05-01T09:07:00.000Z',
      createdAt: '2026-05-01T09:08:00.000Z',
      updatedAt: '2026-05-01T09:08:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-answer-result',
      title: 'answer explanation',
      content: 'answer explanation',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-current',
      sourceAnswerUpdatedAt: '2026-05-01T09:07:00.000Z',
      createdAt: '2026-05-01T09:09:00.000Z',
      updatedAt: '2026-05-01T09:09:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'question',
      id: 'question-structure-map-follow-up',
      title: 'follow-up',
      createdAt: '2026-05-01T09:10:00.000Z',
      updatedAt: '2026-05-01T09:10:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-manual',
      title: 'manual summary',
      content: 'manual summary',
      summaryKind: 'manual',
      createdAt: '2026-05-01T09:11:00.000Z',
      updatedAt: '2026-05-01T09:11:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map-a1',
    createNode({
      type: 'judgment',
      id: 'judgment-structure-map-summary-result',
      title: 'summary result',
      content: 'summary result',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-structure-map-manual',
      sourceSummaryUpdatedAt: '2026-05-01T09:11:00.000Z',
      createdAt: '2026-05-01T09:12:00.000Z',
      updatedAt: '2026-05-01T09:12:00.000Z',
    }),
  );

  return tree;
}
