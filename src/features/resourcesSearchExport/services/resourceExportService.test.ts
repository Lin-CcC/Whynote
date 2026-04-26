import {
  attachTagToNode,
  createNode,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import { createWorkspaceExport } from './resourceExportService';

test('exports the current module to markdown and hides plan-step titles by default', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    format: 'markdown',
    includePlanSteps: false,
    target: 'current-module',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.fileName).toBe('状态与批处理.md');
  expect(result.content).toContain('# 状态与批处理');
  expect(result.content).not.toContain('步骤：先理解批处理');
  expect(result.content).toContain('## 问题：什么是批处理？');
});

test('can include plan-step titles explicitly during module export', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    format: 'markdown',
    includePlanSteps: true,
    target: 'current-module',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('## 步骤：先理解批处理（进行中）');
  expect(result.content).toContain('### 问题：什么是批处理？');
});

test('exports filtered theme results while preserving resource ancestors', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    filterScope: 'theme',
    format: 'txt',
    includePlanSteps: false,
    selectedTagIds: ['tag-reference'],
    target: 'filtered',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('React 学习主题');
  expect(result.content).toContain('标签筛选：待验证');
  expect(result.content).toContain('资料：React 官方文档');
  expect(result.content).toContain('摘录：批处理摘录');
  expect(result.content).not.toContain('模块：状态与批处理');
});

function createResourcesExportSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'React 学习主题',
    workspaceId: 'workspace-resources-export',
    rootId: 'theme-resources-export',
    createdAt: '2026-04-27T11:30:00.000Z',
    updatedAt: '2026-04-27T11:30:00.000Z',
  });
  const referenceTag = createTag('待验证', {
    id: 'tag-reference',
    createdAt: '2026-04-27T11:30:00.000Z',
    updatedAt: '2026-04-27T11:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-batching',
      title: '状态与批处理',
      content: '当前模块聚焦状态更新批处理。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-batching',
    createNode({
      type: 'plan-step',
      id: 'step-batching',
      title: '先理解批处理',
      content: '先看状态更新如何合并。',
      status: 'doing',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-batching',
    createNode({
      type: 'question',
      id: 'question-batching',
      title: '什么是批处理？',
      content: '理解 React 为什么会批量提交 state 更新。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-batching',
    createNode({
      type: 'answer',
      id: 'answer-batching',
      title: '回答草稿',
      content: '批处理会把多次更新合并到一次提交里。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '批处理与并发更新说明。',
      sourceUri: 'https://react.dev/reference/react/useState',
      mimeType: 'text/html',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
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
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = upsertTag(tree, referenceTag);
  tree = attachTagToNode(tree, 'fragment-batching', 'tag-reference');

  return {
    ...snapshot,
    tree,
  };
}
