import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addNodeReference,
  attachTagToNode,
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
  createNodeReference,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
} from './index';

describe('nodeDomain storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores structured workspace data through IndexedDB', async () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Storage workspace',
      workspaceId: 'workspace-storage',
      rootId: 'root-storage',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-storage',
      title: 'Storage module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-storage',
      title: 'Storage step',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const summaryNode = createNode({
      type: 'summary',
      id: 'summary-storage',
      title: 'Storage summary',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-storage',
      title: 'Storage resource',
      sourceUri: 'file:///storage.md',
      mimeType: 'text/markdown',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceFragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-storage',
      title: 'Storage fragment',
      sourceResourceId: 'resource-storage',
      excerpt: 'resource fragment excerpt',
      locator: 'line:1-2',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const tag = createTag('待整理', {
      id: 'tag-storage',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNode);
    tree = insertChildNode(tree, 'module-storage', planStepNode);
    tree = insertChildNode(tree, 'plan-step-storage', summaryNode);
    tree = insertChildNode(tree, 'resource-storage', resourceFragmentNode);
    tree = upsertTag(tree, tag);
    tree = attachTagToNode(tree, 'summary-storage', 'tag-storage');
    tree = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-storage',
        sourceNodeId: 'summary-storage',
        targetNodeId: 'resource-fragment-storage',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const fullSnapshot = {
      workspace: snapshot.workspace,
      tree,
    };
    const storage = createIndexedDbStorage({
      databaseName: `whynote-storage-${crypto.randomUUID()}`,
    });

    await storage.saveWorkspace(fullSnapshot);

    const restoredSnapshot = await storage.loadWorkspace(snapshot.workspace.id);
    const workspaces = await storage.listWorkspaces();
    const resourceMetadata = await storage.listResourceMetadata(
      snapshot.workspace.id,
    );

    expect(restoredSnapshot).not.toBeNull();
    expect(workspaces).toHaveLength(1);
    expect(restoredSnapshot?.tree.nodes['plan-step-storage'].type).toBe(
      'plan-step',
    );
    expect(restoredSnapshot?.tree.nodes['summary-storage'].tagIds).toEqual([
      'tag-storage',
    ]);
    expect(
      restoredSnapshot?.tree.references['reference-storage'].targetNodeId,
    ).toBe('resource-fragment-storage');
    expect(resourceMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'resource-storage',
          nodeType: 'resource',
          sourceUri: 'file:///storage.md',
        }),
        expect.objectContaining({
          id: 'resource-fragment-storage',
          nodeType: 'resource-fragment',
          sourceResourceId: 'resource-storage',
        }),
      ]),
    );

    await storage.close();
  });

  it('stores only settings, recent state and ui preferences in localStorage', () => {
    const storage = createLocalStorageStore({
      prefix: 'whynote-preferences-test',
      storage: window.localStorage,
    });

    storage.saveSettings({
      values: {
        locale: 'zh-CN',
        autosave: true,
      },
      updatedAt: '2026-04-27T00:00:00.000Z',
    });
    storage.saveRecentWorkspaceState({
      workspaceId: 'workspace-storage',
      moduleId: 'module-storage',
      focusedNodeId: 'summary-storage',
      openedAt: '2026-04-27T00:10:00.000Z',
    });
    storage.saveUiPreferences({
      values: {
        treePaneWidth: 320,
        showResourcePane: true,
      },
      updatedAt: '2026-04-27T00:20:00.000Z',
    });

    expect(storage.loadSettings()).toEqual({
      values: {
        locale: 'zh-CN',
        autosave: true,
      },
      updatedAt: '2026-04-27T00:00:00.000Z',
    });
    expect(storage.loadRecentWorkspaceState()).toEqual({
      workspaceId: 'workspace-storage',
      moduleId: 'module-storage',
      focusedNodeId: 'summary-storage',
      openedAt: '2026-04-27T00:10:00.000Z',
    });
    expect(storage.loadUiPreferences()).toEqual({
      values: {
        treePaneWidth: 320,
        showResourcePane: true,
      },
      updatedAt: '2026-04-27T00:20:00.000Z',
    });
    expect(
      window.localStorage.getItem('whynote-preferences-test:workspace-tree'),
    ).toBeNull();

    storage.clear();

    expect(storage.loadSettings()).toBeNull();
    expect(storage.loadRecentWorkspaceState()).toBeNull();
    expect(storage.loadUiPreferences()).toBeNull();
  });
});
