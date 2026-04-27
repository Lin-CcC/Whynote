import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';

test('keeps manual step status overrides until later content changes hand control back to the system', async () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-plan-status"
      initialSelectedNodeId="step-plan-status"
      initialSnapshot={createPlanStepStatusSnapshot()}
    />,
  );

  expect(screen.getByText(/系统判断：待开始/)).toBeInTheDocument();

  fireEvent.change(
    screen.getByRole('combobox', { name: '起始步骤 的步骤状态' }),
    {
      target: {
        value: 'done',
      },
    },
  );

  expect(screen.getByText(/当前状态已手动改为 已完成/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('起始问题 内容'), {
    target: {
      value: '补一段问题说明，触发后续系统重算。',
    },
  });

  await waitFor(() => {
    expect(
      screen.getByRole('combobox', { name: '起始步骤 的步骤状态' }),
    ).toHaveValue('todo');
  });
  expect(screen.queryByText(/当前状态已手动改为 已完成/)).not.toBeInTheDocument();
});

function createPlanStepStatusSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'Plan step status',
    workspaceId: 'workspace-plan-status',
    rootId: 'theme-plan-status',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-plan-status',
      title: '状态模块',
      content: '用于验证步骤状态托管。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-plan-status',
    createNode({
      type: 'plan-step',
      id: 'step-plan-status',
      title: '起始步骤',
      content: '这里只放最小学习路径骨架。',
      status: 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-plan-status',
    createNode({
      type: 'question',
      id: 'question-plan-status',
      title: '起始问题',
      content: '',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
