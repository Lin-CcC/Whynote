import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';

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
import { getActionAvailability, useWorkspaceEditor } from './hooks/useWorkspaceEditor';
import {
  DEMO_SELECTED_NODE_ID,
} from './utils/createDemoWorkspace';
import { DEFAULT_WORKSPACE_VIEW_STATE } from './utils/workspaceViewState';
import type {
  WorkspaceEditorLearningActionRequest,
  WorkspaceEditorOperations,
  WorkspaceEditorProps,
  WorkspaceViewState,
} from './workspaceEditorTypes';

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

test('shows learning actions as the primary path and keeps structure jargon in advanced actions', () => {
  render(<WorkspaceEditor />);

  const learningActionGrid = screen.getByTestId('learning-action-grid');

  expect(
    within(learningActionGrid).getByRole('button', { name: '插入问题' }),
  ).toBeInTheDocument();
  expect(
    within(learningActionGrid).getByRole('button', { name: '插入回答' }),
  ).toBeInTheDocument();
  expect(
    within(learningActionGrid).getByRole('button', { name: '插入总结' }),
  ).toBeInTheDocument();
  expect(
    within(learningActionGrid).queryByRole('button', { name: '插入子节点' }),
  ).not.toBeInTheDocument();
  expect(
    within(learningActionGrid).queryByRole('button', { name: '插入同级' }),
  ).not.toBeInTheDocument();

  const advancedActions = screen.getByTestId('advanced-structure-actions');

  expect(
    within(advancedActions).getByRole('button', { name: '插入子节点' }),
  ).toBeInTheDocument();
  expect(
    within(advancedActions).getByRole('button', { name: '插入同级' }),
  ).toBeInTheDocument();
  expect(screen.getByText('当前可接内容')).toBeInTheDocument();
  expect(screen.queryByText('允许的子节点')).not.toBeInTheDocument();
});

test('inserts a new question after the selected question by default', () => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.click(screen.getByRole('button', { name: '插入问题' }));

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe('step-state-basics');
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('question');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(2);
});

test('inserts an answer into the selected question before follow-up or closing nodes', () => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.click(
    within(screen.getByTestId('learning-action-grid')).getByRole('button', {
      name: '插入回答',
    }),
  );

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe(DEMO_SELECTED_NODE_ID);
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('answer');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(0);
});

test('keeps newly inserted answers in the current question answer block before follow-up questions', () => {
  const operations = createOperationSpies();

  render(
    <WorkspaceEditor
      initialModuleId="module-order"
      initialSelectedNodeId="question-parent"
      initialSnapshot={createQuestionOrderSnapshot()}
      operations={operations}
    />,
  );

  fireEvent.click(
    within(screen.getByTestId('question-block-actions-question-parent')).getByRole(
      'button',
      {
        name: '插入回答',
      },
    ),
  );

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe('question-parent');
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('answer');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(1);
});

test('keeps insert answer reachable from a selected answer inside the active question block', () => {
  const operations = createOperationSpies();

  render(
    <WorkspaceEditor
      initialModuleId="module-order"
      initialSelectedNodeId="answer-first"
      initialSnapshot={createQuestionOrderSnapshot()}
      operations={operations}
    />,
  );

  fireEvent.click(
    within(screen.getByTestId('question-block-actions-question-parent')).getByRole(
      'button',
      {
        name: '插入回答',
      },
    ),
  );

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe('question-parent');
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('answer');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(1);
});

test('inserts an answer under the selected follow-up question instead of the previous question', () => {
  const operations = createOperationSpies();

  render(
    <WorkspaceEditor
      initialModuleId="module-follow-up-answer"
      initialSelectedNodeId="question-parent-follow-up"
      initialSnapshot={createFollowUpAnswerPlacementSnapshot()}
      operations={operations}
    />,
  );

  fireEvent.focus(
    screen.getByLabelText('追问：补充问题 1 内容'),
  );
  expect(screen.getByTestId('editor-node-question-follow-up')).toHaveAttribute(
    'data-node-selected',
    'true',
  );

  fireEvent.click(
    within(
      screen.getByTestId('question-block-actions-question-follow-up'),
    ).getByRole('button', {
      name: '插入回答',
    }),
  );

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe('question-follow-up');
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('answer');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(0);
});

