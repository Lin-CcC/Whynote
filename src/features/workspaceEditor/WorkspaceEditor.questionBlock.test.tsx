import { useState } from 'react';
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  'summary-first-latest',
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

test('does not render visible 已选中 or 编辑中 chips on the main surface', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expect(screen.queryByText('已选中')).not.toBeInTheDocument();
  expect(screen.queryByText('编辑中')).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('editor-node-content-display-answer-first'));

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: '第一版回答 内容' })).toBeInTheDocument();
  });

  expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
  expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
    'data-node-editing',
    'true',
  );
  expect(screen.queryByText('已选中')).not.toBeInTheDocument();
  expect(screen.queryByText('编辑中')).not.toBeInTheDocument();
});

test('clicking an unselected content body enters editing without an explicit preselect and keeps node actions', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expect(
    screen.queryByRole('textbox', { name: '第一版回答 内容' }),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('editor-node-content-display-answer-first'));

  await waitFor(() => {
    expect(
      screen.getByRole('textbox', { name: '第一版回答 内容' }),
    ).toBeInTheDocument();
  });

  expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
    'data-node-selected',
    'true',
  );

  const actionPanel = screen.getByTestId('node-actions-answer-first');

  expect(actionPanel).toHaveAttribute('data-visible', 'true');
  expectToolbarVerbs(actionPanel, ['评估', '追问', '总结', '⋯']);
  expectToolbarMenuActions(actionPanel, '追问', ['生成追问', '插入追问']);
  expect(
    within(openOverflowMenu(actionPanel)).getByRole('button', {
      name: '设为当前回答',
    }),
  ).toBeInTheDocument();
});

test('keeps question and plan-step titles visible while untitled content nodes reveal 添加标题 only when active', async () => {
  const snapshot = createQuestionBlockSnapshot();
  const questionNode = snapshot.tree.nodes['question-main'];
  const planStepNode = snapshot.tree.nodes['step-question-block'];
  const answerNode = snapshot.tree.nodes['answer-first'];

  if (
    questionNode?.type !== 'question' ||
    planStepNode?.type !== 'plan-step' ||
    answerNode?.type !== 'answer'
  ) {
    throw new Error(
      'Expected question-main, step-question-block, and answer-first to exist.',
    );
  }

  questionNode.title = ' ';
  planStepNode.title = ' ';
  answerNode.title = ' ';

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialSnapshot: snapshot,
  });

  expect(screen.getByLabelText('问题 标题')).toBeInTheDocument();
  expect(screen.getByText('填写步骤标题')).toBeInTheDocument();
  expect(
    screen.getByTestId('editor-node-title-display-judgment-first-latest'),
  ).toHaveTextContent('第一版最新评估');

  const answerCard = screen.getByTestId('editor-node-answer-first');

  expect(
    within(answerCard).queryByTestId('editor-node-title-display-answer-first'),
  ).not.toBeInTheDocument();
  expect(
    within(answerCard).queryByTestId('editor-node-add-title-answer-first'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('editor-node-content-display-answer-first'));

  await waitFor(() => {
    expect(
      within(answerCard).getByTestId('editor-node-add-title-answer-first'),
    ).toBeInTheDocument();
  });

  fireEvent.click(
    within(answerCard).getByTestId('editor-node-add-title-answer-first'),
  );

  await waitFor(() => {
    expect(screen.getByLabelText('回答 标题')).toBeInTheDocument();
  });
});

test('renders the selected question toolbar on the question title row and keeps shell actions quiet', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const mainQuestionNode = screen.getByTestId('editor-node-question-main');
  const mainBlockActions = screen.getByTestId(
    'question-block-actions-question-main',
  );
  const secondaryBlockActions = screen.getByTestId(
    'question-block-actions-question-secondary',
  );
  const mainQuestionTitleRow = mainQuestionNode.querySelector('.workspace-nodeTitleRow');

  expect(mainQuestionTitleRow).not.toBeNull();
  expect(
    screen.getByTestId('question-block-question-main').querySelector(
      '.workspace-questionBlockHeader',
    ),
  ).toBeNull();
  expect(mainQuestionTitleRow).toContainElement(mainBlockActions);
  expect(screen.queryByText('已有当前回答')).not.toBeInTheDocument();
  expect(screen.queryByText('还没有当前回答')).not.toBeInTheDocument();

  expect(mainBlockActions).toHaveAttribute('data-visible', 'true');
  expectToolbarVerbs(mainBlockActions, ['回答', '追问', '总结', '⋯']);
  expect(secondaryBlockActions).toHaveAttribute('data-visible', 'false');

  expectToolbarMenuActions(mainBlockActions, '回答', [
    '直接回答当前问题',
    '插入回答',
  ]);
  expectToolbarMenuActions(mainBlockActions, '追问', ['生成追问', '插入追问']);
  expectToolbarMenuActions(mainBlockActions, '总结', ['生成总结', '插入总结']);

  fireEvent.click(
    within(screen.getByRole('tree', { name: '当前模块结构' })).getByRole(
      'button',
      { name: /旁支问题/ },
    ),
  );

  expect(screen.getByTestId('question-block-actions-question-main')).toHaveAttribute(
    'data-visible',
    'false',
  );
  expect(
    screen.getByTestId('question-block-actions-question-secondary'),
  ).toHaveAttribute('data-visible', 'true');
});

test('keeps only the child question title toolbar when a follow-up question becomes active', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-follow-up',
  });

  const followUpNode = screen.getByTestId('editor-node-question-follow-up');
  const followUpTitleRow = followUpNode.querySelector('.workspace-nodeTitleRow');
  const followUpActions = screen.getByTestId('question-block-actions-question-follow-up');

  expect(followUpTitleRow).not.toBeNull();
  expect(followUpTitleRow).toContainElement(followUpActions);
  expect(
    screen.queryByTestId('question-block-actions-question-main'),
  ).not.toBeInTheDocument();
  expect(followUpActions).toHaveAttribute('data-visible', 'true');
});

test('reveals the light toolbar only on hover, focus, or active', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const answerNode = screen.getByTestId('editor-node-answer-first');
  const answerToolbar = screen.getByTestId('node-actions-answer-first');
  const titleControls = answerNode.querySelector('.workspace-nodeTitleControls');
  const hiddenTypeLabel = answerNode.querySelector(
    '.workspace-nodeType[data-visible="false"]',
  );
  const hiddenBodyToggle = within(answerNode).getByRole('button', {
    hidden: true,
    name: '收起正文',
  });

  expect(answerNode).toHaveAttribute('data-node-shell', 'document-inline');
  expect(hiddenTypeLabel).not.toBeNull();
  expect(hiddenTypeLabel).toHaveTextContent('回答');
  expect(titleControls).not.toBeNull();
  expect(titleControls).toContainElement(hiddenBodyToggle);
  expect(titleControls).toHaveAttribute('aria-hidden', 'true');
  expect(titleControls?.children).toHaveLength(2);
  expect(answerToolbar).toHaveAttribute('data-visible', 'false');
  expect(answerToolbar).toHaveAttribute('aria-hidden', 'true');
  expect(
    within(answerNode).queryByRole('button', { name: '收起正文' }),
  ).not.toBeInTheDocument();

  fireEvent.mouseEnter(answerNode);
  expect(
    answerNode.querySelector('.workspace-nodeType[data-visible="true"]'),
  ).toHaveTextContent('回答');
  expect(titleControls).toHaveAttribute('aria-hidden', 'false');
  expect(titleControls?.children).toHaveLength(2);
  expect(answerToolbar).toHaveAttribute('data-visible', 'true');
  expect(answerToolbar).toHaveAttribute('aria-hidden', 'false');
  expect(
    within(answerNode).getByRole('button', { name: '收起正文' }),
  ).toBeInTheDocument();

  fireEvent.mouseLeave(answerNode);
  expect(titleControls).toHaveAttribute('aria-hidden', 'true');
  expect(titleControls?.children).toHaveLength(2);
  expect(answerToolbar).toHaveAttribute('data-visible', 'false');
  expect(answerToolbar).toHaveAttribute('aria-hidden', 'true');
  expect(
    within(answerNode).queryByRole('button', { name: '收起正文' }),
  ).not.toBeInTheDocument();

  fireEvent.focus(screen.getByLabelText('第一版回答 标题'));
  expect(titleControls).toHaveAttribute('aria-hidden', 'false');
  expect(answerToolbar).toHaveAttribute('data-visible', 'true');
  expect(
    within(answerNode).getByRole('button', { name: '收起正文' }),
  ).toBeInTheDocument();
});

