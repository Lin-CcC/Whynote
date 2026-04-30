import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import {
  DEFAULT_WORKSPACE_VIEW_STATE,
  getAnswerHistorySectionId,
  getSummaryHistorySectionId,
} from './utils/workspaceViewState';
import type { WorkspaceEditorProps, WorkspaceViewState } from './workspaceEditorTypes';

test.each([
  'question-main',
  'answer-first',
  'judgment-first-latest',
  'summary-manual',
  'judgment-summary-latest',
])('activates the same question block when selecting %s', (selectedNodeId) => {
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
});

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

test('keeps each answer adjacent to its own latest closure nodes in reading-chain order', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const firstAnswerGroup = screen.getByTestId(
    'question-block-answer-group-answer-first',
  );
  const secondAnswerGroup = screen.getByTestId(
    'question-block-answer-group-answer-second',
  );

  expect(
    within(firstAnswerGroup).getByTestId('editor-node-answer-first'),
  ).toBeInTheDocument();
  expect(
    within(firstAnswerGroup).getByTestId('editor-node-judgment-first-latest'),
  ).toBeInTheDocument();
  expect(
    within(firstAnswerGroup).getByTestId('editor-node-summary-first-latest'),
  ).toBeInTheDocument();
  expect(
    within(secondAnswerGroup).getByTestId('editor-node-answer-second'),
  ).toBeInTheDocument();
  expect(
    within(secondAnswerGroup).getByTestId('editor-node-judgment-second-latest'),
  ).toBeInTheDocument();
  expect(
    within(secondAnswerGroup).getByTestId('editor-node-summary-second-latest'),
  ).toBeInTheDocument();

  expectVisibleNodeOrder('question-main', [
    'answer-first',
    'judgment-first-latest',
    'summary-first-latest',
    'answer-second',
    'judgment-second-latest',
    'summary-second-latest',
    'question-follow-up',
    'summary-manual',
    'judgment-summary-latest',
  ]);
});

test('currentAnswerId only changes emphasis and does not reorder answer groups', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expectAnswerGroupOrder('question-main', ['answer-first', 'answer-second']);
  expect(
    screen.getByTestId('question-block-answer-group-answer-first'),
  ).toHaveAttribute('data-current-answer', 'false');
  expect(
    screen.getByTestId('question-block-answer-group-answer-second'),
  ).toHaveAttribute('data-current-answer', 'true');

  fireEvent.click(
    within(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).getByRole('button', {
      name: '设为当前回答',
    }),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).toHaveAttribute('data-current-answer', 'true');
  });

  expect(
    within(screen.getByTestId('editor-node-answer-first')).getByText(
      '当前回答',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('question-block-answer-group-answer-second'),
  ).toHaveAttribute('data-current-answer', 'false');
  expectAnswerGroupOrder('question-main', ['answer-first', 'answer-second']);
  expectVisibleNodeOrder('question-main', [
    'answer-first',
    'judgment-first-latest',
    'summary-first-latest',
    'answer-second',
    'judgment-second-latest',
    'summary-second-latest',
    'question-follow-up',
    'summary-manual',
    'judgment-summary-latest',
  ]);
});

test('keeps manual summary and summary-check results adjacent with group-local history', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const summaryGroup = screen.getByTestId(
    'question-block-summary-group-summary-manual',
  );

  expect(
    within(screen.getByTestId('editor-node-summary-first-latest')).getByText(
      '答案解析',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-summary-manual')).getByText('总结'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-judgment-summary-latest')).getByText(
      '总结检查结果',
    ),
  ).toBeInTheDocument();
  expect(
    within(summaryGroup).getByTestId('editor-node-judgment-summary-latest'),
  ).toBeInTheDocument();
  expect(
    within(summaryGroup).queryByTestId('editor-node-judgment-summary-old'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '展开早期回答' }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    within(summaryGroup).getByRole('button', {
      name: '展开历史检查结果',
    }),
  );

  expect(
    within(summaryGroup).getByTestId('editor-node-judgment-summary-old'),
  ).toBeInTheDocument();
});

