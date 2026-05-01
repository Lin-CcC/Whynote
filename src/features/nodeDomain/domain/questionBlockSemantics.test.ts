import {
  buildQuestionBlockData,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
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
