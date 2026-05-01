import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import type {
  AiConfig,
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from '../learningEngine';
import {
  createNode,
  createIndexedDbStorage,
  createLocalStorageStore,
  createWorkspaceSnapshot,
  insertChildNode,
  type StructuredDataStorage,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceRuntimeScreen from './WorkspaceRuntimeScreen';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

function getAnswerEvaluationCallout() {
  return screen.getByTestId('answer-evaluation-callout');
}

function getAnswerEvaluationButton() {
  return within(getAnswerEvaluationCallout()).getByRole('button', {
    name: '重新评估当前回答',
  });
}

function revealHistoryAnswer(nodeTestId: string) {
  const expandPreviousAnswersButton = screen.queryByRole('button', {
    name: '展开早期回答',
  });

  if (expandPreviousAnswersButton) {
    fireEvent.click(expandPreviousAnswersButton);
  }

  const answerNode = screen.getByTestId(nodeTestId);
  const expandBodyButton = within(answerNode).queryByRole('button', {
    name: '展开正文',
  });

  if (expandBodyButton) {
    fireEvent.click(expandBodyButton);
  }

  return answerNode;
}

test('evaluates an incomplete answer into judgment, summary and follow-up question with persisted citations', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：回答还不完整',
          content: '你还没有解释为什么更新会被批处理。',
          citations: [{ targetNodeId: 'resource-react-docs' }],
        },
        summary: {
          title: '标准理解',
          content:
            'React 会把同一轮事件中的多个状态更新合并后再统一提交，这样可以减少重复渲染。',
          citations: [{ targetNodeId: 'fragment-batching' }],
        },
        followUpQuestions: [
          {
            title: '追问：还缺哪一步因果关系？',
            content: '请只补上为什么会减少重复渲染。',
          },
        ],
      },
    }),
  );

  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByDisplayValue('为什么状态更新会被批处理？'));
  await waitFor(() => {
    expect(
      getAnswerEvaluationButton(),
    ).toBeEnabled();
  });
  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('回答还不完整'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('标准理解'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();
  expect(
    screen
      .getByDisplayValue('回答草稿')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
  expect(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '查看答案解析',
    }),
  ).toBeInTheDocument();

  const summaryNode = screen
    .getByDisplayValue('标准理解')
    .closest('[data-testid^="editor-node-"]');

  expect(summaryNode).not.toBeNull();
  expect(summaryNode).toHaveTextContent('答案解析');

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => findNodeByTitle(snapshot, '判断：回答还不完整') !== null,
  );
  const judgmentNode = findNodeByTitle(savedSnapshot, '判断：回答还不完整');
  const persistedSummaryNode = findNodeByTitle(savedSnapshot, '标准理解');
  const answerNode = savedSnapshot.tree.nodes['answer-answer-closure'];
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(judgmentNode?.referenceIds).toHaveLength(1);
  expect(persistedSummaryNode?.referenceIds).toHaveLength(1);
  expect(
    savedSnapshot.tree.references[judgmentNode!.referenceIds[0]].targetNodeId,
  ).toBe('resource-react-docs');
  expect(
    savedSnapshot.tree.references[persistedSummaryNode!.referenceIds[0]].targetNodeId,
  ).toBe('fragment-batching');
  expect(judgmentNode).toMatchObject({
    type: 'judgment',
    sourceAnswerId: 'answer-answer-closure',
    sourceAnswerUpdatedAt: answerNode?.updatedAt,
  });
  expect(persistedSummaryNode).toMatchObject({
    type: 'summary',
    sourceAnswerId: 'answer-answer-closure',
    sourceAnswerUpdatedAt: answerNode?.updatedAt,
  });
  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('doing');

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();
});

test('allows evaluating a leaf question while the answer node is selected', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：回答还不完整',
          content: '你还没有解释为什么更新会被批处理。',
        },
        summary: {
          title: '标准理解',
          content:
            'React 会把同一轮事件中的多个状态更新合并后再统一提交，这样可以减少重复渲染。',
        },
        followUpQuestions: [
          {
            title: '追问：还缺哪一步因果关系？',
            content: '请只补上为什么会减少重复渲染。',
          },
        ],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('回答草稿 标题'));
  await waitFor(() => {
    expect(
      getAnswerEvaluationButton(),
    ).toBeEnabled();
  });
  expect(screen.getByTestId('answer-evaluation-callout')).toHaveTextContent(
    '回答还可以直接继续修改，再决定是否重新评估。',
  );
  expect(screen.getByTestId('answer-evaluation-callout')).toHaveTextContent(
    '如果评估链还没闭合，优先补齐当前回答。',
  );
  expect(screen.getByTestId('answer-evaluation-callout')).toBeInTheDocument();

  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('回答还不完整'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '查看答案解析',
    }),
  ).toBeInTheDocument();
});

