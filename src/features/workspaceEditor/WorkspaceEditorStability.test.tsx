import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { createWorkspaceSnapshot, type WorkspaceSnapshot } from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import { DEMO_SELECTED_NODE_ID } from './utils/createDemoWorkspace';

test('keeps the selected textarea focused across consecutive input updates', async () => {
  render(<WorkspaceEditor />);

  const textarea = getNodeContentInput(DEMO_SELECTED_NODE_ID);

  textarea.focus();
  expect(textarea).toHaveFocus();

  fireEvent.change(textarea, {
    target: {
      value: '第一次连续输入',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('第一次连续输入');
  });

  fireEvent.change(textarea, {
    target: {
      value: '第一次连续输入，第二次继续输入更多内容',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('第一次连续输入，第二次继续输入更多内容');
  });
});

test('respects the real focused input when the user starts editing another node directly', async () => {
  render(<WorkspaceEditor />);

  const textarea = getNodeContentInput('question-render-boundary');

  textarea.focus();

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(screen.getByTestId('editor-node-question-render-boundary')).toHaveAttribute(
      'data-node-selected',
      'true',
    );
    expect(screen.getByTestId('editor-node-question-render-boundary')).toHaveAttribute(
      'data-node-editing',
      'true',
    );
    expect(screen.getByTestId('editor-node-step-render-boundary')).toHaveAttribute(
      'data-node-editing',
      'false',
    );
    expect(screen.getByTestId('editor-node-module-state-rendering')).toHaveAttribute(
      'data-node-editing',
      'false',
    );
  });
  expect(screen.getByTestId('editor-node-question-render-boundary')).toHaveTextContent(
    '当前正在编辑输入框。',
  );
  expect(screen.getByTestId('editor-node-question-render-boundary')).toHaveTextContent(
    '编辑中',
  );
  expect(screen.getAllByText('编辑中')).toHaveLength(1);

  fireEvent.change(textarea, {
    target: {
      value: '直接从另一个节点开始编辑，也不应该被外层卡片抢走焦点。',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('直接从另一个节点开始编辑，也不应该被外层卡片抢走焦点。');
  });
});

test('selects a node by clicking its card without requiring textarea focus first', async () => {
  render(<WorkspaceEditor />);

  const node = screen.getByTestId('editor-node-question-render-boundary');
  const textarea = getNodeContentInput('question-render-boundary');

  fireEvent.click(node);

  await waitFor(() => {
    expect(node).toHaveAttribute('data-node-selected', 'true');
    expect(node).toHaveAttribute('data-node-editing', 'false');
    expect(node).toHaveFocus();
  });
  expect(textarea).not.toHaveFocus();
  expect(node).toHaveTextContent('卡片只选中，输入框才会编辑。');
  expect(node).not.toHaveTextContent('编辑中');
});

test('toggles builtin tags on the selected node and persists the updated state', () => {
  const snapshots: WorkspaceSnapshot[] = [];

  render(
    <WorkspaceEditor
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '重要' }));

  const attachedSnapshot = snapshots[snapshots.length - 1];

  expect(screen.getByRole('button', { name: '重要' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(attachedSnapshot?.tree.tags['tag-important']?.name).toBe('重要');
  expect(attachedSnapshot?.tree.nodes[DEMO_SELECTED_NODE_ID].tagIds).toContain(
    'tag-important',
  );

  fireEvent.click(screen.getByRole('button', { name: '重要' }));

  const detachedSnapshot = snapshots[snapshots.length - 1];

  expect(screen.getByRole('button', { name: '重要' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(detachedSnapshot?.tree.nodes[DEMO_SELECTED_NODE_ID].tagIds).not.toContain(
    'tag-important',
  );
});

test('renders disabled builtin tag controls when there is no selected node', () => {
  render(<WorkspaceEditor initialSnapshot={createWorkspaceSnapshot({ title: '空白主题' })} />);

  expect(screen.getByText('先选中一个节点，再挂载内建标签。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重要' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '未理解' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '待验证' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '待整理' })).toBeDisabled();
});

function getNodeContentInput(nodeId: string) {
  const container = screen.getByTestId(`editor-node-${nodeId}`);
  const textarea = container.querySelector('textarea');

  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error(`Unable to find textarea for node ${nodeId}.`);
  }

  return textarea;
}
