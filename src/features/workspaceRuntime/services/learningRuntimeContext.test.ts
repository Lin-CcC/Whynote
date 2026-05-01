import { expect, test } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type ResourceMetadataRecord,
} from '../../nodeDomain';
import {
  buildLearningActionRuntimeContext,
  collectLearningReferenceCandidates,
} from './learningRuntimeContext';

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

test('restores question source context from the linked live node when building a direct-answer draft context', () => {
  const snapshot = createWorkspaceSnapshot({
    title: 'Question source context',
    workspaceId: 'workspace-question-source-context',
    rootId: 'theme-question-source-context',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  });

  let tree = insertChildNode(
    snapshot.tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-source-context',
      title: '上下文模块',
      content: '',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-source-context',
    createNode({
      type: 'plan-step',
      id: 'step-source-context',
      title: '上下文步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-source-context',
    createNode({
      type: 'question',
      id: 'question-parent-source',
      title: '父问题',
      content: '先问清父问题。',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent-source',
    createNode({
      type: 'summary',
      id: 'summary-source-context',
      title: '答案解析：批处理的关键节奏',
      content: '这条解析强调的是“先收拢再统一提交”的节奏。',
      summaryKind: 'answer-closure',
      createdAt: '2026-05-01T00:01:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent-source',
    createNode({
      type: 'question',
      id: 'question-follow-up-source',
      title: '追问：为什么要先收拢？',
      content: '继续围绕上一条解析追问。',
      sourceContext: {
        content: '这条解析强调的是“先收拢再统一提交”的节奏。（已更新版）',
        nodeId: 'summary-source-context',
        nodeType: 'summary',
        title: '答案解析：批处理的关键节奏',
        updatedAt: '2026-05-01T00:02:00.000Z',
      },
      createdAt: '2026-05-01T00:03:00.000Z',
      updatedAt: '2026-05-01T00:03:00.000Z',
    }),
  );

  const liveSourceNode = tree.nodes['summary-source-context'];

  if (liveSourceNode?.type !== 'summary') {
    throw new Error('Expected summary source node to exist.');
  }

  liveSourceNode.content = '这条解析强调的是“先收拢再统一提交”的节奏。（实时内容）';

  const context = buildLearningActionRuntimeContext(tree, 'question-follow-up-source');

  expect(context.focusContext).toEqual({
    content: '这条解析强调的是“先收拢再统一提交”的节奏。（实时内容）',
    title: '答案解析：批处理的关键节奏',
    type: 'summary',
  });
});