test('keeps question, answer, judgment, summary, summary-check, and plan-step title rails mounted while hidden', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expectMountedTitleControls('editor-node-step-question-block', [
    '收起步骤',
    '问题块步骤 状态：进行中',
  ]);
  expectStableHiddenTitleControls('editor-node-question-secondary', ['收起问题']);
  expectStableHiddenTitleControls('editor-node-answer-first', ['收起正文', '追问']);
  expectStableHiddenTitleControls('editor-node-judgment-first-latest', [
    '收起正文',
    '追问',
  ]);
  expectStableHiddenTitleControls('editor-node-summary-first-latest', [
    '收起正文',
    '追问',
  ]);
  expectStableHiddenTitleControls('editor-node-summary-manual', [
    '收起正文',
    '追问',
  ]);
  expectStableHiddenTitleControls('editor-node-judgment-summary-latest', [
    '收起正文',
    '追问',
  ]);
});

test('clicking the question body enters the light editing state without moving the toolbar back to the block shell', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const questionNode = screen.getByTestId('editor-node-question-main');
  const questionToolbar = screen.getByTestId('question-block-actions-question-main');

  fireEvent.click(screen.getByLabelText('主问题 内容'));

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: '主问题 内容' })).toBeInTheDocument();
  });

  expect(screen.getByTestId('editor-node-question-main')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
  expect(screen.getByTestId('editor-node-question-main')).toHaveAttribute(
    'data-node-editing',
    'true',
  );
  expect(questionToolbar).toHaveAttribute('data-visible', 'true');
  expect(questionNode.querySelector('.workspace-nodeTitleRow')).toContainElement(
    questionToolbar,
  );
  expect(
    screen.getByTestId('question-block-question-main').querySelector(
      '.workspace-questionBlockHeader',
    ),
  ).toBeNull();
});

test('keeps question, answer, judgment, explanation, summary, and summary-check nodes in a single-shell structure', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-secondary',
  });

  const questionBlock = screen.getByTestId('question-block-question-main');

  expect(questionBlock.querySelector('.workspace-questionBlockHeader')).toBeNull();
  expect(
    screen
      .getByTestId('question-block-answer-group-answer-second')
      .querySelector('.workspace-questionBlockSectionHeader'),
  ).toBeNull();

  expectSingleShellNode('question-main', '主问题');
  expectSingleShellNode('answer-first', '第一版回答');
  expectSingleShellNode('answer-second', '第二版回答');
  expectSingleShellNode('judgment-first-latest', '第一版最新评估');
  expectSingleShellNode('summary-first-latest', '第一版最新解析');
  expectSingleShellNode('summary-manual', '我的总结');
  expectSingleShellNode('judgment-summary-latest', '最新总结检查结果');
});

test.each([
  ['answer-first', ['评估', '追问', '总结', '⋯']],
  ['judgment-first-latest', ['追问', '总结', '⋯']],
  ['summary-first-latest', ['追问', '总结', '⋯']],
  ['summary-manual', ['追问', '总结', '⋯']],
  ['judgment-summary-latest', ['追问', '总结', '⋯']],
])(
  'moves progression actions onto the selected content node %s and hides the parent question action bar',
  (selectedNodeId, expectedVerbs) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
    });

    expect(
      screen.queryByTestId('question-block-actions-question-main'),
    ).not.toBeInTheDocument();

    const actionPanel = screen.getByTestId(`node-actions-${selectedNodeId}`);

    expect(actionPanel).toHaveAttribute('data-visible', 'true');
    expectToolbarVerbs(actionPanel, expectedVerbs);
    expect(
      within(actionPanel).queryByRole('button', { name: '回答' }),
    ).not.toBeInTheDocument();
  },
);

test.each([
  'judgment-first-latest',
  'summary-first-latest',
  'summary-manual',
  'judgment-summary-latest',
])(
  'keeps AI and manual follow-up/summary entries under the selected content node %s',
  (selectedNodeId) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
    });

    const actionPanel = screen.getByTestId(`node-actions-${selectedNodeId}`);

    expectToolbarMenuActions(actionPanel, '追问', ['生成追问', '插入追问']);
    expectToolbarMenuActions(actionPanel, '总结', ['生成总结', '插入总结']);
  },
);

test.each([
  {
    actionPanelTestId: 'node-actions-answer-first',
    expectedOverflowButtons: ['删除', '查看答案解析', '设为当前回答'],
    expectedVerbs: ['评估', '追问', '总结', '⋯'],
    selectedNodeId: 'answer-first',
  },
  {
    actionPanelTestId: 'node-actions-judgment-first-latest',
    expectedOverflowButtons: ['删除', '回到当前回答继续修改'],
    expectedVerbs: ['追问', '总结', '⋯'],
    selectedNodeId: 'judgment-first-latest',
  },
  {
    actionPanelTestId: 'node-actions-summary-first-latest',
    expectedOverflowButtons: ['删除', '回到当前回答继续修改'],
    expectedVerbs: ['追问', '总结', '⋯'],
    selectedNodeId: 'summary-first-latest',
  },
  {
    actionPanelTestId: 'node-actions-summary-manual',
    expectedOverflowButtons: ['删除', '检查这个总结', '回到当前回答继续修改'],
    expectedVerbs: ['追问', '总结', '⋯'],
    selectedNodeId: 'summary-manual',
  },
])(
  'keeps low-frequency actions in ⋯ on $selectedNodeId',
  ({ actionPanelTestId, expectedOverflowButtons, expectedVerbs }) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: actionPanelTestId.replace('node-actions-', ''),
    });

    const actionPanel = screen.getByTestId(actionPanelTestId);

    expectToolbarVerbs(actionPanel, expectedVerbs);
    const overflowMenu = openOverflowMenu(actionPanel);

    for (const buttonLabel of expectedOverflowButtons) {
      expect(
        within(overflowMenu).getByRole('button', { name: buttonLabel }),
      ).toBeInTheDocument();
    }
  },
);

test('keeps the current answer reevaluation action on the selected current answer', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'answer-second',
  });

  const actionPanel = screen.getByTestId('node-actions-answer-second');

  expect(
    screen.queryByTestId('question-block-actions-question-main'),
  ).not.toBeInTheDocument();
  expect(actionPanel).toHaveAttribute('data-visible', 'true');
  expectToolbarVerbs(actionPanel, ['评估', '追问', '总结', '⋯']);
  expect(
    within(actionPanel).getByRole('button', { name: '评估' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '评估' }),
  ).toBeEnabled();
  const overflowMenu = openOverflowMenu(actionPanel);
  expect(
    within(overflowMenu).getByRole('button', { name: '删除' }),
  ).toBeInTheDocument();
  expect(
    within(overflowMenu).getByRole('button', {
      name: '查看答案解析',
    }),
  ).toBeInTheDocument();
  expect(
    within(overflowMenu).queryByRole('button', {
      name: '设为当前回答',
    }),
  ).not.toBeInTheDocument();
});

test('keeps document nodes frame-free until focus moves into their editable content', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expect(screen.getByTestId('editor-node-question-main')).toHaveAttribute(
    'data-node-frame-visible',
    'false',
  );
  expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
    'data-node-frame-visible',
    'false',
  );

  fireEvent.click(screen.getByTestId('editor-node-content-display-answer-first'));

  await waitFor(() => {
    expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
      'data-node-frame-visible',
      'true',
    );
  });

  expect(screen.getByTestId('editor-node-question-main')).toHaveAttribute(
    'data-node-frame-visible',
    'false',
  );
});

test('marks the question block and inline learning nodes as document surfaces without rails', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-block-chrome',
    'document',
  );
  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-question-rail',
    'none',
  );

  for (const nodeId of [
    'question-main',
    'answer-first',
    'judgment-first-latest',
    'summary-first-latest',
    'summary-manual',
    'judgment-summary-latest',
  ] as const) {
    expect(screen.getByTestId(`editor-node-${nodeId}`)).toHaveAttribute(
      'data-node-shell',
      'document-inline',
    );
    expect(screen.getByTestId(`editor-node-${nodeId}`)).toHaveAttribute(
      'data-node-chrome',
      'document',
    );
    expect(screen.getByTestId(`editor-node-${nodeId}`)).toHaveAttribute(
      'data-node-rail',
      'none',
    );
  }
});

test('keeps the selected question in inline document flow without forcing an editor shell first', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
  });

  const questionNode = screen.getByTestId('editor-node-question-main');

  expect(questionNode).toHaveAttribute('data-node-shell', 'document-inline');
  expect(questionNode).toHaveAttribute('data-node-chrome', 'document');
  expect(questionNode).toHaveAttribute('data-node-rail', 'none');
  expect(screen.getByLabelText('主问题 标题')).toBeInTheDocument();
  expect(screen.getByLabelText('主问题 内容')).toHaveAttribute(
    'data-testid',
    'editor-node-content-display-question-main',
  );
  expect(questionNode.querySelector('textarea')).toBeNull();
});

