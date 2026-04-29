import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
  type ResourceMetadataRecord,
} from '../../nodeDomain';
import ResourceFocusPanel from './ResourceFocusPanel';

test('requires a stable excerpt or locator before creating a teaching citation from a resource', () => {
  const onApplyTreeChange = vi.fn<(nextTree: NodeTree) => void>();

  render(
    <ResourceFocusPanel
      activeResourceNodeId="resource-react-docs"
      currentModuleTitle="Teaching citation module"
      onApplyTreeChange={onApplyTreeChange}
      onCancelDeleteNode={() => {}}
      onConfirmDeleteNode={() => {}}
      onFocusResourceNode={() => {}}
      onRequestDeleteNode={() => {}}
      pendingDeleteNodeId={null}
      resourceMetadataByNodeId={{}}
      selectedEditorNodeId="summary-teaching"
      tree={createTeachingCitationTree()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '引用当前资料' }));

  expect(
    screen.getByText(
      '教学引用需要落到具体资料片段。请填写“引用片段正文”或“引用片段定位信息”，或先在资料区定位到一个摘录再引用。',
    ),
  ).toBeInTheDocument();
  expect(onApplyTreeChange).not.toHaveBeenCalled();
});

test('keeps resource summary for focus display while separating body foundation preview', () => {
  const tree = createTeachingCitationTree();
  const resourceMetadataByNodeId: Record<string, ResourceMetadataRecord> = {
    'resource-react-docs': {
      id: 'resource-react-docs',
      workspaceId: 'workspace-resource-focus-panel',
      nodeId: 'resource-react-docs',
      nodeType: 'resource',
      title: 'React 官方文档',
      summarySource: 'ai-generated',
      bodyFormat: 'plain-text',
      bodyText:
        'React 会在同一轮事件处理中先收集更新，再在提交阶段统一处理，这段正文基础应该和资料概况分开显示。',
      updatedAt: '2026-04-28T00:00:00.000Z',
    },
  };

  render(
    <ResourceFocusPanel
      activeResourceNodeId="resource-react-docs"
      currentModuleTitle="Teaching citation module"
      onApplyTreeChange={() => {}}
      onCancelDeleteNode={() => {}}
      onConfirmDeleteNode={() => {}}
      onFocusResourceNode={() => {}}
      onRequestDeleteNode={() => {}}
      pendingDeleteNodeId={null}
      resourceMetadataByNodeId={resourceMetadataByNodeId}
      selectedEditorNodeId="summary-teaching"
      tree={tree}
    />,
  );

  expect(screen.getByText('资料概况')).toBeInTheDocument();
  expect(
    screen.getAllByText('关于 useState 批处理与事件边界的资料概况。'),
  ).toHaveLength(2);
  expect(screen.getByText('正文基础预览')).toBeInTheDocument();
  expect(
    screen.getByText(
      'React 会在同一轮事件处理中先收集更新，再在提交阶段统一处理，这段正文基础应该和资料概况分开显示。',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      '这里会同时保留资料概况和正文基础。资料概况只负责说明“这份资料大概讲什么”，不会自动当成引用正文。',
    ),
  ).toBeInTheDocument();
});

function createTeachingCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Teaching citation workspace',
    workspaceId: 'workspace-resource-focus-panel',
    rootId: 'theme-resource-focus-panel',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-teaching',
      title: 'Teaching citation module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-teaching',
    createNode({
      type: 'plan-step',
      id: 'step-teaching',
      title: 'Step teaching',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-teaching',
    createNode({
      type: 'summary',
      id: 'summary-teaching',
      title: '标准理解',
      content:
        '批处理会先收集同一轮事件里的更新，再统一提交。\n\n如果忽略事件边界，就很难理解为什么这不会变成每次 setState 都立刻渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 useState 批处理与事件边界的资料概况。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}
