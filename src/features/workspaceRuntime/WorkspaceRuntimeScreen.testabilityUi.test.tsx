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

test('marks a direct-answer draft as the current answer in the text view', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualQuestionDirectAnswerSnapshot(),
    createMockProviderClient({
      'learning-action-draft': {
        title: 'AI 回答草稿',
        content: '这是一版直接回答生成的当前回答草稿。',
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('手动问题 标题'));
  fireEvent.click(
    within(await screen.findByTestId('question-direct-answer-callout')).getByRole(
      'button',
      { name: '直接回答当前问题' },
    ),
  );

  const generatedAnswerTitle = await screen.findByDisplayValue('AI 回答草稿');
  const generatedAnswerNode = generatedAnswerTitle.closest('[data-testid^="editor-node-"]');

  expect(generatedAnswerNode).not.toBeNull();
  expect(generatedAnswerNode).toHaveTextContent('当前回答');
  expect(
    screen.getByTestId('editor-node-question-manual-direct-answer'),
  ).toHaveTextContent('当前回答：AI 回答草稿');
});

test('keeps an empty current answer draft on the main editing path instead of only showing direct answer', async () => {
  const dependencies = await createPreloadedDependencies(
    createEmptyCurrentAnswerDraftSnapshot(),
    createMockProviderClient({}),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('空草稿当前回答 标题'));

  const callout = await screen.findByTestId('question-current-answer-draft-callout');

  expect(
    within(callout).getByRole('button', { name: '回到当前回答继续修改' }),
  ).toHaveClass('workspace-primaryAction');
  expect(
    within(callout).getByRole('button', { name: '直接回答当前问题' }),
  ).toBeInTheDocument();
  const blockActions = screen.getByTestId(
    'question-block-actions-question-empty-current-draft',
  );

  expect(
    within(blockActions).getByRole('button', { name: '生成追问' }),
  ).toBeInTheDocument();
  expect(
    within(blockActions).getByRole('button', { name: '插入追问' }),
  ).toBeInTheDocument();
  expect(
    within(blockActions).getByRole('button', { name: '生成总结' }),
  ).toBeInTheDocument();
  expect(
    within(blockActions).getByRole('button', { name: '插入总结' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(callout).getByRole('button', { name: '回到当前回答继续修改' }),
  );

  const draftAnswerNode = screen.getByTestId('editor-node-answer-empty-current-draft');

  await waitFor(() => {
    expect(draftAnswerNode).toHaveAttribute('data-node-selected', 'true');
  });
  expect(draftAnswerNode).toHaveTextContent('当前回答');
  expect(
    screen.getByTestId('editor-node-question-empty-current-draft'),
  ).toHaveTextContent('当前回答：新回答（正文为空）');
  expect(
    screen.getByTestId('question-block-actions-question-empty-current-draft'),
  ).toBeInTheDocument();
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  providerClient: AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-testability-ui-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-testability-ui-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(_config: AiConfig) {
      return providerClient;
    },
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createMockProviderClient(
  payloadByTaskName: Record<string, unknown>,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName] ?? {};
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

function createManualQuestionDirectAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动问题直接回答',
    workspaceId: 'workspace-manual-direct-answer-ui',
    rootId: 'theme-manual-direct-answer-ui',
    createdAt: '2026-04-30T13:00:00.000Z',
    updatedAt: '2026-04-30T13:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-direct-answer-ui',
      title: '手动问题模块',
      content: '',
      createdAt: '2026-04-30T13:00:00.000Z',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-direct-answer-ui',
    createNode({
      type: 'question',
      id: 'question-manual-direct-answer',
      title: '手动问题',
      content: '让 direct answer 生成一版当前回答。',
      createdAt: '2026-04-30T13:00:00.000Z',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createEmptyCurrentAnswerDraftSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '空草稿当前回答',
    workspaceId: 'workspace-empty-current-draft',
    rootId: 'theme-empty-current-draft',
    createdAt: '2026-04-30T14:00:00.000Z',
    updatedAt: '2026-04-30T14:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-empty-current-draft',
      title: '空草稿模块',
      content: '',
      createdAt: '2026-04-30T14:00:00.000Z',
      updatedAt: '2026-04-30T14:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-empty-current-draft',
    createNode({
      type: 'question',
      id: 'question-empty-current-draft',
      title: '问题：空草稿当前回答',
      content: '这个问题已经有当前回答草稿，但正文还是空的。',
      currentAnswerId: 'answer-empty-current-draft',
      createdAt: '2026-04-30T14:00:00.000Z',
      updatedAt: '2026-04-30T14:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-empty-current-draft',
    createNode({
      type: 'answer',
      id: 'answer-empty-current-draft',
      title: '新回答',
      content: '',
      createdAt: '2026-04-30T14:01:00.000Z',
      updatedAt: '2026-04-30T14:01:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
