import {
  buildQuestionBlockData,
  createNode,
  createWorkspaceSnapshot,
  isAnswerClosureResultNodeStale,
  isSummaryCheckJudgmentNodeStale,
  insertChildNode,
  moveAnswerGroup,
  moveStructureMapNode,
  moveSummaryGroup,
  resolveQuestionCurrentAnswerNodeId,
} from '..';

test('question block falls back to the latest filled legacy answer', () => {
  const tree = createLegacyQuestionSnapshot({
    answerDrafts: [
      {
        content: 'first answer',
        id: 'answer-legacy-question-block-v1',
        title: 'answer v1',
      },
      {
        content: 'second answer',
        id: 'answer-legacy-question-block-v2',
        title: 'answer v2',
      },
      {
        content: '',
        id: 'answer-legacy-question-block-v3',
        title: 'answer v3 draft',
      },
    ],
    createdAt: '2026-04-30T12:00:00.000Z',
    moduleId: 'module-legacy-question-block-filled',
    moduleTitle: 'module',
    questionId: 'question-legacy-question-block-filled',
    questionTitle: 'legacy question',
    rootId: 'theme-legacy-question-block-filled',
    workspaceId: 'workspace-legacy-question-block-filled',
    workspaceTitle: 'legacy question block filled',
  });

  expect(resolveQuestionCurrentAnswerNodeId(tree, 'question-legacy-question-block-filled')).toBe(
    'answer-legacy-question-block-v2',
  );
  expect(
    buildQuestionBlockData(tree, 'question-legacy-question-block-filled').currentAnswerNodeId,
  ).toBe('answer-legacy-question-block-v2');
});

test('question block keeps currentAnswerNodeId empty when legacy questions only contain empty answers', () => {
  const tree = createLegacyQuestionSnapshot({
    answerDrafts: [
      {
        content: '   ',
        id: 'answer-legacy-question-block-empty-v1',
        title: 'answer v1 draft',
      },
      {
        content: '',
        id: 'answer-legacy-question-block-empty-v2',
        title: 'answer v2 draft',
      },
    ],
    createdAt: '2026-04-30T12:10:00.000Z',
    moduleId: 'module-legacy-question-block-empty',
    moduleTitle: 'module',
    questionId: 'question-legacy-question-block-empty',
    questionTitle: 'legacy empty question',
    rootId: 'theme-legacy-question-block-empty',
    workspaceId: 'workspace-legacy-question-block-empty',
    workspaceTitle: 'legacy question block empty',
  });
  const questionBlock = buildQuestionBlockData(tree, 'question-legacy-question-block-empty');

  expect(resolveQuestionCurrentAnswerNodeId(tree, 'question-legacy-question-block-empty')).toBe(
    null,
  );
  expect(questionBlock.currentAnswerNodeId).toBe(null);
  expect(questionBlock.answerGroups.map((group) => group.answer.id)).toEqual([
    'answer-legacy-question-block-empty-v1',
    'answer-legacy-question-block-empty-v2',
  ]);
});

test('question block keeps empty currentAnswerNodeId behavior when legacy questions have no answers', () => {
  const tree = createLegacyQuestionSnapshot({
    answerDrafts: [],
    createdAt: '2026-04-30T12:20:00.000Z',
    moduleId: 'module-legacy-question-block-none',
    moduleTitle: 'module',
    questionId: 'question-legacy-question-block-none',
    questionTitle: 'legacy question without answers',
    rootId: 'theme-legacy-question-block-none',
    workspaceId: 'workspace-legacy-question-block-none',
    workspaceTitle: 'legacy question block none',
  });
  const questionBlock = buildQuestionBlockData(tree, 'question-legacy-question-block-none');

  expect(resolveQuestionCurrentAnswerNodeId(tree, 'question-legacy-question-block-none')).toBe(
    null,
  );
  expect(questionBlock.currentAnswerNodeId).toBe(null);
  expect(questionBlock.answerGroups).toEqual([]);
});