test.each([
  {
    sourceContent: '这是当前回答。',
    sourceNodeId: 'answer-action-source',
    sourceTitle: '当前回答',
    sourceType: 'answer',
  },
  {
    sourceContent: '这里明确指出还缺最后一层因果。',
    sourceNodeId: 'judgment-action-source',
    sourceTitle: '当前回答判断',
    sourceType: 'judgment',
  },
  {
    sourceContent: '这是围绕当前回答的答案解析。',
    sourceNodeId: 'summary-action-closure',
    sourceTitle: '答案解析草稿',
    sourceType: 'summary',
  },
  {
    sourceContent: '这是用户自己写的阶段性总结。',
    sourceNodeId: 'summary-action-manual',
    sourceTitle: '手写总结',
    sourceType: 'summary',
  },
])(
  'inserts an empty manual follow-up question with source context from $sourceNodeId',
  async ({ sourceContent, sourceNodeId, sourceTitle, sourceType }) => {
    const snapshots: WorkspaceSnapshot[] = [];

    render(
      <WorkspaceEditor
        initialModuleId="module-action-source"
        initialSelectedNodeId={sourceNodeId}
        initialSnapshot={createBlockActionSourceSnapshot()}
        onSnapshotChange={(snapshot) => {
          snapshots.push(snapshot);
        }}
      />,
    );

    fireEvent.click(
      within(
        screen.getByTestId('question-block-actions-question-action-source'),
      ).getByRole('button', {
        name: '插入追问',
      }),
    );

    const insertedQuestionTitle = await screen.findByDisplayValue('新追问');
    const insertedQuestionNode = insertedQuestionTitle.closest(
      '[data-testid^="editor-node-"]',
    );

    expect(insertedQuestionNode).not.toBeNull();
    expect(insertedQuestionNode).toHaveTextContent('追问围绕：来源');
    expect(insertedQuestionNode).toHaveTextContent(sourceTitle);

    const latestSnapshot = snapshots[snapshots.length - 1];
    const insertedQuestion = Object.values(latestSnapshot.tree.nodes).find(
      (node) =>
        node.type === 'question' &&
        node.parentId === 'question-action-source' &&
        node.title === '新追问',
    );

    expect(insertedQuestion).toMatchObject({
      type: 'question',
      content: '',
      sourceContext: {
        content: sourceContent,
        nodeId: sourceNodeId,
        nodeType: sourceType,
        title: sourceTitle,
      },
    });
  },
);

