import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import {
  DEFAULT_WORKSPACE_VIEW_STATE,
  getQuestionBlockHistorySectionId,
} from './utils/workspaceViewState';
import type { WorkspaceEditorProps, WorkspaceViewState } from './workspaceEditorTypes';

test.each([
  'question-main',
  'answer-current',
  'judgment-current-latest',
  'summary-manual',
  'judgment-summary-latest',
])(
  'activates the same question block when selecting %s',
  (selectedNodeId) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
    });

    expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(
      screen.getByTestId('question-block-question-secondary'),
    ).toHaveAttribute('data-active', 'false');
  },
);

test('shows question block actions only on the active block', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const mainBlockActions = screen.getByTestId(
    'question-block-actions-question-main',
  );

  expect(
    within(mainBlockActions).getByRole('button', { name: '直接回答当前问题' }),
  ).toBeInTheDocument();
  expect(
    within(mainBlockActions).getByRole('button', { name: '插入回答' }),
  ).toBeInTheDocument();
  expect(
    within(mainBlockActions).getByRole('button', { name: '插入追问' }),
  ).toBeInTheDocument();
  expect(
    within(mainBlockActions).getByRole('button', { name: '插入总结' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('question-block-actions-question-secondary'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole('tree', { name: '当前模块结构' })).getByRole(
      'button',
      { name: /旁支问题/ },
    ),
  );

  expect(
    screen.queryByTestId('question-block-actions-question-main'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByTestId('question-block-actions-question-secondary'),
  ).toBeInTheDocument();
});

test('splits current answer from previous answers and keeps previous answers collapsed by default', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const currentAnswerSection = screen.getByTestId(
    'question-block-current-answer-question-main',
  );

  expect(
    within(currentAnswerSection).getByTestId('editor-node-answer-current'),
  ).toBeInTheDocument();
  expect(
    within(currentAnswerSection).getByTestId('editor-node-judgment-current-latest'),
  ).toBeInTheDocument();
  expect(
    within(currentAnswerSection).getByTestId('editor-node-summary-current-latest'),
  ).toBeInTheDocument();
  expect(
    within(currentAnswerSection).queryByTestId('editor-node-answer-old'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('question-block-previous-answers-question-main'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开早期回答' }));

  const previousAnswersSection = screen.getByTestId(
    'question-block-previous-answers-question-main',
  );

  expect(
    within(previousAnswersSection).getByTestId('editor-node-answer-old'),
  ).toBeInTheDocument();
  expect(
    within(previousAnswersSection).getByTestId('editor-node-judgment-old-latest'),
  ).toBeInTheDocument();
  expect(
    within(previousAnswersSection).getByTestId('editor-node-summary-old-latest'),
  ).toBeInTheDocument();
});

test('keeps the set-current-answer action reachable and re-groups answers after switching', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  fireEvent.click(screen.getByRole('button', { name: '展开早期回答' }));

  fireEvent.click(
    within(
      screen.getByTestId('question-block-previous-answers-question-main'),
    ).getByRole('button', {
      name: '设为当前回答',
    }),
  );

  await waitFor(() => {
    expect(
      within(
        screen.getByTestId('question-block-current-answer-question-main'),
      ).getByTestId('editor-node-answer-old'),
    ).toBeInTheDocument();
  });

  expect(
    within(
      screen.getByTestId('question-block-previous-answers-question-main'),
    ).getByTestId('editor-node-answer-current'),
  ).toBeInTheDocument();
});

test('renders answer explanation, manual summary, and summary check result as separate display semantics', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expect(
    within(screen.getByTestId('editor-node-summary-current-latest')).getByText(
      '答案解析',
    ),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('当前最新解析')).toBeInTheDocument();

  expect(
    within(screen.getByTestId('editor-node-summary-manual')).getByText('总结'),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('我的总结')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-summary-manual')).getByRole('button', {
      name: '检查这个总结',
    }),
  ).toBeInTheDocument();

  expect(
    within(screen.getByTestId('editor-node-judgment-summary-latest')).getByText(
      '总结检查结果',
    ),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('最新检查结果')).toBeInTheDocument();
});

test('tracks block, body, and history collapse in workspace view state', () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-answer-current')).getByRole('button', {
      name: '收起正文',
    }),
  );

  expect(viewStateChanges.at(-1)?.collapsedNodeBodyIds).toContain('answer-current');
  expect(screen.queryByLabelText('当前回答 内容')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开早期回答' }));

  expect(viewStateChanges.at(-1)?.expandedHistorySectionIds).toContain(
    getQuestionBlockHistorySectionId('question-main'),
  );
  expect(
    screen.getByTestId('question-block-previous-answers-question-main'),
  ).toBeInTheDocument();

  fireEvent.click(
    within(screen.getByTestId('question-block-question-main')).getAllByRole(
      'button',
      {
        name: '收起 block',
      },
    )[0],
  );

  expect(viewStateChanges.at(-1)?.collapsedQuestionBlockIds).toContain(
    'question-main',
  );
  expect(
    screen.queryByTestId('question-block-current-answer-question-main'),
  ).not.toBeInTheDocument();
});