test.each([
  ['answer-first', '第一版回答'],
  ['judgment-first-latest', '第一版最新评估'],
  ['summary-first-latest', '第一版最新解析'],
  ['summary-manual', '我的总结'],
  ['judgment-summary-latest', '最新总结检查结果'],
] as const)(
  'keeps %s in inline document flow after clicking into body editing',
  async (nodeId, displayTitle) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: 'question-main',
    });

    const node = screen.getByTestId(`editor-node-${nodeId}`);

    fireEvent.click(screen.getByTestId(`editor-node-content-display-${nodeId}`));

    await waitFor(() => {
      expect(screen.getByLabelText(`${displayTitle} 内容`)).toBeInTheDocument();
    });

    expect(node).toHaveAttribute('data-node-shell', 'document-inline');
    expect(node).toHaveAttribute('data-node-chrome', 'document');
    expect(node).toHaveAttribute('data-node-rail', 'none');
    expect(screen.getByLabelText(`${displayTitle} 标题`)).toBeInTheDocument();
  },
);

test.each([
  {
    badges: ['旧回答'],
    bodyLabel: '第一版回答',
    hint: '旧回答已折叠',
    label: '回答',
    nodeId: 'answer-first',
    relationNote: null,
    title: '第一版回答',
  },
  {
    badges: ['历史结果'],
    bodyLabel: '第一版最新评估',
    hint: '历史判断已折叠',
    label: '判断',
    nodeId: 'judgment-first-latest',
    relationNote: '配对回答：旧回答 · 第一版回答',
    title: '第一版最新评估',
  },
  {
    badges: ['历史结果'],
    bodyLabel: '第一版最新解析',
    hint: '历史答案解析已折叠',
    label: '答案解析',
    nodeId: 'summary-first-latest',
    relationNote: '配对回答：旧回答 · 第一版回答',
    title: '第一版最新解析',
  },
  {
    badges: [],
    bodyLabel: '我的总结',
    hint: '总结已折叠',
    label: '总结',
    nodeId: 'summary-manual',
    relationNote: null,
    title: '我的总结',
  },
  {
    badges: ['当前结果'],
    bodyLabel: '最新总结检查结果',
    hint: '当前总结检查结果已折叠',
    label: '总结检查结果',
    nodeId: 'judgment-summary-latest',
    relationNote: '检查对象：我的总结',
    title: '最新总结检查结果',
  },
])(
  'renders the unified compact collapsed summary for $nodeId',
  ({ badges, bodyLabel, hint, label, nodeId, relationNote, title }) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: 'question-main',
      initialWorkspaceViewState: {
        ...DEFAULT_WORKSPACE_VIEW_STATE,
        collapsedNodeBodyIds: [nodeId],
      },
    });

    const collapsedNode = screen.getByTestId(`editor-node-${nodeId}`);

    expect(within(collapsedNode).getByText(label)).toBeInTheDocument();
    expect(within(collapsedNode).getByText(title)).toBeInTheDocument();

    for (const badge of badges) {
      expect(within(collapsedNode).getByText(badge)).toBeInTheDocument();
    }

    if (relationNote) {
      expect(within(collapsedNode).getByText(relationNote)).toBeInTheDocument();
    }

    expect(within(collapsedNode).getByText(hint)).toBeInTheDocument();
    expect(
      within(collapsedNode).getByRole('button', { name: '展开正文' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(`${bodyLabel} 标题`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`${bodyLabel} 内容`)).not.toBeInTheDocument();
    expect(
      within(collapsedNode).queryByText('正文已折叠，展开后继续查看或编辑。'),
    ).not.toBeInTheDocument();
  },
);

test('uses fallback titles in unified compact collapsed summaries when content node titles are empty', () => {
  const snapshot = createQuestionBlockSnapshot();

  for (const nodeId of [
    'answer-first',
    'judgment-first-latest',
    'summary-first-latest',
    'summary-manual',
  ] as const) {
    const node = snapshot.tree.nodes[nodeId];

    if (
      !node ||
      (node.type !== 'answer' &&
        node.type !== 'judgment' &&
        node.type !== 'summary')
    ) {
      throw new Error(`Expected ${nodeId} to be a collapsible content node.`);
    }

    node.title = '   ';
  }

  renderQuestionBlockEditor({
    initialSnapshot: snapshot,
    initialWorkspaceViewState: {
      ...DEFAULT_WORKSPACE_VIEW_STATE,
      collapsedNodeBodyIds: [
        'answer-first',
        'judgment-first-latest',
        'summary-first-latest',
        'summary-manual',
      ],
    },
  });

  expect(
    within(screen.getByTestId('editor-node-answer-first')).getByText(
      '未命名回答',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-judgment-first-latest')).getByText(
      '未命名判断',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-summary-first-latest')).getByText(
      '未命名答案解析',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-summary-manual')).getByText(
      '未命名总结',
    ),
  ).toBeInTheDocument();
});

test('continues editing from a collapsed answer node by expanding the body first', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'answer-first',
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-answer-first')).getByRole('button', {
      name: '收起正文',
    }),
  );

  const collapsedNode = screen.getByTestId('editor-node-answer-first');

  expect(
    within(collapsedNode).getByRole('button', { name: '展开正文' }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('第一版回答 内容')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('node-actions-answer-first'),
  ).not.toBeInTheDocument();

  fireEvent.click(within(collapsedNode).getByRole('button', { name: '展开正文' }));

  await waitFor(() => {
    expect(screen.getByLabelText('第一版回答 内容')).toBeInTheDocument();
  });

  expect(
    within(screen.getByTestId('editor-node-answer-first')).getByRole('button', {
      name: '收起正文',
    }),
  ).toBeInTheDocument();
  expect(
    within(openOverflowMenu(screen.getByTestId('node-actions-answer-first'))).getByRole(
      'button',
      {
        name: '设为当前回答',
      },
    ),
  ).toBeInTheDocument();
});

test.each([
  'answer-first',
  'judgment-first-latest',
  'summary-first-latest',
  'summary-manual',
])(
  'routes AI follow-up generation through the selected content node %s',
  (selectedNodeId) => {
    const onGenerateFollowUpQuestion = vi.fn();

    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
      onGenerateFollowUpQuestion,
    });

    fireEvent.click(
      within(
        openToolbarMenu(screen.getByTestId(`node-actions-${selectedNodeId}`), '追问'),
      ).getByRole('button', {
        name: '生成追问',
      }),
    );

    expect(onGenerateFollowUpQuestion).toHaveBeenCalledWith(selectedNodeId);
  },
);

test.each([
  'answer-first',
  'judgment-first-latest',
  'summary-first-latest',
  'summary-manual',
])(
  'routes AI summary generation through the selected content node %s',
  (selectedNodeId) => {
    const onGenerateSummary = vi.fn();

    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
      onGenerateSummary,
    });

    fireEvent.click(
      within(
        openToolbarMenu(screen.getByTestId(`node-actions-${selectedNodeId}`), '总结'),
      ).getByRole('button', {
        name: '生成总结',
      }),
    );

    expect(onGenerateSummary).toHaveBeenCalledWith(selectedNodeId);
  },
);

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

  fireEvent.click(screen.getByTestId('editor-node-answer-first'));
  fireEvent.click(
    within(openOverflowMenu(screen.getByTestId('node-actions-answer-first'))).getByRole(
      'button',
      {
        name: '设为当前回答',
      },
    ),
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
    screen.getByTestId('editor-node-summary-first-latest'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('editor-node-summary-manual'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('editor-node-judgment-summary-latest'),
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

test('renders follow-up questions as indented subsections and lets the child block become the active shell', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-follow-up',
  });

  expect(
    screen.getByTestId('follow-up-section-question-follow-up'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('question-block-question-follow-up')).toHaveAttribute(
    'data-question-level',
    'follow-up',
  );
  expect(screen.getByTestId('question-block-question-follow-up')).toHaveAttribute(
    'data-active',
    'true',
  );
  expect(screen.getByTestId('question-block-question-follow-up')).toHaveAttribute(
    'data-question-selected',
    'true',
  );
  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-active',
    'false',
  );
  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-question-selected',
    'false',
  );
  expect(
    screen.queryByTestId('question-block-actions-question-main'),
  ).not.toBeInTheDocument();
});

test('tracks block, body, and group-local history collapse in workspace view state', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  fireEvent.mouseEnter(screen.getByTestId('editor-node-answer-first'));
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

  fireEvent.click(screen.getByTestId('editor-node-question-main'));

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-question-main'),
    ).toHaveAttribute('data-question-selected', 'true');
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-question-main')).getByRole('button', {
      name: '收起问题',
    }),
  );

  await waitFor(() => {
    expect(
      viewStateChanges.some((state) =>
        state.collapsedQuestionBlockIds.includes('question-main'),
      ),
    ).toBe(true);
    expect(
      screen.getByTestId('question-block-question-main'),
    ).toHaveAttribute('data-collapsed', 'true');
    expect(
      screen.queryByTestId('question-block-answer-group-answer-first'),
    ).not.toBeInTheDocument();
  });
});