test('inserts an empty manual summary from the question block instead of delegating to AI', async () => {
  const snapshots: WorkspaceSnapshot[] = [];
  const onLearningActionRequest = vi.fn(() => true);

  render(
    <WorkspaceEditor
      initialModuleId="module-action-source"
      initialSelectedNodeId="summary-action-closure"
      initialSnapshot={createBlockActionSourceSnapshot()}
      onLearningActionRequest={onLearningActionRequest}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(
    within(
      screen.getByTestId('question-block-actions-question-action-source'),
    ).getByRole('button', {
      name: '插入总结',
    }),
  );

  const insertedSummaryTitle = await screen.findByDisplayValue('新总结');
  const insertedSummaryNode = insertedSummaryTitle.closest(
    '[data-testid^="editor-node-"]',
  );

  expect(onLearningActionRequest).not.toHaveBeenCalled();
  expect(insertedSummaryNode).not.toBeNull();
  expect(insertedSummaryNode).toHaveTextContent('总结');

  const latestSnapshot = snapshots[snapshots.length - 1];
  const insertedSummary = Object.values(latestSnapshot.tree.nodes).find(
    (node) =>
      node.type === 'summary' &&
      node.parentId === 'question-action-source' &&
      node.title === '新总结',
  );

  expect(insertedSummary).toMatchObject({
    type: 'summary',
    content: '',
    summaryKind: 'manual',
  });
});

test('inserts an empty scaffold summary from the selected scaffold node instead of delegating to AI', async () => {
  const snapshots: WorkspaceSnapshot[] = [];
  const onLearningActionRequest = vi.fn(() => true);

  render(
    <WorkspaceEditor
      initialModuleId="module-scaffold-actions"
      initialSelectedNodeId="summary-scaffold-selected"
      initialSnapshot={createScaffoldActionSnapshot()}
      onLearningActionRequest={onLearningActionRequest}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(
    within(
      screen.getByTestId('node-actions-summary-scaffold-selected'),
    ).getByRole('button', {
      name: '插入总结',
    }),
  );

  const insertedSummaryTitle = await screen.findByDisplayValue('新总结');
  const insertedSummaryNode = insertedSummaryTitle.closest(
    '[data-testid^="editor-node-"]',
  );

  expect(onLearningActionRequest).not.toHaveBeenCalled();
  expect(insertedSummaryNode).not.toBeNull();

  const latestSnapshot = snapshots[snapshots.length - 1];
  const insertedSummary = Object.values(latestSnapshot.tree.nodes).find(
    (node) =>
      node.type === 'summary' &&
      node.parentId === 'step-scaffold-actions' &&
      node.title === '新总结',
  );

  expect(insertedSummary).toMatchObject({
    type: 'summary',
    content: '',
    summaryKind: 'scaffold',
  });
});

test('allows switching a newly inserted leaf node between safe types while preserving content', async () => {
  const snapshots: WorkspaceSnapshot[] = [];

  render(
    <WorkspaceEditor
      initialSelectedNodeId="question-type-switch-target"
      initialSnapshot={createTypeSwitchSnapshot()}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(
    within(screen.getByTestId('learning-action-grid')).getByRole('button', {
      name: '插入回答',
    }),
  );

  await screen.findByDisplayValue('新回答');
  const contentInput = screen.getByLabelText('新回答 内容');

  fireEvent.change(contentInput, {
    target: {
      value: '这段内容在切换成总结后也应该保留。',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '切换为总结' }));

  await waitFor(() => {
    const switchedNode = screen
      .getByDisplayValue('新回答')
      .closest('[data-testid^="editor-node-"]');

    expect(switchedNode).toHaveAttribute('data-node-type', 'summary');
    expect(switchedNode).toHaveTextContent('总结');
    expect(contentInput).toHaveValue('这段内容在切换成总结后也应该保留。');
  });

  const latestSnapshot = snapshots[snapshots.length - 1];
  const preservedNode = Object.values(latestSnapshot.tree.nodes).find(
    (node) =>
      node.title === '新回答' &&
      node.content === '这段内容在切换成总结后也应该保留。',
  );

  expect(preservedNode?.type).toBe('summary');

  fireEvent.click(screen.getByTestId('editor-node-question-type-switch-complex'));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '切换为回答' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '切换为总结' })).toBeDisabled();
  });
});

test('does not promote an older edited answer to currentAnswerId', () => {
  const { result } = renderHook(() =>
    useWorkspaceEditor({
      initialModuleId: 'module-current-answer-editor',
      initialSelectedNodeId: 'answer-editor-previous',
      initialSnapshot: createCurrentAnswerEditorSnapshot(),
    }),
  );

  act(() => {
    result.current.updateNode('answer-editor-previous', {
      content: '补充旧回答，但不升格为当前回答。',
    });
  });

  const questionNode = result.current.tree.nodes['question-current-answer-editor'];

  expect(questionNode).toMatchObject({
    type: 'question',
    currentAnswerId: 'answer-editor-current',
  });
});