test('does not auto-reopen the selected node body after the user collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'answer-current',
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-answer-current')).getByRole('button', {
      name: '收起正文',
    }),
  );

  await waitFor(() => {
    expect(
      within(screen.getByTestId('editor-node-answer-current')).getByRole(
        'button',
        {
          name: '展开正文',
        },
      ),
    ).toBeInTheDocument();
  });
  expect(screen.queryByLabelText('当前回答 内容')).not.toBeInTheDocument();
});

test('does not auto-reopen the selected history section after the user collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'answer-old',
  });

  expect(
    screen.getByTestId('question-block-previous-answers-question-main'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '收起早期回答' }));

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: '展开早期回答' }),
    ).toBeInTheDocument();
  });
  expect(
    screen.queryByTestId('question-block-previous-answers-question-main'),
  ).not.toBeInTheDocument();
});

test('does not auto-reopen the selected question block after the user collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  fireEvent.click(
    within(screen.getByTestId('question-block-question-main')).getAllByRole(
      'button',
      {
        name: /收起 block/,
      },
    )[0],
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-question-main'),
    ).toHaveAttribute('data-collapsed', 'true');
  });
  expect(
    screen.queryByTestId('question-block-current-answer-question-main'),
  ).not.toBeInTheDocument();
});

test('falls back to the latest non-empty answer when currentAnswerId is missing', () => {
  renderQuestionBlockEditor({
    initialSnapshot: createLegacyAnswerFallbackSnapshot(),
    initialSelectedNodeId: 'question-legacy',
  });

  const currentAnswerSection = screen.getByTestId(
    'question-block-current-answer-question-legacy',
  );

  expect(
    within(currentAnswerSection).getByTestId('editor-node-answer-legacy-filled'),
  ).toBeInTheDocument();
  expect(
    within(currentAnswerSection).queryByTestId('editor-node-answer-legacy-empty'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开早期回答' }));

  expect(
    within(
      screen.getByTestId('question-block-previous-answers-question-legacy'),
    ).getByTestId('editor-node-answer-legacy-empty'),
  ).toBeInTheDocument();
});

test('auto-expands a collapsed question block when a node inside it is selected from the structure tree', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
    initialWorkspaceViewState: {
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['answer-old'],
      expandedHistorySectionIds: [],
    },
  });

  expect(
    screen.getByTestId('question-block-question-main'),
  ).toHaveAttribute('data-collapsed', 'true');

  fireEvent.click(
    within(screen.getByRole('tree', { name: '当前模块结构' })).getByRole(
      'button',
      { name: /^回答.*旧回答$/ },
    ),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-question-main'),
    ).toHaveAttribute('data-collapsed', 'false');
  });

  expect(
    screen.getByTestId('question-block-previous-answers-question-main'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('editor-node-answer-old')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-answer-old')).getByRole('button', {
      name: '收起正文',
    }),
  ).toBeInTheDocument();
});

function renderQuestionBlockEditor(
  options?: Partial<WorkspaceEditorProps> & {
    initialWorkspaceViewState?: WorkspaceViewState;
    onViewStateChange?: (state: WorkspaceViewState) => void;
  },
) {
  const snapshot = options?.initialSnapshot ?? createQuestionBlockSnapshot();
  const initialWorkspaceViewState =
    options?.initialWorkspaceViewState ?? DEFAULT_WORKSPACE_VIEW_STATE;
  const onDirectAnswerQuestion = options?.onDirectAnswerQuestion ?? vi.fn();
  const onEvaluateAnswer = options?.onEvaluateAnswer ?? vi.fn();
  const onEvaluateSummary = options?.onEvaluateSummary ?? vi.fn();

  function Wrapper() {
    const [workspaceViewState, setWorkspaceViewState] = useState(
      initialWorkspaceViewState,
    );

    return (
      <WorkspaceEditor
        initialModuleId="module-question-block"
        initialSelectedNodeId={options?.initialSelectedNodeId ?? 'question-main'}
        initialSnapshot={snapshot}
        onDirectAnswerQuestion={onDirectAnswerQuestion}
        onEvaluateAnswer={onEvaluateAnswer}
        onEvaluateSummary={onEvaluateSummary}
        onWorkspaceViewStateChange={(state) => {
          setWorkspaceViewState(state);
          options?.onViewStateChange?.(state);
        }}
        workspaceViewState={workspaceViewState}
      />
    );
  }

  return render(<Wrapper />);
}

function createQuestionBlockSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '问题块测试主题',
    workspaceId: 'workspace-question-block',
    rootId: 'theme-question-block',
    createdAt: '2026-04-30T09:00:00.000Z',
    updatedAt: '2026-04-30T09:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-question-block',
      title: '问题块模块',
      content: '',
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-question-block',
    createNode({
      type: 'plan-step',
      id: 'step-question-block',
      title: '问题块步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-question-block',
    createNode({
      type: 'question',
      id: 'question-main',
      title: '主问题',
      content: '围绕当前回答、旧回答和总结结果建立主视图。',
      currentAnswerId: 'answer-current',
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'answer',
      id: 'answer-old',
      title: '旧回答',
      content: '这是旧回答。',
      createdAt: '2026-04-30T09:01:00.000Z',
      updatedAt: '2026-04-30T09:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-old-latest',
      title: '旧回答评估',
      content: '旧回答的最新评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-old',
      createdAt: '2026-04-30T09:02:00.000Z',
      updatedAt: '2026-04-30T09:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-old-latest',
      title: '旧回答解析',
      content: '旧回答的最新解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-old',
      createdAt: '2026-04-30T09:03:00.000Z',
      updatedAt: '2026-04-30T09:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'answer',
      id: 'answer-current',
      title: '当前回答',
      content: '这是当前回答。',
      createdAt: '2026-04-30T09:04:00.000Z',
      updatedAt: '2026-04-30T09:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-current-history',
      title: '当前历史评估',
      content: '当前回答的旧评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-current',
      createdAt: '2026-04-30T09:05:00.000Z',
      updatedAt: '2026-04-30T09:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-current-latest',
      title: '当前最新评估',
      content: '当前回答的最新评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-current',
      createdAt: '2026-04-30T09:06:00.000Z',
      updatedAt: '2026-04-30T09:06:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-current-history',
      title: '当前旧解析',
      content: '当前回答的旧解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-current',
      createdAt: '2026-04-30T09:07:00.000Z',
      updatedAt: '2026-04-30T09:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-current-latest',
      title: '当前最新解析',
      content: '当前回答的最新解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-current',
      createdAt: '2026-04-30T09:08:00.000Z',
      updatedAt: '2026-04-30T09:08:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-manual',
      title: '我的总结',
      content: '这是我手写的总结。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T09:09:00.000Z',
      updatedAt: '2026-04-30T09:09:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-history',
      title: '旧检查结果',
      content: '总结的旧检查结果。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      createdAt: '2026-04-30T09:10:00.000Z',
      updatedAt: '2026-04-30T09:10:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-latest',
      title: '最新检查结果',
      content: '总结的最新检查结果。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      createdAt: '2026-04-30T09:11:00.000Z',
      updatedAt: '2026-04-30T09:11:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'question',
      id: 'question-follow-up',
      title: '后续追问',
      content: '这个追问仍然保留为真实子节点。',
      createdAt: '2026-04-30T09:12:00.000Z',
      updatedAt: '2026-04-30T09:12:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-question-block',
    createNode({
      type: 'question',
      id: 'question-secondary',
      title: '旁支问题',
      content: '用来验证只有当前激活 block 会显示 block 级动作。',
      createdAt: '2026-04-30T09:13:00.000Z',
      updatedAt: '2026-04-30T09:13:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createLegacyAnswerFallbackSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '兼容回答回退主题',
    workspaceId: 'workspace-legacy-answer-fallback',
    rootId: 'theme-legacy-answer-fallback',
    createdAt: '2026-04-30T10:00:00.000Z',
    updatedAt: '2026-04-30T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-answer-fallback',
      title: '兼容模块',
      content: '',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-answer-fallback',
    createNode({
      type: 'plan-step',
      id: 'step-legacy-answer-fallback',
      title: '兼容步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-legacy-answer-fallback',
    createNode({
      type: 'question',
      id: 'question-legacy',
      title: '旧问题',
      content: '没有 currentAnswerId 时应该回退到最新非空回答。',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy',
    createNode({
      type: 'answer',
      id: 'answer-legacy-filled',
      title: '旧的有效回答',
      content: '这里有实际内容。',
      createdAt: '2026-04-30T10:01:00.000Z',
      updatedAt: '2026-04-30T10:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy',
    createNode({
      type: 'answer',
      id: 'answer-legacy-empty',
      title: '尾部空草稿',
      content: '   ',
      createdAt: '2026-04-30T10:02:00.000Z',
      updatedAt: '2026-04-30T10:02:00.000Z',
    }),
  );

  const legacyQuestionNode = tree.nodes['question-legacy'];

  if (legacyQuestionNode?.type === 'question') {
    const { currentAnswerId: _ignoredCurrentAnswerId, ...questionWithoutCurrentAnswer } =
      legacyQuestionNode;

    tree = {
      ...tree,
      nodes: {
        ...tree.nodes,
        'question-legacy': questionWithoutCurrentAnswer,
      },
    };
  }

  return {
    ...snapshot,
    tree,
  };
}
