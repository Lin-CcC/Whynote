import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import type {
  AiConfig,
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from '../learningEngine';
import {
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
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

test('creates a judgment-linked answer explanation on the first evaluation', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualQuestionAnswerSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：回答还不完整',
          content: '还没有说明为什么统一提交会减少重复渲染。',
        },
        summary: {
          title: '标准理解',
          content: '同一轮事件里的更新会先被收集，再统一提交，因此不必为每次更新都重复渲染。',
        },
        followUpQuestions: [],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByDisplayValue('手动回答草稿');
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

  await screen.findByDisplayValue('回答还不完整');
  await screen.findByDisplayValue('标准理解');

  const judgmentNode = findNodeByTitleInput('回答还不完整');
  const summaryNode = findNodeByTitleInput('标准理解');

  expect(summaryNode).toHaveTextContent('答案解析');
  expect(
    within(judgmentNode).queryByText('当前还没有对应的答案解析。'),
  ).not.toBeInTheDocument();

  fireEvent.click(judgmentNode);
  fireEvent.click(
    within(judgmentNode).getByRole('button', { name: '查看答案解析' }),
  );

  await waitFor(() => {
    expect(summaryNode).toHaveAttribute('data-node-selected', 'true');
  });
});

test('evaluates a manually inserted question and answer through the same closure path', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualQuestionAnswerSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：手动问题还差关键因果',
          content: '这版手动回答还缺少因果链路。',
        },
        summary: {
          title: '标准理解',
          content: '先说清更新如何被收集，再说明为什么统一提交能减少重复渲染。',
        },
        followUpQuestions: [
          {
            title: '追问：还缺哪条因果链？',
            content: '只补统一提交如何减少重复渲染。',
          },
        ],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByDisplayValue('手动回答草稿');
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

  expect(await screen.findByDisplayValue('手动问题还差关键因果')).toBeInTheDocument();
  expect(await screen.findByDisplayValue('标准理解')).toBeInTheDocument();
  expect(await screen.findByDisplayValue('追问：还缺哪条因果链？')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('answer-evaluation-callout')).getByRole('button', {
      name: '查看答案解析',
    }),
  ).toBeInTheDocument();
});

test('keeps answer explanation available on the first evaluation even when summary is omitted', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualQuestionAnswerSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：还缺最后一步',
          content: '还没有说明为什么统一提交会减少重复渲染。',
        },
        followUpQuestions: [],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByDisplayValue('手动回答草稿');
  fireEvent.click(screen.getByRole('button', { name: '重新评估当前回答' }));

  expect(
    await screen.findByDisplayValue('还缺最后一步'),
  ).toBeInTheDocument();
  await screen.findByDisplayValue('标准理解');
  const judgmentNode = findNodeByTitleInput('还缺最后一步');
  const summaryNode = findNodeByTitleInput('标准理解');
  expect(summaryNode).toHaveTextContent('答案解析');

  const callout = screen.getByTestId('answer-evaluation-callout');
  expect(
    within(callout).getByRole('button', { name: '查看答案解析' }),
  ).toBeEnabled();

  fireEvent.click(judgmentNode);
  fireEvent.click(
    screen.getByRole('button', { name: '查看答案解析' }),
  );

  await waitFor(() => {
    expect(summaryNode).toHaveAttribute('data-node-selected', 'true');
  });
});

test('matches a manual summary before a manual judgment as the same answer explanation path', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualSummaryBeforeJudgmentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  const judgmentNode = await screen.findByTestId('editor-node-manual-judgment');
  const summaryNode = await screen.findByTestId('editor-node-manual-summary');

  fireEvent.click(judgmentNode);
  expect(
    within(judgmentNode).getByRole('button', { name: '查看答案解析' }),
  ).toBeEnabled();

  fireEvent.click(
    within(judgmentNode).getByRole('button', { name: '查看答案解析' }),
  );

  await waitFor(() => {
    expect(summaryNode).toHaveAttribute('data-node-selected', 'true');
  });
  expect(summaryNode).toHaveTextContent('答案解析');
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  providerClient?: AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-answer-explanation-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-answer-explanation-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      return providerClient ?? createMockProviderClient({}, config);
    },
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createMockProviderClient(
  payloadByTaskName: Record<string, unknown>,
  _config?: AiConfig,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName] ?? {};
      const rawText = JSON.stringify(payload);

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

function findNodeByTitleInput(title: string) {
  const input = screen.getByDisplayValue(title);
  const node = input.closest('[data-testid^="editor-node-"]');

  if (!(node instanceof HTMLElement)) {
    throw new Error(`Unable to locate editor node for title ${title}.`);
  }

  return node;
}

function createManualQuestionAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动问题评估回归',
    workspaceId: 'workspace-manual-question-answer',
    rootId: 'theme-manual-question-answer',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-question-answer',
      title: '手动闭环模块',
      content: '验证手动问题也能进入评估主路径。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-question-answer',
    createNode({
      type: 'plan-step',
      id: 'step-manual-question-answer',
      title: '手动闭环步骤',
      content: '先有手动问题和手动回答，再进入评估。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-question-answer',
    createNode({
      type: 'question',
      id: 'manual-question',
      title: '手动问题',
      content: '为什么统一提交能减少重复渲染？',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'manual-question',
    createNode({
      type: 'answer',
      id: 'manual-answer',
      title: '手动回答草稿',
      content: '因为更新会先放到一起。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createManualSummaryBeforeJudgmentSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动答案解析配对',
    workspaceId: 'workspace-manual-summary-before-judgment',
    rootId: 'theme-manual-summary-before-judgment',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-summary-before-judgment',
      title: '手动配对模块',
      content: '验证手动 summary / judgment 也能接入统一主路径。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-summary-before-judgment',
    createNode({
      type: 'plan-step',
      id: 'step-manual-summary-before-judgment',
      title: '手动配对步骤',
      content: 'summary 在 judgment 前面时也应该能跳转。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-summary-before-judgment',
    createNode({
      type: 'question',
      id: 'manual-question-inline',
      title: '手动问题',
      content: '统一提交为什么能减少重复渲染？',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'manual-question-inline',
    createNode({
      type: 'answer',
      id: 'manual-answer-inline',
      title: '手动回答',
      content: '因为更新会先一起处理。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'manual-question-inline',
    createNode({
      type: 'summary',
      id: 'manual-summary',
      title: '手动标准理解',
      content: '先收集同一轮更新，再统一提交，因此不会为每次更新都重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'manual-question-inline',
    createNode({
      type: 'judgment',
      id: 'manual-judgment',
      title: '手动判断',
      content: '回答方向对了，但因果解释还可以更清楚。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
