import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  createWorkspaceSnapshot,
  type NodeTree,
  type ResourceMetadataRecord,
  type ResourceNode,
} from '../../nodeDomain';
import type { ResourceImportDraft } from '../services/resourceIngestTypes';
import ResourceEntryPanel from './ResourceEntryPanel';

test('creates a resource from uploaded text body foundation without invoking AI summary resolution', async () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();
  const onFocusResourceNode = vi.fn<(nodeId: string) => void>();
  const onResolveResourceSummary = vi.fn<
    (draft: ResourceImportDraft) => Promise<ResourceImportDraft>
  >(async (draft) => draft);
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={onApplyTreeChange}
      onFocusResourceNode={onFocusResourceNode}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  importLocalMarkdownFile();

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  const metadataRecord = await waitForSingleMetadataUpsert(
    onUpsertResourceMetadata,
  );
  const createdTree = waitForSingleTreeChange(onApplyTreeChange);
  const createdResourceNode = findCreatedResourceNode(createdTree);

  expect(onResolveResourceSummary).not.toHaveBeenCalled();
  expect(metadataRecord.titleSource).toBe('file-heading');
  expect(metadataRecord.summarySource).toBe('file-body');
  expect(metadataRecord.bodyText).toContain('render snapshots');
  expect(createdResourceNode.content).toBe(
    'This file explains render snapshots in detail.',
  );
  expect(onFocusResourceNode).toHaveBeenCalledWith(createdResourceNode.id);
});

test('keeps local-file creation usable even when a summary resolver is provided but broken', async () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();
  const onResolveResourceSummary = vi.fn(async () => {
    throw new Error('provider offline');
  });
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={onApplyTreeChange}
      onFocusResourceNode={() => {}}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  importLocalMarkdownFile();

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  const metadataRecord = await waitForSingleMetadataUpsert(
    onUpsertResourceMetadata,
  );
  const createdTree = waitForSingleTreeChange(onApplyTreeChange);

  expect(onResolveResourceSummary).not.toHaveBeenCalled();
  expect(metadataRecord.titleSource).toBe('file-heading');
  expect(metadataRecord.summarySource).toBe('file-body');
  expect(
    Object.values(createdTree.nodes).some(
      (node) => node.type === 'resource' && node.title === 'React Rendering Notes',
    ),
  ).toBe(true);
  expect(
    screen.getByText(
      '已创建资料《React Rendering Notes》，资料区、搜索、定位和导出会立刻使用它。',
    ),
  ).toBeInTheDocument();
});

test('preserves manual edits instead of silently overwriting imported defaults', async () => {
  const onResolveResourceSummary = vi.fn<
    (draft: ResourceImportDraft) => Promise<ResourceImportDraft>
  >(async (draft) => ({
    ...draft,
    content: 'AI generated summary should never be used during import entry.',
    ingest: {
      ...draft.ingest,
      summarySource: 'ai-generated',
      titleSource: 'ai-generated',
    },
    title: 'AI generated title',
  }));
  const onUpsertResourceMetadata = vi.fn(async () => {});

  render(
    <ResourceEntryPanel
      onApplyTreeChange={() => {}}
      onFocusResourceNode={() => {}}
      onUpsertResourceMetadata={onUpsertResourceMetadata}
      tree={createTestTree()}
      workspaceId="workspace-resource-entry"
    />,
  );

  importLocalMarkdownFile();

  expect(await screen.findByDisplayValue('React Rendering Notes')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('资料标题'), {
    target: {
      value: '手动保留标题',
    },
  });
  fireEvent.change(screen.getByLabelText('资料概况'), {
    target: {
      value: '手动补充的资料概况，应该优先保留。',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  const metadataRecord = await waitForSingleMetadataUpsert(
    onUpsertResourceMetadata,
  );

  expect(onResolveResourceSummary).not.toHaveBeenCalled();
  expect(metadataRecord.title).toBe('手动保留标题');
  expect(metadataRecord.titleSource).toBe('user');
  expect(metadataRecord.summarySource).toBe('user');
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

function importLocalMarkdownFile() {
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
}

function findCreatedResourceNode(tree: NodeTree): ResourceNode {
  const createdResourceNode = Object.values(tree.nodes).find(
    (node): node is ResourceNode => node.type === 'resource',
  );

  if (!createdResourceNode) {
    throw new Error('Expected the tree change to create a resource node.');
  }

  return createdResourceNode;
}

async function waitForSingleMetadataUpsert(
  onUpsertResourceMetadata: ReturnType<typeof vi.fn>,
): Promise<ResourceMetadataRecord> {
  await waitFor(() => {
    expect(onUpsertResourceMetadata).toHaveBeenCalledTimes(1);
  });

  const firstCall = onUpsertResourceMetadata.mock.calls[0];

  if (!firstCall?.[0]) {
    throw new Error('Expected resource metadata to be upserted once.');
  }

  return firstCall[0] as ResourceMetadataRecord;
}

function waitForSingleTreeChange(
  onApplyTreeChange: ReturnType<typeof vi.fn<(nextTree: NodeTree) => void>>,
): NodeTree {
  const firstCall = onApplyTreeChange.mock.calls[0];

  if (!firstCall?.[0]) {
    throw new Error('Expected a tree change after creating a resource.');
  }

  return firstCall[0] as NodeTree;
}