test('directly answers a hand-authored question and keeps the answer-revision path intact', async () => {
  let observedLearningActionPrompt = '';
  const dependencies = await createPreloadedDependencies(
    createManualQuestionDirectAnswerSnapshot(),
    createMockProviderClient({
      'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
        const userMessage = request.messages.find((message) => message.role === 'user');

        observedLearningActionPrompt = userMessage?.content ?? '';

        return {
          title: 'AI 回答草稿',
          content:
            '因为 React 会把同一轮里的更新先收集，再统一提交，所以界面不必为每次更新都单独重复渲染。',
        };
      },
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：AI 回答还可再补',
          content: '还需要把统一提交为什么会减少重复渲染这条因果链讲完整。',
        },
        summary: {
          title: '标准理解',
          content:
            '更稳妥的理解是：同一轮里的更新会先被收集，再统一提交，因此界面不需要为每次更新单独重复渲染。',
        },
        followUpQuestions: [],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('手动问题 标题'));

  const callout = await screen.findByTestId('question-direct-answer-callout');
  const directAnswerButton = within(callout).getByRole('button', {
    name: '直接回答当前问题',
  });
  const insertAnswerButton = within(callout).getByRole('button', {
    name: '插入回答',
  });

  expect(directAnswerButton).toHaveClass('workspace-primaryAction');
  expect(insertAnswerButton).not.toHaveClass('workspace-primaryAction');

  fireEvent.click(directAnswerButton);

  const answerTitleInput = await screen.findByDisplayValue('AI 回答草稿');

  expect(answerTitleInput.closest('[data-testid^="editor-node-"]')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
  expect(observedLearningActionPrompt).toContain('学习动作：insert-answer');
  expect(screen.getByTestId('answer-evaluation-callout')).toBeInTheDocument();

  await waitFor(() => {
    expect(
      getAnswerEvaluationButton(),
    ).toBeEnabled();
  });
  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('AI 回答还可再补'),
  ).toBeInTheDocument();
  expect(await screen.findByDisplayValue('标准理解')).toBeInTheDocument();

  fireEvent.click(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '查看答案解析',
    }),
  );

  expect(
    screen
      .getByDisplayValue('标准理解')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');

  fireEvent.click(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '回到当前回答继续修改',
    }),
  );
  expect(
    screen
      .getByDisplayValue('AI 回答草稿')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => findNodeByTitle(snapshot, 'AI 回答草稿') !== null,
  );
  const answerNode = findNodeByTitle(savedSnapshot, 'AI 回答草稿');
  const questionNode = savedSnapshot.tree.nodes['question-manual-direct-answer'];

  expect(answerNode?.type).toBe('answer');
  expect(answerNode?.parentId).toBe('question-manual-direct-answer');
  expect(questionNode).toMatchObject({
    type: 'question',
    currentAnswerId: answerNode?.id,
  });
});

test('directly answers a generated question without relying on question source', async () => {
  const dependencies = await createPreloadedDependencies(
    createGeneratedQuestionDirectAnswerSnapshot(),
    createMockProviderClient({
      'learning-action-draft': {
        title: '系统问题 AI 回答',
        content:
          '因为同一轮里的更新会被统一提交，所以界面不需要为每次状态变化都立刻重复渲染。',
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('系统生成问题 标题'));
  fireEvent.click(
    within(await screen.findByTestId('question-direct-answer-callout')).getByRole(
      'button',
      { name: '直接回答当前问题' },
    ),
  );

  const answerTitleInput = await screen.findByDisplayValue('系统问题 AI 回答');

  expect(answerTitleInput.closest('[data-testid^="editor-node-"]')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
  expect(screen.getByTestId('answer-evaluation-callout')).toBeInTheDocument();

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => findNodeByTitle(snapshot, '系统问题 AI 回答') !== null,
  );
  const answerNode = findNodeByTitle(savedSnapshot, '系统问题 AI 回答');

  expect(answerNode?.type).toBe('answer');
  expect(answerNode?.parentId).toBe('question-generated-direct-answer');
});

test.each([
  {
    sourceContent: '因为 React 会先把更新合并起来。',
    sourceNodeId: 'answer-follow-up-source',
    sourceTitle: '第一版回答',
    sourceType: 'answer',
  },
  {
    sourceContent: '这里明确指出还缺最后一层因果。',
    sourceNodeId: 'judgment-follow-up-source',
    sourceTitle: '当前回答判断',
    sourceType: 'judgment',
  },
  {
    sourceContent: '先补上“合并更新如何减少重复渲染”的因果链条。',
    sourceNodeId: 'summary-follow-up-source-closure',
    sourceTitle: '答案解析草稿',
    sourceType: 'summary',
  },
  {
    sourceContent: '这是用户自己写的阶段性总结。',
    sourceNodeId: 'summary-follow-up-source-manual',
    sourceTitle: '手写总结',
    sourceType: 'summary',
  },
])(
  'restores the $sourceNodeId source context when directly answering an AI-generated follow-up',
  async ({ sourceContent, sourceNodeId, sourceTitle, sourceType }) => {
    let observedLearningActionPrompt = '';
    const dependencies = await createPreloadedDependencies(
      createFollowUpSourceContextSnapshot(),
      createMockProviderClient({
        'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
          const actionId = extractLearningActionId(request);
          const userMessage =
            request.messages.find((message) => message.role === 'user')?.content ??
            '';

          if (actionId === 'insert-question') {
            return {
              title: '继续围绕具体内容追问',
              content: '请沿着当前这条内容继续补上最关键的一层因果关系。',
            };
          }

          if (actionId === 'insert-answer') {
            observedLearningActionPrompt = userMessage;

            return {
              title: '追问回答草稿',
              content: '先接住来源内容，再回答这条追问。',
            };
          }

          return {};
        },
      }),
    );

    render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
    await screen.findByRole('heading', { name: '当前学习模块' });

    fireEvent.focus(screen.getByLabelText(`${sourceTitle} 标题`));
    fireEvent.click(
      within(
        screen.getByTestId('question-block-actions-question-follow-up-source'),
      ).getByRole('button', {
        name: '生成追问',
      }),
    );

    const followUpQuestionTitle = await screen.findByDisplayValue(
      '继续围绕具体内容追问',
    );
    const followUpQuestionNode = followUpQuestionTitle.closest(
      '[data-testid^="editor-node-"]',
    );

    expect(followUpQuestionNode).not.toBeNull();
    expect(followUpQuestionNode).toHaveTextContent(`追问围绕：来源`);
    expect(followUpQuestionNode).toHaveTextContent(sourceTitle);

    fireEvent.click(
      within(await screen.findByTestId('question-direct-answer-callout')).getByRole(
        'button',
        { name: '直接回答当前问题' },
      ),
    );

    expect(
      await screen.findByDisplayValue('追问回答草稿'),
    ).toBeInTheDocument();
    expect(observedLearningActionPrompt).toContain('学习动作：insert-answer');
    expect(observedLearningActionPrompt).toContain('追问来源上下文');
    expect(observedLearningActionPrompt).toContain(sourceType);
    expect(observedLearningActionPrompt).toContain(sourceTitle);
    expect(observedLearningActionPrompt).toContain(sourceContent);

    const savedSnapshot = await waitForSavedSnapshot(
      dependencies.structuredDataStorage,
      (snapshot) =>
        findNodeByTitle(snapshot, '继续围绕具体内容追问') !== null &&
        findNodeByTitle(snapshot, '追问回答草稿') !== null,
    );
    const followUpQuestionNodeInSnapshot = findNodeByTitle(
      savedSnapshot,
      '继续围绕具体内容追问',
    );

    expect(followUpQuestionNodeInSnapshot).toMatchObject({
      type: 'question',
      sourceContext: {
        content: sourceContent,
        nodeId: sourceNodeId,
        nodeType: sourceType,
        title: sourceTitle,
      },
    });
  },
);

test('evaluates a sufficient answer into a closed question and promotes the step to done', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: true,
        judgment: {
          title: '判断：已答到当前问题',
          content: '回答已经覆盖当前问题的关键点。',
        },
        summary: {
          title: '标准理解',
          content:
            '批处理会把同一轮事件中的多次更新合并提交，从而减少不必要的重复渲染。',
          citations: [{ targetNodeId: 'fragment-batching' }],
        },
        followUpQuestions: [],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByDisplayValue('为什么状态更新会被批处理？'));
  await waitFor(() => {
    expect(
      getAnswerEvaluationButton(),
    ).toBeEnabled();
  });
  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('已答到当前问题'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('标准理解'),
  ).toBeInTheDocument();

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => {
      const stepNode = snapshot.tree.nodes['step-answer-closure'];

      return stepNode?.type === 'plan-step' && stepNode.status === 'done';
    },
  );
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('done');
  expect(
    Object.values(savedSnapshot.tree.nodes).some(
      (node) => node.title === '追问：还缺哪一步因果关系？',
    ),
  ).toBe(false);
  expect(
    screen
      .getByDisplayValue('标准理解')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
});

