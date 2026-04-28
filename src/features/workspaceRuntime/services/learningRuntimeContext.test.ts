import { expect, test } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type ResourceMetadataRecord,
} from '../../nodeDomain';
import { collectLearningReferenceCandidates } from './learningRuntimeContext';

test('includes resource body foundation when building learning reference candidates', () => {
  const snapshot = createWorkspaceSnapshot({
    title: 'Learning reference body foundation',
    workspaceId: 'workspace-learning-reference-body',
    rootId: 'theme-learning-reference-body',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });
  const resourceNode = createNode({
    type: 'resource',
    id: 'resource-body-foundation',
    title: 'React render snapshots',
    content: 'Short resource summary.',
    sourceUri: 'https://example.com/render-snapshots',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });
  const tree = insertChildNode(
    snapshot.tree,
    snapshot.workspace.rootNodeId,
    resourceNode,
  );
  const resourceMetadataByNodeId: Record<string, ResourceMetadataRecord> = {
    [resourceNode.id]: {
      id: resourceNode.id,
      workspaceId: snapshot.workspace.id,
      nodeId: resourceNode.id,
      nodeType: 'resource',
      title: resourceNode.title,
      importMethod: 'url',
      ingestStatus: 'ready',
      titleSource: 'ai-generated',
      summarySource: 'ai-generated',
      bodyFormat: 'plain-text',
      bodyText:
        'Render snapshots capture the state and props visible to a specific render. This longer body foundation keeps the learning chain from seeing only the card summary.',
      updatedAt: resourceNode.updatedAt,
    },
  };

  const [candidate] = collectLearningReferenceCandidates(
    tree,
    resourceMetadataByNodeId,
  );

  expect(candidate).toMatchObject({
    targetNodeId: resourceNode.id,
    targetType: 'resource',
    title: 'React render snapshots',
  });
  expect(candidate?.content.startsWith('正文基础（优先用于定位真实引用）')).toBe(true);
  expect(candidate?.content).toContain('Short resource summary.');
  expect(candidate?.content).toContain(
    'This longer body foundation keeps the learning chain from seeing only the card summary.',
  );
  expect(candidate?.content).toContain(
    '资料概况（只用于判断资料是否相关，不是引用正文）',
  );
  expect(candidate?.content.indexOf('正文基础')).toBeLessThan(
    candidate?.content.indexOf('资料概况'),
  );
});