test('keeps the expanded plan-step rendered as a lightweight section divider shell', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
  });

  const planStepNode = screen.getByTestId('editor-node-step-question-block');
  const planStepHeader = planStepNode.querySelector('.workspace-nodeHeader');
  const titleControls = planStepNode.querySelector('.workspace-nodeTitleControls');

  expect(planStepNode).toHaveAttribute(
    'data-node-shell',
    'section-divider',
  );
  expect(planStepNode).toHaveAttribute(
    'data-node-rail',
    'separator',
  );
  expect(planStepHeader).not.toBeNull();
  expect(planStepHeader?.querySelectorAll('.workspace-nodeTitleRow')).toHaveLength(1);
  expect(planStepNode.querySelector('.workspace-planStepCollapsedTitle')).toBeNull();
  expect(titleControls).not.toBeNull();
  expect(titleControls).toContainElement(
    within(planStepNode).getByTestId('plan-step-status-trigger-step-question-block'),
  );
  expect(titleControls).toContainElement(
    within(planStepNode).getByRole('button', { name: '收起步骤' }),
  );
});

test('reveals plan-step runtime hints from the status badge without inserting text into the body flow', () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
  });

  const planStepNode = screen.getByTestId('editor-node-step-question-block');
  const statusTrigger = within(planStepNode).getByTestId(
    'plan-step-status-trigger-step-question-block',
  );

  expect(within(planStepNode).queryByText(/系统判断：/)).not.toBeInTheDocument();

  fireEvent.mouseEnter(statusTrigger);

  expect(within(planStepNode).getByText(/系统判断：/)).toBeInTheDocument();

  fireEvent.mouseLeave(statusTrigger);

  expect(within(planStepNode).queryByText(/系统判断：/)).not.toBeInTheDocument();

  fireEvent.focus(statusTrigger);

  expect(within(planStepNode).getByText(/系统判断：/)).toBeInTheDocument();

  fireEvent.blur(statusTrigger);

  expect(within(planStepNode).queryByText(/系统判断：/)).not.toBeInTheDocument();
});

test('collapses and expands a plan-step while keeping its header visible', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  const planStepNode = screen.getByTestId('editor-node-step-question-block');

  expect(
    within(planStepNode).getByRole('button', { name: '收起步骤' }),
  ).toBeInTheDocument();
  expect(
    within(planStepNode).getByTestId('plan-step-status-trigger-step-question-block'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('question-block-question-main')).toBeInTheDocument();

  fireEvent.click(within(planStepNode).getByRole('button', { name: '收起步骤' }));

  await waitFor(() => {
    expect(
      within(screen.getByTestId('editor-node-step-question-block')).getByRole(
        'button',
        { name: '展开步骤' },
      ),
    ).toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.collapsedPlanStepIds).toContain('step-question-block');
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByText('步骤'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByText('问题块步骤'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByText('进行中'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByText(
      '当前步骤已折叠',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).queryByTestId(
      'plan-step-status-trigger-step-question-block',
    ),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).queryByText(
      /这里承接当前学习步骤/,
    ),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).queryByText(
      /系统判断：/,
    ),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-step-question-block')).queryByText(
      '步骤已折叠，展开后继续查看正文和子内容。',
    ),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('问题块步骤 标题')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('问题块步骤 内容')).not.toBeInTheDocument();
  expect(screen.queryByTestId('question-block-question-main')).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByTestId('editor-node-step-question-block')).getByRole(
      'button',
      { name: '展开步骤' },
    ),
  );

  await waitFor(() => {
    expect(screen.getByLabelText('问题块步骤 内容')).toBeInTheDocument();
  });

  expect(
    viewStateChanges.at(-1)?.collapsedPlanStepIds.includes('step-question-block'),
  ).toBe(false);
  expect(screen.getByTestId('question-block-question-main')).toBeInTheDocument();
});

test('restores inner question block, body, and history state after collapsing and reopening a plan-step', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['answer-first'],
      expandedHistorySectionIds: [getAnswerHistorySectionId('answer-first')],
    }),
  });

  const planStepNode = screen.getByTestId('editor-node-step-question-block');

  fireEvent.click(within(planStepNode).getByRole('button', { name: '收起步骤' }));

  await waitFor(() => {
    expect(screen.queryByTestId('question-block-question-main')).not.toBeInTheDocument();
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-step-question-block')).getByRole(
      'button',
      { name: '展开步骤' },
    ),
  );

  await waitFor(() => {
    expect(screen.getByTestId('question-block-question-main')).toBeInTheDocument();
  });

  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-collapsed',
    'true',
  );

  fireEvent.mouseEnter(screen.getByTestId('editor-node-question-main'));
  fireEvent.click(
    within(screen.getByTestId('editor-node-question-main')).getByRole('button', {
      name: '展开问题',
    }),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).toBeInTheDocument();
  });

  expect(screen.queryByLabelText('第一版回答 内容')).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-answer-first')).getByRole('button', {
      name: '展开正文',
    }),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByTestId('question-block-answer-group-answer-first'),
    ).getByRole('button', {
      name: '收起历史评估与旧解析',
    }),
  ).toBeInTheDocument();
  expect(screen.getByTestId('editor-node-judgment-first-history')).toBeInTheDocument();
});

test('does not auto-reopen a group history section after the user collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'judgment-first-history',
    initialWorkspaceViewState: createWorkspaceViewState({
      expandedHistorySectionIds: [getAnswerHistorySectionId('answer-first')],
    }),
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

test('does not auto-reopen a plan-step after the user manually collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedPlanStepIds: ['step-question-block'],
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('question-block-question-main')).toBeInTheDocument();
  });

  fireEvent.mouseEnter(screen.getByTestId('editor-node-step-question-block'));
  fireEvent.click(
    within(screen.getByTestId('editor-node-step-question-block')).getByRole(
      'button',
      { name: '收起步骤' },
    ),
  );

  await waitFor(() => {
    expect(screen.queryByTestId('question-block-question-main')).not.toBeInTheDocument();
  });

  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByRole(
      'button',
      { name: '展开步骤' },
    ),
  ).toBeInTheDocument();
});

test('shows 未命名步骤 in the compact collapsed summary when the plan-step title is empty', async () => {
  const snapshot = createQuestionBlockSnapshot();
  const planStepNode = snapshot.tree.nodes['step-question-block'];

  if (planStepNode?.type !== 'plan-step') {
    throw new Error('Expected step-question-block to be a plan-step node.');
  }

  planStepNode.title = '  ';

  renderQuestionBlockEditor({
    initialSnapshot: snapshot,
    initialSelectedNodeId: 'step-question-block',
  });

  fireEvent.click(
    within(screen.getByTestId('editor-node-step-question-block')).getByRole(
      'button',
      { name: '收起步骤' },
    ),
  );

  await waitFor(() => {
    expect(
      within(screen.getByTestId('editor-node-step-question-block')).getByRole(
        'button',
        { name: '展开步骤' },
      ),
    ).toBeInTheDocument();
  });

  expect(
    within(screen.getByTestId('editor-node-step-question-block')).getByText(
      '未命名步骤',
    ),
  ).toBeInTheDocument();
});

test('auto-expands a collapsed plan-step, block, and hidden history when selecting a historical node from the structure tree', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'step-question-block',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedPlanStepIds: ['step-question-block'],
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['judgment-first-history'],
    }),
  });

  expect(screen.queryByTestId('question-block-question-main')).not.toBeInTheDocument();

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

test('clicking a structure-map answer group keeps map active, and the leftmost document icon explicitly opens the document target', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedPlanStepIds: ['step-question-block'],
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['answer-first'],
      mainViewMode: 'structure-map',
    }),
  });

  expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();

  const answerGroupItem = screen.getByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const titleButton = answerGroupItem.querySelector(
    '.workspace-structureMapTitleButton',
  ) as HTMLButtonElement | null;

  expect(titleButton).not.toBeNull();

  fireEvent.click(titleButton as HTMLButtonElement);

  await waitFor(() => {
    expect(answerGroupItem).toHaveAttribute('data-selected', 'true');
  });

  expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  fireEvent.mouseEnter(answerGroupItem);
  const openDocumentButton = within(answerGroupItem).getByRole('button', {
    name: '在文档中查看',
  });
  expect(openDocumentButton).toHaveAttribute('data-structure-node-action-style', 'icon');

  fireEvent.click(openDocumentButton);

  await waitFor(() => {
    expect(
      screen.queryByTestId('workspace-structure-map-shell'),
    ).not.toBeInTheDocument();
  });

  expect(screen.getByTestId('question-block-question-main')).toHaveAttribute(
    'data-collapsed',
    'false',
  );
  expect(screen.getByTestId('editor-node-answer-first')).toHaveAttribute(
    'data-node-selected',
    'true',
  );
});

