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
  expect(screen.getByText(/默认主路径仍留在当前回答上/u)).toBeInTheDocument();

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
    '围绕当前回答继续',
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
    screen.getByRole('button', { name: '重新评估当前回答' }),
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
