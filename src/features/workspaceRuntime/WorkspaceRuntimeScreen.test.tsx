import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

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

test('creates a minimal real workspace when IndexedDB is empty', async () => {
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('heading', { name: '当前学习模块' }),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('默认模块')).toBeInTheDocument();

  const workspaces = await dependencies.structuredDataStorage.listWorkspaces();
  const snapshot = await dependencies.structuredDataStorage.loadWorkspace(
    workspaces[0].id,
  );

  expect(workspaces).toHaveLength(1);
  expect(snapshot?.workspace.title).toBe('新的学习主题');
  expect(
    snapshot?.tree.nodes[snapshot.tree.rootId].childIds.map(
      (childId) => snapshot.tree.nodes[childId].title,
    ),
  ).toEqual(['默认模块']);
});

test('persists workspace edits and restores them on the next mount', async () => {
  const dependencies = createTestDependencies();
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByDisplayValue('默认模块'), {
    target: {
      value: '已持久化模块',
    },
  });

  await waitFor(() => {
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(await screen.findByDisplayValue('已持久化模块')).toBeInTheDocument();
});

test('does not trigger a cross-component render update warning while editing workspace content', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const dependencies = createTestDependencies();

  try {
    render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
    await screen.findByRole('heading', { name: '当前学习模块' });

    fireEvent.change(screen.getByDisplayValue('默认模块'), {
      target: {
        value: 'render warning fixed',
      },
    });

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('render warning fixed'),
      ).toBeInTheDocument();
    });

    const hasCrossComponentWarning = consoleErrorSpy.mock.calls.some((call) =>
      call.some(
        (argument) =>
          typeof argument === 'string' &&
          argument.includes('Cannot update a component'),
      ),
    );

    expect(hasCrossComponentWarning).toBe(false);
  } finally {
    consoleErrorSpy.mockRestore();
  }
});

test('guides recovery from the AI action card when no module exists', async () => {
  const dependencies = await createPreloadedDependencies(
    createEmptyWorkspaceSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  expect(
    screen.getByText(/当前还没有可供 AI 操作的学习模块/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '新建模块' })[0]);

  expect(await screen.findByDisplayValue('新模块')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '为当前模块规划学习路径' }),
  ).toBeInTheDocument();
});

test('runs learning-engine plan-step generation from UI and materializes the result into the tree', async () => {
  const dependencies = createTestDependencies({
    providerClient: createMockProviderClient({
      'plan-step-generation': {
        planSteps: [
          {
            title: '建立最小概念框架',
            content: '先明确这个模块要解决的核心问题。',
            introductions: [
              {
                title: '铺垫：先建立进入问题的基础图景',
                content: '先说明为什么问这个问题，再进入主问题。',
              },
            ],
            questions: [
              {
                title: '并发渲染到底改变了什么？',
                content: '聚焦运行时行为变化。',
              },
            ],
          },
        ],
      },
    }),
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByRole('textbox', { name: /Base URL/i }), {
    target: {
      value: 'https://api.example.com/v1',
    },
  });
  fireEvent.change(screen.getByLabelText(/API Key/i), {
    target: {
      value: 'test-key',
    },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Model/i }), {
    target: {
      value: 'gpt-test',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存当前配置' }));
  fireEvent.click(screen.getByRole('button', { name: '为当前模块规划学习路径' }));

  expect(await screen.findByDisplayValue('建立最小概念框架')).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('先建立进入问题的基础图景'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('并发渲染到底改变了什么？'),
  ).toBeInTheDocument();
});

test('locks editor mutations while an AI action is running and keeps manual edits from slipping in', async () => {
  const deferredProvider = createDeferredProviderClient();
  const dependencies = createTestDependencies({
    providerClient: deferredProvider.providerClient,
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: '为当前模块规划学习路径' }));

  const moduleTitleInput = await screen.findByDisplayValue('默认模块');

  expect(moduleTitleInput).toBeDisabled();
  expect(screen.getByRole('button', { name: '插入子节点' })).toBeDisabled();

  fireEvent.change(moduleTitleInput, {
    target: {
      value: '请求期间手动改名',
    },
  });

  expect(moduleTitleInput).toHaveValue('默认模块');

  deferredProvider.resolve('plan-step-generation', {
    planSteps: [
      {
        title: 'AI 生成步骤',
        content: '由延迟响应返回。',
        introductions: [
          {
            title: '铺垫：等待规划结果',
            content: '先建立一个最小讲解节点。',
          },
        ],
        questions: [
          {
            title: '这一步到底要解决什么？',
            content: '确认 AI 结果已经落树。',
          },
        ],
      },
    ],
  });

  expect(await screen.findByDisplayValue('AI 生成步骤')).toBeInTheDocument();
  expect(screen.getByDisplayValue('默认模块')).toBeInTheDocument();
});

test('shows a visible error when workspace autosave fails', async () => {
  const baseStorage = createIndexedDbStorage({
    databaseName: `whynote-runtime-save-failure-${crypto.randomUUID()}`,
  });
  const dependencies = createTestDependencies({
    storage: createFailingSaveStorage(baseStorage),
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByDisplayValue('默认模块'), {
    target: {
      value: '触发保存失败',
    },
  });

  expect(
    await screen.findByText('工作区保存失败：mock save failure'),
  ).toBeInTheDocument();
});

test('shows a visible error when the provider call fails', async () => {
  const dependencies = createTestDependencies({
    providerClient: createThrowingProviderClient('provider offline'),
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: '为当前模块规划学习路径' }));

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(
      'AI 动作失败：provider offline',
    );
  });
});