test('promotes a leaf node to currentAnswerId when switching it to answer', async () => {
  const snapshots: WorkspaceSnapshot[] = [];

  render(
    <WorkspaceEditor
      initialModuleId="module-current-answer-editor"
      initialSelectedNodeId="summary-editor-draft"
      initialSnapshot={createCurrentAnswerEditorSnapshot()}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '切换为回答' }));

  await waitFor(() => {
    expect(screen.getByTestId('editor-node-summary-editor-draft')).toHaveAttribute(
      'data-node-type',
      'answer',
    );
  });

  const latestSnapshot = snapshots[snapshots.length - 1];
  const questionNode = latestSnapshot.tree.nodes['question-current-answer-editor'];

  expect(questionNode).toMatchObject({
    type: 'question',
    currentAnswerId: 'summary-editor-draft',
  });
  expect(latestSnapshot.tree.nodes['summary-editor-draft']).toMatchObject({
    type: 'answer',
  });
});

test('shows common progression actions and retained scaffold-specific actions when a scaffold node is selected', () => {
  const onGenerateFollowUpQuestion = vi.fn();
  const onGenerateSummary = vi.fn();

  render(
    <WorkspaceEditor
      initialModuleId="module-scaffold-actions"
      initialSelectedNodeId="summary-scaffold-selected"
      initialSnapshot={createScaffoldActionSnapshot()}
      onGenerateFollowUpQuestion={onGenerateFollowUpQuestion}
      onGenerateSummary={onGenerateSummary}
    />,
  );

  const actionPanel = screen.getByTestId('node-actions-summary-scaffold-selected');

  expect(
    within(actionPanel).getByRole('button', { name: '生成追问' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '插入追问' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '生成总结' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '插入总结' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '继续修改' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '删除' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '换个说法' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '更基础一点' }),
  ).toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '举个例子' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(actionPanel).getByRole('button', { name: '生成追问' }),
  );
  fireEvent.click(
    within(actionPanel).getByRole('button', { name: '生成总结' }),
  );

  expect(onGenerateFollowUpQuestion).toHaveBeenCalledWith(
    'summary-scaffold-selected',
  );
  expect(onGenerateSummary).toHaveBeenCalledWith('summary-scaffold-selected');
});

test('renders scaffold summaries in the unified compact collapsed summary and keeps scaffold actions reachable', async () => {
  renderWorkspaceEditorWithViewState({
    initialModuleId: 'module-scaffold-actions',
    initialSelectedNodeId: 'summary-scaffold-selected',
    initialSnapshot: createScaffoldActionSnapshot(),
  });

  const actionPanel = screen.getByTestId('node-actions-summary-scaffold-selected');

  fireEvent.click(
    within(
      screen.getByTestId('editor-node-summary-scaffold-selected'),
    ).getByRole('button', {
      name: '收起正文',
    }),
  );

  const collapsedNode = screen.getByTestId('editor-node-summary-scaffold-selected');

  expect(within(collapsedNode).getByText('铺垫')).toBeInTheDocument();
  expect(within(collapsedNode).getByText('先建立概念地图')).toBeInTheDocument();
  expect(within(collapsedNode).getByText('铺垫已折叠')).toBeInTheDocument();
  expect(
    within(collapsedNode).getByRole('button', { name: '展开正文' }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('先建立概念地图 内容')).not.toBeInTheDocument();
  expect(
    within(actionPanel).getByRole('button', { name: '换个说法' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(actionPanel).getByRole('button', { name: '继续修改' }),
  );

  await waitFor(() => {
    expect(screen.getByLabelText('先建立概念地图 内容')).toBeInTheDocument();
  });

  expect(
    within(screen.getByTestId('node-actions-summary-scaffold-selected')).getByRole(
      'button',
      { name: '举个例子' },
    ),
  ).toBeInTheDocument();
});

test('uses 未命名铺垫 in the unified compact collapsed summary when the scaffold title is empty', () => {
  const snapshot = createScaffoldActionSnapshot();
  const scaffoldNode = snapshot.tree.nodes['summary-scaffold-selected'];

  if (!scaffoldNode || scaffoldNode.type !== 'summary') {
    throw new Error('Expected summary-scaffold-selected to be a summary node.');
  }

  scaffoldNode.title = '   ';

  renderWorkspaceEditorWithViewState({
    initialModuleId: 'module-scaffold-actions',
    initialSelectedNodeId: 'step-scaffold-actions',
    initialSnapshot: snapshot,
    initialWorkspaceViewState: {
      ...DEFAULT_WORKSPACE_VIEW_STATE,
      collapsedNodeBodyIds: ['summary-scaffold-selected'],
    },
  });

  expect(
    within(screen.getByTestId('editor-node-summary-scaffold-selected')).getByText(
      '未命名铺垫',
    ),
  ).toBeInTheDocument();
});

test('deletes the selected scaffold node from the common node action panel', async () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-scaffold-actions"
      initialSelectedNodeId="summary-scaffold-selected"
      initialSnapshot={createScaffoldActionSnapshot()}
    />,
  );

  fireEvent.click(
    within(
      screen.getByTestId('node-actions-summary-scaffold-selected'),
    ).getByRole('button', {
      name: '删除',
    }),
  );

  await waitFor(() => {
    expect(
      screen.queryByTestId('editor-node-summary-scaffold-selected'),
    ).not.toBeInTheDocument();
  });
});

test('deletes the selected node from the Delete shortcut when focus is outside editable fields', () => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.keyDown(window, {
    key: 'Delete',
  });

  expect(getOperationSpy(operations, 'deleteNode')).toHaveBeenCalledTimes(1);
  expect(getOperationSpy(operations, 'deleteNode').mock.calls[0]?.[1]).toBe(
    DEMO_SELECTED_NODE_ID,
  );
});

