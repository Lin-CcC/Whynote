import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  addNodeReference,
  attachTagToNode,
  createNode,
  createNodeReference,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  type NodeTree,
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
      onUpsertResourceMetadata={async () => {}}
      onSelectEditorNode={handleSelectEditorNode}
      selectedEditorNodeId={null}
      tree={createResourcesPanelSnapshot().tree}
      workspaceId="workspace-resources-panel"
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
      onUpsertResourceMetadata={async () => {}}
      onSelectEditorNode={() => {}}
      selectedEditorNodeId="question-batching"
      tree={createResourcesPanelSnapshot().tree}
      workspaceId="workspace-resources-panel"
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
  expect(
    resourceFocusCard.getByRole('button', { name: '为当前资料补充摘录' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '创建摘录' }),
  ).not.toBeInTheDocument();
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
      onUpsertResourceMetadata={async () => {}}
      onSelectEditorNode={() => {}}
      selectedEditorNodeId={null}
      tree={createResourcesPanelSnapshot().tree}
      workspaceId="workspace-resources-panel"
      workspaceTitle="React 学习主题"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '导出内容' }));

  expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:resources-export');
});

test('switches expanded-view mode back to full content for filtered export', () => {
  render(
    <ResourcesSearchExportPanel
      activeResourceNodeId={null}
      currentModuleId="module-current"
      onApplyTreeChange={() => {}}
      onFocusResourceNode={() => {}}
      onUpsertResourceMetadata={async () => {}}
      onSelectEditorNode={() => {}}
      selectedEditorNodeId={null}
      tree={createResourcesPanelSnapshot().tree}
      workspaceId="workspace-resources-panel"
      workspaceTitle="React 学习主题"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '仅当前展开内容' }));
  expect(
    screen.getByRole('button', { name: '仅当前展开内容' }),
  ).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: /重要/i }));
  fireEvent.click(screen.getByRole('button', { name: '标签筛选结果' }));

  expect(screen.getByRole('button', { name: '仅当前展开内容' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '全部内容' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    screen.getByText('标签筛选结果始终按全部内容导出，不读取折叠状态。'),
  ).toBeInTheDocument();
});

test('confirms fragment deletion impact and restores resource focus to the parent resource', () => {
  render(
    <StatefulResourcesSearchExportPanel
      initialActiveResourceNodeId="fragment-batching"
      initialSelectedEditorNodeId="question-batching"
      snapshot={createResourcesPanelSnapshot()}
    />,
  );

  fireEvent.click(
    screen.getByRole('button', { name: '删除摘录 批处理摘录' }),
  );

  expect(
    screen.getByRole('heading', { name: '确认删除摘录《批处理摘录》？' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('删除后会一起移除对应的 1 条资料引用，但不会删除那些学习节点本身。'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '确认删除摘录' }));

  expect(
    screen.queryByRole('button', { name: '定位摘录 批处理摘录' }),
  ).not.toBeInTheDocument();
  expect(
    getSectionByHeading('当前资料焦点').getByText('资料 · React 官方文档'),
  ).toBeInTheDocument();
  expect(
    getSectionByHeading('当前资料焦点').getByText('问题 · 什么是批处理？'),
  ).toBeInTheDocument();
});

test('confirms resource deletion impact and restores focus to an adjacent resource', () => {
  render(
    <StatefulResourcesSearchExportPanel
      initialActiveResourceNodeId="resource-react-docs"
      initialSelectedEditorNodeId="question-batching"
      snapshot={createResourcesPanelSnapshot()}
    />,
  );

  fireEvent.click(
    getSectionByHeading('当前资料焦点').getByRole('button', {
      name: '删除资料',
    }),
  );

  expect(
    screen.getByRole('heading', { name: '确认删除资料《React 官方文档》？' }),
  ).toBeInTheDocument();
  expect(screen.getByText('1 条引用')).toBeInTheDocument();
  expect(screen.getByText('2 条摘录')).toBeInTheDocument();
  expect(
    screen.getByText(
      '删除后会同时删除其下所有摘录，并一并移除 3 条相关资料引用。学习节点本身不会被删除，但这些节点会失去对应资料依据。',
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '确认删除资料' }));

  const resourceFocusCard = getSectionByHeading('当前资料焦点');

  expect(
    screen.queryByRole('button', { name: '定位资料 React 官方文档' }),
  ).not.toBeInTheDocument();
  expect(resourceFocusCard.getByText('资料 · 第二份资料')).toBeInTheDocument();
  expect(resourceFocusCard.getByText('问题 · 什么是批处理？')).toBeInTheDocument();
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
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-event-boundary',
      title: '事件边界摘录',
      content: '用于解释为什么不会逐次立刻渲染。',
      excerpt: 'React 会在事件处理结束后统一处理这些更新。',
      locator: 'useState > event boundary',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-secondary',
      title: '第二份资料',
      content: '备用资料，没有摘录也没有引用。',
      sourceUri: '本地文件：secondary.md',
      mimeType: 'text/markdown',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = upsertTag(tree, importantTag);
  tree = attachTagToNode(tree, 'question-batching', 'tag-important');
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-resource-react-docs',
      sourceNodeId: 'question-batching',
      targetNodeId: 'resource-react-docs',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-fragment-batching',
      sourceNodeId: 'question-batching',
      targetNodeId: 'fragment-batching',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-fragment-event-boundary',
      sourceNodeId: 'question-batching',
      targetNodeId: 'fragment-event-boundary',
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function StatefulResourcesSearchExportPanel(props: {
  initialActiveResourceNodeId: string | null;
  initialSelectedEditorNodeId: string | null;
  snapshot: WorkspaceSnapshot;
}) {
  const [tree, setTree] = useState<NodeTree>(props.snapshot.tree);
  const [activeResourceNodeId, setActiveResourceNodeId] = useState<string | null>(
    props.initialActiveResourceNodeId,
  );
  const [selectedEditorNodeId, setSelectedEditorNodeId] = useState<
    string | null
  >(props.initialSelectedEditorNodeId);

  return (
    <ResourcesSearchExportPanel
      activeResourceNodeId={activeResourceNodeId}
      currentModuleId="module-current"
      onApplyTreeChange={setTree}
      onClearResourceFocus={() => {
        setActiveResourceNodeId(null);
      }}
      onFocusResourceNode={setActiveResourceNodeId}
      onUpsertResourceMetadata={async () => {}}
      onSelectEditorNode={(nodeId) => {
        setActiveResourceNodeId(null);
        setSelectedEditorNodeId(nodeId);
      }}
      selectedEditorNodeId={selectedEditorNodeId}
      tree={tree}
      workspaceId={props.snapshot.workspace.id}
      workspaceTitle={props.snapshot.workspace.title}
    />
  );
}

function getSectionByHeading(name: string) {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return within(section);
}