test('clears completion suggestion after switching to another node', async () => {
  const dependencies = await createPreloadedDependencies(
    createCompletionSuggestionSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: /^步骤理解闭环$/ }));
  const completionSuggestionButton = screen.getByRole('button', {
    name: '查看当前步骤完成依据',
  });
  await waitFor(() => {
    expect(completionSuggestionButton).toBeEnabled();
  });
  fireEvent.click(completionSuggestionButton);

  expect(
    await screen.findByRole('heading', { name: '当前步骤可以考虑标记完成' }),
  ).toBeInTheDocument();
  expect(screen.getByText('当前步骤已满足最小学习闭环。')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^问题什么是闭环？$/ }));

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: '当前步骤可以考虑标记完成' }),
    ).not.toBeInTheDocument();
  });
});

test('clears completion suggestion after editing the related workspace content', async () => {
  const dependencies = await createPreloadedDependencies(
    createCompletionSuggestionSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: /^步骤理解闭环$/ }));
  const completionSuggestionButton = screen.getByRole('button', {
    name: '查看当前步骤完成依据',
  });
  await waitFor(() => {
    expect(completionSuggestionButton).toBeEnabled();
  });
  fireEvent.click(completionSuggestionButton);

  expect(
    await screen.findByRole('heading', { name: '当前步骤可以考虑标记完成' }),
  ).toBeInTheDocument();
  expect(screen.getByText('当前步骤已满足最小学习闭环。')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('理解闭环 内容'), {
    target: {
      value: '补充后需要重新判断建议是否仍然成立。',
    },
  });

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: '当前步骤可以考虑标记完成' }),
    ).not.toBeInTheDocument();
  });
});

function createTestDependencies(options?: {
  providerClient?: AiProviderClient;
  storage?: StructuredDataStorage;
}): WorkspaceRuntimeDependencies {
  const storage =
    options?.storage ??
    createIndexedDbStorage({
      databaseName: `whynote-runtime-${crypto.randomUUID()}`,
    });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      return options?.providerClient ?? createMockProviderClient({}, config);
    },
    defaultLearningMode: 'standard',
  };
}

async function createPreloadedDependencies(snapshot: WorkspaceSnapshot) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-preloaded-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);

  return createTestDependencies({
    storage,
  });
}

function createMockProviderClient(
  payloadByTaskName: Record<string, unknown>,
  _config?: AiConfig,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName] ?? {
        planSteps: [],
      };
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

function createDeferredProviderClient() {
  const resolvers = new Map<string, (payload: unknown) => void>();

  return {
    providerClient: {
      async generateObject<T>(
        request: AiProviderObjectRequest<T>,
      ): Promise<AiProviderObjectResponse<T>> {
        const payload = await new Promise<unknown>((resolve) => {
          resolvers.set(request.taskName, resolve);
        });
        const rawText = JSON.stringify(payload);

        return {
          taskName: request.taskName,
          content: request.parse(rawText) as T,
          model: 'mock-model',
          providerLabel: 'mock-provider',
          rawText,
        };
      },
    } satisfies AiProviderClient,
    resolve(taskName: string, payload: unknown) {
      const resolve = resolvers.get(taskName);

      if (!resolve) {
        throw new Error(`Task ${taskName} is not pending.`);
      }

      resolvers.delete(taskName);
      resolve(payload);
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

function createFailingSaveStorage(
  storage: StructuredDataStorage,
): StructuredDataStorage {
  let saveCount = 0;

  return {
    async close() {
      await storage.close();
    },
    async deleteWorkspace(workspaceId: string) {
      await storage.deleteWorkspace(workspaceId);
    },
    async listResourceMetadata(workspaceId: string) {
      return storage.listResourceMetadata(workspaceId);
    },
    async upsertResourceMetadata(record) {
      await storage.upsertResourceMetadata(record);
    },
    async listWorkspaces() {
      return storage.listWorkspaces();
    },
    async loadWorkspace(workspaceId: string) {
      return storage.loadWorkspace(workspaceId);
    },
    async saveWorkspace(snapshot) {
      saveCount += 1;

      if (saveCount >= 2) {
        throw new Error('mock save failure');
      }

      await storage.saveWorkspace(snapshot);
    },
  };
}

function createCompletionSuggestionSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '建议测试主题',
    workspaceId: 'workspace-completion-suggestion',
    rootId: 'theme-completion-suggestion',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-completion',
      title: '理解闭环模块',
      content: '用于验证步骤完成建议。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-completion',
    createNode({
      type: 'plan-step',
      id: 'step-completion',
      title: '理解闭环',
      content: '确认问题已经形成回答、判断和总结。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-completion',
    createNode({
      type: 'question',
      id: 'question-completion',
      title: '什么是闭环？',
      content: '围绕问题、回答和总结之间的关系解释。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-completion',
    createNode({
      type: 'answer',
      id: 'answer-completion',
      title: '回答草稿',
      content: '当问题已经得到回答并被解释总结时，就形成了学习闭环。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-completion',
    createNode({
      type: 'judgment',
      id: 'judgment-completion',
      title: '判断：已答到当前问题',
      content: '这个回答已经覆盖当前问题的关键点。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-completion',
    createNode({
      type: 'summary',
      id: 'summary-completion',
      title: '总结：标准理解',
      content: '当前步骤已经形成问题、回答、判断和总结，可以用于完成建议。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createEmptyWorkspaceSnapshot(): WorkspaceSnapshot {
  return createWorkspaceSnapshot({
    title: '空模块主题',
    workspaceId: 'workspace-empty-module',
    rootId: 'theme-empty-module',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });
}