test.each([
  ['judgment-first-latest', 'structure-map-item-answer-group:answer-first'],
  ['judgment-summary-latest', 'structure-map-item-summary-group:summary-manual'],
  ['question-follow-up', 'structure-map-item-question-block:question-follow-up'],
])(
  'keeps document selection mapped to the correct structure-map unit for %s',
  async (selectedNodeId, expectedMapItemTestId) => {
    renderQuestionBlockEditor({
      initialSelectedNodeId: selectedNodeId,
    });

    fireEvent.click(screen.getByRole('button', { name: '结构地图' }));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
    });

    expect(screen.getByTestId(expectedMapItemTestId)).toHaveAttribute(
      'data-selected',
      'true',
    );
  },
);

test('renders plan-step panels as question clusters with local answers, follow-up branches, and step-level scaffold nodes', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapClusterSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  const panel = screen.getByTestId('structure-map-panel-step-question-block');

  expect(panel).toHaveAttribute('data-structure-panel', 'step-question-block');
  expect(panel).toHaveAttribute('data-structure-role', 'plan-step-panel');
  expect(
    within(panel).getByTestId('structure-map-item-plan-step:step-question-block'),
  ).toBeInTheDocument();

  const scaffold = within(panel).getByTestId(
    'structure-map-scaffold-summary-scaffold-step',
  );

  expect(scaffold).toHaveAttribute('data-structure-role', 'scaffold');

  const topLevelCluster = within(panel).getByTestId(
    'structure-map-question-question-main',
  );

  expect(topLevelCluster).toHaveAttribute('data-structure-role', 'question-cluster');
  expect(topLevelCluster).toHaveAttribute('data-structure-level', 'top-level');
  expect(topLevelCluster).toHaveAttribute('data-structure-layout', 'logic-graph');

  const topLevelMainRegion = topLevelCluster.querySelector(
    '[data-structure-cluster-region="main"]',
  );

  expect(topLevelMainRegion).not.toBeNull();
  expect(topLevelMainRegion).toHaveAttribute('data-structure-cluster-region', 'main');
  expect(
    within(topLevelMainRegion as HTMLElement).getByTestId(
      'structure-map-item-question-block:question-main',
    ),
  ).toBeInTheDocument();

  const supportingRegion = within(topLevelCluster).getByTestId(
    'structure-map-supporting-group-question-main',
  );

  expect(supportingRegion).toHaveAttribute('data-structure-role', 'supporting-group');
  expect(supportingRegion).toHaveAttribute(
    'data-structure-cluster-region',
    'supporting',
  );
  expect(supportingRegion).toHaveAttribute(
    'data-structure-attachment',
    'supporting-rail',
  );
  expect(supportingRegion).toHaveAttribute(
    'data-structure-connector',
    'supporting-spine',
  );
  expect(
    within(supportingRegion).getByTestId('structure-map-item-answer-group:answer-first'),
  ).toBeInTheDocument();
  expect(
    within(supportingRegion).getByTestId(
      'structure-map-item-summary-group:summary-manual',
    ),
  ).toBeInTheDocument();
  expect(
    within(topLevelCluster).queryByTestId(
      'structure-map-scaffold-summary-scaffold-step',
    ),
  ).not.toBeInTheDocument();
  expect(supportingRegion.previousElementSibling).not.toBeNull();
  expect(supportingRegion.previousElementSibling).toHaveAttribute(
    'data-structure-connector-role',
    'supporting',
  );
  expect(supportingRegion.previousElementSibling).toHaveAttribute(
    'data-structure-connector-segment',
    'root',
  );

  const supportingNodes = supportingRegion.querySelectorAll(
    '[data-structure-role="supporting-node"]',
  );
  const supportingConnectors = Array.from(
    supportingRegion.querySelectorAll('[data-structure-connector-role="supporting"]'),
  );

  expect(
    new Set(
      supportingConnectors.map((connector) =>
        connector.getAttribute('data-structure-connector-segment'),
      ),
    ),
  ).toEqual(new Set(['spine', 'leaf']));
  expect(
    supportingConnectors.filter(
      (connector) =>
        connector.getAttribute('data-structure-connector-segment') === 'spine',
    ),
  ).toHaveLength(1);
  expect(
    supportingConnectors.filter(
      (connector) =>
        connector.getAttribute('data-structure-connector-segment') === 'leaf',
    ),
  ).toHaveLength(supportingNodes.length);
  expect(
    supportingRegion.querySelector(
      '[data-structure-connector-role="supporting"][data-structure-connector-segment="root"]',
    ),
  ).toBeNull();

  const followUpBranch = within(topLevelCluster).getByTestId(
    'structure-map-branch-question-main',
  );

  expect(followUpBranch).toHaveAttribute('data-structure-branch', 'follow-up');
  expect(followUpBranch).toHaveAttribute('data-structure-cluster-region', 'branch');
  expect(followUpBranch).toHaveAttribute(
    'data-structure-connector',
    'follow-up-trunk',
  );
  expect(followUpBranch).toHaveAttribute(
    'data-structure-branch-direction',
    'down-right',
  );

  const followUpNodes = followUpBranch.querySelectorAll(
    '[data-structure-role="follow-up-node"]',
  );
  const followUpConnectors = Array.from(
    followUpBranch.querySelectorAll('[data-structure-connector-role="branch"]'),
  );

  expect(
    new Set(
      followUpConnectors.map((connector) =>
        connector.getAttribute('data-structure-connector-segment'),
      ),
    ),
  ).toEqual(new Set(['root', 'trunk', 'leaf']));
  expect(
    followUpConnectors.filter(
      (connector) =>
        connector.getAttribute('data-structure-connector-segment') === 'root',
    ),
  ).toHaveLength(1);
  expect(
    followUpConnectors.filter(
      (connector) =>
        connector.getAttribute('data-structure-connector-segment') === 'trunk',
    ),
  ).toHaveLength(1);
  expect(
    followUpConnectors.filter(
      (connector) =>
        connector.getAttribute('data-structure-connector-segment') === 'leaf',
    ),
  ).toHaveLength(followUpNodes.length);
  expect(followUpBranch.getAttribute('data-structure-connector')).not.toBe(
    supportingRegion.getAttribute('data-structure-connector'),
  );

  const followUpCluster = within(followUpBranch).getByTestId(
    'structure-map-question-question-follow-up',
  );

  expect(followUpCluster).toHaveAttribute('data-structure-level', 'follow-up');
  expect(followUpCluster).toHaveAttribute('data-structure-layout', 'logic-graph');
  expect(
    within(followUpCluster).getByTestId(
      'structure-map-item-answer-group:answer-follow-up',
    ),
  ).toBeInTheDocument();
});

test('drags from the node surface while keeping icon zones out of drag start', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'step-question-block',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  const answerGroupButton = screen.getByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const titleButton = answerGroupButton.querySelector(
    '.workspace-structureMapTitleButton',
  ) as HTMLButtonElement | null;
  const menuButton = within(answerGroupButton).getByRole('button', {
    name: /更多操作：/,
  });

  expect(answerGroupButton).toHaveAttribute('data-draggable', 'true');
  expect(answerGroupButton).toHaveAttribute(
    'data-structure-node-draggable-surface',
    'true',
  );
  expect(titleButton).not.toBeNull();
  expect(
    within(answerGroupButton).queryByTestId(
      'structure-map-drag-handle-answer-group:answer-first',
    ),
  ).not.toBeInTheDocument();

  fireEvent.pointerDown(answerGroupButton);
  fireEvent.dragStart(answerGroupButton);

  await waitFor(() => {
    expect(answerGroupButton).toHaveAttribute('data-dragging', 'true');
  });
  fireEvent.dragEnd(answerGroupButton);

  fireEvent.pointerDown(titleButton as HTMLButtonElement);
  fireEvent.dragStart(answerGroupButton);

  await waitFor(() => {
    expect(answerGroupButton).toHaveAttribute('data-dragging', 'true');
  });
  fireEvent.dragEnd(answerGroupButton);

  fireEvent.pointerDown(titleButton as HTMLButtonElement);
  fireEvent.dragStart(titleButton as HTMLButtonElement);

  await waitFor(() => {
    expect(answerGroupButton).toHaveAttribute('data-dragging', 'true');
  });
  fireEvent.dragEnd(titleButton as HTMLButtonElement);

  fireEvent.pointerDown(menuButton);
  const actionDragAttempt = createEvent.dragStart(answerGroupButton);
  fireEvent(answerGroupButton, actionDragAttempt);
  expect(actionDragAttempt.defaultPrevented).toBe(true);
});

