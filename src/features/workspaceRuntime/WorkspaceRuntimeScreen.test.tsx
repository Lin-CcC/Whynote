import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  vi.restoreAllMocks();
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

test('keeps the active editor input mounted and focused while autosave status changes', async () => {
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  const moduleTitleInput = screen.getByDisplayValue('默认模块');

  moduleTitleInput.focus();
  expect(moduleTitleInput).toHaveFocus();

  fireEvent.change(moduleTitleInput, {
    target: {
      value: '输入期间不应重挂载',
    },
  });

  await waitFor(
    () => {
      expect(screen.getByText('保存中')).toBeInTheDocument();
    },
    {
      timeout: 2_000,
    },
  );

  expect(screen.getByDisplayValue('输入期间不应重挂载')).toBe(moduleTitleInput);
  expect(moduleTitleInput).toHaveFocus();

  await waitFor(
    () => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    },
    {
      timeout: 2_000,
    },
  );

  expect(screen.getByDisplayValue('输入期间不应重挂载')).toBe(moduleTitleInput);
  expect(moduleTitleInput).toHaveFocus();
});

test('keeps sidebar context synchronized while editing a long module title', async () => {
  const dependencies = createTestDependencies();
  const nextTitle =
    '这是一个会同时带动左右侧栏上下文更新的超长模块标题，用来验证止抖修复后仍然同步但不打断输入';

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  const moduleTitleInput = screen.getByDisplayValue('默认模块');

  moduleTitleInput.focus();
  expect(moduleTitleInput).toHaveFocus();

  fireEvent.change(moduleTitleInput, {
    target: {
      value: nextTitle,
    },
  });

  await waitFor(
    () => {
      expect(moduleTitleInput).toHaveFocus();
      expect(moduleTitleInput).toHaveValue(nextTitle);
      expect(screen.getByTitle(`当前节点：${nextTitle}`)).toBeInTheDocument();
      expect(screen.getAllByTitle(`模块 · ${nextTitle}`).length).toBeGreaterThan(0);
      expect(screen.getByTitle(`当前默认只搜模块：${nextTitle}`)).toBeInTheDocument();
      expect(screen.getByText('保存中')).toBeInTheDocument();
    },
    {
      timeout: 2_000,
    },
  );

  await waitFor(
    () => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    },
    {
      timeout: 2_000,
    },
  );

  expect(moduleTitleInput).toHaveFocus();
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
    screen.getByText(/当前还没有可供运行时动作使用的学习模块/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '新建模块' })[0]);

  expect(await screen.findByDisplayValue('新模块')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '为当前模块规划学习路径' }),
  ).toBeInTheDocument();
});

test('restores question block collapse state after remounting the runtime screen', async () => {
  const dependencies = await createPreloadedDependencies(
    createRuntimeQuestionBlockSnapshot(),
  );
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    within(
      screen.getByTestId('question-block-answer-group-answer-runtime-current'),
    ).getByRole('button', {
      name: '展开历史评估与旧解析',
    }),
  );

  fireEvent.click(
    within(screen.getByTestId('editor-node-answer-runtime-current')).getByRole(
      'button',
      {
        name: '收起正文',
      },
    ),
  );
  fireEvent.click(
    within(
      screen.getByTestId('question-block-question-runtime-main'),
    ).getByRole('button', {
      name: '收起 block',
    }),
  );

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByRole('heading', { name: '当前学习模块' });

  const questionBlock = screen.getByTestId('question-block-question-runtime-main');

  expect(questionBlock).toHaveAttribute('data-collapsed', 'true');

  fireEvent.click(
    within(questionBlock).getByRole('button', {
      name: '展开 block',
    }),
  );

  expect(
    within(screen.getByTestId('editor-node-answer-runtime-current')).getByRole(
      'button',
      {
        name: '展开正文',
      },
    ),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByTestId('question-block-answer-group-answer-runtime-current'),
    ).getByRole('button', {
      name: '收起历史评估与旧解析',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('editor-node-judgment-runtime-current-history'),
  ).toBeInTheDocument();
});

