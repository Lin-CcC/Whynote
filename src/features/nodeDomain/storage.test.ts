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
  deleteNode,
  insertChildNode,
  moveNode,
  upsertTag,
  validateNodeTree,
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
        focusText: '批处理会把同一轮事件中的多个更新合并后再提交。',
        note: '这里在解释机制，应该直接对照资料里的原文片段。',
        purpose: 'mechanism',
        sourceExcerpt: 'resource fragment excerpt',
        sourceLocator: 'line:1-2',
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
    expect(
      restoredSnapshot?.tree.references['reference-storage'].focusText,
    ).toBe('批处理会把同一轮事件中的多个更新合并后再提交。');
    expect(restoredSnapshot?.tree.references['reference-storage'].purpose).toBe(
      'mechanism',
    );
    expect(
      restoredSnapshot?.tree.references['reference-storage'].sourceLocator,
    ).toBe('line:1-2');
    expect(
      restoredSnapshot?.tree.nodes['resource-fragment-storage'].type ===
        'resource-fragment' &&
        restoredSnapshot.tree.nodes['resource-fragment-storage'].sourceResourceId,
    ).toBe('resource-storage');
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

  it('keeps the previous workspace snapshot recoverable when a save fails mid-transaction', async () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Atomic save workspace',
      workspaceId: 'workspace-atomic-save',
      rootId: 'root-atomic-save',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-atomic-save',
      title: 'Atomic module',
      content: 'safe content',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    const validTree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    const validSnapshot = {
      workspace: snapshot.workspace,
      tree: validTree,
    };
    const brokenSnapshot = {
      workspace: {
        ...snapshot.workspace,
        updatedAt: '2026-04-27T00:30:00.000Z',
      },
      tree: {
        ...validTree,
        nodes: {
          ...validTree.nodes,
          'module-atomic-save': {
            ...validTree.nodes['module-atomic-save'],
            content: (() => 'cannot clone') as unknown as string,
          },
        },
      },
    };
    const storage = createIndexedDbStorage({
      databaseName: `whynote-atomic-save-${crypto.randomUUID()}`,
    });

    await storage.saveWorkspace(validSnapshot);
    await expect(storage.saveWorkspace(brokenSnapshot)).rejects.toThrow();

    const restoredSnapshot = await storage.loadWorkspace(snapshot.workspace.id);

    expect(restoredSnapshot).toEqual(validSnapshot);

    await storage.close();
  });

  it('preserves separately upserted resource ingest metadata across later workspace saves', async () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Resource metadata workspace',
      workspaceId: 'workspace-resource-metadata',
      rootId: 'root-resource-metadata',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-metadata',
      title: 'Storage markdown resource',
      content: 'Initial summary',
      sourceUri: '本地文件：storage.md',
      mimeType: 'text/markdown',
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    });
    const storage = createIndexedDbStorage({
      databaseName: `whynote-resource-metadata-${crypto.randomUUID()}`,
    });

    const initialTree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      resourceNode,
    );
    const storedResourceNode = initialTree.nodes['resource-metadata'];

    if (storedResourceNode.type !== 'resource') {
      throw new Error('expected resource node to be materialized as resource');
    }

    await storage.saveWorkspace({
      workspace: snapshot.workspace,
      tree: initialTree,
    });
    await storage.upsertResourceMetadata({
      id: 'resource-metadata',
      workspaceId: snapshot.workspace.id,
      nodeId: 'resource-metadata',
      nodeType: 'resource',
      title: 'Storage markdown resource',
      sourceUri: '本地文件：storage.md',
      mimeType: 'text/markdown',
      importMethod: 'local-file',
      ingestStatus: 'ready',
      titleSource: 'file-heading',
      summarySource: 'file-body',
      bodyText: '# Storage markdown resource\n\nFull resource body',
      bodyFormat: 'markdown',
      importedAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    });

    const updatedTree = {
      ...initialTree,
      nodes: {
        ...initialTree.nodes,
        'resource-metadata': {
          ...storedResourceNode,
          content: 'Updated summary',
          sourceUri: '本地文件：storage-updated.md',
          title: 'Storage markdown resource updated',
          updatedAt: '2026-04-27T01:00:00.000Z',
        },
      },
    };

    await storage.saveWorkspace({
      workspace: {
        ...snapshot.workspace,
        updatedAt: '2026-04-27T01:00:00.000Z',
      },
      tree: updatedTree,
    });

    const resourceMetadata = await storage.listResourceMetadata(
      snapshot.workspace.id,
    );

    expect(resourceMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'resource-metadata',
          title: 'Storage markdown resource updated',
          sourceUri: '本地文件：storage-updated.md',
          mimeType: 'text/markdown',
          importMethod: 'local-file',
          ingestStatus: 'ready',
          titleSource: 'file-heading',
          summarySource: 'file-body',
          bodyText: '# Storage markdown resource\n\nFull resource body',
          bodyFormat: 'markdown',
          importedAt: '2026-04-27T00:00:00.000Z',
          updatedAt: '2026-04-27T01:00:00.000Z',
        }),
      ]),
    );

    await storage.close();
  });

  it('persists deleted resources without stale references, fragments, or metadata', async () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Deleted resource persistence',
      workspaceId: 'workspace-deleted-resource-persistence',
      rootId: 'root-deleted-resource-persistence',
      createdAt: '2026-04-29T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-deleted-resource',
      title: 'Deleted resource module',
      createdAt: '2026-04-29T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-deleted-resource',
      title: 'Which evidence remains?',
      createdAt: '2026-04-29T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-deleted-persistence',
      title: 'Deleted persistence resource',
      sourceUri: 'file:///deleted-persistence.md',
      createdAt: '2026-04-29T00:00:00.000Z',
    });
    const fragmentNode = createNode({
      type: 'resource-fragment',
      id: 'fragment-deleted-persistence',
      title: 'Deleted persistence fragment',
      sourceResourceId: 'resource-deleted-persistence',
      excerpt: 'This fragment will be deleted.',
      locator: 'section:1',
      createdAt: '2026-04-29T00:00:00.000Z',
    });
    const storage = createIndexedDbStorage({
      databaseName: `whynote-deleted-resource-persistence-${crypto.randomUUID()}`,
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, 'module-deleted-resource', questionNode);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNode);
    tree = insertChildNode(tree, 'resource-deleted-persistence', fragmentNode);
    tree = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-deleted-persistence',
        sourceNodeId: 'question-deleted-resource',
        targetNodeId: 'fragment-deleted-persistence',
        createdAt: '2026-04-29T00:00:00.000Z',
      }),
    );

    await storage.saveWorkspace({
      workspace: snapshot.workspace,
      tree,
    });

    const deletedTree = deleteNode(tree, 'resource-deleted-persistence');

    await storage.saveWorkspace({
      workspace: {
        ...snapshot.workspace,
        updatedAt: '2026-04-29T01:00:00.000Z',
      },
      tree: deletedTree,
    });

    const restoredSnapshot = await storage.loadWorkspace(snapshot.workspace.id);
    const resourceMetadata = await storage.listResourceMetadata(
      snapshot.workspace.id,
    );

    expect(restoredSnapshot).not.toBeNull();
    expect(
      restoredSnapshot?.tree.nodes['resource-deleted-persistence'],
    ).toBeUndefined();
    expect(
      restoredSnapshot?.tree.nodes['fragment-deleted-persistence'],
    ).toBeUndefined();
    expect(
      restoredSnapshot?.tree.references['reference-deleted-persistence'],
    ).toBeUndefined();
    expect(
      restoredSnapshot?.tree.nodes['question-deleted-resource'].referenceIds,
    ).toEqual([]);
    expect(resourceMetadata).toEqual([]);
    validateNodeTree(restoredSnapshot!.tree);

    await storage.close();
  });

  it('restores moved resource fragments with parent/source invariants intact', async () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Restore fragment invariant',
      workspaceId: 'workspace-fragment-restore',
      rootId: 'root-fragment-restore',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNodeA = createNode({
      type: 'resource',
      id: 'resource-restore-a',
      title: 'Restore resource A',
      sourceUri: 'file:///resource-restore-a.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNodeB = createNode({
      type: 'resource',
      id: 'resource-restore-b',
      title: 'Restore resource B',
      sourceUri: 'file:///resource-restore-b.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const fragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-restore',
      title: 'Restore fragment',
      sourceResourceId: 'resource-restore-a',
      excerpt: 'Fragment excerpt',
      locator: 'line:20-22',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, resourceNodeA);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNodeB);
    tree = insertChildNode(tree, 'resource-restore-a', fragmentNode);
    tree = moveNode(tree, 'resource-fragment-restore', 'resource-restore-b');

    const storage = createIndexedDbStorage({
      databaseName: `whynote-fragment-restore-${crypto.randomUUID()}`,
    });

    await storage.saveWorkspace({
      workspace: snapshot.workspace,
      tree,
    });

    const restoredSnapshot = await storage.loadWorkspace(snapshot.workspace.id);

    expect(restoredSnapshot).not.toBeNull();
    expect(
      restoredSnapshot?.tree.nodes['resource-fragment-restore'].parentId,
    ).toBe('resource-restore-b');
    expect(
      restoredSnapshot?.tree.nodes['resource-fragment-restore'].type ===
        'resource-fragment' &&
        restoredSnapshot.tree.nodes['resource-fragment-restore'].sourceResourceId,
    ).toBe('resource-restore-b');
    validateNodeTree(restoredSnapshot!.tree);

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
        'ai.selectedTemplateId': 'gemini-openai-compatible',
        'ai.presets': [
          {
            id: 'preset-gemini',
            name: '我的 Gemini',
            templateId: 'gemini-openai-compatible',
            baseUrl:
              'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: 'test-key',
            model: 'gemini-2.5-flash',
            updatedAt: '2026-04-27T00:00:00.000Z',
          },
        ],
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
        'ai.selectedTemplateId': 'gemini-openai-compatible',
        'ai.presets': [
          {
            id: 'preset-gemini',
            name: '我的 Gemini',
            templateId: 'gemini-openai-compatible',
            baseUrl:
              'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: 'test-key',
            model: 'gemini-2.5-flash',
            updatedAt: '2026-04-27T00:00:00.000Z',
          },
        ],
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
