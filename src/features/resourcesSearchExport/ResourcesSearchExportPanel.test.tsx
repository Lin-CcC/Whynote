import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  attachTagToNode,
  createNode,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import ResourcesSearchExportPanel from './ResourcesSearchExportPanel';

test('routes module hits to editor selection and resource hits to resource focus', () => {
  const handleFocusResourceNode = vi.fn();
  const handleSelectEditorNode = vi.fn();

  render(
    <ResourcesSearchExportPanel
      activeResourceNodeId={null}
      currentModuleId="module-current"
      onApplyTreeChange={() => {}}
      onFocusResourceNode={handleFocusResourceNode}
      onSelectEditorNode={handleSelectEditorNode}
      selectedEditorNodeId={null}
      tree={createResourcesPanelSnapshot().tree}
      workspaceTitle="React 学习主题"
    />,
  );

  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: '批处理',
    },
  });

  fireEvent.click(
    screen.getByRole('button', { name: '跳转到 什么是批处理？' }),
  );

  expect(handleSelectEditorNode).toHaveBeenCalledWith('question-batching');
  expect(handleFocusResourceNode).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole('button', { name: '切换到全主题搜索' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: '跳转到 批处理摘录' }),
  );

  expect(handleFocusResourceNode).toHaveBeenCalledWith('fragment-batching');
});

test('supports tag filtering, renders the global resource area, and shows focused resource details', () => {
  render(
    <ResourcesSearchExportPanel
      activeResourceNodeId="resource-react-docs"
      currentModuleId="module-current"
      onApplyTreeChange={() => {}}
      onClearResourceFocus={() => {}}
      onFocusResourceNode={() => {}}
      onSelectEditorNode={() => {}}
      selectedEditorNodeId="question-batching"
      tree={createResourcesPanelSnapshot().tree}
      workspaceTitle="React 学习主题"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /重要/i }));

  expect(
    screen.getByRole('heading', { name: '当前资料焦点' }),
  ).toBeInTheDocument();
  const resourceFocusCard = getSectionByHeading('当前资料焦点');

  expect(resourceFocusCard.getByText('资料 · React 官方文档')).toBeInTheDocument();
  expect(resourceFocusCard.getByText('问题 · 什么是批处理？')).toBeInTheDocument();
  expect(screen.getByText('什么是批处理？')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('https://react.dev/reference/react/useState'),
  ).toBeInTheDocument();
});

test('exports through the browser download flow', () => {
  const createObjectUrlSpy = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:resources-export');
  const revokeObjectUrlSpy = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => {});
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});

  render(
    <ResourcesSearchExportPanel
      activeResourceNodeId={null}
      currentModuleId="module-current"
      onApplyTreeChange={() => {}}
      onFocusResourceNode={() => {}}
      onSelectEditorNode={() => {}}
      selectedEditorNodeId={null}
      tree={createResourcesPanelSnapshot().tree}
      workspaceTitle="React 学习主题"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '导出内容' }));

  expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:resources-export');
});

function createResourcesPanelSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'React 学习主题',
    workspaceId: 'workspace-resources-panel',
    rootId: 'theme-resources-panel',
    createdAt: '2026-04-27T12:00:00.000Z',
    updatedAt: '2026-04-27T12:00:00.000Z',
  });
  const importantTag = createTag('重要', {
    id: 'tag-important',
    createdAt: '2026-04-27T12:00:00.000Z',
    updatedAt: '2026-04-27T12:00:00.000Z',
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
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
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
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
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
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
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
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
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
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = upsertTag(tree, importantTag);
  tree = attachTagToNode(tree, 'question-batching', 'tag-important');

  return {
    ...snapshot,
    tree,
  };
}

function getSectionByHeading(name: string) {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return within(section);
}