test.each([
  {
    sourceContent: '这里明确指出还缺最后一层因果。',
    sourceNodeId: 'judgment-follow-up-source',
    sourceTitle: '当前回答判断',
    sourceType: 'judgment',
  },
  {
    sourceContent: '先补上“合并更新如何减少重复渲染”的因果链条。',
    sourceNodeId: 'summary-follow-up-source-closure',
    sourceTitle: '答案解析草稿',
    sourceType: 'summary',
  },
  {
    sourceContent: '这是用户自己写的阶段性总结。',
    sourceNodeId: 'summary-follow-up-source-manual',
    sourceTitle: '手写总结',
    sourceType: 'summary',
  },
])(
  'restores the $sourceNodeId source context when directly answering a manually inserted follow-up',
  async ({ sourceContent, sourceNodeId, sourceTitle, sourceType }) => {
    let observedLearningActionPrompt = '';
    const dependencies = await createPreloadedDependencies(
      createFollowUpSourceContextSnapshot(),
      createMockProviderClient({
        'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
          const actionId = extractLearningActionId(request);
          const userMessage =
            request.messages.find((message) => message.role === 'user')?.content ??
            '';

          if (actionId === 'insert-answer') {
            observedLearningActionPrompt = userMessage;

            return {
              title: '追问回答草稿',
              content: '先接住来源内容，再回答这条手动插入的追问。',
            };
          }

          return {};
        },
      }),
    );

    render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
    await screen.findByRole('heading', { name: '当前学习模块' });

    fireEvent.focus(screen.getByLabelText(`${sourceTitle} 标题`));
    fireEvent.click(
      within(
        screen.getByTestId('question-block-actions-question-follow-up-source'),
      ).getByRole('button', {
        name: '插入追问',
      }),
    );

    const followUpQuestionTitle = await screen.findByDisplayValue('新追问');
    const followUpQuestionNode = followUpQuestionTitle.closest(
      '[data-testid^="editor-node-"]',
    );

    expect(followUpQuestionNode).not.toBeNull();
    expect(followUpQuestionNode).toHaveTextContent(`追问围绕：来源`);
    expect(followUpQuestionNode).toHaveTextContent(sourceTitle);

    fireEvent.click(
      within(await screen.findByTestId('question-direct-answer-callout')).getByRole(
        'button',
        { name: '直接回答当前问题' },
      ),
    );

    expect(await screen.findByDisplayValue('追问回答草稿')).toBeInTheDocument();
    expect(observedLearningActionPrompt).toContain('学习动作：insert-answer');
    expect(observedLearningActionPrompt).toContain('追问来源上下文');
    expect(observedLearningActionPrompt).toContain(sourceType);
    expect(observedLearningActionPrompt).toContain(sourceTitle);
    expect(observedLearningActionPrompt).toContain(sourceContent);

    const savedSnapshot = await waitForSavedSnapshot(
      dependencies.structuredDataStorage,
      (snapshot) =>
        findNodeByTitle(snapshot, '新追问') !== null &&
        findNodeByTitle(snapshot, '追问回答草稿') !== null,
    );
    const followUpQuestionNodeInSnapshot = findNodeByTitle(savedSnapshot, '新追问');

    expect(followUpQuestionNodeInSnapshot).toMatchObject({
      type: 'question',
      sourceContext: {
        content: sourceContent,
        nodeId: sourceNodeId,
        nodeType: sourceType,
        title: sourceTitle,
      },
    });
  },
);

