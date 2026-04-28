import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import {
  createIndexedDbStorage,
  createLocalStorageStore,
  type StructuredDataStorage,
} from '../nodeDomain';
import WorkspaceRuntimeScreen from './WorkspaceRuntimeScreen';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('imports multiple local files without breaking resource library, search, export, or restore', async () => {
  const exportProbe = createExportProbe();
  const dependencies = createTestDependencies();
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByLabelText('批量导入本地文件'), {
    target: {
      files: [
        new File(
          ['# Rendering Notes\n\nReact will batch updates before commit.'],
          'rendering-notes.md',
          { type: 'text/markdown' },
        ),
        new File(
          ['State snapshots\n\nEach render captures its own closure.'],
          'state-snapshot.txt',
          { type: 'text/plain' },
        ),
      ],
    },
  });

  expect(
    await screen.findByRole('heading', {
      name: '将导入 2 份，跳过 0 份',
    }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '导入 2 份资料' }));

  expect(
    await screen.findByRole('button', { name: '定位资料 Rendering Notes' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: '定位资料 State snapshots' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '切换到资料区搜索' }));
  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: 'closure',
    },
  });

  expect(
    await screen.findByRole('button', { name: '跳转到 State snapshots' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '整个主题' }));
  fireEvent.click(screen.getByRole('button', { name: '导出内容' }));

  expect(await exportProbe.readText()).toContain('资料：Rendering Notes');
  expect(await exportProbe.readText()).toContain('资料：State snapshots');
  expect(await exportProbe.readText()).toContain('本地文件：rendering-notes.md');
  expect(await exportProbe.readText()).toContain('本地文件：state-snapshot.txt');

  await waitForSaved();

  const restoredSnapshot = await loadOnlyWorkspaceSnapshot(dependencies);
  const resourceMetadata = await loadOnlyResourceMetadata(dependencies);

  expect(
    Object.values(restoredSnapshot.tree.nodes).filter(
      (node) => node.type === 'resource',
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Rendering Notes',
      }),
      expect.objectContaining({
        title: 'State snapshots',
      }),
    ]),
  );
  expect(resourceMetadata).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        importMethod: 'batch',
        originalFileName: 'rendering-notes.md',
        sourceUri: '本地文件：rendering-notes.md',
        title: 'Rendering Notes',
      }),
      expect.objectContaining({
        importMethod: 'batch',
        originalFileName: 'state-snapshot.txt',
        sourceUri: '本地文件：state-snapshot.txt',
        title: 'State snapshots',
      }),
    ]),
  );
  expect(resourceMetadata[0]?.importBatchId).toBeTruthy();

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('button', { name: '定位资料 Rendering Notes' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: '定位资料 State snapshots' }),
  ).toBeInTheDocument();
});

function createTestDependencies(options?: {
  storage?: StructuredDataStorage;
}): WorkspaceRuntimeDependencies {
  const storage =
    options?.storage ??
    createIndexedDbStorage({
      databaseName: `whynote-runtime-batch-resource-import-${crypto.randomUUID()}`,
    });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-batch-resource-import-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient() {
      return {
        async generateObject(request) {
          const rawText = JSON.stringify({ planSteps: [] });

          return {
            taskName: request.taskName,
            content: request.parse(rawText),
            model: 'mock-model',
            providerLabel: 'mock-provider',
            rawText,
          };
        },
      };
    },
    defaultLearningMode: 'standard',
  };
}

function createExportProbe() {
  let exportedBlob: Blob | null = null;

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) {
      throw new Error('expected export content to be materialized as Blob');
    }

    exportedBlob = blob;
    return 'blob:batch-resource-import-export';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  return {
    async readText() {
      if (!exportedBlob) {
        throw new Error('export blob was not created');
      }

      return exportedBlob.text();
    },
  };
}

async function loadOnlyWorkspaceSnapshot(
  dependencies: WorkspaceRuntimeDependencies,
) {
  const workspaces = await dependencies.structuredDataStorage.listWorkspaces();

  if (workspaces.length !== 1) {
    throw new Error(
      `expected exactly one workspace, received ${String(workspaces.length)}`,
    );
  }

  const snapshot = await dependencies.structuredDataStorage.loadWorkspace(
    workspaces[0].id,
  );

  if (!snapshot) {
    throw new Error('expected workspace snapshot to exist');
  }

  return snapshot;
}

async function loadOnlyResourceMetadata(
  dependencies: WorkspaceRuntimeDependencies,
) {
  const workspaces = await dependencies.structuredDataStorage.listWorkspaces();

  if (workspaces.length !== 1) {
    throw new Error(
      `expected exactly one workspace, received ${String(workspaces.length)}`,
    );
  }

  return dependencies.structuredDataStorage.listResourceMetadata(workspaces[0].id);
}

async function waitForSaved() {
  await waitFor(() => {
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });
}
