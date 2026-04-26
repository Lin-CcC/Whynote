import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

test('creates a minimal real workspace when IndexedDB is empty', async () => {
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('heading', { name: '当前学习模块' }),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('默认模块')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /状态与渲染/i }),
  ).not.toBeInTheDocument();

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

test('runs learning-engine plan-step generation from UI and materializes the result into the tree', async () => {
  const dependencies = createTestDependencies({
    providerClient: createMockProviderClient({
      'plan-step-generation': {
        planSteps: [
          {
            title: '建立最小概念框架',
            content: '先明确这个模块要解决的核心问题。',
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
  fireEvent.click(screen.getByRole('button', { name: '保存 AI 配置' }));
  fireEvent.click(
    screen.getByRole('button', { name: '为当前模块生成 plan-step' }),
  );

  expect(
    await screen.findByDisplayValue('建立最小概念框架'),
  ).toBeInTheDocument();
  expect(screen.getByText('已为模块生成 3 个 plan-step。')).toBeInTheDocument();
});

test('locks editor mutations while an AI action is running and keeps manual edits from slipping in', async () => {
  const deferredProvider = createDeferredProviderClient();
  const dependencies = createTestDependencies({
    providerClient: deferredProvider.providerClient,
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: '为当前模块生成 plan-step' }),
  );

  const moduleTitleInput = await screen.findByDisplayValue('默认模块');

  expect(
    await screen.findByText(/文本编辑和结构操作已临时锁定/),
  ).toBeInTheDocument();
  expect(moduleTitleInput).toBeDisabled();
  expect(screen.getByRole('button', { name: '插入子节点' })).toBeDisabled();
  expect(
    screen.getByRole('button', {
      name: /默认模块先定义当前主题下的第一个学习方向。/,
    }),
  ).toBeDisabled();

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

  fireEvent.click(
    screen.getByRole('button', { name: '为当前模块生成 plan-step' }),
  );

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

  fireEvent.click(
    screen.getByRole('button', { name: /^步骤理解闭环$/ }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: '建议完成当前步骤' }),
  );

  expect(
    await screen.findByRole('heading', { name: '当前步骤可以考虑标记完成' }),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: /^问题什么是闭环？$/ }),
  );

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

  fireEvent.click(
    screen.getByRole('button', { name: /^步骤理解闭环$/ }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: '建议完成当前步骤' }),
  );

  expect(
    await screen.findByRole('heading', { name: '当前步骤可以考虑标记完成' }),
  ).toBeInTheDocument();

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

test('focuses a resource entry through the library without resetting the editor selection', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceFocusSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  expect(await screen.findByDisplayValue('资源定位模块')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: /^步骤构建理解$/ }),
  );
  await waitFor(() => {
    expect(
      getSectionByHeading('当前焦点').getByText('步骤 · 构建理解'),
    ).toBeInTheDocument();
  });
  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 官方文档' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');
  const editorFocusCard = getSectionByHeading('当前焦点');

  expect(resourceFocusCard.getByText('资料 · React 官方文档')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('https://react.dev/reference/react/useState'),
  ).toBeInTheDocument();
  expect(
    editorFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
});

test('focuses a resource fragment through the library and shows its excerpt details', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceFocusSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  expect(await screen.findByDisplayValue('资源定位模块')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: /^步骤构建理解$/ }),
  );
  await waitFor(() => {
    expect(
      getSectionByHeading('当前焦点').getByText('步骤 · 构建理解'),
    ).toBeInTheDocument();
  });
  fireEvent.click(
    screen.getByRole('button', { name: '定位摘录 批处理摘录' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');
  const editorFocusCard = getSectionByHeading('当前焦点');

  expect(resourceFocusCard.getByText('摘录 · 批处理摘录')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('React 会把多个 state 更新批处理后再统一提交。'),
  ).toBeInTheDocument();
  expect(resourceFocusCard.getByText('useState > batching')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
  expect(
    editorFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
});

test('focuses a resource hit from search results without falling back to the module default node', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceFocusSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  expect(await screen.findByDisplayValue('资源定位模块')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: /^步骤构建理解$/ }),
  );
  await waitFor(() => {
    expect(
      getSectionByHeading('当前焦点').getByText('步骤 · 构建理解'),
    ).toBeInTheDocument();
  });
  fireEvent.click(
    screen.getByRole('button', { name: '切换到资料区搜索' }),
  );
  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: '批处理',
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: '跳转到 批处理摘录' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');
  const editorFocusCard = getSectionByHeading('当前焦点');

  expect(resourceFocusCard.getByText('摘录 · 批处理摘录')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
  expect(
    editorFocusCard.getByText('步骤 · 构建理解'),
  ).toBeInTheDocument();
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
      content: '确认问题已经形成回答和总结。',
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
      content: '当问题已经得到回答并被总结时，就形成了学习闭环。',
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
      title: '阶段总结',
      content: '当前步骤已经有问题、回答和总结，可用于完成建议。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createResourceFocusSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '资料定位主题',
    workspaceId: 'workspace-resource-focus',
    rootId: 'theme-resource-focus',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-resource-focus',
      title: '资源定位模块',
      content: '用于验证资料焦点和模块内 editor 选区可以并存。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-resource-focus',
    createNode({
      type: 'plan-step',
      id: 'step-resource-focus',
      title: '构建理解',
      content: '先固定一个非默认 editor 焦点，再验证资源定位不会把它冲掉。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-resource-focus',
    createNode({
      type: 'question',
      id: 'question-resource-focus',
      title: '什么是批处理？',
      content: '理解 React 为什么会把多次状态更新合并处理。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-resource-focus',
    createNode({
      type: 'answer',
      id: 'answer-resource-focus',
      title: '批处理答案',
      content: 'React 会把一轮事件里的多次更新合并后再提交。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 state 更新与 Hook 的参考资料。',
      sourceUri: 'https://react.dev/reference/react/useState',
      mimeType: 'text/html',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用来解释批处理的上下文。',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function getSectionByHeading(name: string) {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return within(section);
}

async function findSectionByHeading(name: string) {
  const heading = await screen.findByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return within(section);
}