test('does not trigger the Delete shortcut while editing a node field', () => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  const selectedNode = screen.getByTestId(`editor-node-${DEMO_SELECTED_NODE_ID}`);
  const titleInput = selectedNode.querySelector('input');

  expect(titleInput).not.toBeNull();

  fireEvent.focus(titleInput!);
  fireEvent.keyDown(titleInput!, {
    key: 'Delete',
  });

  expect(getOperationSpy(operations, 'deleteNode')).not.toHaveBeenCalled();
});

test('removes redundant type prefixes from titles when the UI already shows node labels', async () => {
  const snapshots: WorkspaceSnapshot[] = [];

  render(
    <WorkspaceEditor
      initialModuleId="module-prefixed-display-titles"
      initialSelectedNodeId="summary-scaffold-prefixed"
      initialSnapshot={createPrefixedDisplayTitleSnapshot()}
      onSnapshotChange={(snapshot) => {
        snapshots.push(snapshot);
      }}
    />,
  );

  expect(await screen.findByDisplayValue('先建立概念地图')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('铺垫：先建立概念地图')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('从参数到学习：AI 的物理基础')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('问题：从参数到学习：AI 的物理基础')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('第一版理解')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('回答：第一版理解')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('还差关键因果')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('判断：还差关键因果')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('标准理解')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('答案解析：标准理解')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('只围绕当前问题')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('总结：只围绕当前问题')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /问题.*从参数到学习：AI 的物理基础/u }),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByDisplayValue('还差关键因果'), {
    target: {
      value: '判断：补上最后一步',
    },
  });

  await waitFor(() => {
    expect(screen.getByDisplayValue('补上最后一步')).toBeInTheDocument();
  });

  const latestSnapshot = snapshots[snapshots.length - 1];

  expect(latestSnapshot?.tree.nodes['judgment-prefixed']?.title).toBe('补上最后一步');
});

test('inserts scaffold before the first question when the step is selected', () => {
  const operations = createOperationSpies();

  render(
    <WorkspaceEditor
      initialSelectedNodeId="step-state-basics"
      operations={operations}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '插入铺垫 / 讲解' }));

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[1]).toBe('step-state-basics');
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('summary');
  expect(insertChildSpy.mock.calls[0]?.[2].title).toBe('新铺垫');
  expect(insertChildSpy.mock.calls[0]?.[3]).toBe(0);
});