test('keeps follow-up questions after the answer closure chain instead of under old closures', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const mainBlock = screen.getByTestId('question-block-question-main');
  const followUpNode = screen.getByTestId('editor-node-question-follow-up');
  const summaryGroup = screen.getByTestId(
    'question-block-summary-group-summary-manual',
  );

  expect(mainBlock.compareDocumentPosition(followUpNode)).not.toBe(0);
  expect(
    screen.queryByTestId('editor-node-judgment-first-history'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('editor-node-summary-first-history'),
  ).not.toBeInTheDocument();

  const orderedNodeIds = getRenderedNodeIds('question-main');
  const followUpIndex = orderedNodeIds.indexOf('question-follow-up');
  const secondExplanationIndex = orderedNodeIds.indexOf('summary-second-latest');
  const summaryIndex = orderedNodeIds.indexOf('summary-manual');

  expect(followUpIndex).toBeGreaterThan(secondExplanationIndex);
  expect(followUpIndex).toBeLessThan(summaryIndex);
  expect(
    summaryGroup.compareDocumentPosition(followUpNode),
  ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
});

test('tracks block, body, and group-local history collapse in workspace view state', () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-answer-first')).getByRole('button', {
      name: '收起正文',
    }),
  );

  expect(viewStateChanges.at(-1)?.collapsedNodeBodyIds).toContain('answer-first');
  expect(screen.queryByLabelText('第一版回答 内容')).not.toBeInTheDocument();

  fireEvent.click(
    within(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).getByRole('button', {
      name: '展开历史评估与旧解析',
    }),
  );

  expect(viewStateChanges.at(-1)?.expandedHistorySectionIds).toContain(
    getAnswerHistorySectionId('answer-first'),
  );
  expect(
    screen.getByTestId('editor-node-judgment-first-history'),
  ).toBeInTheDocument();

  fireEvent.click(
    within(
      screen.getByTestId('question-block-summary-group-summary-manual'),
    ).getByRole('button', {
      name: '展开历史检查结果',
    }),
  );

  expect(viewStateChanges.at(-1)?.expandedHistorySectionIds).toEqual(
    expect.arrayContaining([
      getAnswerHistorySectionId('answer-first'),
      getSummaryHistorySectionId('summary-manual'),
    ]),
  );
  expect(
    screen.getByTestId('editor-node-judgment-summary-old'),
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
    screen.getByTestId('question-block-question-main'),
  ).toHaveAttribute('data-collapsed', 'true');
  expect(
    screen.queryByTestId('question-block-answer-group-answer-first'),
  ).not.toBeInTheDocument();
});

test('does not auto-reopen a group history section after the user collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'judgment-first-history',
    initialWorkspaceViewState: {
      collapsedQuestionBlockIds: [],
      collapsedNodeBodyIds: [],
      expandedHistorySectionIds: [getAnswerHistorySectionId('answer-first')],
    },
  });

  expect(
    screen.getByTestId('editor-node-judgment-first-history'),
  ).toBeInTheDocument();

  fireEvent.click(
    within(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).getByRole('button', {
      name: '收起历史评估与旧解析',
    }),
  );

  await waitFor(() => {
    expect(
      within(
        screen.getByTestId('question-block-answer-group-answer-first'),
      ).getByRole('button', {
        name: '展开历史评估与旧解析',
      }),
    ).toBeInTheDocument();
  });

  expect(
    screen.queryByTestId('editor-node-judgment-first-history'),
  ).not.toBeInTheDocument();
});

test('auto-expands a collapsed block and its hidden history when selecting a historical node from the structure tree', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
    initialWorkspaceViewState: {
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['judgment-first-history'],
      expandedHistorySectionIds: [],
    },
  });

  expect(
    screen.getByTestId('question-block-question-main'),
  ).toHaveAttribute('data-collapsed', 'true');

  fireEvent.click(
    within(screen.getByRole('tree', { name: '当前模块结构' })).getByRole(
      'button',
      { name: /第一版历史评估/ },
    ),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-question-main'),
    ).toHaveAttribute('data-collapsed', 'false');
  });

  expect(
    screen.getByTestId('editor-node-judgment-first-history'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-judgment-first-history')).getByRole(
      'button',
      {
        name: '收起正文',
      },
    ),
  ).toBeInTheDocument();
});

