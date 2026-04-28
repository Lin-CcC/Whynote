import 'fake-indexeddb/auto';

import { expect, test } from 'vitest';

import {
  createIndexedDbStorage,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
} from './index';

test('preserves batch provenance metadata across later workspace saves', async () => {
  const snapshot = createWorkspaceSnapshot({
    title: 'Batch provenance workspace',
    workspaceId: 'workspace-batch-provenance',
    rootId: 'root-batch-provenance',
    createdAt: '2026-04-27T00:00:00.000Z',
  });
  const resourceNode = createNode({
    type: 'resource',
    id: 'resource-batch-provenance',
    title: 'Batch import resource',
    content: 'Initial summary',
    sourceUri: '本地文件：notes/storage.md',
    mimeType: 'text/markdown',
    createdAt: '2026-04-27T00:00:00.000Z',
    updatedAt: '2026-04-27T00:00:00.000Z',
  });
  const storage = createIndexedDbStorage({
    databaseName: `whynote-batch-provenance-${crypto.randomUUID()}`,
  });
  const initialTree = insertChildNode(
    snapshot.tree,
    snapshot.tree.rootId,
    resourceNode,
  );
  const storedResourceNode = initialTree.nodes['resource-batch-provenance'];

  if (storedResourceNode.type !== 'resource') {
    throw new Error('expected resource node to be materialized as resource');
  }

  await storage.saveWorkspace({
    workspace: snapshot.workspace,
    tree: initialTree,
  });
  await storage.upsertResourceMetadata({
    id: 'resource-batch-provenance',
    workspaceId: snapshot.workspace.id,
    nodeId: 'resource-batch-provenance',
    nodeType: 'resource',
    title: 'Batch import resource',
    sourceUri: '本地文件：notes/storage.md',
    mimeType: 'text/markdown',
    importMethod: 'batch',
    ingestStatus: 'ready',
    titleSource: 'file-heading',
    summarySource: 'file-body',
    bodyText: '# Batch import resource\n\nFull resource body',
    bodyFormat: 'markdown',
    importedAt: '2026-04-27T00:00:00.000Z',
    originalFileName: 'storage.md',
    sourceRelativePath: 'notes/storage.md',
    importBatchId: 'batch-storage-provenance',
    updatedAt: '2026-04-27T00:00:00.000Z',
  });

  await storage.saveWorkspace({
    workspace: {
      ...snapshot.workspace,
      updatedAt: '2026-04-27T01:00:00.000Z',
    },
    tree: {
      ...initialTree,
      nodes: {
        ...initialTree.nodes,
        'resource-batch-provenance': {
          ...storedResourceNode,
          content: 'Updated summary',
          sourceUri: '本地文件：notes/storage-updated.md',
          title: 'Batch import resource updated',
          updatedAt: '2026-04-27T01:00:00.000Z',
        },
      },
    },
  });

  const resourceMetadata = await storage.listResourceMetadata(
    snapshot.workspace.id,
  );

  expect(resourceMetadata).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'resource-batch-provenance',
        title: 'Batch import resource updated',
        sourceUri: '本地文件：notes/storage-updated.md',
        mimeType: 'text/markdown',
        importMethod: 'batch',
        ingestStatus: 'ready',
        titleSource: 'file-heading',
        summarySource: 'file-body',
        bodyText: '# Batch import resource\n\nFull resource body',
        bodyFormat: 'markdown',
        importedAt: '2026-04-27T00:00:00.000Z',
        originalFileName: 'storage.md',
        sourceRelativePath: 'notes/storage.md',
        importBatchId: 'batch-storage-provenance',
        updatedAt: '2026-04-27T01:00:00.000Z',
      }),
    ]),
  );

  await storage.close();
});
