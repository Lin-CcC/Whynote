import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  createWorkspaceSnapshot,
  type NodeTree,
  type ResourceMetadataRecord,
  type ResourceNode,
} from '../../nodeDomain';
import LocalBatchImportPanel from './LocalBatchImportPanel';

test('previews a mixed batch selection and imports each supported file as an independent resource', async () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();
  const onFocusResourceNode = vi.fn<(nodeId: string) => void>();
  const onUpsertResourceMetadata = vi.fn<
    (record: ResourceMetadataRecord) => Promise<void>
  >(async () => {});

  render(
    <LocalBatchImportPanel
      onApplyTreeChange={onApplyTreeChange}
      onFocusResourceNode={onFocusResourceNode}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-local-batch-import"
    />,
  );

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
        new File(['%PDF-1.5'], 'book.pdf', { type: 'application/pdf' }),
      ],
    },
  });

  expect(
    await screen.findByRole('heading', {
      name: '将导入 2 份，跳过 1 份',
    }),
  ).toBeInTheDocument();
  expect(screen.getByText('Rendering Notes')).toBeInTheDocument();
  expect(screen.getByText('State snapshots')).toBeInTheDocument();
  expect(
    screen.getByText('当前只支持导入 .txt / .md 文件。PDF / DOCX 暂不在这版范围内。'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '导入 2 份资料' }));

  await waitFor(() => {
    expect(onUpsertResourceMetadata).toHaveBeenCalledTimes(2);
  });
  expect(onApplyTreeChange).toHaveBeenCalledTimes(1);

  const createdTree = readAppliedTree(onApplyTreeChange);
  const resourceNodes = Object.values(createdTree.nodes).filter(
    (node): node is ResourceNode => node.type === 'resource',
  );
  const metadataRecords = onUpsertResourceMetadata.mock.calls.map(
    ([record]) => record,
  );

  expect(resourceNodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: 'Rendering Notes' }),
      expect.objectContaining({ title: 'State snapshots' }),
    ]),
  );
  expect(metadataRecords).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        importMethod: 'batch',
        originalFileName: 'rendering-notes.md',
        sourceUri: '本地文件：rendering-notes.md',
      }),
      expect.objectContaining({
        importMethod: 'batch',
        originalFileName: 'state-snapshot.txt',
        sourceUri: '本地文件：state-snapshot.txt',
      }),
    ]),
  );
  expect(metadataRecords[0]?.importBatchId).toBeTruthy();
  expect(metadataRecords[0]?.importBatchId).toBe(metadataRecords[1]?.importBatchId);
  expect(onFocusResourceNode).toHaveBeenCalledWith(resourceNodes[1].id);
  expect(
    await screen.findByRole('heading', {
      name: /成功 2 份，失败 0 份，\s*跳过 1 份/u,
    }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('book.pdf')).toHaveLength(2);
});

function createTestTree() {
  return createWorkspaceSnapshot({
    title: 'Local batch import',
    workspaceId: 'workspace-local-batch-import',
    rootId: 'theme-local-batch-import',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  }).tree;
}

function readAppliedTree(
  onApplyTreeChange: ReturnType<typeof vi.fn<(nextTree: NodeTree) => void>>,
) {
  const firstCall = onApplyTreeChange.mock.calls[0];

  if (!firstCall?.[0]) {
    throw new Error('expected the batch import to apply a tree change');
  }

  return firstCall[0] as NodeTree;
}
