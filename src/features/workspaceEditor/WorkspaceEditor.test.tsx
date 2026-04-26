import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  deleteNode,
  insertChildNode,
  insertSiblingNode,
  liftNode,
  lowerNode,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
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
