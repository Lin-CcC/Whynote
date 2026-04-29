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
      screen.getByRole('button', { name: '重新评估当前回答' }),
    ).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

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
  expect(
    screen.getByText('答案解析可以对照，但主路径还是留在当前回答。'),
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
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(judgmentNode?.referenceIds).toHaveLength(1);
  expect(persistedSummaryNode?.referenceIds).toHaveLength(1);
  expect(
    savedSnapshot.tree.references[judgmentNode!.referenceIds[0]].targetNodeId,
  ).toBe('resource-react-docs');
  expect(
    savedSnapshot.tree.references[persistedSummaryNode!.referenceIds[0]].targetNodeId,
  ).toBe('fragment-batching');
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
      screen.getByRole('button', { name: '重新评估当前回答' }),
    ).toBeEnabled();
  });
  expect(screen.getByTestId('answer-evaluation-callout')).toHaveTextContent(
    '改完这版回答再重评',
  );
  expect(screen.getByTestId('answer-evaluation-callout')).toHaveTextContent(
    '先重评当前回答，把判断和答案解析补出来。',
  );
  expect(screen.getByText('当前回答修订')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

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
  expect(screen.getByText('当前回答修订')).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: '重新评估当前回答' }),
    ).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

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

  fireEvent.click(screen.getByRole('button', { name: '回到当前回答继续修改' }));
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

  expect(answerNode?.type).toBe('answer');
  expect(answerNode?.parentId).toBe('question-manual-direct-answer');
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
      screen.getByRole('button', { name: '重新评估当前回答' }),
    ).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

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

test('re-evaluates only the currently selected answer when a question already has multiple answers', async () => {
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
            title: '判断：第一版回答还不完整',
            content: '这次只继续围绕当前选中的回答补缺口。',
          },
          summary: {
            title: '标准理解',
            content: '先把第一版回答缺失的因果关系补清楚，再决定是否需要继续追问。',
          },
          followUpQuestions: [
            {
              title: '追问：第一版还缺哪条因果关系？',
              content: '继续围绕当前这版回答补关键缺口。',
            },
          ],
        };
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('第一版回答 标题'));
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

  expect(
    await screen.findByDisplayValue('第一版回答还不完整'),
  ).toBeInTheDocument();
  expect(observedQuestionClosurePrompt).toContain('当前回答：第一版回答');
  expect(observedQuestionClosurePrompt).toContain('因为 React 会先把更新合并起来。');
  expect(observedQuestionClosurePrompt).not.toContain('第二版回答');
  expect(observedQuestionClosurePrompt).not.toContain(
    '因为同一轮事件里的更新会统一提交，所以能减少重复渲染。',
  );
  expect(
    screen
      .getByDisplayValue('第一版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
});

test('scopes learning-action drafts to the currently selected answer instead of aggregating sibling answers', async () => {
  let observedLearningActionPrompt = '';
  const dependencies = await createPreloadedDependencies(
    createMultiAnswerClosureSnapshot(),
    createMockProviderClient({
      'learning-action-draft': (request: AiProviderObjectRequest<unknown>) => {
        const userMessage = request.messages.find((message) => message.role === 'user');

        observedLearningActionPrompt = userMessage?.content ?? '';

        return {
          title: '总结：只围绕第一版回答',
          content: '只围绕第一版回答补上缺失的因果关系。',
        };
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('第一版回答 标题'));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '插入总结' })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '插入总结' }));

  expect(
    await screen.findByDisplayValue('总结：只围绕第一版回答'),
  ).toBeInTheDocument();
  expect(observedLearningActionPrompt).toContain('现有回答');
  expect(observedLearningActionPrompt).toContain('第一版回答');
  expect(observedLearningActionPrompt).toContain('因为 React 会先把更新合并起来。');
  expect(observedLearningActionPrompt).not.toContain('第二版回答');
  expect(observedLearningActionPrompt).not.toContain(
    '因为同一轮事件里的更新会统一提交，所以能减少重复渲染。',
  );
});

test('views the explanation that belongs to the currently selected answer round', async () => {
  const dependencies = await createPreloadedDependencies(
    createMultiRoundClosureSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('第一版回答 标题'));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '查看答案解析' })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '查看答案解析' }));

  expect(
    await screen.findByDisplayValue('标准理解：第一版回答'),
  ).toBeInTheDocument();
  expect(
    screen
      .getByDisplayValue('标准理解：第一版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');
  expect(
    screen
      .getByDisplayValue('标准理解：第二版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).not.toHaveAttribute('data-node-selected', 'true');
});

test('keeps judgment nodes actionable within the current answer revision path', async () => {
  const dependencies = await createPreloadedDependencies(
    createMultiRoundClosureSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: /第一版回答还不完整/ }));

  expect(await screen.findByTestId('judgment-inline-actions')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '给我提示' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '查看答案解析' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '回到当前回答继续修改' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '重新评估当前回答' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(
      '当前 judgment 的主动作已经收口到正文卡片，左侧不再重复抢这条路径。',
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '回到当前回答继续修改' }));
  expect(
    screen
      .getByDisplayValue('第一版回答')
      .closest('[data-testid^="editor-node-"]'),
  ).toHaveAttribute('data-node-selected', 'true');

  fireEvent.click(screen.getByRole('button', { name: /第一版回答还不完整/ }));
  fireEvent.click(screen.getByRole('button', { name: '查看答案解析' }));
  expect(
    screen
      .getByDisplayValue('标准理解：第一版回答')
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

  fireEvent.click(screen.getByRole('button', { name: '更基础一点' }));

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

test('creates AI drafts instead of empty shells for scaffold, question, summary and judgment actions', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: '插入铺垫 / 讲解' }));
  expect(
    await screen.findByDisplayValue('先把同一轮更新放到一张图里'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(/先抓住一件事：批处理不是“晚一点更新”/u),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '插入问题' }));
  expect(
    await screen.findByDisplayValue('为什么“同一轮事件”是批处理成立的前提？'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(
      '请解释如果更新不处在同一轮里，React 为什么就不能直接沿用同一套合并节奏。',
    ),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: '插入总结' }),
  );
  expect(
    await screen.findByDisplayValue('总结：先把节奏和结果分开看'),
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
      screen.getByRole('button', { name: '重新评估当前回答' }),
    ).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

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

  fireEvent.change(screen.getByRole('combobox', { name: '起始步骤 的步骤状态' }), {
    target: {
      value: 'done',
    },
  });

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
    await screen.findByRole('combobox', { name: '起始步骤 的步骤状态' }),
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
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

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
