import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import {
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type StructuredDataStorage,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import type { WorkspaceRuntimeDependencies } from '../workspaceRuntimeTypes';
import { useWorkspaceRuntime } from './useWorkspaceRuntime';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  vi.useRealTimers();
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('debounces autosave and avoids switching to saving during short pauses', async () => {
  const snapshot = createPreloadedSnapshot();
  const baseStorage = createIndexedDbStorage({
    databaseName: `whynote-runtime-hook-save-debounce-${crypto.randomUUID()}`,
  });

  await baseStorage.saveWorkspace(snapshot);

  const countingStorage = createCountingSaveStorage(baseStorage);
  openedStorages.push(countingStorage.storage);

  const dependencies = {
    structuredDataStorage: countingStorage.storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-hook-save-debounce-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
  const { result } = renderHook(() => useWorkspaceRuntime(dependencies));

  await waitFor(() => {
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.snapshot).not.toBeNull();
  });

  vi.useFakeTimers();

  const firstSnapshot = cloneSnapshotWithModuleTitle(
    result.current.snapshot!,
    '默认模块 A',
  );

  act(() => {
    result.current.handleSnapshotChange(firstSnapshot);
  });

  expect(result.current.saveStatus).toBe('idle');
  expect(countingStorage.getSaveCount()).toBe(0);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });

  const secondSnapshot = cloneSnapshotWithModuleTitle(
    firstSnapshot,
    '默认模块 AB',
  );

  act(() => {
    result.current.handleSnapshotChange(secondSnapshot);
  });

  expect(result.current.saveStatus).toBe('idle');
  expect(countingStorage.getSaveCount()).toBe(0);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

  expect(result.current.saveStatus).toBe('idle');
  expect(countingStorage.getSaveCount()).toBe(0);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });

  expect(result.current.saveStatus).toBe('saving');
  expect(countingStorage.getSaveCount()).toBe(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(result.current.saveStatus).toBe('saved');
  expect(countingStorage.getSaveCount()).toBe(1);
});

function createPreloadedSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'Hook 保存状态测试',
    workspaceId: 'workspace-hook-save-status',
    rootId: 'theme-hook-save-status',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
  });

  return {
    ...snapshot,
    tree: insertChildNode(
      snapshot.tree,
      snapshot.workspace.rootNodeId,
      createNode({
        type: 'module',
        id: 'module-hook-save-status',
        title: '默认模块',
        content: '验证自动保存状态切换。',
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
      }),
    ),
  };
}

function cloneSnapshotWithModuleTitle(
  snapshot: WorkspaceSnapshot,
  moduleTitle: string,
): WorkspaceSnapshot {
  const nextSnapshot = structuredClone(snapshot);
  const moduleNodeId = nextSnapshot.tree.nodes[nextSnapshot.tree.rootId].childIds[0];
  const moduleNode = nextSnapshot.tree.nodes[moduleNodeId];

  if (moduleNode?.type === 'module') {
    moduleNode.title = moduleTitle;
    moduleNode.updatedAt = new Date().toISOString();
  }

  nextSnapshot.workspace.updatedAt = new Date().toISOString();
  return nextSnapshot;
}

function createCountingSaveStorage(storage: StructuredDataStorage) {
  let saveCount = 0;

  return {
    getSaveCount() {
      return saveCount;
    },
    storage: {
      async close() {
        await storage.close();
      },
      async deleteWorkspace(workspaceId) {
        await storage.deleteWorkspace(workspaceId);
      },
      async listResourceMetadata(workspaceId) {
        return storage.listResourceMetadata(workspaceId);
      },
      async upsertResourceMetadata(record) {
        await storage.upsertResourceMetadata(record);
      },
      async listWorkspaces() {
        return storage.listWorkspaces();
      },
      async loadWorkspace(workspaceId) {
        return storage.loadWorkspace(workspaceId);
      },
      async saveWorkspace(nextSnapshot) {
        saveCount += 1;
        await storage.saveWorkspace(nextSnapshot);
      },
    } satisfies StructuredDataStorage,
  };
}