test.each([
  {
    actionLabel: '生成追问',
    expectedFollowUpTitle: '围绕铺垫继续追问',
  },
  {
    actionLabel: '插入追问',
    expectedFollowUpTitle: '新追问',
  },
])(
  'restores scaffold source context when directly answering a follow-up created from scaffold summary via $actionLabel',
  async ({ actionLabel, expectedFollowUpTitle }) => {
    let observedLearningActionPrompt = '';
    const dependencies = await createPreloadedDependencies(
      createScaffoldFollowUpSourceContextSnapshot(),
      createMockProviderClient({
        'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
          const actionId = extractLearningActionId(request);
          const userMessage =
            request.messages.find((message) => message.role === 'user')?.content ??
            '';

          if (actionId === 'insert-question') {
            return {
              title: '围绕铺垫继续追问',
              content: '请沿着这段铺垫继续追问最关键的理解检查点。',
            };
          }

          if (actionId === 'insert-answer') {
            observedLearningActionPrompt = userMessage;

            return {
              title: '铺垫追问回答草稿',
              content: '先接住这段铺垫，再回答后面的追问。',
            };
          }

          return {};
        },
      }),
    );

    render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
    await screen.findByRole('heading', { name: '当前学习模块' });

    fireEvent.focus(screen.getByLabelText('铺垫讲解 标题'));
    fireEvent.click(
      within(
        screen.getByTestId('node-actions-summary-follow-up-source-scaffold'),
      ).getByRole('button', {
        name: actionLabel,
      }),
    );

    const insertedFollowUpSnapshot = await waitForSavedSnapshot(
      dependencies.structuredDataStorage,
      (snapshot) =>
        Object.values(snapshot.tree.nodes).some(
          (node) =>
            node.type === 'question' &&
            node.parentId === 'step-scaffold-follow-up-source-context' &&
            node.sourceContext?.nodeId === 'summary-follow-up-source-scaffold',
        ),
    );
    const insertedFollowUpNode = Object.values(insertedFollowUpSnapshot.tree.nodes).find(
      (node) =>
        node.type === 'question' &&
        node.parentId === 'step-scaffold-follow-up-source-context' &&
        node.sourceContext?.nodeId === 'summary-follow-up-source-scaffold',
    );

    expect(insertedFollowUpNode).toMatchObject({
      title: expectedFollowUpTitle,
    });

    const followUpCallout = await screen.findByTestId('question-direct-answer-callout');
    const followUpNode = screen.getByTestId(`editor-node-${insertedFollowUpNode?.id}`);

    expect(followUpCallout).toBeInTheDocument();
    expect(followUpNode).toHaveTextContent(
      '追问围绕：来源总结 · 铺垫讲解：先建立概念地图，再进入后续问题。',
    );

    fireEvent.click(
      within(followUpCallout).getByRole('button', {
        name: '直接回答当前问题',
      }),
    );

    expect(await screen.findByDisplayValue('铺垫追问回答草稿')).toBeInTheDocument();
    expect(observedLearningActionPrompt).toContain('学习动作：insert-answer');
    expect(observedLearningActionPrompt).toContain('追问来源上下文');
    expect(observedLearningActionPrompt).toContain('summary');
    expect(observedLearningActionPrompt).toContain('铺垫讲解');
    expect(observedLearningActionPrompt).toContain('先建立概念地图，再进入后续问题。');

    const savedSnapshot = await waitForSavedSnapshot(
      dependencies.structuredDataStorage,
      (snapshot) =>
        findNodeByTitle(snapshot, expectedFollowUpTitle) !== null &&
        findNodeByTitle(snapshot, '铺垫追问回答草稿') !== null,
    );
    const followUpQuestionNodeInSnapshot = findNodeByTitle(
      savedSnapshot,
      expectedFollowUpTitle,
    );

    expect(followUpQuestionNodeInSnapshot).toMatchObject({
      type: 'question',
      sourceContext: {
        content: '先建立概念地图，再进入后续问题。',
        nodeId: 'summary-follow-up-source-scaffold',
        nodeType: 'summary',
        title: '铺垫讲解',
      },
    });
  },
);

