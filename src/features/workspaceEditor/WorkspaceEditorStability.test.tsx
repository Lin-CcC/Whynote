import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { createWorkspaceSnapshot, type WorkspaceSnapshot } from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import workspaceEditorStyles from './workspaceEditor.css?raw';
import { DEMO_SELECTED_NODE_ID } from './utils/createDemoWorkspace';

test('keeps the selected textarea focused across consecutive input updates', async () => {
  render(<WorkspaceEditor />);

  const textarea = getNodeContentInput(DEMO_SELECTED_NODE_ID);

  textarea.focus();
  expect(textarea).toHaveFocus();

  fireEvent.change(textarea, {
    target: {
      value: 'first focused edit',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('first focused edit');
  });

  fireEvent.change(textarea, {
    target: {
      value: 'first focused edit, then keep typing more content',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('first focused edit, then keep typing more content');
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
  expect(screen.getByTestId('editor-node-question-render-boundary')).toHaveAttribute(
    'data-node-frame-visible',
    'true',
  );
  expect(
    screen.getByTestId('editor-node-question-render-boundary'),
  ).not.toHaveTextContent('编辑中');
  expect(
    screen.getByTestId('editor-node-question-render-boundary'),
  ).not.toHaveTextContent('点击标题或正文即可继续修改');
  expect(screen.queryByText('编辑中')).not.toBeInTheDocument();

  fireEvent.change(textarea, {
    target: {
      value: 'editing another node directly should keep focus on its own textarea',
    },
  });

  await waitFor(() => {
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue(
      'editing another node directly should keep focus on its own textarea',
    );
  });
});

test('selects a node by clicking its card without requiring textarea focus first', async () => {
  render(<WorkspaceEditor />);

  const node = screen.getByTestId('editor-node-question-render-boundary');

  fireEvent.click(node);

  await waitFor(() => {
    expect(node).toHaveAttribute('data-node-selected', 'true');
    expect(node).toHaveAttribute('data-node-editing', 'false');
    expect(node).toHaveFocus();
  });
  expect(node.querySelector('textarea')).toBeNull();
  expect(node).toHaveAttribute('data-node-frame-visible', 'true');
  expect(node).not.toHaveTextContent('编辑中');
});

test('keeps document node visibility changes free of transition-driven shell animations', () => {
  expect(workspaceEditorStyles).not.toMatch(
    /\.workspace-documentNode\s*\{[^}]*transition:/,
  );
  expect(workspaceEditorStyles).not.toMatch(
    /\.workspace-nodeTitleToolbar\s*\{[^}]*transition:/,
  );
  expect(workspaceEditorStyles).not.toMatch(
    /\.workspace-nodeActionToolbar\s*\{[^}]*transition:/,
  );
  expect(workspaceEditorStyles).not.toMatch(
    /\.workspace-nodeTitleToolbar\s*\{[^}]*animation:/,
  );
  expect(workspaceEditorStyles).not.toMatch(
    /\.workspace-nodeActionToolbar\s*\{[^}]*animation:/,
  );
});

test('keeps title control rails and toolbars layout-stable by avoiding display toggles', () => {
  render(<WorkspaceEditor />);

  const hiddenTitleControls = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.workspace-nodeTitleControls[aria-hidden="true"][data-visible="false"]',
    ),
  );
  const hiddenActionToolbars = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.workspace-nodeActionToolbar[aria-hidden="true"][data-visible="false"]',
    ),
  );

  expect(hiddenTitleControls.length).toBeGreaterThan(0);
  expect(hiddenActionToolbars.length).toBeGreaterThan(0);

  for (const controls of hiddenTitleControls) {
    expect(controls.querySelector('button')).not.toBeNull();
  }

  for (const toolbar of hiddenActionToolbars) {
    expect(toolbar.querySelector('button')).not.toBeNull();
  }
});

test('keeps the title input focused while side panels reflect title edits', async () => {
  render(<WorkspaceEditor />);

  const titleInput = getNodeTitleInput('question-render-boundary');
  const nextTitle =
    'A very long title that forces the side panels to rerender while focus stays put';

  titleInput.focus();
  expect(titleInput).toHaveFocus();

  fireEvent.change(titleInput, {
    target: {
      value: nextTitle,
    },
  });

  await waitFor(() => {
    expect(titleInput).toHaveFocus();
    expect(titleInput).toHaveValue(nextTitle);
    expect(screen.getByTitle(`当前节点：${nextTitle}`)).toBeInTheDocument();
    expect(screen.getByTitle(`问题 · ${nextTitle}`)).toBeInTheDocument();
  });
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
  let textarea = container.querySelector('textarea');

  if (!(textarea instanceof HTMLTextAreaElement)) {
    const contentDisplay = container.querySelector(
      `[data-testid="editor-node-content-display-${nodeId}"]`,
    );

    if (contentDisplay instanceof HTMLButtonElement) {
      fireEvent.click(contentDisplay);
      textarea = container.querySelector('textarea');
    }
  }

  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error(`Unable to find textarea for node ${nodeId}.`);
  }

  return textarea;
}

function getNodeTitleInput(nodeId: string) {
  const container = screen.getByTestId(`editor-node-${nodeId}`);
  let input = container.querySelector('input');

  if (!(input instanceof HTMLInputElement)) {
    const titleEntry =
      container.querySelector(`[data-testid="editor-node-title-display-${nodeId}"]`) ??
      container.querySelector(`[data-testid="editor-node-add-title-${nodeId}"]`);

    if (titleEntry instanceof HTMLButtonElement) {
      fireEvent.click(titleEntry);
      input = container.querySelector('input');
    }
  }

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Unable to find title input for node ${nodeId}.`);
  }

  return input;
}
