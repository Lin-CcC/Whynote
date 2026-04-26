import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  type StructuredDataStorage,
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