test('highlights valid structure-map dropzones and stabilizes the hovered legal target', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  const questionItem = screen.getByTestId('structure-map-item-question-block:question-main');
  const validDropZone = screen.getByTestId('structure-map-dropzone-step-secondary-1');

  fireEvent.pointerDown(questionItem);
  fireEvent.dragStart(questionItem);

  expect(validDropZone).toHaveAttribute('data-drop-state', 'valid');
  expect(validDropZone).toHaveTextContent('可落点');

  fireEvent.dragOver(validDropZone);

  expect(validDropZone).toHaveAttribute('data-active', 'true');
  expect(validDropZone).toHaveTextContent('松手放到这里');
});

test('shows explicit invalid structure-map drop feedback instead of failing silently', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  const answerGroupButton = screen.getByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const invalidDropZone = screen.getByTestId(
    'structure-map-dropzone-module-question-block-1',
  );

  fireEvent.pointerDown(answerGroupButton);
  fireEvent.dragStart(answerGroupButton);

  await waitFor(() => {
    expect(invalidDropZone).toHaveAttribute('data-drop-state', 'invalid');
  });

  fireEvent.dragOver(invalidDropZone);

  expect(invalidDropZone).toHaveAttribute('data-active', 'true');
  expect(invalidDropZone).toHaveTextContent('不能放这里');

  fireEvent.drop(invalidDropZone);
  fireEvent.dragEnd(answerGroupButton);

  expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('当前落点无效');
});