test('reorders follow-up questions only within their original parent question', () => {
  const tree = createStructureMapQuestionSnapshot();

  const moved = moveStructureMapNode(tree, {
    index: 0,
    nodeId: 'question-follow-up-structure-map',
    targetParentNodeId: 'question-structure-map',
  });

  expect(getQuestionBlockEntryAnchorIds(moved, 'question-structure-map')).toEqual([
    'question-follow-up-structure-map',
    'answer-structure-map-v1',
    'answer-structure-map-v2',
    'summary-structure-map-manual',
  ]);
  expect(() =>
    moveStructureMapNode(tree, {
      index: 0,
      nodeId: 'question-follow-up-structure-map',
      targetParentNodeId: 'question-structure-map-peer',
    }),
  ).toThrow(/original parent question/i);
});

test('reorders answer groups within a question while keeping closure nodes paired and not stale', () => {
  const tree = createStructureMapQuestionSnapshot();
  const originalAnswerNode = tree.nodes['answer-structure-map-v1'];

  if (originalAnswerNode?.type !== 'answer') {
    throw new Error('Expected answer-structure-map-v1 to be an answer node.');
  }

  const moved = moveAnswerGroup(tree, 'answer-structure-map-v1', 4);

  expect(getQuestionBlockEntryAnchorIds(moved, 'question-structure-map')).toEqual([
    'question-follow-up-structure-map',
    'answer-structure-map-v2',
    'summary-structure-map-manual',
    'answer-structure-map-v1',
  ]);
  expect(moved.nodes['question-structure-map']).toMatchObject({
    type: 'question',
    currentAnswerId: 'answer-structure-map-v2',
    childIds: [
      'question-follow-up-structure-map',
      'answer-structure-map-v2',
      'judgment-structure-map-v2',
      'summary-structure-map-v2',
      'summary-structure-map-manual',
      'judgment-structure-map-summary',
      'answer-structure-map-v1',
      'judgment-structure-map-v1',
      'summary-structure-map-v1',
    ],
  });
  expect(moved.nodes['answer-structure-map-v1']).toMatchObject({
    type: 'answer',
    updatedAt: originalAnswerNode.updatedAt,
  });
  expect(moved.nodes['judgment-structure-map-v1']).toMatchObject({
    type: 'judgment',
    sourceAnswerId: 'answer-structure-map-v1',
    sourceAnswerUpdatedAt: originalAnswerNode.updatedAt,
  });
  expect(moved.nodes['summary-structure-map-v1']).toMatchObject({
    type: 'summary',
    sourceAnswerId: 'answer-structure-map-v1',
    sourceAnswerUpdatedAt: originalAnswerNode.updatedAt,
  });
  expect(isAnswerClosureResultNodeStale(moved, 'judgment-structure-map-v1')).toBe(
    false,
  );
  expect(isAnswerClosureResultNodeStale(moved, 'summary-structure-map-v1')).toBe(
    false,
  );
});

test('reorders manual summary groups within a question while keeping summary checks paired and not stale', () => {
  const tree = createStructureMapQuestionSnapshot();
  const originalSummaryNode = tree.nodes['summary-structure-map-manual'];

  if (originalSummaryNode?.type !== 'summary') {
    throw new Error('Expected summary-structure-map-manual to be a summary node.');
  }

  const moved = moveSummaryGroup(tree, 'summary-structure-map-manual', 0);

  expect(getQuestionBlockEntryAnchorIds(moved, 'question-structure-map')).toEqual([
    'summary-structure-map-manual',
    'answer-structure-map-v1',
    'question-follow-up-structure-map',
    'answer-structure-map-v2',
  ]);
  expect(moved.nodes['question-structure-map']).toMatchObject({
    type: 'question',
    currentAnswerId: 'answer-structure-map-v2',
    childIds: [
      'summary-structure-map-manual',
      'judgment-structure-map-summary',
      'answer-structure-map-v1',
      'judgment-structure-map-v1',
      'summary-structure-map-v1',
      'question-follow-up-structure-map',
      'answer-structure-map-v2',
      'judgment-structure-map-v2',
      'summary-structure-map-v2',
    ],
  });
  expect(moved.nodes['summary-structure-map-manual']).toMatchObject({
    type: 'summary',
    updatedAt: originalSummaryNode.updatedAt,
  });
  expect(moved.nodes['judgment-structure-map-summary']).toMatchObject({
    type: 'judgment',
    sourceSummaryId: 'summary-structure-map-manual',
    sourceSummaryUpdatedAt: originalSummaryNode.updatedAt,
  });
  expect(
    isSummaryCheckJudgmentNodeStale(moved, 'judgment-structure-map-summary'),
  ).toBe(false);
});

