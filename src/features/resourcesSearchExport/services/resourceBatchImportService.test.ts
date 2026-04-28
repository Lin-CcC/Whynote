import { expect, test } from 'vitest';

import {
  buildResourceBatchImportPreview,
  countResourceBatchPreviewItems,
} from './resourceBatchImportService';

test('builds a multi-file preview with supported drafts and explicit skipped items', async () => {
  const preview = await buildResourceBatchImportPreview(
    [
      new File(
        ['# Rendering Notes\n\nReact will batch updates before commit.'],
        'rendering-notes.md',
        {
          type: 'text/markdown',
        },
      ),
      new File(
        ['State snapshots\n\nEach render captures its own closure.'],
        'state-snapshot.txt',
        {
          type: 'text/plain',
        },
      ),
      new File(['%PDF-1.5'], 'book.pdf', {
        type: 'application/pdf',
      }),
    ],
    {
      importBatchId: 'batch-preview-test',
      selection: 'files',
    },
  );

  expect(preview.importBatchId).toBe('batch-preview-test');
  expect(preview.importMethod).toBe('batch');
  expect(countResourceBatchPreviewItems(preview)).toEqual({
    readyCount: 2,
    skippedCount: 1,
    totalCount: 3,
  });
  expect(preview.items).toEqual([
    expect.objectContaining({
      draft: expect.objectContaining({
        ingest: expect.objectContaining({
          importBatchId: 'batch-preview-test',
          importMethod: 'batch',
          originalFileName: 'rendering-notes.md',
        }),
        sourceUri: '本地文件：rendering-notes.md',
        title: 'Rendering Notes',
      }),
      fileName: 'rendering-notes.md',
      sourceLabel: 'rendering-notes.md',
      status: 'ready',
    }),
    expect.objectContaining({
      draft: expect.objectContaining({
        ingest: expect.objectContaining({
          importBatchId: 'batch-preview-test',
          importMethod: 'batch',
          originalFileName: 'state-snapshot.txt',
        }),
        sourceUri: '本地文件：state-snapshot.txt',
        title: 'State snapshots',
      }),
      fileName: 'state-snapshot.txt',
      sourceLabel: 'state-snapshot.txt',
      status: 'ready',
    }),
    expect.objectContaining({
      fileName: 'book.pdf',
      reason: '当前只支持导入 .txt / .md 文件。PDF / DOCX 暂不在这版范围内。',
      sourceLabel: 'book.pdf',
      status: 'skipped',
    }),
  ]);
});

test('keeps relative paths and folder provenance when scanning a selected directory', async () => {
  const markdownFile = new File(
    ['# React Hooks Folder Notes\n\nPrefer colocated state.'],
    'hooks-notes.md',
    {
      type: 'text/markdown',
    },
  );

  Object.defineProperty(markdownFile, 'webkitRelativePath', {
    configurable: true,
    value: 'react/docs/hooks-notes.md',
  });

  const preview = await buildResourceBatchImportPreview([markdownFile], {
    importBatchId: 'folder-preview-test',
    selection: 'folder',
  });
  const firstItem = preview.items[0];

  expect(preview.importMethod).toBe('folder');
  expect(firstItem).toEqual(
    expect.objectContaining({
      fileName: 'hooks-notes.md',
      relativePath: 'react/docs/hooks-notes.md',
      sourceLabel: 'react/docs/hooks-notes.md',
      status: 'ready',
    }),
  );

  if (firstItem?.status !== 'ready') {
    throw new Error('expected the folder preview item to be importable');
  }

  expect(firstItem.draft).toEqual(
    expect.objectContaining({
      sourceUri: '本地文件：react/docs/hooks-notes.md',
      ingest: expect.objectContaining({
        importBatchId: 'folder-preview-test',
        importMethod: 'folder',
        originalFileName: 'hooks-notes.md',
        sourceRelativePath: 'react/docs/hooks-notes.md',
      }),
    }),
  );
});