test('keeps the left runtime action card auxiliary while the main question block path stays reachable', async () => {
  const dependencies = await createPreloadedDependencies(
    createRuntimeQuestionNeedingAnswerSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    within(screen.getByRole('tree', { name: '当前模块结构' })).getByRole(
      'button',
      {
        name: /待回答问题/,
      },
    ),
  );

  expect(screen.getByText('辅助概览')).toBeInTheDocument();
  expect(screen.getByText('下一步建议')).toBeInTheDocument();
  expect(screen.getByText('冗余入口')).toBeInTheDocument();
  expect(screen.getByTestId('question-direct-answer-callout')).toBeInTheDocument();

  const blockActions = screen.getByTestId(
    'question-block-actions-question-runtime-open',
  );

  expect(
    within(blockActions).getByRole('button', { name: '直接回答当前问题' }),
  ).toBeInTheDocument();
  expect(
    within(blockActions).getByRole('button', { name: '插入回答' }),
  ).toBeInTheDocument();
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
  expect(
    screen.getByText(/主编辑流已经收口到中间的 question block/),
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

  expect(await screen.findByText('步骤可考虑完成')).toBeInTheDocument();
  expect(screen.getByText('当前步骤已满足最小学习闭环。')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^问题什么是闭环？$/ }));

  await waitFor(() => {
    expect(screen.queryByText('步骤可考虑完成')).not.toBeInTheDocument();
  });
  expect(screen.queryByText('当前步骤已满足最小学习闭环。')).not.toBeInTheDocument();
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

  expect(await screen.findByText('步骤可考虑完成')).toBeInTheDocument();
  expect(screen.getByText('当前步骤已满足最小学习闭环。')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('理解闭环 内容'), {
    target: {
      value: '补充后需要重新判断建议是否仍然成立。',
    },
  });

  await waitFor(() => {
    expect(screen.queryByText('步骤可考虑完成')).not.toBeInTheDocument();
  });
  expect(screen.queryByText('当前步骤已满足最小学习闭环。')).not.toBeInTheDocument();
});

test('deletes a non-selected preset without changing the current config', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  createAiGeminiPreset('我的 Gemini');
  switchAiCurrentConfigToUnsaved();
  createAiCustomPreset('测试 Key');

  fireEvent.click(screen.getByRole('button', { name: '删除预设：我的 Gemini' }));

  expect(confirmSpy).toHaveBeenCalledWith(
    expect.stringContaining('是否删除本地预设「我的 Gemini」？'),
  );
  expect(screen.getByLabelText('Base URL')).toHaveValue('https://example.com/v1');
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('custom-key');
  expect(screen.getByLabelText('Model')).toHaveValue('custom-model');
  expect(getAiCurrentConfigSelect().selectedOptions[0]?.text).toBe('测试 Key');
  expect(findOptionValueByText(getAiCurrentConfigSelect(), '我的 Gemini')).toBeNull();
  expect(
    screen.getByText('已删除本地预设：我的 Gemini。当前配置保持不变。'),
  ).toBeInTheDocument();
});

test('deletes the selected preset and returns the UI to current config unsaved', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  createAiGeminiPreset('我的 Gemini');

  fireEvent.click(screen.getByRole('button', { name: '删除预设：我的 Gemini' }));

  expect(confirmSpy).toHaveBeenCalledWith(
    expect.stringContaining('如果它正被当前配置使用，界面会回到“当前配置（未保存）”。'),
  );
  expect(getAiCurrentConfigSelect()).toHaveValue('');
  expect(getAiCurrentConfigSelect().selectedOptions[0]?.text).toBe('当前配置（未保存）');
  expect(screen.getByLabelText('Base URL')).toHaveValue(
    'https://generativelanguage.googleapis.com/v1beta/openai',
  );
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('gemini-key');
  expect(screen.getByLabelText('Model')).toHaveValue('gemini-2.5-flash');
  expect(findOptionValueByText(getAiCurrentConfigSelect(), '我的 Gemini')).toBeNull();
  expect(
    screen.getByText(
      '已删除本地预设：我的 Gemini。当前配置保持不变，已回到未保存状态。',
    ),
  ).toBeInTheDocument();
});

