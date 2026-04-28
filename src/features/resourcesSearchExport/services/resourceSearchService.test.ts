import {
  attachTagToNode,
  createNode,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import { searchWorkspaceNodes } from './resourceSearchService';

test('defaults to searching only inside the current module', () => {
  const snapshot = createResourcesSearchSnapshot();

  const result = searchWorkspaceNodes({
    currentModuleId: 'module-current',
    query: '批处理',
    scope: 'current-module',
    selectedTagIds: [],
    tree: snapshot.tree,
  });

  expect(result.results.map((item) => item.nodeId)).toEqual(['question-batching']);
  expect(result.results[0]?.pathLabel).toContain('状态更新机制');
});

test('can switch to theme scope and include resource hits', () => {
  const snapshot = createResourcesSearchSnapshot();

  const result = searchWorkspaceNodes({
    currentModuleId: 'module-current',
    query: '批处理',
    scope: 'theme',
    selectedTagIds: [],
    tree: snapshot.tree,
  });

  expect(result.results.map((item) => item.nodeId)).toEqual([
    'question-batching',
    'fragment-batching',
  ]);
  expect(result.results[1]?.sourceSummary).toContain('React 官方文档');
});

test('labels scaffold summaries as introductions in search results', () => {
  const snapshot = createResourcesSearchSnapshot();

  const result = searchWorkspaceNodes({
    currentModuleId: 'module-current',
    query: '前置讲解',
    scope: 'current-module',
    selectedTagIds: [],
    tree: snapshot.tree,
  });

  expect(result.results.map((item) => item.nodeId)).toEqual(['summary-introduction']);
  expect(result.results[0]?.nodeTypeLabel).toBe('铺垫');
  expect(result.results[0]?.title).toBe('先理解状态更新的背景');
});

test('supports resource-only search by source summary', () => {
  const snapshot = createResourcesSearchSnapshot();

  const result = searchWorkspaceNodes({
    currentModuleId: 'module-current',
    query: 'react.dev/reference',
    scope: 'resources',
    selectedTagIds: ['tag-important'],
    tree: snapshot.tree,
  });

  expect(result.results.map((item) => item.nodeId)).toEqual(['resource-react-docs']);
  expect(result.availableTags).toEqual([]);
});

test('filters module or theme results by existing node tags', () => {
  const snapshot = createResourcesSearchSnapshot();

  const result = searchWorkspaceNodes({
    currentModuleId: 'module-current',
    query: '',
    scope: 'theme',
    selectedTagIds: ['tag-important'],
    tree: snapshot.tree,
  });

  expect(result.results.map((item) => item.nodeId)).toEqual(['question-batching']);
  expect(result.availableTags).toEqual([
    {
      count: 1,
      id: 'tag-important',
      name: '重要',
    },
  ]);
});

function createResourcesSearchSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'React 学习主题',
    workspaceId: 'workspace-resources-search',
    rootId: 'theme-resources-search',
    createdAt: '2026-04-27T11:00:00.000Z',
    updatedAt: '2026-04-27T11:00:00.000Z',
  });
  const importantTag = createTag('重要', {
    id: 'tag-important',
    createdAt: '2026-04-27T11:00:00.000Z',
    updatedAt: '2026-04-27T11:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-current',
      title: '状态更新机制',
      content: '当前模块聚焦状态更新流程。',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-current',
    createNode({
      type: 'plan-step',
      id: 'step-current',
      title: '先理解更新流程',
      content: '先看状态更新如何合并。',
      status: 'doing',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-current',
    createNode({
      type: 'summary',
      id: 'summary-introduction',
      title: '铺垫：先理解状态更新的背景',
      content: '这段前置讲解帮助进入后续问题。',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-current',
    createNode({
      type: 'question',
      id: 'question-batching',
      title: '什么是批处理？',
      content: '理解 React 为什么会批量提交 state 更新。',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-other',
      title: '副作用',
      content: '和当前模块无关。',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '状态更新与 Hook 参考入口。',
      sourceUri: 'https://react.dev/reference/react/useState',
      mimeType: 'text/html',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用于解释批处理的上下文。',
      excerpt: 'React 会把多个 state 更新批量处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-27T11:00:00.000Z',
      updatedAt: '2026-04-27T11:00:00.000Z',
    }),
  );
  tree = upsertTag(tree, importantTag);
  tree = attachTagToNode(tree, 'question-batching', 'tag-important');

  return {
    ...snapshot,
    tree,
  };
}