test('keeps structure-map drag item and dropzone test ids stable', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  expect(
    screen.getByTestId('structure-map-item-question-block:question-main'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('structure-map-item-answer-group:answer-first'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('structure-map-item-question-block:question-main'),
  ).toHaveAttribute('data-structure-node-draggable-surface', 'true');
  expect(
    screen.getByTestId('structure-map-dropzone-question-main-0'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('structure-map-dropzone-step-secondary-1'),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('structure-map-drag-handle-question-block:question-main'),
  ).not.toBeInTheDocument();
});

test('supports collapsing structure-map step panels, top-level clusters, and follow-up branches', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapClusterSnapshot(),
    initialSelectedNodeId: 'question-follow-up',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  const panel = await screen.findByTestId('structure-map-panel-step-question-block');
  const stepItem = within(panel).getByTestId(
    'structure-map-item-plan-step:step-question-block',
  );
  const stepActions = stepItem.querySelector(
    '[data-structure-step-actions="inline"]',
  ) as HTMLElement | null;

  expect(stepActions).not.toBeNull();
  expect(stepItem).toHaveAttribute('data-structure-node-action-visibility', 'default');
  const stepMenu = openStructureMapNodeMenu(stepItem);
  expect(
    within(stepMenu).queryByRole('button', {
      name: '聚焦当前步骤',
    }),
  ).not.toBeInTheDocument();
  expect(
    within(stepMenu).queryByRole('button', {
      name: '收起面板',
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(getStructureMapCollapseAction(stepItem));

  await waitFor(() => {
    expect(
      within(panel).queryByTestId('structure-map-question-question-main'),
    ).not.toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.collapsedStructureMapStepIds).toContain(
    'step-question-block',
  );
  fireEvent.click(getStructureMapCollapseAction(stepItem));

  await waitFor(() => {
    expect(
      within(panel).getByTestId('structure-map-question-question-main'),
    ).toBeInTheDocument();
  });

  const topLevelCluster = within(panel).getByTestId('structure-map-question-question-main');
  const topLevelClusterItem = within(topLevelCluster).getByTestId(
    'structure-map-item-question-block:question-main',
  );

  fireEvent.click(getStructureMapCollapseAction(topLevelClusterItem));

  await waitFor(() => {
    expect(
      within(topLevelCluster).queryByTestId('structure-map-branch-question-main'),
    ).not.toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.collapsedStructureMapClusterIds).toContain('question-main');
  fireEvent.click(getStructureMapCollapseAction(topLevelClusterItem));

  await waitFor(() => {
    expect(
      within(topLevelCluster).getByTestId('structure-map-branch-question-main'),
    ).toBeInTheDocument();
  });

  const followUpCluster = screen.getByTestId('structure-map-question-question-follow-up');
  const followUpClusterItem = within(followUpCluster).getByTestId(
    'structure-map-item-question-block:question-follow-up',
  );

  fireEvent.click(getStructureMapCollapseAction(followUpClusterItem));

  await waitFor(() => {
    expect(
      within(followUpCluster).queryByTestId(
        'structure-map-item-answer-group:answer-follow-up',
      ),
    ).not.toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.collapsedStructureMapFollowUpIds).toContain(
    'question-follow-up',
  );
  fireEvent.click(getStructureMapCollapseAction(followUpClusterItem));

  await waitFor(() => {
    expect(
      within(followUpCluster).getByTestId('structure-map-item-answer-group:answer-follow-up'),
    ).toBeInTheDocument();
  });
});

test('supports manually focusing the current plan-step from the structure map', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  await screen.findByTestId('structure-map-panel-step-question-block');
  expect(screen.getByTestId('structure-map-panel-step-secondary')).toBeInTheDocument();

  const stepItem = screen.getByTestId(
    'structure-map-item-plan-step:step-question-block',
  );

  expect(getStructureMapFocusAction(stepItem)).toHaveAttribute(
    'data-structure-node-focus-action',
    'true',
  );
  const stepMenu = openStructureMapNodeMenu(stepItem);
  expect(
    within(stepMenu).queryByRole('button', {
      name: '聚焦当前步骤',
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(getStructureMapFocusAction(stepItem));

  await waitFor(() => {
    expect(
      screen.queryByTestId('structure-map-panel-step-secondary'),
    ).not.toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toEqual({
    kind: 'plan-step',
    nodeId: 'step-question-block',
  });
  expect(screen.getByText('退出聚焦')).toBeInTheDocument();

  fireEvent.click(screen.getByText('退出聚焦'));

  await waitFor(() => {
    expect(screen.getByTestId('structure-map-panel-step-secondary')).toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toBeNull();
});

test('supports manually focusing the current question cluster from the structure map', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapClusterSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  await screen.findByTestId('structure-map-question-question-main');
  expect(screen.getByTestId('structure-map-scaffold-summary-scaffold-step')).toBeInTheDocument();

  const clusterItem = screen.getByTestId(
    'structure-map-item-question-block:question-main',
  );
  const clusterMenu = openStructureMapNodeMenu(clusterItem);

  expect(
    getStructureMapFocusAction(clusterItem),
  ).toHaveAttribute('data-structure-node-focus-action', 'true');
  expect(
    within(clusterMenu).queryByRole('button', {
      name: '聚焦当前问题簇',
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(getStructureMapFocusAction(clusterItem));

  await waitFor(() => {
    expect(
      screen.queryByTestId('structure-map-scaffold-summary-scaffold-step'),
    ).not.toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toEqual({
    kind: 'question-cluster',
    nodeId: 'question-main',
  });
  expect(screen.getByText('退出聚焦')).toBeInTheDocument();

  fireEvent.click(screen.getByText('退出聚焦'));

  await waitFor(() => {
    expect(
      screen.getByTestId('structure-map-scaffold-summary-scaffold-step'),
    ).toBeInTheDocument();
  });

  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toBeNull();
});

test('regular structure-map selection does not automatically enter focus mode', async () => {
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'judgment-first-latest',
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  fireEvent.click(screen.getByRole('button', { name: '结构地图' }));

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  expect(screen.queryByText('退出聚焦')).not.toBeInTheDocument();
  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toBeNull();

  const answerGroupItem = screen.getByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const titleButton = answerGroupItem.querySelector(
    '.workspace-structureMapTitleButton',
  ) as HTMLButtonElement | null;

  expect(titleButton).not.toBeNull();

  fireEvent.click(titleButton as HTMLButtonElement);

  await waitFor(() => {
    expect(answerGroupItem).toHaveAttribute('data-selected', 'true');
  });

  expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  expect(viewStateChanges.at(-1)?.structureMapFocusTarget).toBeNull();
});

test('structure-map local controls do not trigger extra scrollIntoView jumps', async () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const scrollIntoViewSpy = vi.fn();

  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewSpy,
  });

  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapClusterSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  const panel = await screen.findByTestId('structure-map-panel-step-question-block');
  const stepItem = within(panel).getByTestId(
    'structure-map-item-plan-step:step-question-block',
  );
  const clusterItem = within(panel).getByTestId(
    'structure-map-item-question-block:question-main',
  );

  const initialCallCount = scrollIntoViewSpy.mock.calls.length;

  fireEvent.click(getStructureMapFocusAction(stepItem));
  fireEvent.click(screen.getByText('退出聚焦'));
  fireEvent.click(getStructureMapCollapseAction(stepItem));
  fireEvent.click(getStructureMapCollapseAction(stepItem));
  fireEvent.click(getStructureMapCollapseAction(clusterItem));

  expect(scrollIntoViewSpy).toHaveBeenCalledTimes(initialCallCount);
  if (originalScrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  } else {
    // jsdom may not define this API.
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  }
});

test('clicking a structure-map node does not trigger an extra scrollIntoView jump', async () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const scrollIntoViewSpy = vi.fn();

  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewSpy,
  });

  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapClusterSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  const answerGroupItem = await screen.findByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const initialCallCount = scrollIntoViewSpy.mock.calls.length;

  fireEvent.click(answerGroupItem);

  await waitFor(() => {
    expect(answerGroupItem).toHaveAttribute('data-selected', 'true');
  });
  expect(scrollIntoViewSpy).toHaveBeenCalledTimes(initialCallCount);

  if (originalScrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  } else {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  }
});

test('adding a tag to a hovered node does not refocus the previously selected document node', async () => {
  const originalFocus = HTMLElement.prototype.focus;
  const focusSpy = vi.fn();

  Object.defineProperty(HTMLElement.prototype, 'focus', {
    configurable: true,
    value: focusSpy,
  });

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'answer-first',
  });

  const targetNode = screen.getByTestId('editor-node-summary-manual');
  const initialCallCount = focusSpy.mock.calls.length;

  fireEvent.mouseEnter(targetNode);
  fireEvent.click(screen.getByTestId('editor-tag-entry-summary-manual'));
  fireEvent.click(
    within(screen.getByTestId('editor-tag-popover-summary-manual')).getByRole(
      'button',
      { name: /步骤/ },
    ),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId('editor-tag-chip-summary-manual-tag-step'),
    ).toBeInTheDocument();
  });

  expect(focusSpy).toHaveBeenCalledTimes(initialCallCount);

  if (originalFocus) {
    Object.defineProperty(HTMLElement.prototype, 'focus', {
      configurable: true,
      value: originalFocus,
    });
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).focus;
  }
});

test('keeps structure-map node controls quiet by default and reveals icon actions on hover or active state', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  const answerGroupItem = await screen.findByTestId(
    'structure-map-item-answer-group:answer-first',
  );
  const actions = answerGroupItem.querySelector(
    '.workspace-structureMapNodeActions',
  ) as HTMLElement | null;
  const titleButton = answerGroupItem.querySelector(
    '.workspace-structureMapTitleButton',
  ) as HTMLButtonElement | null;

  expect(actions).not.toBeNull();
  expect(titleButton).not.toBeNull();
  expect(answerGroupItem).toHaveAttribute(
    'data-structure-node-action-visibility',
    'default',
  );
  expect(actions).toHaveAttribute('data-structure-node-action-visibility', 'default');
  expect(within(answerGroupItem).queryByText('文档')).not.toBeInTheDocument();
  expect(within(answerGroupItem).queryByText('拖动')).not.toBeInTheDocument();
  expect(within(answerGroupItem).queryByText('收起')).not.toBeInTheDocument();
  expect(
    answerGroupItem,
  ).toHaveAttribute('data-structure-node-draggable-surface', 'true');
  expect(
    actions?.querySelector('[data-structure-node-menu="more"]'),
  ).not.toBeNull();
  expect(
    actions?.querySelector('[data-structure-node-focus-action="true"]'),
  ).toBeNull();
  expect(
    answerGroupItem.querySelector('[data-structure-node-collapse-action="true"]'),
  ).toBeNull();
  expect(
    within(answerGroupItem).queryByTestId(
      'structure-map-drag-handle-answer-group:answer-first',
    ),
  ).not.toBeInTheDocument();

  fireEvent.mouseEnter(answerGroupItem);
  expect(answerGroupItem).toHaveAttribute(
    'data-structure-node-action-visibility',
    'hover',
  );

  fireEvent.click(titleButton as HTMLButtonElement);

  await waitFor(() => {
    expect(answerGroupItem).toHaveAttribute(
      'data-structure-node-action-visibility',
      'active',
    );
  });
});

test('supports inline title editing with Enter commit, Escape cancel, and blur commit', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  const questionItem = await screen.findByTestId(
    'structure-map-item-question-block:question-main',
  );
  const titleButton = questionItem.querySelector(
    '.workspace-structureMapTitleButton',
  ) as HTMLButtonElement | null;

  expect(titleButton).not.toBeNull();
  expect(questionItem).toHaveAttribute('data-structure-node-editing', 'false');

  fireEvent.doubleClick(titleButton as HTMLButtonElement);

  const titleInput = within(questionItem).getByRole('textbox');

  expect(questionItem).toHaveAttribute('data-structure-node-editing', 'true');
  fireEvent.change(titleInput, { target: { value: '重新命名的问题' } });
  fireEvent.keyDown(titleInput, { key: 'Enter' });

  await waitFor(() => {
    expect(questionItem).toHaveAttribute('data-structure-node-editing', 'false');
  });

  expect(within(questionItem).getByText('重新命名的问题')).toBeInTheDocument();

  fireEvent.doubleClick(
    questionItem.querySelector('.workspace-structureMapTitleButton') as HTMLButtonElement,
  );

  const escapeInput = within(questionItem).getByRole('textbox');

  fireEvent.change(escapeInput, { target: { value: '不会提交的问题' } });
  fireEvent.keyDown(escapeInput, { key: 'Escape' });

  await waitFor(() => {
    expect(questionItem).toHaveAttribute('data-structure-node-editing', 'false');
  });

  expect(within(questionItem).getByText('重新命名的问题')).toBeInTheDocument();

  fireEvent.doubleClick(
    questionItem.querySelector('.workspace-structureMapTitleButton') as HTMLButtonElement,
  );

  const blurInput = within(questionItem).getByRole('textbox');

  fireEvent.change(blurInput, { target: { value: '失焦提交的问题' } });
  fireEvent.blur(blurInput);

  await waitFor(() => {
    expect(questionItem).toHaveAttribute('data-structure-node-editing', 'false');
  });

  expect(within(questionItem).getByText('失焦提交的问题')).toBeInTheDocument();
});

test('dragging a structure-map unit reorders the document while keeping the moved node selected in the map', async () => {
  const snapshots: WorkspaceSnapshot[] = [];
  const viewStateChanges: WorkspaceViewState[] = [];

  renderQuestionBlockEditor({
    initialSelectedNodeId: 'summary-manual',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedPlanStepIds: ['step-question-block'],
      collapsedQuestionBlockIds: ['question-main'],
      mainViewMode: 'structure-map',
    }),
    onSnapshotChange: (snapshot) => {
      snapshots.push(snapshot);
    },
    onViewStateChange: (state) => {
      viewStateChanges.push(state);
    },
  });

  const summaryItem = screen.getByTestId('structure-map-item-summary-group:summary-manual');

  fireEvent.pointerDown(summaryItem);
  fireEvent.dragStart(summaryItem);
  fireEvent.dragOver(
    screen.getByTestId('structure-map-dropzone-question-main-0'),
  );
  fireEvent.drop(screen.getByTestId('structure-map-dropzone-question-main-0'));

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  expect(screen.getByTestId('workspace-structure-map-shell')).toHaveAttribute(
    'data-structure-drop-behavior',
    'stay-in-map',
  );
  expect(screen.getByTestId('structure-map-item-summary-group:summary-manual')).toHaveAttribute(
    'data-selected',
    'true',
  );
  expect(screen.getByRole('status')).toHaveTextContent('已移动');

  expect(
    snapshots.at(-1)?.tree.nodes['question-main']?.childIds[0],
  ).toBe('summary-manual');
  expect(viewStateChanges.at(-1)?.structureMapFocusTarget ?? null).toBeNull();
});

test('allows moving a top-level question block across plan steps from the structure map', async () => {
  const snapshots: WorkspaceSnapshot[] = [];

  renderQuestionBlockEditor({
    initialSnapshot: createCrossStepStructureMapSnapshot(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      collapsedPlanStepIds: ['step-question-block', 'step-secondary'],
      collapsedQuestionBlockIds: ['question-main'],
      mainViewMode: 'structure-map',
    }),
    onSnapshotChange: (snapshot) => {
      snapshots.push(snapshot);
    },
  });

  const questionItem = screen.getByTestId('structure-map-item-question-block:question-main');

  fireEvent.pointerDown(questionItem);
  fireEvent.dragStart(questionItem);
  fireEvent.dragOver(screen.getByTestId('structure-map-dropzone-step-secondary-1'));
  fireEvent.drop(screen.getByTestId('structure-map-dropzone-step-secondary-1'));

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  expect(screen.getByTestId('structure-map-item-question-block:question-main')).toHaveAttribute(
    'data-selected',
    'true',
  );
  expect(screen.getByRole('status')).toHaveTextContent('已移动');
  expect(snapshots.at(-1)?.tree.nodes['question-main']?.parentId).toBe('step-secondary');
  expect(snapshots.at(-1)?.tree.nodes['step-secondary']?.childIds).toEqual([
    'question-cross-step',
    'question-main',
  ]);
});

test('keeps unsupported resource nodes out of the structure map projection', async () => {
  renderQuestionBlockEditor({
    initialSnapshot: createStructureMapSnapshotWithResource(),
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: createWorkspaceViewState({
      mainViewMode: 'structure-map',
    }),
  });

  await waitFor(() => {
    expect(screen.getByTestId('workspace-structure-map-shell')).toBeInTheDocument();
  });

  const structureMapShell = screen.getByTestId('workspace-structure-map-shell');

  expect(screen.getByTestId('structure-map-item-plan-step:step-question-block')).toBeInTheDocument();
  expect(
    within(structureMapShell).queryByText('Reference material'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('structure-map-item-question-block:resource-module-direct'),
  ).not.toBeInTheDocument();
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
  const {
    initialWorkspaceViewState = createWorkspaceViewState(),
    onViewStateChange,
    ...workspaceEditorProps
  } = options ?? {};
  const snapshot =
    workspaceEditorProps.initialSnapshot ?? createQuestionBlockSnapshot();
  const onDirectAnswerQuestion =
    workspaceEditorProps.onDirectAnswerQuestion ?? vi.fn();
  const onEvaluateAnswer = workspaceEditorProps.onEvaluateAnswer ?? vi.fn();
  const onEvaluateSummary = workspaceEditorProps.onEvaluateSummary ?? vi.fn();
  const onGenerateFollowUpQuestion =
    workspaceEditorProps.onGenerateFollowUpQuestion ?? vi.fn();
  const onGenerateSummary = workspaceEditorProps.onGenerateSummary ?? vi.fn();

  function Wrapper() {
    const [workspaceViewState, setWorkspaceViewState] = useState(
      initialWorkspaceViewState,
    );

    return (
      <WorkspaceEditor
        {...workspaceEditorProps}
        initialModuleId={
          workspaceEditorProps.initialModuleId ??
          snapshot.tree.nodes[snapshot.workspace.rootNodeId].childIds[0]
        }
        initialSelectedNodeId={
          workspaceEditorProps.initialSelectedNodeId ?? 'question-main'
        }
        initialSnapshot={snapshot}
        onDirectAnswerQuestion={onDirectAnswerQuestion}
        onEvaluateAnswer={onEvaluateAnswer}
        onEvaluateSummary={onEvaluateSummary}
        onGenerateFollowUpQuestion={onGenerateFollowUpQuestion}
        onGenerateSummary={onGenerateSummary}
        onWorkspaceViewStateChange={(state) => {
          setWorkspaceViewState(state);
          onViewStateChange?.(state);
        }}
        workspaceViewState={workspaceViewState}
      />
    );
  }

  return render(<Wrapper />);
}

function createWorkspaceViewState(
  overrides: Partial<WorkspaceViewState> = {},
): WorkspaceViewState {
  return {
    ...DEFAULT_WORKSPACE_VIEW_STATE,
    leftRailMode: 'expanded',
    rightRailMode: 'expanded',
    ...overrides,
  };
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

function createStructureMapClusterSnapshot(): WorkspaceSnapshot {
  const snapshot = createQuestionBlockSnapshot();
  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    'step-question-block',
    createNode({
      type: 'summary',
      id: 'summary-scaffold-step',
      title: '进入这个步骤前先交代背景',
      content: '这是 step 级 scaffold，不应该并入任何 question cluster。',
      summaryKind: 'scaffold',
      createdAt: '2026-04-30T08:59:00.000Z',
      updatedAt: '2026-04-30T08:59:00.000Z',
    }),
    0,
  );
  tree = insertChildNode(
    tree,
    'question-follow-up',
    createNode({
      type: 'answer',
      id: 'answer-follow-up',
      title: '追问回答',
      content: '这是 follow-up question 自己的回答。',
      createdAt: '2026-04-30T09:05:30.000Z',
      updatedAt: '2026-04-30T09:05:30.000Z',
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

function createCrossStepStructureMapSnapshot(): WorkspaceSnapshot {
  const snapshot = createQuestionBlockSnapshot();
  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    'module-question-block',
    createNode({
      type: 'plan-step',
      id: 'step-secondary',
      title: '第二步骤',
      content: '',
      status: 'todo',
      createdAt: '2026-04-30T09:20:00.000Z',
      updatedAt: '2026-04-30T09:20:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-secondary',
    createNode({
      type: 'question',
      id: 'question-cross-step',
      title: '第二步骤问题',
      content: '用于验证 question block 可以跨 step 移动。',
      createdAt: '2026-04-30T09:21:00.000Z',
      updatedAt: '2026-04-30T09:21:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createStructureMapSnapshotWithResource(): WorkspaceSnapshot {
  const snapshot = createQuestionBlockSnapshot();
  const resourceNode = createNode({
    type: 'resource',
    id: 'resource-module-direct',
    title: 'Reference material',
    sourceUri: 'file:///reference.md',
    createdAt: '2026-04-30T09:20:00.000Z',
    updatedAt: '2026-04-30T09:20:00.000Z',
  });

  resourceNode.parentId = 'module-question-block';
  resourceNode.order =
    snapshot.tree.nodes['module-question-block']?.childIds.length ?? 0;

  const tree = {
    ...snapshot.tree,
    nodes: {
      ...snapshot.tree.nodes,
      [resourceNode.id]: resourceNode,
    },
  };

  const moduleNode = tree.nodes['module-question-block'];

  if (moduleNode?.type !== 'module') {
    throw new Error('Expected module-question-block to exist.');
  }

  moduleNode.childIds = [...moduleNode.childIds, resourceNode.id];

  return {
    ...snapshot,
    tree,
  };
}

function expectToolbarVerbs(
  toolbar: HTMLElement,
  expectedLabels: string[],
) {
  expect(
    within(toolbar)
      .getAllByRole('button')
      .map((button) =>
        (button.textContent?.replace('▾', '').trim() ?? ''),
      ),
  ).toEqual(expectedLabels);
}

function expectToolbarMenuActions(
  toolbar: HTMLElement,
  menuLabel: string,
  expectedActionLabels: string[],
) {
  const menu = openToolbarMenu(toolbar, menuLabel);

  for (const actionLabel of expectedActionLabels) {
    expect(
      within(menu).getByRole('button', { name: actionLabel }),
    ).toBeInTheDocument();
  }
}

function openToolbarMenu(toolbar: HTMLElement, menuLabel: string) {
  fireEvent.click(
    within(toolbar).getByRole('button', {
      name: menuLabel,
    }),
  );

  return within(toolbar).getByRole('menu');
}

function openOverflowMenu(toolbar: HTMLElement) {
  return openToolbarMenu(toolbar, '⋯');
}

function openStructureMapNodeMenu(item: HTMLElement) {
  fireEvent.click(
    within(item).getByRole('button', {
      name: /更多操作：/,
    }),
  );

  return within(item).getByRole('menu');
}

function getStructureMapFocusAction(item: HTMLElement) {
  const action = item.querySelector(
    '[data-structure-node-focus-action="true"]',
  ) as HTMLButtonElement | null;

  expect(action).not.toBeNull();

  return action as HTMLButtonElement;
}

function getStructureMapCollapseAction(item: HTMLElement) {
  const action = item.querySelector(
    '[data-structure-node-collapse-action="true"]',
  ) as HTMLButtonElement | null;

  expect(action).not.toBeNull();

  return action as HTMLButtonElement;
}

function expectMountedTitleControls(
  nodeTestId: string,
  hiddenButtonNames: string[],
) {
  const node = screen.getByTestId(nodeTestId);
  const titleControls = node.querySelector('.workspace-nodeTitleControls');

  expect(titleControls).not.toBeNull();

  for (const buttonName of hiddenButtonNames) {
    expect(
      within(node).getByRole('button', {
        hidden: true,
        name: buttonName,
      }),
    ).toBeInTheDocument();
  }
}

function expectStableHiddenTitleControls(
  nodeTestId: string,
  hiddenButtonNames: string[],
) {
  const node = screen.getByTestId(nodeTestId);
  const titleControls = node.querySelector('.workspace-nodeTitleControls');

  expectMountedTitleControls(nodeTestId, hiddenButtonNames);
  expect(titleControls).toHaveAttribute('data-visible', 'false');
  expect(titleControls).toHaveAttribute('aria-hidden', 'true');
}

function expectSingleShellNode(nodeId: string, title: string) {
  const node = screen.getByTestId(`editor-node-${nodeId}`);

  expect(node.querySelectorAll('.workspace-nodeTitleRow')).toHaveLength(1);
  expect(within(node).getAllByText(title)).toHaveLength(1);
}

function getRenderedNodeIds(questionNodeId: string) {
  return Array.from(
    screen
      .getByTestId(`question-block-${questionNodeId}`)
      .querySelectorAll('section[data-testid^="editor-node-"]'),
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