function createLegacyQuestionSnapshot(options: {
  answerDrafts: Array<{
    content: string;
    id: string;
    title: string;
  }>;
  createdAt: string;
  moduleId: string;
  moduleTitle: string;
  questionId: string;
  questionTitle: string;
  rootId: string;
  workspaceId: string;
  workspaceTitle: string;
}) {
  const snapshot = createWorkspaceSnapshot({
    title: options.workspaceTitle,
    workspaceId: options.workspaceId,
    rootId: options.rootId,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: options.moduleId,
      title: options.moduleTitle,
      createdAt: options.createdAt,
      updatedAt: options.createdAt,
    }),
  );
  tree = insertChildNode(
    tree,
    options.moduleId,
    createNode({
      type: 'question',
      id: options.questionId,
      title: options.questionTitle,
      createdAt: options.createdAt,
      updatedAt: options.createdAt,
    }),
  );

  for (const answerDraft of options.answerDrafts) {
    tree = insertChildNode(
      tree,
      options.questionId,
      createNode({
        type: 'answer',
        id: answerDraft.id,
        title: answerDraft.title,
        content: answerDraft.content,
        createdAt: options.createdAt,
        updatedAt: options.createdAt,
      }),
    );
  }

  const questionNode = tree.nodes[options.questionId];

  if (questionNode?.type === 'question') {
    delete questionNode.currentAnswerId;
  }

  return tree;
}

function createStructureMapQuestionSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    title: 'structure map question block',
    workspaceId: 'workspace-structure-map-question-block',
    rootId: 'theme-structure-map-question-block',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-structure-map-question-block',
      title: 'module',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-structure-map-question-block',
    createNode({
      type: 'plan-step',
      id: 'step-structure-map-question-block',
      title: 'step',
      status: 'doing',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-question-block',
    createNode({
      type: 'question',
      id: 'question-structure-map',
      title: 'question',
      currentAnswerId: 'answer-structure-map-v2',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'answer',
      id: 'answer-structure-map-v1',
      title: 'answer v1',
      content: 'answer v1',
      createdAt: '2026-05-01T08:01:00.000Z',
      updatedAt: '2026-05-01T08:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'judgment',
      id: 'judgment-structure-map-v1',
      title: 'judgment v1',
      content: 'judgment v1',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-v1',
      sourceAnswerUpdatedAt: '2026-05-01T08:01:00.000Z',
      createdAt: '2026-05-01T08:02:00.000Z',
      updatedAt: '2026-05-01T08:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-v1',
      title: 'summary v1',
      content: 'summary v1',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-v1',
      sourceAnswerUpdatedAt: '2026-05-01T08:01:00.000Z',
      createdAt: '2026-05-01T08:03:00.000Z',
      updatedAt: '2026-05-01T08:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'question',
      id: 'question-follow-up-structure-map',
      title: 'follow-up',
      createdAt: '2026-05-01T08:04:00.000Z',
      updatedAt: '2026-05-01T08:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'answer',
      id: 'answer-structure-map-v2',
      title: 'answer v2',
      content: 'answer v2',
      createdAt: '2026-05-01T08:05:00.000Z',
      updatedAt: '2026-05-01T08:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'judgment',
      id: 'judgment-structure-map-v2',
      title: 'judgment v2',
      content: 'judgment v2',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-v2',
      sourceAnswerUpdatedAt: '2026-05-01T08:05:00.000Z',
      createdAt: '2026-05-01T08:06:00.000Z',
      updatedAt: '2026-05-01T08:06:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-v2',
      title: 'summary v2',
      content: 'summary v2',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-structure-map-v2',
      sourceAnswerUpdatedAt: '2026-05-01T08:05:00.000Z',
      createdAt: '2026-05-01T08:07:00.000Z',
      updatedAt: '2026-05-01T08:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'summary',
      id: 'summary-structure-map-manual',
      title: 'manual summary',
      content: 'manual summary',
      summaryKind: 'manual',
      createdAt: '2026-05-01T08:08:00.000Z',
      updatedAt: '2026-05-01T08:08:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-structure-map',
    createNode({
      type: 'judgment',
      id: 'judgment-structure-map-summary',
      title: 'summary check',
      content: 'summary check',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-structure-map-v2',
      sourceAnswerUpdatedAt: '2026-05-01T08:05:00.000Z',
      sourceSummaryId: 'summary-structure-map-manual',
      sourceSummaryUpdatedAt: '2026-05-01T08:08:00.000Z',
      createdAt: '2026-05-01T08:09:00.000Z',
      updatedAt: '2026-05-01T08:09:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-structure-map-question-block',
    createNode({
      type: 'question',
      id: 'question-structure-map-peer',
      title: 'peer question',
      createdAt: '2026-05-01T08:10:00.000Z',
      updatedAt: '2026-05-01T08:10:00.000Z',
    }),
  );

  return syncStructureMapQuestionSourceTimestamps(tree);
}

function getQuestionBlockEntryAnchorIds(
  tree: ReturnType<typeof createStructureMapQuestionSnapshot>,
  questionNodeId: string,
) {
  return buildQuestionBlockData(tree, questionNodeId).entries.map((entry) => {
    if (entry.type === 'answer-group') {
      return entry.group.answer.id;
    }

    if (entry.type === 'summary-group') {
      return entry.group.summary.id;
    }

    return entry.node.id;
  });
}

function syncStructureMapQuestionSourceTimestamps(
  tree: ReturnType<typeof createLegacyQuestionSnapshot>,
) {
  const answerV1 = tree.nodes['answer-structure-map-v1'];
  const answerV2 = tree.nodes['answer-structure-map-v2'];
  const manualSummary = tree.nodes['summary-structure-map-manual'];
  const judgmentV1 = tree.nodes['judgment-structure-map-v1'];
  const summaryV1 = tree.nodes['summary-structure-map-v1'];
  const judgmentV2 = tree.nodes['judgment-structure-map-v2'];
  const summaryV2 = tree.nodes['summary-structure-map-v2'];
  const summaryCheck = tree.nodes['judgment-structure-map-summary'];

  if (
    answerV1?.type !== 'answer' ||
    answerV2?.type !== 'answer' ||
    manualSummary?.type !== 'summary' ||
    judgmentV1?.type !== 'judgment' ||
    summaryV1?.type !== 'summary' ||
    judgmentV2?.type !== 'judgment' ||
    summaryV2?.type !== 'summary' ||
    summaryCheck?.type !== 'judgment'
  ) {
    throw new Error('Expected structure-map question fixture nodes to exist.');
  }

  judgmentV1.sourceAnswerUpdatedAt = answerV1.updatedAt;
  summaryV1.sourceAnswerUpdatedAt = answerV1.updatedAt;
  judgmentV2.sourceAnswerUpdatedAt = answerV2.updatedAt;
  summaryV2.sourceAnswerUpdatedAt = answerV2.updatedAt;
  summaryCheck.sourceAnswerUpdatedAt = answerV2.updatedAt;
  summaryCheck.sourceSummaryUpdatedAt = manualSummary.updatedAt;

  return tree;
}
