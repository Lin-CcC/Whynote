import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { createWorkspaceSnapshot, type NodeTree } from '../../nodeDomain';
import ResourceEntryPanel from './ResourceEntryPanel';
import type { ResourceImportDraft } from '../services/resourceIngestTypes';

test('prefers AI summary when imported text has readable body foundation', async () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();
  const onFocusResourceNode = vi.fn<(nodeId: string) => void>();
  const onResolveResourceSummary = vi.fn<
    (draft: ResourceImportDraft) => Promise<ResourceImportDraft>
  >(async (draft) => ({
    ...draft,
    content: 'AI 生成的资料概况，说明资料讲什么以及适合在哪些问题下引用。',
    ingest: {
      ...draft.ingest,
      summarySource: 'ai-generated',
      titleSource: 'ai-generated',
    },
    title: 'AI 生成标题',
  }));
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={onApplyTreeChange}
      onFocusResourceNode={onFocusResourceNode}
      onResolveResourceSummary={onResolveResourceSummary}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  fireEvent.change(screen.getByLabelText('本地资料文件'), {
    target: {
      files: [
        new File(
          ['# React Rendering Notes\n\nThis file explains render snapshots in detail.'],
          'rendering-notes.md',
          { type: 'text/markdown' },
        ),
      ],
    },
  });

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  await waitFor(() => {
    expect(onUpsertResourceMetadata).toHaveBeenCalledTimes(1);
  });

  const metadataRecord = onUpsertResourceMetadata.mock.calls[0][0];
  const createdTree = onApplyTreeChange.mock.calls[0][0];
  const createdResourceNode = Object.values(createdTree.nodes).find(
    (node) => node.type === 'resource' && node.title === 'AI 生成标题',
  );

  expect(onResolveResourceSummary).toHaveBeenCalledTimes(1);
  expect(metadataRecord.titleSource).toBe('ai-generated');
  expect(metadataRecord.summarySource).toBe('ai-generated');
  expect(metadataRecord.bodyText).toContain('render snapshots');
  expect(createdResourceNode?.content).toBe(
    'AI 生成的资料概况，说明资料讲什么以及适合在哪些问题下引用。',
  );
  expect(onFocusResourceNode).toHaveBeenCalledWith(createdResourceNode?.id);
});

test('falls back to rule extraction when AI summary fails', async () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();
  const onResolveResourceSummary = vi.fn(async () => {
    throw new Error('provider offline');
  });
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={onApplyTreeChange}
      onFocusResourceNode={() => {}}
      onResolveResourceSummary={onResolveResourceSummary}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  fireEvent.change(screen.getByLabelText('本地资料文件'), {
    target: {
      files: [
        new File(
          ['# React Rendering Notes\n\nThis file explains render snapshots in detail.'],
          'rendering-notes.md',
          { type: 'text/markdown' },
        ),
      ],
    },
  });

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  await waitFor(() => {
    expect(onUpsertResourceMetadata).toHaveBeenCalledTimes(1);
  });

  const metadataRecord = onUpsertResourceMetadata.mock.calls[0][0];
  const createdTree = onApplyTreeChange.mock.calls[0][0];

  expect(onResolveResourceSummary).toHaveBeenCalledTimes(1);
  expect(metadataRecord.titleSource).toBe('file-heading');
  expect(metadataRecord.summarySource).toBe('file-body');
  expect(
    Object.values(createdTree.nodes).some(
      (node) => node.type === 'resource' && node.title === 'React Rendering Notes',
    ),
  ).toBe(true);
  expect(
    screen.getByText(
      'AI 摘要未完成，已回退到规则提取或手动内容，并创建资料《React Rendering Notes》。',
    ),
  ).toBeInTheDocument();
});

test('preserves manual edits instead of silently overwriting them with AI summary', async () => {
  const onResolveResourceSummary = vi.fn<
    (draft: ResourceImportDraft) => Promise<ResourceImportDraft>
  >(async (draft) => ({
    ...draft,
    content: 'AI 生成的资料概况，解释材料主题与引用场景。',
    ingest: {
      ...draft.ingest,
      summarySource: 'ai-generated',
      titleSource: 'ai-generated',
    },
    title: 'AI 生成标题',
  }));
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={() => {}}
      onFocusResourceNode={() => {}}
      onResolveResourceSummary={onResolveResourceSummary}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  fireEvent.change(screen.getByLabelText('本地资料文件'), {
    target: {
      files: [
        new File(
          ['# React Rendering Notes\n\nThis file explains render snapshots in detail.'],
          'rendering-notes.md',
          { type: 'text/markdown' },
        ),
      ],
    },
  });

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('资料标题'), {
    target: {
      value: '手动保留标题',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  await waitFor(() => {
    expect(onUpsertResourceMetadata).toHaveBeenCalledTimes(1);
  });

  const metadataRecord = onUpsertResourceMetadata.mock.calls[0][0];

  expect(metadataRecord.titleSource).toBe('user');
  expect(metadataRecord.summarySource).toBe('ai-generated');
  expect(metadataRecord.title).toBe('手动保留标题');
});

function createTestTree() {
  return createWorkspaceSnapshot({
    title: 'Resource entry',
    workspaceId: 'workspace-resource-entry',
    rootId: 'theme-resource-entry',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  }).tree;
}
