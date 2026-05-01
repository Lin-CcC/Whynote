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

  expect(answerNode).toHaveAttribute('data-node-shell', 'document-inline');
  expect(answerToolbar).toHaveAttribute('data-visible', 'false');
  expect(
    within(answerNode).queryByRole('button', { name: '收起正文' }),
  ).not.toBeInTheDocument();

  fireEvent.mouseEnter(answerNode);
  expect(answerToolbar).toHaveAttribute('data-visible', 'true');
  expect(
    within(answerNode).getByRole('button', { name: '收起正文' }),
  ).toBeInTheDocument();

  fireEvent.mouseLeave(answerNode);
  expect(answerToolbar).toHaveAttribute('data-visible', 'false');
  expect(
    within(answerNode).queryByRole('button', { name: '收起正文' }),
  ).not.toBeInTheDocument();

  fireEvent.focus(screen.getByLabelText('第一版回答 标题'));
  expect(answerToolbar).toHaveAttribute('data-visible', 'true');
  expect(
    within(answerNode).getByRole('button', { name: '收起正文' }),
  ).toBeInTheDocument();
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
    'true',
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
    initialWorkspaceViewState: {
      collapsedPlanStepIds: [],
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['answer-first'],
      expandedHistorySectionIds: [getAnswerHistorySectionId('answer-first')],
    },
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
    initialWorkspaceViewState: {
      collapsedPlanStepIds: [],
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

test('does not auto-reopen a plan-step after the user manually collapses it', async () => {
  renderQuestionBlockEditor({
    initialSelectedNodeId: 'question-main',
    initialWorkspaceViewState: {
      collapsedPlanStepIds: ['step-question-block'],
      collapsedQuestionBlockIds: [],
      collapsedNodeBodyIds: [],
      expandedHistorySectionIds: [],
    },
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
    initialWorkspaceViewState: {
      collapsedPlanStepIds: ['step-question-block'],
      collapsedQuestionBlockIds: ['question-main'],
      collapsedNodeBodyIds: ['judgment-first-history'],
      expandedHistorySectionIds: [],
    },
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
  const onGenerateFollowUpQuestion =
    options?.onGenerateFollowUpQuestion ?? vi.fn();
  const onGenerateSummary = options?.onGenerateSummary ?? vi.fn();

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
        onGenerateFollowUpQuestion={onGenerateFollowUpQuestion}
        onGenerateSummary={onGenerateSummary}
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