test('re-evaluates the question current answer instead of the selected old answer', async () => {
  let observedQuestionClosurePrompt = '';
  const dependencies = await createPreloadedDependencies(
    createMultiAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': (request: AiProviderObjectRequest<unknown>) => {
        const userMessage = request.messages.find((message) => message.role === 'user');

        observedQuestionClosurePrompt = userMessage?.content ?? '';

        return {
          isAnswerSufficient: false,
          judgment: {
            title: '判断：第二版回答还不完整',
            content: '这次只继续围绕当前回答补缺口。',
          },
          summary: {
            title: '标准理解',
            content: '先把第二版回答缺失的因果关系补清楚，再决定是否需要继续追问。',
          },
          followUpQuestions: [
            {
              title: '追问：第二版还缺哪条因果关系？',
              content: '继续围绕当前回答补关键缺口。',
            },
          ],
        };
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  const firstAnswerNode = revealHistoryAnswer('editor-node-answer-answer-closure');

  fireEvent.focus(within(firstAnswerNode).getByLabelText('第一版回答 标题'));
  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('第二版回答还不完整'),
  ).toBeInTheDocument();
  expect(observedQuestionClosurePrompt).toContain('当前回答：第二版回答');
  expect(observedQuestionClosurePrompt).toContain(
    '因为同一轮事件里的更新会统一提交，所以能减少重复渲染。',
  );
  expect(observedQuestionClosurePrompt).not.toContain('当前回答：第一版回答');
  expect(observedQuestionClosurePrompt).not.toContain('因为 React 会先把更新合并起来。');
  expect(
    screen
      .getByDisplayValue('第二版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
});

test('scopes generated summaries to the selected content node instead of silently jumping back to current answer', async () => {
  let observedLearningActionPrompt = '';
  const dependencies = await createPreloadedDependencies(
    createMultiAnswerClosureSnapshot(),
    createMockProviderClient({
      'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
        const userMessage = request.messages.find((message) => message.role === 'user');

        observedLearningActionPrompt = userMessage?.content ?? '';

        return {
          title: '总结：只围绕第二版回答',
          content: '只围绕第二版回答补上缺失的因果关系。',
        };
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  const firstAnswerNode = revealHistoryAnswer('editor-node-answer-answer-closure');

  fireEvent.focus(within(firstAnswerNode).getByLabelText('第一版回答 标题'));
  const blockActions = await screen.findByTestId(
    'question-block-actions-question-answer-closure',
  );

  await waitFor(() => {
    expect(
      within(blockActions).getByRole('button', { name: '生成总结' }),
    ).toBeEnabled();
  });
  fireEvent.click(within(blockActions).getByRole('button', { name: '生成总结' }));
  await waitFor(() => {
    expect(observedLearningActionPrompt).toContain('现有回答');
  });
  expect(observedLearningActionPrompt).toContain('现有回答');
  expect(observedLearningActionPrompt).toContain('第一版回答');
  expect(observedLearningActionPrompt).toContain(
    '因为 React 会先把更新合并起来。',
  );
  expect(observedLearningActionPrompt).not.toContain('现有回答：当前回答：第二版回答');
});

test('views the explanation that belongs to the question current answer round', async () => {
  const dependencies = await createPreloadedDependencies(
    createMultiRoundClosureSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  const firstAnswerNode = revealHistoryAnswer('editor-node-answer-answer-closure');

  fireEvent.focus(within(firstAnswerNode).getByLabelText('第一版回答 标题'));
  await waitFor(() => {
    expect(
      within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
        name: '查看答案解析',
      }),
    ).toBeEnabled();
  });
  fireEvent.click(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '查看答案解析',
    }),
  );

  expect(
    await screen.findByDisplayValue('标准理解：第二版回答'),
  ).toBeInTheDocument();
  expect(
    screen
      .getByDisplayValue('标准理解：第二版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
  expect(
    screen
      .getByDisplayValue('标准理解：第一版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).not.toHaveAttribute('data-node-selected', 'true');
});

test('keeps judgment nodes actionable within the current answer revision path', async () => {
  const dependencies = await createPreloadedDependencies(
    createMultiRoundClosureSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  revealHistoryAnswer('editor-node-answer-answer-closure');
  fireEvent.click(screen.getByRole('button', { name: /第一版回答还不完整/ }));

  const inlineActions = await screen.findByTestId(
    'judgment-inline-actions-judgment-answer-closure-v1',
  );

  expect(await screen.findByTestId('judgment-inline-actions')).toBeInTheDocument();
  expect(within(inlineActions).getByRole('button', { name: '给我提示' })).toBeInTheDocument();
  expect(
    within(inlineActions).getByRole('button', { name: '查看答案解析' }),
  ).toBeInTheDocument();
  expect(
    within(inlineActions).getByRole('button', { name: '回到当前回答继续修改' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('answer-evaluation-callout'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    within(inlineActions).getByRole('button', { name: '回到当前回答继续修改' }),
  );
  expect(
    screen
      .getByDisplayValue('第二版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');

  revealHistoryAnswer('editor-node-answer-answer-closure');
  fireEvent.click(screen.getByRole('button', { name: /第一版回答还不完整/ }));
  fireEvent.click(
    within(
      await screen.findByTestId('judgment-inline-actions-judgment-answer-closure-v1'),
    ).getByRole('button', { name: '查看答案解析' }),
  );
  expect(
    screen
      .getByDisplayValue('标准理解：第二版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
});

test('extends a scaffold with a simpler follow-up explanation draft', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
        const actionId = extractLearningActionId(request);

        if (actionId !== 'simplify-scaffold') {
          return {};
        }

        return {
          title: '铺垫：先用排队的直觉理解批处理',
          content:
            '可以先把批处理想成把同一轮里的更新先排进同一个队列，再一起结算。这样用户只会看到整理后的结果，而不是每塞一次都马上重画一遍页面。',
          citations: [{ targetNodeId: 'fragment-batching' }],
        };
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('先知道什么叫批处理 标题'));
  fireEvent.click(
    within(screen.getByTestId('node-actions-intro-answer-closure')).getByRole(
      'button',
      { name: '更基础一点' },
    ),
  );

  const titleInput = await screen.findByDisplayValue(
    '先用排队的直觉理解批处理',
  );

  expect(titleInput).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue(/可以先把批处理想成把同一轮里的更新先排进同一个队列/u),
  ).toBeInTheDocument();
  expect(titleInput.closest('[data-testid^="editor-node-"]')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
});

test('creates AI drafts for scaffold, generate-follow-up, generate-summary and judgment actions', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
        const actionId = extractLearningActionId(request);

        switch (actionId) {
          case 'insert-scaffold':
            return {
              title: '铺垫：先把同一轮更新放到一张图里',
              content:
                '先抓住一件事：批处理不是“晚一点更新”，而是把同一轮里的变化先收拢，再决定怎么统一提交。这样后面的提问才有共同参照系。',
            };
          case 'insert-question':
            return {
              title: '为什么“同一轮事件”是批处理成立的前提？',
              content:
                '请解释如果更新不处在同一轮里，React 为什么就不能直接沿用同一套合并节奏。',
            };
          case 'insert-summary':
            return {
              title: '总结：先把节奏和结果分开看',
              content:
                '理解批处理时，先区分“更新何时被收集”与“界面何时被提交”。前者决定能不能合并，后者决定用户会看到几次渲染结果。',
            };
          case 'insert-judgment':
            return {
              title: '判断：已经抓到批处理的主线',
              content:
                '这份草稿已经抓到了“先收集再统一提交”的主线，但还可以继续检查你是否说明了它为什么会减少重复渲染。',
            };
          default:
            return {};
        }
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('理解批处理为什么成立 标题'));
  fireEvent.click(
    within(screen.getByTestId('learning-action-grid')).getByRole('button', {
      name: '插入铺垫 / 讲解',
    }),
  );
  expect(
    await screen.findByDisplayValue('先把同一轮更新放到一张图里'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(/先抓住一件事：批处理不是“晚一点更新”/u),
  ).toBeInTheDocument();

  fireEvent.focus(screen.getByLabelText('为什么状态更新会被批处理？ 标题'));
  const blockActions = await screen.findByTestId(
    'question-block-actions-question-answer-closure',
  );

  fireEvent.click(
    within(blockActions).getByRole('button', { name: '生成追问' }),
  );
  expect(
    await screen.findByDisplayValue('为什么“同一轮事件”是批处理成立的前提？'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(
      '请解释如果更新不处在同一轮里，React 为什么就不能直接沿用同一套合并节奏。',
    ),
  ).toBeInTheDocument();

  fireEvent.focus(screen.getByLabelText('为什么状态更新会被批处理？ 标题'));
  fireEvent.click(
    within(screen.getByTestId('question-block-actions-question-answer-closure')).getByRole(
      'button',
      { name: '生成总结' },
    ),
  );
  expect(
    await screen.findByDisplayValue('先把节奏和结果分开看'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(
      '理解批处理时，先区分“更新何时被收集”与“界面何时被提交”。前者决定能不能合并，后者决定用户会看到几次渲染结果。',
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '插入判断' }));
  expect(
    await screen.findByDisplayValue('已经抓到批处理的主线'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(/这份草稿已经抓到了“先收集再统一提交”的主线/u),
  ).toBeInTheDocument();
});

test('falls back to a local judgment draft when the AI provider is unavailable', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createThrowingProviderClient(
      'AI 服务请求失败（429）：当前 AI 配额已用尽，请检查 provider 的 plan / billing。',
    ),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('回答草稿 标题'));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '插入判断' })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '插入判断' }));

  expect(await screen.findByDisplayValue('回答还不完整')).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(/这次回答还不完整，“为什么状态更新会被批处理？”里仍有关键点没有答到。/u),
  ).toBeInTheDocument();
  expect(screen.getByText('AI 暂时不可用，已先补上一段可编辑的本地判断草稿。')).toBeInTheDocument();
  expect(screen.queryByText(/AI 动作失败：/u)).not.toBeInTheDocument();
});

test('tolerates question-closure JSON wrapped in explanation text and code fences', async () => {
  const rawResponse = `这是评估结果，请按其中的 JSON 对象落地：
\`\`\`json
{"isAnswerSufficient":true,"judgment":{"title":"判断：已答到当前问题","content":"这次回答已经覆盖当前问题的关键点。"},"summary":{"title":"标准理解","content":"批处理会把同一轮事件中的多个状态更新合并后再统一提交，从而减少不必要的重复渲染。","citations":[{"targetNodeId":"fragment-batching"}]},"followUpQuestions":[]}
\`\`\`
其余文字只是说明。`;
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': rawResponse,
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByDisplayValue('为什么状态更新会被批处理？'));
  await waitFor(() => {
    expect(
      getAnswerEvaluationButton(),
    ).toBeEnabled();
  });
  fireEvent.click(getAnswerEvaluationButton());

  expect(
    await screen.findByDisplayValue('已答到当前问题'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('标准理解'),
  ).toBeInTheDocument();

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => {
      const stepNode = snapshot.tree.nodes['step-answer-closure'];

      return stepNode?.type === 'plan-step' && stepNode.status === 'done';
    },
  );
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('done');
});

test('preserves a manual step status override across save and reload', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualStatusSnapshot(),
  );
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(
    within(screen.getByTestId('editor-node-step-manual-status')).getByRole('combobox'),
    {
      target: {
        value: 'done',
      },
    },
  );

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => {
      const stepNode = snapshot.tree.nodes['step-manual-status'];

      return stepNode?.type === 'plan-step' && stepNode.status === 'done';
    },
  );
  const stepNode = savedSnapshot.tree.nodes['step-manual-status'];

  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('done');

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    within(await screen.findByTestId('editor-node-step-manual-status')).getByRole(
      'combobox',
    ),
  ).toHaveValue('done');
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  providerClient?: AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-learning-loop-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-learning-loop-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      return providerClient ?? createMockProviderClient({}, config);
    },
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createMockProviderClient(
  payloadByTaskName: Record<
    string,
    | unknown
    | ((request: AiProviderObjectRequest<unknown>) => unknown)
  >,
  _config?: AiConfig,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payloadSource = payloadByTaskName[request.taskName] ?? {};
      const payload =
        typeof payloadSource === 'function'
          ? payloadSource(request as AiProviderObjectRequest<unknown>)
          : payloadSource;
      const rawText =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

      return {
        taskName: request.taskName,
        content: request.parse(rawText) as T,
        model: 'mock-model',
        providerLabel: 'mock-provider',
        rawText,
      };
    },
  };
}