test('falls back to the latest non-empty answer when currentAnswerId is missing', () => {
  renderQuestionBlockEditor({
    initialSnapshot: createLegacyAnswerFallbackSnapshot(),
    initialSelectedNodeId: 'question-legacy',
  });

  expect(
    screen.getByTestId('question-block-answer-group-answer-legacy-filled'),
  ).toHaveAttribute('data-current-answer', 'true');
  expect(
    screen.getByTestId('question-block-answer-group-answer-legacy-empty'),
  ).toHaveAttribute('data-current-answer', 'false');
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
        initialModuleId={
          options?.initialModuleId ?? snapshot.tree.nodes[snapshot.workspace.rootNodeId].childIds[0]
        }
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
      content: '围绕回答、判断、答案解析、总结检查和追问验证 question block 排序。',
      currentAnswerId: 'answer-second',
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'answer',
      id: 'answer-first',
      title: '第一版回答',
      content: '先给出第一版回答。',
      createdAt: '2026-04-30T09:01:00.000Z',
      updatedAt: '2026-04-30T09:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'answer',
      id: 'answer-second',
      title: '第二版回答',
      content: '这是当前工作的第二版回答。',
      createdAt: '2026-04-30T09:02:00.000Z',
      updatedAt: '2026-04-30T09:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-second-latest',
      title: '第二版最新评估',
      content: '第二版回答的最新判断。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-second',
      sourceAnswerUpdatedAt: '2026-04-30T09:02:00.000Z',
      createdAt: '2026-04-30T09:03:00.000Z',
      updatedAt: '2026-04-30T09:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-second-latest',
      title: '第二版最新解析',
      content: '第二版回答的答案解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-second',
      sourceAnswerUpdatedAt: '2026-04-30T09:02:00.000Z',
      createdAt: '2026-04-30T09:04:00.000Z',
      updatedAt: '2026-04-30T09:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'question',
      id: 'question-follow-up',
      title: '追问：下一轮问题',
      content: '这个追问应该紧跟在对应回答闭环之后显示。',
      createdAt: '2026-04-30T09:05:00.000Z',
      updatedAt: '2026-04-30T09:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-first-history',
      title: '第一版历史评估',
      content: '这是第一版回答的旧评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-first',
      sourceAnswerUpdatedAt: '2026-04-30T09:01:00.000Z',
      createdAt: '2026-04-30T09:06:00.000Z',
      updatedAt: '2026-04-30T09:06:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-first-history',
      title: '第一版旧解析',
      content: '这是第一版回答的旧答案解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-first',
      sourceAnswerUpdatedAt: '2026-04-30T09:01:00.000Z',
      createdAt: '2026-04-30T09:07:00.000Z',
      updatedAt: '2026-04-30T09:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-first-latest',
      title: '第一版最新评估',
      content: '这是第一版回答的最新评估。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-first',
      sourceAnswerUpdatedAt: '2026-04-30T09:01:00.000Z',
      createdAt: '2026-04-30T09:08:00.000Z',
      updatedAt: '2026-04-30T09:08:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'summary',
      id: 'summary-first-latest',
      title: '第一版最新解析',
      content: '这是第一版回答的最新答案解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-first',
      sourceAnswerUpdatedAt: '2026-04-30T09:01:00.000Z',
      createdAt: '2026-04-30T09:09:00.000Z',
      updatedAt: '2026-04-30T09:09:00.000Z',
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
      createdAt: '2026-04-30T09:10:00.000Z',
      updatedAt: '2026-04-30T09:10:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-old',
      title: '旧总结检查结果',
      content: '这是总结的旧检查结果。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      sourceSummaryUpdatedAt: '2026-04-30T09:10:00.000Z',
      sourceAnswerId: 'answer-second',
      sourceAnswerUpdatedAt: '2026-04-30T09:02:00.000Z',
      createdAt: '2026-04-30T09:11:00.000Z',
      updatedAt: '2026-04-30T09:11:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-main',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-latest',
      title: '最新总结检查结果',
      content: '这是总结的最新检查结果。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      sourceSummaryUpdatedAt: '2026-04-30T09:10:00.000Z',
      sourceAnswerId: 'answer-second',
      sourceAnswerUpdatedAt: '2026-04-30T09:02:00.000Z',
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
      content: '用来验证 block 激活只跟当前 question block 走。',
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
    delete legacyQuestionNode.currentAnswerId;
  }

  return {
    ...snapshot,
    tree,
  };
}

function getRenderedNodeIds(questionNodeId: string) {
  return Array.from(
    screen
      .getByTestId(`question-block-${questionNodeId}`)
      .querySelectorAll('[data-testid^="editor-node-"]'),
  )
    .map((element) => element.getAttribute('data-testid') ?? '')
    .filter((testId) => testId !== `editor-node-${questionNodeId}`)
    .map((testId) => testId.replace('editor-node-', ''));
}

function expectVisibleNodeOrder(questionNodeId: string, expectedNodeIds: string[]) {
  expect(getRenderedNodeIds(questionNodeId)).toEqual(expectedNodeIds);
}

function expectAnswerGroupOrder(
  questionNodeId: string,
  expectedAnswerIds: string[],
) {
  const answerGroupIds = Array.from(
    screen
      .getByTestId(`question-block-${questionNodeId}`)
      .querySelectorAll('[data-testid^="question-block-answer-group-"]'),
  ).map((element) =>
    (element.getAttribute('data-testid') ?? '').replace(
      'question-block-answer-group-',
      '',
    ),
  );

  expect(answerGroupIds).toEqual(expectedAnswerIds);
}