test('delegates a learning action to the runtime hook when an external handler takes over', () => {
  const operations = createOperationSpies();
  const onLearningActionRequest = vi.fn(
    (_request: WorkspaceEditorLearningActionRequest) => true,
  );

  render(
    <WorkspaceEditor
      onLearningActionRequest={onLearningActionRequest}
      operations={operations}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '插入问题' }));

  expect(onLearningActionRequest).toHaveBeenCalledTimes(1);
  const request = onLearningActionRequest.mock.calls[0]?.[0];

  expect(request).toBeDefined();
  expect(request?.actionId).toBe('insert-question');
  expect(request?.placement.nodeType).toBe('question');
  expect(request?.placement.parentNodeId).toBe('step-state-basics');
  expect(getOperationSpy(operations, 'insertChildNode')).not.toHaveBeenCalled();
});

test('allows choosing answer and summary when inserting nodes for a learning question', () => {
  const operations = createOperationSpies();

  render(<WorkspaceEditor operations={operations} />);

  fireEvent.change(screen.getByLabelText('子节点类型'), {
    target: {
      value: 'answer',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '插入子节点' }));

  const insertChildSpy = getOperationSpy(operations, 'insertChildNode');

  expect(insertChildSpy).toHaveBeenCalledTimes(1);
  expect(insertChildSpy.mock.calls[0]?.[2].type).toBe('answer');

  fireEvent.change(screen.getByLabelText('同级节点类型'), {
    target: {
      value: 'summary',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '插入同级' }));

  const insertSiblingSpy = getOperationSpy(operations, 'insertSiblingNode');

  expect(insertSiblingSpy).toHaveBeenCalledTimes(1);
  expect(insertSiblingSpy.mock.calls[0]?.[2].type).toBe('summary');
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
      name: /梳理 state \/ props \/ render 的关系.*状态/i,
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

  const parentNode = screen.getByTestId('question-block-question-parent');
  const renderedNodeIds = Array.from(
    parentNode.querySelectorAll('[data-testid^="editor-node-"]'),
  )
    .map((element) => element.getAttribute('data-testid'))
    .filter((testId) => testId !== 'editor-node-question-parent');

  expect(renderedNodeIds).toEqual([
    'editor-node-answer-first',
    'editor-node-question-child',
    'editor-node-summary-third',
  ]);
  expect(
    screen.getByDisplayValue('父问题保留并承接子节点顺序。'),
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

function createScaffoldActionSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '铺垫动作',
    workspaceId: 'workspace-scaffold-actions',
    rootId: 'theme-scaffold-actions',
    createdAt: '2026-04-27T09:15:00.000Z',
    updatedAt: '2026-04-27T09:15:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-scaffold-actions',
      title: '铺垫模块',
      content: '',
      createdAt: '2026-04-27T09:15:00.000Z',
      updatedAt: '2026-04-27T09:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-scaffold-actions',
    createNode({
      type: 'plan-step',
      id: 'step-scaffold-actions',
      title: '铺垫步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-27T09:15:00.000Z',
      updatedAt: '2026-04-27T09:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-scaffold-actions',
    createNode({
      type: 'summary',
      id: 'summary-scaffold-selected',
      title: '铺垫：先建立概念地图',
      content: '先解释这一步为什么存在，再进入后续问题。',
      createdAt: '2026-04-27T09:15:00.000Z',
      updatedAt: '2026-04-27T09:15:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-scaffold-actions',
    createNode({
      type: 'question',
      id: 'question-scaffold-actions',
      title: '后续问题',
      content: '验证铺垫后的理解。',
      createdAt: '2026-04-27T09:15:00.000Z',
      updatedAt: '2026-04-27T09:15:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createPrefixedDisplayTitleSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '标题前缀收口',
    workspaceId: 'workspace-prefixed-display-titles',
    rootId: 'theme-prefixed-display-titles',
    createdAt: '2026-04-29T09:00:00.000Z',
    updatedAt: '2026-04-29T09:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-prefixed-display-titles',
      title: '模块：标题前缀收口',
      content: '',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-prefixed-display-titles',
    createNode({
      type: 'plan-step',
      id: 'step-prefixed-display-titles',
      title: '步骤：统一标题展示',
      content: '',
      status: 'doing',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-prefixed-display-titles',
    createNode({
      type: 'summary',
      id: 'summary-scaffold-prefixed',
      title: '铺垫：先建立概念地图',
      content: '先把最小背景交代清楚。',
      summaryKind: 'scaffold',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-prefixed-display-titles',
    createNode({
      type: 'question',
      id: 'question-prefixed',
      title: '问题：从参数到学习：AI 的物理基础',
      content: '这里保留标题正文里的普通冒号。',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-prefixed',
    createNode({
      type: 'answer',
      id: 'answer-prefixed',
      title: '回答：第一版理解',
      content: '先给出一版理解。',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-prefixed',
    createNode({
      type: 'judgment',
      id: 'judgment-prefixed',
      title: '判断：还差关键因果',
      content: '还没把因果关系补全。',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-prefixed',
    createNode({
      type: 'summary',
      id: 'summary-answer-explanation-prefixed',
      title: '答案解析：标准理解',
      content: '把标准理解补完整。',
      summaryKind: 'answer-closure',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-prefixed-display-titles',
    createNode({
      type: 'summary',
      id: 'summary-generic-prefixed',
      title: '总结：只围绕当前问题',
      content: '这是步骤层的普通总结。',
      summaryKind: 'manual',
      createdAt: '2026-04-29T09:00:00.000Z',
      updatedAt: '2026-04-29T09:00:00.000Z',
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

function createFollowUpAnswerPlacementSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '追问回答插入',
    workspaceId: 'workspace-follow-up-answer',
    rootId: 'theme-follow-up-answer',
    createdAt: '2026-04-29T15:00:00.000Z',
    updatedAt: '2026-04-29T15:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-follow-up-answer',
      title: '追问模块',
      content: '',
      createdAt: '2026-04-29T15:00:00.000Z',
      updatedAt: '2026-04-29T15:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-follow-up-answer',
    createNode({
      type: 'plan-step',
      id: 'step-follow-up-answer',
      title: '追问步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-29T15:00:00.000Z',
      updatedAt: '2026-04-29T15:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-follow-up-answer',
    createNode({
      type: 'question',
      id: 'question-parent-follow-up',
      title: '父问题',
      content: '先有一轮回答，再出现追问。',
      createdAt: '2026-04-29T15:00:00.000Z',
      updatedAt: '2026-04-29T15:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent-follow-up',
    createNode({
      type: 'answer',
      id: 'answer-parent-follow-up',
      title: '上一版回答',
      content: '这是上一题的回答。',
      createdAt: '2026-04-29T15:00:00.000Z',
      updatedAt: '2026-04-29T15:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-parent-follow-up',
    createNode({
      type: 'question',
      id: 'question-follow-up',
      title: '追问：补充问题 1',
      content: '为什么6000万个参数的盲目试错复杂度是指数级，而不是线性的？',
      createdAt: '2026-04-29T15:00:00.000Z',
      updatedAt: '2026-04-29T15:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createBlockActionSourceSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '动作来源语义',
    workspaceId: 'workspace-action-source',
    rootId: 'theme-action-source',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-action-source',
      title: '动作来源模块',
      content: '',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-action-source',
    createNode({
      type: 'plan-step',
      id: 'step-action-source',
      title: '动作来源步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-action-source',
    createNode({
      type: 'question',
      id: 'question-action-source',
      title: '动作来源问题',
      content: '用于验证内容节点上的追问和总结动作来源。',
      currentAnswerId: 'answer-action-source',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-action-source',
    createNode({
      type: 'answer',
      id: 'answer-action-source',
      title: '当前回答',
      content: '这是当前回答。',
      createdAt: '2026-05-01T00:01:00.000Z',
      updatedAt: '2026-05-01T00:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-action-source',
    createNode({
      type: 'judgment',
      id: 'judgment-action-source',
      title: '当前回答判断',
      content: '这里明确指出还缺最后一层因果。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-action-source',
      sourceAnswerUpdatedAt: '2026-05-01T00:01:00.000Z',
      createdAt: '2026-05-01T00:01:30.000Z',
      updatedAt: '2026-05-01T00:01:30.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-action-source',
    createNode({
      type: 'summary',
      id: 'summary-action-closure',
      title: '答案解析草稿',
      content: '这是围绕当前回答的答案解析。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-action-source',
      sourceAnswerUpdatedAt: '2026-05-01T00:01:00.000Z',
      createdAt: '2026-05-01T00:02:00.000Z',
      updatedAt: '2026-05-01T00:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-action-source',
    createNode({
      type: 'summary',
      id: 'summary-action-manual',
      title: '手写总结',
      content: '这是用户自己写的阶段性总结。',
      summaryKind: 'manual',
      createdAt: '2026-05-01T00:03:00.000Z',
      updatedAt: '2026-05-01T00:03:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createTypeSwitchSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '节点类型切换',
    workspaceId: 'workspace-type-switch',
    rootId: 'theme-type-switch',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-type-switch',
      title: '模块',
      content: '验证节点类型切换。',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-type-switch',
    createNode({
      type: 'plan-step',
      id: 'step-type-switch',
      title: '步骤',
      content: '先插入一个叶子节点，再切换类型。',
      status: 'todo',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-type-switch',
    createNode({
      type: 'question',
      id: 'question-type-switch-target',
      title: '目标问题',
      content: '这里先插一个节点，再改类型。',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-type-switch',
    createNode({
      type: 'question',
      id: 'question-type-switch-complex',
      title: '复杂问题',
      content: '这个节点已经有子树，不应该开放安全切换。',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-type-switch-complex',
    createNode({
      type: 'question',
      id: 'question-type-switch-child',
      title: '子问题',
      content: '让父问题失去叶子节点资格。',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createCurrentAnswerEditorSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '当前回答编辑器语义',
    workspaceId: 'workspace-current-answer-editor',
    rootId: 'theme-current-answer-editor',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-current-answer-editor',
      title: '模块',
      content: '',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-current-answer-editor',
    createNode({
      type: 'plan-step',
      id: 'step-current-answer-editor',
      title: '当前回答步骤',
      content: '',
      status: 'doing',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-current-answer-editor',
    createNode({
      type: 'question',
      id: 'question-current-answer-editor',
      title: '目标问题',
      content: '验证当前回答语义。',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-editor',
    createNode({
      type: 'answer',
      id: 'answer-editor-previous',
      title: '第一版回答',
      content: '旧回答内容',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-editor',
    createNode({
      type: 'answer',
      id: 'answer-editor-current',
      title: '当前回答',
      content: '当前回答内容',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-editor',
    createNode({
      type: 'summary',
      id: 'summary-editor-draft',
      title: '手写总结草稿',
      content: '可切换成 answer 的叶子节点',
      summaryKind: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
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

function renderWorkspaceEditorWithViewState(
  props: WorkspaceEditorProps & {
    initialWorkspaceViewState?: WorkspaceViewState;
  },
) {
  const {
    initialWorkspaceViewState = DEFAULT_WORKSPACE_VIEW_STATE,
    ...workspaceEditorProps
  } = props;

  function Wrapper() {
    const [workspaceViewState, setWorkspaceViewState] = useState(
      initialWorkspaceViewState,
    );

    return (
      <WorkspaceEditor
        {...workspaceEditorProps}
        onWorkspaceViewStateChange={setWorkspaceViewState}
        workspaceViewState={workspaceViewState}
      />
    );
  }

  return render(<Wrapper />);
}

function getSectionByHeading(name: string) {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return section;
}