test('renames the selected preset immediately without changing its content', async () => {
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  createAiGeminiPreset('我的 Gemini');

  fireEvent.click(screen.getByRole('button', { name: '重命名预设：我的 Gemini' }));
  fireEvent.change(screen.getByLabelText('重命名预设：我的 Gemini'), {
    target: {
      value: '工作用 Gemini',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存名称' }));

  expect(getAiCurrentConfigSelect().selectedOptions[0]?.text).toBe('工作用 Gemini');
  expect(findOptionValueByText(getAiCurrentConfigSelect(), '我的 Gemini')).toBeNull();
  expect(findOptionValueByText(getAiCurrentConfigSelect(), '工作用 Gemini')).not.toBeNull();
  expect(screen.getByLabelText('Base URL')).toHaveValue(
    'https://generativelanguage.googleapis.com/v1beta/openai',
  );
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('gemini-key');
  expect(screen.getByLabelText('Model')).toHaveValue('gemini-2.5-flash');
  expect(
    screen.getByText('已重命名本地预设：我的 Gemini -> 工作用 Gemini。'),
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

function createRuntimeQuestionBlockSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '运行时问题块主题',
    workspaceId: 'workspace-runtime-question-block',
    rootId: 'theme-runtime-question-block',
    createdAt: '2026-04-30T10:00:00.000Z',
    updatedAt: '2026-04-30T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-runtime-question-block',
      title: '运行时问题块模块',
      content: '',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-runtime-question-block',
    createNode({
      type: 'plan-step',
      id: 'step-runtime-question-block',
      title: '运行时问题块步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-runtime-question-block',
    createNode({
      type: 'question',
      id: 'question-runtime-main',
      title: '运行时主问题',
      content: '用于验证主视图折叠状态持久化。',
      currentAnswerId: 'answer-runtime-current',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-runtime-main',
    createNode({
      type: 'answer',
      id: 'answer-runtime-old',
      title: '早期回答',
      content: '这是早期回答。',
      createdAt: '2026-04-30T10:01:00.000Z',
      updatedAt: '2026-04-30T10:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-runtime-main',
    createNode({
      type: 'judgment',
      id: 'judgment-runtime-old',
      title: '早期评估',
      content: '这是早期评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-runtime-old',
      sourceAnswerUpdatedAt: '2026-04-30T10:01:00.000Z',
      createdAt: '2026-04-30T10:02:00.000Z',
      updatedAt: '2026-04-30T10:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-runtime-main',
    createNode({
      type: 'answer',
      id: 'answer-runtime-current',
      title: '当前回答',
      content: '这是当前回答。',
      createdAt: '2026-04-30T10:03:00.000Z',
      updatedAt: '2026-04-30T10:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-runtime-main',
    createNode({
      type: 'judgment',
      id: 'judgment-runtime-current-history',
      title: '当前旧评估',
      content: '这是当前回答的旧评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-runtime-current',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      createdAt: '2026-04-30T10:03:30.000Z',
      updatedAt: '2026-04-30T10:03:30.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-runtime-main',
    createNode({
      type: 'judgment',
      id: 'judgment-runtime-current',
      title: '当前评估',
      content: '这是当前评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-runtime-current',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      createdAt: '2026-04-30T10:04:00.000Z',
      updatedAt: '2026-04-30T10:04:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createRuntimeQuestionNeedingAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '运行时待答主题',
    workspaceId: 'workspace-runtime-open-question',
    rootId: 'theme-runtime-open-question',
    createdAt: '2026-04-30T10:30:00.000Z',
    updatedAt: '2026-04-30T10:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-runtime-open-question',
      title: '运行时待答模块',
      content: '',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-runtime-open-question',
    createNode({
      type: 'plan-step',
      id: 'step-runtime-open-question',
      title: '运行时待答步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-runtime-open-question',
    createNode({
      type: 'question',
      id: 'question-runtime-open',
      title: '待回答问题',
      content: '用于验证左侧 action card 已经降级为辅助概览。',
      createdAt: '2026-04-30T10:30:00.000Z',
      updatedAt: '2026-04-30T10:30:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function getAiCurrentConfigSelect() {
  return screen.getByLabelText('当前配置') as HTMLSelectElement;
}

function switchAiCurrentConfigToUnsaved() {
  fireEvent.change(getAiCurrentConfigSelect(), {
    target: {
      value: '',
    },
  });
}

function createAiGeminiPreset(name: string) {
  fireEvent.change(screen.getByLabelText('厂商模板'), {
    target: {
      value: 'gemini-openai-compatible',
    },
  });
  fireEvent.change(screen.getByLabelText(/API Key/i), {
    target: {
      value: 'gemini-key',
    },
  });
  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: name,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存为新预设' }));
}

function createAiCustomPreset(name: string) {
  fireEvent.change(screen.getByLabelText('厂商模板'), {
    target: {
      value: 'custom-openai-compatible',
    },
  });
  fireEvent.change(screen.getByLabelText('Base URL'), {
    target: {
      value: 'https://example.com/v1',
    },
  });
  fireEvent.change(screen.getByLabelText(/API Key/i), {
    target: {
      value: 'custom-key',
    },
  });
  fireEvent.change(screen.getByLabelText('Model'), {
    target: {
      value: 'custom-model',
    },
  });
  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: name,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存为新预设' }));
}

function findOptionValueByText(
  select: HTMLSelectElement,
  optionLabel: string,
) {
  return (
    [...select.options].find((option) => option.text === optionLabel)?.value ??
    null
  );
}
