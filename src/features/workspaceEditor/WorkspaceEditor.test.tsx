import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import {
  createNode,
  createWorkspaceSnapshot,
  deleteNode,
  insertChildNode,
  insertSiblingNode,
  liftNode,
  lowerNode,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import { getActionAvailability } from './hooks/useWorkspaceEditor';
import {
  DEMO_SELECTED_NODE_ID,
} from './utils/createDemoWorkspace';
import type { WorkspaceEditorOperations } from './workspaceEditorTypes';

test('switches modules and keeps structure and text view in sync', () => {
  render(<WorkspaceEditor />);

  fireEvent.click(screen.getByRole('button', { name: /副作用与数据流/i }));

  expect(
    screen.getByRole('heading', { name: '副作用与数据流' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /^问题什么时候应该使用 useEffect？$/i }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: /^问题为什么 setState 会合并更新，它如何影响渲染？$/i,
    }),
  ).not.toBeInTheDocument();
});

test('selects a node from structure view and focuses the text card', async () => {
  render(<WorkspaceEditor />);

  fireEvent.click(
    screen.getByRole('button', {
      name: /^问题组件拆分如何影响渲染成本？$/i,
    }),
  );

  const focusedNode = screen.getByTestId('editor-node-question-render-boundary');

  await waitFor(() => {
    expect(focusedNode).toHaveFocus();
  });
});

test('collapses and expands the structure tree', () => {
  render(<WorkspaceEditor />);

  fireEvent.click(
    screen.getByRole('button', {
      name: /折叠 梳理 state \/ props \/ render 的关系/i,
    }),
  );

  expect(
    screen.queryByRole('button', {
      name: /^问题state 和 props 有什么区别？$/i,
    }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', {
      name: /展开 梳理 state \/ props \/ render 的关系/i,
    }),
  );

  expect(
    screen.getByRole('button', {
      name: /^问题state 和 props 有什么区别？$/i,
    }),
  ).toBeInTheDocument();
});

test.each([
  ['插入子节点', 'insertChildNode'],
  ['插入同级', 'insertSiblingNode'],
  ['删除节点', 'deleteNode'],
  ['提升一级', 'liftNode'],
  ['降低一级', 'lowerNode'],
] as const)('uses domain operation for %s', (buttonLabel, operationName) => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.click(screen.getByRole('button', { name: buttonLabel }));

  const operationSpy = getOperationSpy(operations, operationName);

  expect(operationSpy).toHaveBeenCalledTimes(1);
  expect(operationSpy.mock.calls[0]?.[1]).toBe(DEMO_SELECTED_NODE_ID);
});

test('renders plan-step with weaker emphasis than learning nodes', () => {
  render(<WorkspaceEditor />);

  expect(screen.getByTestId('editor-node-step-state-basics')).toHaveAttribute(
    'data-node-emphasis',
    'supporting',
  );
  expect(screen.getByTestId('editor-node-question-props-diff')).toHaveAttribute(
    'data-node-emphasis',
    'primary',
  );
  expect(
    screen.getByRole('combobox', {
      name: /梳理 state \/ props \/ render 的关系 的步骤状态/i,
    }),
  ).toBeInTheDocument();
});

test('disables lower when previous sibling cannot accept the current node', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-constraints"
      initialSelectedNodeId="summary-selected"
      initialSnapshot={createLowerConstraintSnapshot()}
    />,
  );

  expect(screen.getByRole('button', { name: '降低一级' })).toBeDisabled();
});

test('marks lift as unavailable when the target parent cannot accept the node', () => {
  const snapshot = createResourceFragmentSnapshot();
  const actionAvailability = getActionAvailability(snapshot.tree, 'fragment-selected');

  expect(actionAvailability.canLift).toBe(false);
});

test.each([
  ['插入子节点', 'insertChildNode'],
  ['插入同级', 'insertSiblingNode'],
  ['删除节点', 'deleteNode'],
  ['提升一级', 'liftNode'],
  ['降低一级', 'lowerNode'],
] as const)('surfaces editor error when %s throws', (buttonLabel, operationName) => {
  const operations = createOperationSpies();
  const operationSpy = getOperationSpy(operations, operationName);

  operationSpy.mockImplementation(() => {
    throw new Error(`${buttonLabel}失败`);
  });

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.click(screen.getByRole('button', { name: buttonLabel }));

  expect(screen.getByRole('alert')).toHaveTextContent(`${buttonLabel}失败`);
});

test('recovers with a new module after deleting the last module', () => {
  const snapshots: WorkspaceSnapshot[] = [];

  render(
    <WorkspaceEditor
      initialModuleId="module-recovery"
      initialSelectedNodeId="module-recovery"
      initialSnapshot={createSingleModuleSnapshot()}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '删除节点' }));

  expect(
    within(getSectionByHeading('当前学习模块')).getByText('0 个模块'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: '还没有可展示的模块结构' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: '还没有可编辑的模块' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(getSectionByHeading('还没有可编辑的模块')).getByRole('button', {
      name: '新建模块',
    }),
  );

  expect(screen.getByDisplayValue('新模块')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '新模块' })).toBeInTheDocument();
  expect(
    within(getSectionByHeading('当前学习模块')).getByRole('button', {
      name: /新模块/i,
    }),
  ).toBeInTheDocument();

  const latestSnapshot = snapshots[snapshots.length - 1];
  const rootChildTitles =
    latestSnapshot?.tree.nodes[latestSnapshot.tree.rootId].childIds.map(
      (childId) => latestSnapshot.tree.nodes[childId]?.title,
    ) ?? [];

  expect(rootChildTitles).toContain('新模块');
});