function createThrowingProviderClient(message: string): AiProviderClient {
  return {
    async generateObject<T>(
      _request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      throw new Error(message);
    },
  };
}

function extractLearningActionId(
  request: AiProviderObjectRequest<unknown>,
) {
  const userMessage = request.messages.find((message) => message.role === 'user');
  const matchedAction = userMessage?.content.match(/学习动作：([^\n]+)/u);

  return matchedAction?.[1]?.trim() ?? '';
}

async function waitForSavedSnapshot(
  storage: StructuredDataStorage,
  predicate: (snapshot: WorkspaceSnapshot) => boolean,
): Promise<WorkspaceSnapshot> {
  let latestSnapshot: WorkspaceSnapshot | null = null;

  await waitFor(async () => {
    const workspaces = await storage.listWorkspaces();

    latestSnapshot = await storage.loadWorkspace(workspaces[0].id);
    expect(latestSnapshot).not.toBeNull();
    expect(predicate(latestSnapshot!)).toBe(true);
  });

  if (!latestSnapshot) {
    throw new Error('Expected saved snapshot to exist.');
  }

  return latestSnapshot;
}

function findNodeByTitle(snapshot: WorkspaceSnapshot, title: string) {
  return Object.values(snapshot.tree.nodes).find((node) => node.title === title) ?? null;
}

function createAnswerClosureSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '学习闭环主题',
    workspaceId: 'workspace-answer-closure',
    rootId: 'theme-answer-closure',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-answer-closure',
      title: '理解批处理',
      content: '验证回答后的最小闭环。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-answer-closure',
    createNode({
      type: 'plan-step',
      id: 'step-answer-closure',
      title: '理解批处理为什么成立',
      content: '先让用户回答，再由系统评估和推进。',
      status: 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-closure',
    createNode({
      type: 'summary',
      id: 'intro-answer-closure',
      title: '铺垫：先知道什么叫批处理',
      content: '先说明它发生在同一轮事件处理里，再进入判断题。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-closure',
    createNode({
      type: 'question',
      id: 'question-answer-closure',
      title: '为什么状态更新会被批处理？',
      content: '请解释它为什么能减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'answer',
      id: 'answer-answer-closure',
      title: '回答草稿',
      content: '因为 React 会把多个更新放在一起。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 useState 和批处理的资料概况。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用于支撑回答评估。',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createMultiAnswerClosureSnapshot(): WorkspaceSnapshot {
  const snapshot = createAnswerClosureSnapshot();
  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'answer',
      id: 'answer-answer-closure-v2',
      title: '第二版回答',
      content: '因为同一轮事件里的更新会统一提交，所以能减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  const firstAnswerNode = tree.nodes['answer-answer-closure'];

  if (firstAnswerNode?.type === 'answer') {
    firstAnswerNode.title = '第一版回答';
    firstAnswerNode.content = '因为 React 会先把更新合并起来。';
  }

  const questionNode = tree.nodes['question-answer-closure'];

  if (questionNode?.type === 'question') {
    questionNode.currentAnswerId = 'answer-answer-closure-v2';
  }

  return {
    ...snapshot,
    tree,
  };
}

function createMultiRoundClosureSnapshot(): WorkspaceSnapshot {
  const snapshot = createAnswerClosureSnapshot();
  let tree = snapshot.tree;

  const firstAnswerNode = tree.nodes['answer-answer-closure'];

  if (firstAnswerNode?.type === 'answer') {
    firstAnswerNode.title = '第一版回答';
    firstAnswerNode.content = '因为 React 会先把更新合并起来。';
  }

  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'judgment',
      id: 'judgment-answer-closure-v1',
      title: '判断：第一版回答还不完整',
      content: '第一版回答还没有把为什么能减少重复渲染讲清楚。',
      hint: '先把“同一轮更新如何被合并提交”与“为什么会减少重复渲染”这层关系补出来。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-answer-closure',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'summary',
      id: 'summary-answer-closure-v1',
      title: '标准理解：第一版回答',
      content: '先补上“合并更新如何减少重复渲染”的因果链条。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-answer-closure',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'answer',
      id: 'answer-answer-closure-v2',
      title: '第二版回答',
      content: '因为同一轮事件里的更新会统一提交，所以能减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'judgment',
      id: 'judgment-answer-closure-v2',
      title: '判断：第二版回答已说明因果关系',
      content: '第二版回答已经把更新节奏和减少重复渲染的关系补全了。',
      hint: '这轮已经答到位了，只需要按当前答案复述一遍完整因果链。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-answer-closure-v2',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'summary',
      id: 'summary-answer-closure-v2',
      title: '标准理解：第二版回答',
      content: '第二版已经覆盖了为什么统一提交能减少重复渲染。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-answer-closure-v2',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  const questionNode = tree.nodes['question-answer-closure'];

  if (questionNode?.type === 'question') {
    questionNode.currentAnswerId = 'answer-answer-closure-v2';
  }

  return {
    ...snapshot,
    tree,
  };
}

function createManualQuestionDirectAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动问题直接回答',
    workspaceId: 'workspace-manual-direct-answer',
    rootId: 'theme-manual-direct-answer',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-direct-answer',
      title: '手动问题模块',
      content: '验证 question 语境可以直接起一版 AI answer。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-direct-answer',
    createNode({
      type: 'plan-step',
      id: 'step-manual-direct-answer',
      title: '手动问题起答',
      content: '先选中手动插入的 question，再让 AI 直接回答。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-direct-answer',
    createNode({
      type: 'question',
      id: 'question-manual-direct-answer',
      title: '手动问题',
      content: '为什么 React 会把同一轮里的更新统一提交，从而减少重复渲染？',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createFollowUpSourceContextSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '追问来源上下文',
    workspaceId: 'workspace-follow-up-source-context',
    rootId: 'theme-follow-up-source-context',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-follow-up-source-context',
      title: '追问来源上下文模块',
      content: '验证内容节点追问后的 direct answer 仍能恢复具体来源上下文。',
      createdAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-follow-up-source-context',
    createNode({
      type: 'plan-step',
      id: 'step-follow-up-source-context',
      title: '追问来源上下文步骤',
      content: '先在具体内容节点上发起追问，再直接回答这条新追问。',
      status: 'doing',
      createdAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-follow-up-source-context',
    createNode({
      type: 'question',
      id: 'question-follow-up-source',
      title: '为什么批处理会减少重复渲染？',
      content: '围绕因果链继续补关键内容。',
      currentAnswerId: 'answer-follow-up-source',
      createdAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-follow-up-source',
    createNode({
      type: 'answer',
      id: 'answer-follow-up-source',
      title: '第一版回答',
      content: '因为 React 会先把更新合并起来。',
      createdAt: '2026-05-01T00:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-follow-up-source',
    createNode({
      type: 'judgment',
      id: 'judgment-follow-up-source',
      title: '当前回答判断',
      content: '这里明确指出还缺最后一层因果。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-follow-up-source',
      sourceAnswerUpdatedAt: '2026-05-01T00:01:00.000Z',
      createdAt: '2026-05-01T00:01:30.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-follow-up-source',
    createNode({
      type: 'summary',
      id: 'summary-follow-up-source-closure',
      title: '答案解析草稿',
      content: '先补上“合并更新如何减少重复渲染”的因果链条。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-follow-up-source',
      sourceAnswerUpdatedAt: '2026-05-01T00:01:00.000Z',
      createdAt: '2026-05-01T00:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-follow-up-source',
    createNode({
      type: 'summary',
      id: 'summary-follow-up-source-manual',
      title: '手写总结',
      content: '这是用户自己写的阶段性总结。',
      summaryKind: 'manual',
      createdAt: '2026-05-01T00:03:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createScaffoldFollowUpSourceContextSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '铺垫追问来源上下文',
    workspaceId: 'workspace-scaffold-follow-up-source-context',
    rootId: 'theme-scaffold-follow-up-source-context',
    createdAt: '2026-05-01T01:00:00.000Z',
    updatedAt: '2026-05-01T01:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-scaffold-follow-up-source-context',
      title: '铺垫追问来源上下文模块',
      content: '验证从铺垫节点发起追问后，direct answer 仍能恢复具体来源。',
      createdAt: '2026-05-01T01:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-scaffold-follow-up-source-context',
    createNode({
      type: 'plan-step',
      id: 'step-scaffold-follow-up-source-context',
      title: '铺垫追问来源上下文步骤',
      content: '先围绕铺垫发起追问，再直接回答这条新追问。',
      status: 'doing',
      createdAt: '2026-05-01T01:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-scaffold-follow-up-source-context',
    createNode({
      type: 'summary',
      id: 'summary-follow-up-source-scaffold',
      title: '铺垫讲解',
      content: '先建立概念地图，再进入后续问题。',
      summaryKind: 'scaffold',
      createdAt: '2026-05-01T01:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-scaffold-follow-up-source-context',
    createNode({
      type: 'question',
      id: 'question-after-scaffold-source',
      title: '铺垫后的原始问题',
      content: '这里保留一个原始问题，确保铺垫上下文仍处在真实学习步骤里。',
      createdAt: '2026-05-01T01:01:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createGeneratedQuestionDirectAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '系统问题直接回答',
    workspaceId: 'workspace-generated-direct-answer',
    rootId: 'theme-generated-direct-answer',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-generated-direct-answer',
      title: '系统问题模块',
      content: '验证系统生成的问题也能直接进入同一条 AI answer 主路径。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-generated-direct-answer',
    createNode({
      type: 'plan-step',
      id: 'step-generated-direct-answer',
      title: '系统问题起答',
      content: '问题已经在学习树里，但还没有 answer。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-generated-direct-answer',
    createNode({
      type: 'summary',
      id: 'intro-generated-direct-answer',
      title: '系统铺垫',
      content: '先有一段学习铺垫，再进入系统生成的问题。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-generated-direct-answer',
    createNode({
      type: 'question',
      id: 'question-generated-direct-answer',
      title: '系统生成问题',
      content: '为什么同一轮事件里的状态更新会被统一提交，而不是每次更新都立刻重复渲染？',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createManualStatusSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动状态主题',
    workspaceId: 'workspace-manual-status',
    rootId: 'theme-manual-status',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-status',
      title: '状态模块',
      content: '验证手动状态跨保存保留。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-status',
    createNode({
      type: 'plan-step',
      id: 'step-manual-status',
      title: '起始步骤',
      content: '这里只有骨架，没有真实学习证据。',
      status: 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-status',
    createNode({
      type: 'question',
      id: 'question-manual-status',
      title: '起始问题',
      content: '',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