test('keeps text main view in the same order as the underlying question children', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-order"
      initialSelectedNodeId="question-parent"
      initialSnapshot={createQuestionOrderSnapshot()}
    />,
  );

  const parentNode = screen.getByTestId('editor-node-question-parent');
  const renderedNodeIds = Array.from(
    parentNode.querySelectorAll('[data-testid^="editor-node-"]'),
  ).map((element) => element.getAttribute('data-testid'));

  expect(renderedNodeIds).toEqual([
    'editor-node-answer-first',
    'editor-node-question-child',
    'editor-node-summary-third',
  ]);
  expect(
    screen.getByRole('heading', { name: '父问题保留，子问题显式承接' }),
  ).toBeInTheDocument();
});

function createOperationSpies(): WorkspaceEditorOperations {
  return {
    insertChildNode: vi.fn((tree, parentNodeId, node, index) =>
      insertChildNode(tree, parentNodeId, node, index),
    ),
    insertSiblingNode: vi.fn((tree, siblingNodeId, node, position) =>
      insertSiblingNode(tree, siblingNodeId, node, position),
    ),
    deleteNode: vi.fn((tree, nodeId) => deleteNode(tree, nodeId)),
    liftNode: vi.fn((tree, nodeId) => liftNode(tree, nodeId)),
    lowerNode: vi.fn((tree, nodeId) => lowerNode(tree, nodeId)),
  };
}

function getOperationSpy(
  operations: WorkspaceEditorOperations,
  operationName:
    | 'insertChildNode'
    | 'insertSiblingNode'
    | 'deleteNode'
    | 'liftNode'
    | 'lowerNode',
) {
  switch (operationName) {
    case 'insertChildNode':
      return operations.insertChildNode as ReturnType<typeof vi.fn>;
    case 'insertSiblingNode':
      return operations.insertSiblingNode as ReturnType<typeof vi.fn>;
    case 'deleteNode':
      return operations.deleteNode as ReturnType<typeof vi.fn>;
    case 'liftNode':
      return operations.liftNode as ReturnType<typeof vi.fn>;
    case 'lowerNode':
      return operations.lowerNode as ReturnType<typeof vi.fn>;
  }
}

function createLowerConstraintSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '结构约束',
    workspaceId: 'workspace-constraints',
    rootId: 'theme-constraints',
    createdAt: '2026-04-27T09:00:00.000Z',
    updatedAt: '2026-04-27T09:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-constraints',
      title: '约束模块',
      content: '',
      createdAt: '2026-04-27T09:00:00.000Z',
      updatedAt: '2026-04-27T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-constraints',
    createNode({
      type: 'plan-step',
      id: 'step-constraints',
      title: '约束步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-27T09:00:00.000Z',
      updatedAt: '2026-04-27T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-constraints',
    createNode({
      type: 'answer',
      id: 'answer-anchor',
      title: '前一个回答',
      content: '',
      createdAt: '2026-04-27T09:00:00.000Z',
      updatedAt: '2026-04-27T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-constraints',
    createNode({
      type: 'summary',
      id: 'summary-selected',
      title: '当前总结',
      content: '',
      createdAt: '2026-04-27T09:00:00.000Z',
      updatedAt: '2026-04-27T09:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createResourceFragmentSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '资源约束',
    workspaceId: 'workspace-resource',
    rootId: 'theme-resource',
    createdAt: '2026-04-27T09:30:00.000Z',
    updatedAt: '2026-04-27T09:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-parent',
      title: '资源节点',
      content: '',
      createdAt: '2026-04-27T09:30:00.000Z',
      updatedAt: '2026-04-27T09:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-parent',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-selected',
      title: '资源摘录',
      content: '',
      sourceResourceId: 'resource-parent',
      excerpt: '摘录内容',
      createdAt: '2026-04-27T09:30:00.000Z',
      updatedAt: '2026-04-27T09:30:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createQuestionOrderSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '顺序校验',
    workspaceId: 'workspace-order',
    rootId: 'theme-order',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-order',
      title: '顺序模块',
      content: '',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-order',
    createNode({
      type: 'plan-step',
      id: 'step-order',
      title: '顺序步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-order',
    createNode({
      type: 'question',
      id: 'question-parent',
      title: '父问题',
      content: '父问题保留并承接子节点顺序。',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent',
    createNode({
      type: 'answer',
      id: 'answer-first',
      title: '先有回答',
      content: '',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent',
    createNode({
      type: 'question',
      id: 'question-child',
      title: '中间插入子问题',
      content: '',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent',
    createNode({
      type: 'summary',
      id: 'summary-third',
      title: '最后总结',
      content: '',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createSingleModuleSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '恢复主题',
    workspaceId: 'workspace-recovery',
    rootId: 'theme-recovery',
    createdAt: '2026-04-27T10:30:00.000Z',
    updatedAt: '2026-04-27T10:30:00.000Z',
  });

  const tree = insertChildNode(
    snapshot.tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-recovery',
      title: '唯一模块',
      content: '用于验证删空后的恢复路径。',
      createdAt: '2026-04-27T10:30:00.000Z',
      updatedAt: '2026-04-27T10:30:00.000Z',
    }),
  );

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

  return section;
}
