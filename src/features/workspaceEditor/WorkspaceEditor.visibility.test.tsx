import { cloneElement, type ReactElement, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  moveNode,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceEditor from './WorkspaceEditor';
import { getNodeSemanticVisibility } from './utils/nodeSemanticVisibility';
import { DEFAULT_WORKSPACE_VIEW_STATE } from './utils/workspaceViewState';
import type {
  WorkspaceEditorProps,
  WorkspaceEditorRenderContext,
  WorkspaceViewState,
} from './workspaceEditorTypes';

test('keeps current-answer semantics in inspector while only the current answer keeps a default badge', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-legacy-current-answer"
      initialSelectedNodeId="question-legacy-current-answer"
      initialSnapshot={createLegacyCurrentAnswerSnapshot()}
    />,
  );

  const questionNode = screen.getByTestId('editor-node-question-legacy-current-answer');

  expect(
    within(questionNode).queryByText('当前回答：第二版回答'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('当前回答：第二版回答')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-answer-legacy-v1')).queryByText('旧回答'),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-answer-legacy-v2')).getByText('当前回答'),
  ).toBeInTheDocument();
});

test('keeps the current answer badge on the existing current answer when an older answer is edited', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-current-answer-editor"
      initialSelectedNodeId="answer-editor-previous"
      initialSnapshot={createCurrentAnswerEditorSnapshot()}
    />,
  );

  fireEvent.click(
    screen.getByTestId('editor-node-content-display-answer-editor-previous'),
  );
  fireEvent.change(screen.getByRole('textbox', { name: '第一版回答 内容' }), {
    target: {
      value: '补充旧回答，但不应该篡改当前回答标识。',
    },
  });

  expect(
    within(screen.getByTestId('editor-node-answer-editor-previous')).getByText('旧回答'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('editor-node-answer-editor-current')).getByText(
      '当前回答',
      {
        selector: '.workspace-semanticBadge',
      },
    ),
  ).toBeInTheDocument();
});

test('falls back the current answer badge and removes answer-closure results after deleting the current answer', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-current-answer-delete"
      initialSelectedNodeId="answer-delete-current"
      initialSnapshot={createCurrentAnswerDeletionSnapshot()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '删除节点' }));

  expect(
    within(screen.getByTestId('editor-node-answer-delete-previous')).getByText(
      '当前回答',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('editor-node-judgment-delete-current'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('editor-node-summary-delete-current'),
  ).not.toBeInTheDocument();
});

test('promotes a leaf node to current answer visibility after switching it to answer', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-current-answer-editor"
      initialSelectedNodeId="summary-editor-draft"
      initialSnapshot={createCurrentAnswerEditorSnapshot()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '切换为回答' }));

  const promotedNode = screen.getByTestId('editor-node-summary-editor-draft');

  expect(promotedNode).toHaveAttribute('data-node-type', 'answer');
  expect(within(promotedNode).getByText('当前回答')).toBeInTheDocument();
});

test('keeps default result badges minimal while preserving full semantics in inspector', async () => {
  renderWorkspaceEditorWithViewState(
    <WorkspaceEditor
      initialModuleId="module-visibility-results"
      initialSelectedNodeId="question-visibility-results"
      initialSnapshot={createVisibilityResultSnapshot()}
    />,
  );

  const questionNode = screen.getByTestId('editor-node-question-visibility-results');
  const oldJudgmentNode = screen.getByTestId('editor-node-judgment-visibility-v1');
  const currentSummaryNode = screen.getByTestId('editor-node-summary-visibility-v2');
  const currentSummaryCheckNode = screen.getByTestId(
    'editor-node-judgment-summary-check-current',
  );
  const summaryGroup = screen.getByTestId(
    'question-block-summary-group-summary-summary-check-source',
  );

  expect(
    within(questionNode).queryByText('当前回答：第二版回答'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('当前回答：第二版回答')).toBeInTheDocument();
  expect(oldJudgmentNode).not.toHaveTextContent('历史结果');
  expect(
    within(oldJudgmentNode).queryByText('配对回答：旧回答 · 第一版回答'),
  ).not.toBeInTheDocument();
  expect(currentSummaryNode).toHaveTextContent('当前结果');
  expect(currentSummaryNode).toHaveTextContent('已过期');
  expect(currentSummaryCheckNode).toHaveTextContent('总结检查结果');
  expect(currentSummaryCheckNode).toHaveTextContent('当前结果');
  expect(currentSummaryCheckNode).toHaveTextContent('已过期');

  fireEvent.click(oldJudgmentNode);

  expect(oldJudgmentNode).toHaveTextContent('历史结果');
  expect(screen.getByText('配对回答：旧回答 · 第一版回答')).toBeInTheDocument();

  fireEvent.click(
    within(summaryGroup).getByRole('button', { name: '展开历史检查结果' }),
  );
  const oldSummaryCheckNode = await screen.findByTestId(
    'editor-node-judgment-summary-check-old',
  );

  expect(oldSummaryCheckNode).not.toHaveTextContent('历史结果');

  fireEvent.click(oldSummaryCheckNode);

  expect(oldSummaryCheckNode).toHaveTextContent('历史结果');
  expect(screen.getByText('检查对象：手写总结')).toBeInTheDocument();
});

test('shows readable fallback labels for unnamed current answers and summary pairing targets', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-unnamed-visibility"
      initialSelectedNodeId="question-unnamed-visibility"
      initialSnapshot={createUnnamedVisibilitySnapshot()}
    />,
  );

  const questionNode = screen.getByTestId('editor-node-question-unnamed-visibility');
  const answerResultNode = screen.getByTestId('editor-node-summary-unnamed-answer-result');
  const summaryCheckNode = screen.getByTestId(
    'editor-node-judgment-unnamed-summary-result',
  );

  expect(
    within(questionNode).queryByText('当前回答：未命名回答（正文为空）'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('当前回答：未命名回答（正文为空）')).toBeInTheDocument();

  fireEvent.click(answerResultNode);
  expect(screen.getByText('配对回答：当前回答 · 未命名回答')).toBeInTheDocument();

  fireEvent.click(summaryCheckNode);
  expect(screen.getByText('检查对象：未命名总结')).toBeInTheDocument();
});

test('keeps semantic badges and relation notes visible in compact collapsed summaries', () => {
  renderWorkspaceEditorWithViewState(
    <WorkspaceEditor
      initialModuleId="module-visibility-results"
      initialSelectedNodeId="question-visibility-results"
      initialSnapshot={createVisibilityResultSnapshot()}
    />,
    {
      initialWorkspaceViewState: {
        ...DEFAULT_WORKSPACE_VIEW_STATE,
        collapsedNodeBodyIds: [
          'answer-visibility-v2',
          'judgment-visibility-v1',
          'summary-visibility-v2',
          'judgment-summary-check-current',
        ],
      },
    },
  );

  const currentAnswerNode = screen.getByTestId('editor-node-answer-visibility-v2');
  const oldJudgmentNode = screen.getByTestId('editor-node-judgment-visibility-v1');
  const currentSummaryNode = screen.getByTestId('editor-node-summary-visibility-v2');
  const currentSummaryCheckNode = screen.getByTestId(
    'editor-node-judgment-summary-check-current',
  );

  expect(within(currentAnswerNode).getByText('当前回答')).toBeInTheDocument();
  expect(
    within(currentAnswerNode).getByText('当前回答已折叠'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('第二版回答 内容')).not.toBeInTheDocument();

  expect(within(oldJudgmentNode).getByText('历史结果')).toBeInTheDocument();
  expect(
    within(oldJudgmentNode).getByText('配对回答：旧回答 · 第一版回答'),
  ).toBeInTheDocument();
  expect(
    within(oldJudgmentNode).getByText('历史判断已折叠'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('第一版回答仍有缺口 内容')).not.toBeInTheDocument();

  expect(within(currentSummaryNode).getByText('当前结果')).toBeInTheDocument();
  expect(within(currentSummaryNode).getByText('已过期')).toBeInTheDocument();
  expect(
    within(currentSummaryNode).getByText('配对回答：当前回答 · 第二版回答'),
  ).toBeInTheDocument();
  expect(
    within(currentSummaryNode).getByText('当前答案解析已折叠'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('标准理解 内容')).not.toBeInTheDocument();

  expect(
    within(currentSummaryCheckNode).getByText('当前结果'),
  ).toBeInTheDocument();
  expect(within(currentSummaryCheckNode).getByText('已过期')).toBeInTheDocument();
  expect(
    within(currentSummaryCheckNode).getByText('检查对象：手写总结'),
  ).toBeInTheDocument();
  expect(
    within(currentSummaryCheckNode).getByText('当前总结检查结果已折叠'),
  ).toBeInTheDocument();
});

test('returns interpolated note strings from the semantic visibility helper', () => {
  const snapshot = createVisibilityResultSnapshot();
  const questionNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['question-visibility-results'],
  ).notes;
  const answerResultNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['summary-visibility-v2'],
  ).notes;
  const answerResultRelationNote = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['summary-visibility-v2'],
  ).compactRelationNote;
  const summaryCheckNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['judgment-summary-check-current'],
  ).notes;
  const summaryCheckRelationNote = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['judgment-summary-check-current'],
  ).compactRelationNote;

  expect(questionNotes).toEqual(['当前回答：第二版回答']);
  expect(answerResultNotes).toContain('配对回答：当前回答 · 第二版回答');
  expect(answerResultRelationNote).toBe('配对回答：当前回答 · 第二版回答');
  expect(summaryCheckNotes).toContain('检查对象：手写总结');
  expect(summaryCheckRelationNote).toBe('检查对象：手写总结');
  expect(
    [...questionNotes, ...answerResultNotes, ...summaryCheckNotes].join(' '),
  ).not.toContain('?{');
});

test('returns readable fallback labels from the semantic visibility helper for unnamed nodes', () => {
  const snapshot = createUnnamedVisibilitySnapshot();
  const questionNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['question-unnamed-visibility'],
  ).notes;
  const answerResultNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['summary-unnamed-answer-result'],
  ).notes;
  const answerResultRelationNote = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['summary-unnamed-answer-result'],
  ).compactRelationNote;
  const summaryCheckNotes = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['judgment-unnamed-summary-result'],
  ).notes;
  const summaryCheckRelationNote = getNodeSemanticVisibility(
    snapshot.tree,
    snapshot.tree.nodes['judgment-unnamed-summary-result'],
  ).compactRelationNote;

  expect(questionNotes).toEqual(['当前回答：未命名回答（正文为空）']);
  expect(answerResultNotes).toContain('配对回答：当前回答 · 未命名回答');
  expect(answerResultRelationNote).toBe('配对回答：当前回答 · 未命名回答');
  expect(summaryCheckNotes).toContain('检查对象：未命名总结');
  expect(summaryCheckRelationNote).toBe('检查对象：未命名总结');
  expect(
    [...questionNotes, ...answerResultNotes, ...summaryCheckNotes].join(' '),
  ).not.toContain('?{');
});

test('removes summary-check results from the UI when a manual summary switches away from summary semantics', () => {
  render(
    <WorkspaceEditor
      initialModuleId="module-summary-type-switch"
      initialSelectedNodeId="summary-switch-source"
      initialSnapshot={createSummaryTypeSwitchCascadeSnapshot()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '切换为判断' }));

  expect(
    screen.queryByTestId('editor-node-judgment-summary-switch-result'),
  ).not.toBeInTheDocument();
});

test('removes paired answer-closure results from the UI after moving the source answer across questions', () => {
  render(<CrossQuestionMoveHarness />);

  expect(screen.getByTestId('editor-node-judgment-cross-question-a')).toBeInTheDocument();
  expect(screen.getByTestId('editor-node-summary-cross-question-a')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '移动到问题 B' }));

  expect(
    screen.queryByTestId('editor-node-judgment-cross-question-a'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('editor-node-summary-cross-question-a'),
  ).not.toBeInTheDocument();
});

function CrossQuestionMoveHarness() {
  return (
    <WorkspaceEditor
      initialModuleId="module-cross-question"
      initialSelectedNodeId="answer-cross-question-a"
      initialSnapshot={createCrossQuestionMoveSnapshot()}
      renderLeftPanelExtra={(context: WorkspaceEditorRenderContext) => (
        <button
          onClick={() => {
            context.applyTreeChange(
              moveNode(
                context.tree,
                'answer-cross-question-a',
                'question-cross-question-b',
              ),
              {
                nextSelectedNodeId: 'answer-cross-question-a',
              },
            );
          }}
          type="button"
        >
          移动到问题 B
        </button>
      )}
    />
  );
}

function renderWorkspaceEditorWithViewState(
  element: ReactElement<WorkspaceEditorProps>,
  options?: {
    initialWorkspaceViewState?: WorkspaceViewState;
  },
) {
  function Harness() {
    const [workspaceViewState, setWorkspaceViewState] = useState(
      options?.initialWorkspaceViewState ?? DEFAULT_WORKSPACE_VIEW_STATE,
    );

    return cloneElement(element, {
      onWorkspaceViewStateChange: setWorkspaceViewState,
      workspaceViewState,
    });
  }

  return render(<Harness />);
}

function createLegacyCurrentAnswerSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '旧问题当前回答回填',
    workspaceId: 'workspace-legacy-current-answer',
    rootId: 'theme-legacy-current-answer',
    createdAt: '2026-04-30T08:00:00.000Z',
    updatedAt: '2026-04-30T08:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-legacy-current-answer',
      title: '旧问题模块',
      content: '',
      createdAt: '2026-04-30T08:00:00.000Z',
      updatedAt: '2026-04-30T08:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-legacy-current-answer',
    createNode({
      type: 'question',
      id: 'question-legacy-current-answer',
      title: '旧问题',
      content: '没有 currentAnswerId，但有多条旧回答。',
      createdAt: '2026-04-30T08:00:00.000Z',
      updatedAt: '2026-04-30T08:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-current-answer',
    createNode({
      type: 'answer',
      id: 'answer-legacy-v1',
      title: '第一版回答',
      content: '第一版旧回答。',
      createdAt: '2026-04-30T08:01:00.000Z',
      updatedAt: '2026-04-30T08:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-legacy-current-answer',
    createNode({
      type: 'answer',
      id: 'answer-legacy-v2',
      title: '第二版回答',
      content: '第二版旧回答。',
      createdAt: '2026-04-30T08:02:00.000Z',
      updatedAt: '2026-04-30T08:02:00.000Z',
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
    createdAt: '2026-04-30T09:00:00.000Z',
    updatedAt: '2026-04-30T09:00:00.000Z',
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
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-current-answer-editor',
    createNode({
      type: 'question',
      id: 'question-current-answer-editor',
      title: '目标问题',
      content: '验证当前回答语义。',
      currentAnswerId: 'answer-editor-current',
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
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
      createdAt: '2026-04-30T09:01:00.000Z',
      updatedAt: '2026-04-30T09:01:00.000Z',
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
      createdAt: '2026-04-30T09:02:00.000Z',
      updatedAt: '2026-04-30T09:02:00.000Z',
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
      createdAt: '2026-04-30T09:03:00.000Z',
      updatedAt: '2026-04-30T09:03:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createCurrentAnswerDeletionSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '当前回答删除回退',
    workspaceId: 'workspace-current-answer-delete',
    rootId: 'theme-current-answer-delete',
    createdAt: '2026-04-30T09:30:00.000Z',
    updatedAt: '2026-04-30T09:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-current-answer-delete',
      title: '删除模块',
      content: '',
      createdAt: '2026-04-30T09:30:00.000Z',
      updatedAt: '2026-04-30T09:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-current-answer-delete',
    createNode({
      type: 'question',
      id: 'question-current-answer-delete',
      title: '删除当前回答',
      content: '删除当前回答后应该回退到上一条。',
      currentAnswerId: 'answer-delete-current',
      createdAt: '2026-04-30T09:30:00.000Z',
      updatedAt: '2026-04-30T09:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-delete',
    createNode({
      type: 'answer',
      id: 'answer-delete-previous',
      title: '第一版回答',
      content: '前一条幸存回答。',
      createdAt: '2026-04-30T09:31:00.000Z',
      updatedAt: '2026-04-30T09:31:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-delete',
    createNode({
      type: 'answer',
      id: 'answer-delete-current',
      title: '当前回答',
      content: '这条当前回答会被删除。',
      createdAt: '2026-04-30T09:32:00.000Z',
      updatedAt: '2026-04-30T09:32:00.000Z',
    }),
  );

  tree = insertChildNode(
    tree,
    'question-current-answer-delete',
    createNode({
      type: 'judgment',
      id: 'judgment-delete-current',
      title: '判断：当前回答还可再补',
      content: '这条判断应该跟着当前回答一起消失。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-delete-current',
      sourceAnswerUpdatedAt: '2026-04-30T09:32:00.000Z',
      createdAt: '2026-04-30T09:33:00.000Z',
      updatedAt: '2026-04-30T09:33:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-current-answer-delete',
    createNode({
      type: 'summary',
      id: 'summary-delete-current',
      title: '标准理解',
      content: '这条答案解析也应该跟着当前回答一起消失。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-delete-current',
      sourceAnswerUpdatedAt: '2026-04-30T09:32:00.000Z',
      createdAt: '2026-04-30T09:34:00.000Z',
      updatedAt: '2026-04-30T09:34:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createVisibilityResultSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '语义可见性',
    workspaceId: 'workspace-visibility-results',
    rootId: 'theme-visibility-results',
    createdAt: '2026-04-30T10:00:00.000Z',
    updatedAt: '2026-04-30T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-visibility-results',
      title: '可见性模块',
      content: '',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-visibility-results',
    createNode({
      type: 'question',
      id: 'question-visibility-results',
      title: '验证结果可见性',
      content: '当前回答、历史结果、过期结果和配对关系都应该看得见。',
      currentAnswerId: 'answer-visibility-v2',
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'answer',
      id: 'answer-visibility-v1',
      title: '第一版回答',
      content: '旧回答。',
      createdAt: '2026-04-30T10:01:00.000Z',
      updatedAt: '2026-04-30T10:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'judgment',
      id: 'judgment-visibility-v1',
      title: '判断：第一版回答仍有缺口',
      content: '这是旧回答的旧结果。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-visibility-v1',
      sourceAnswerUpdatedAt: '2026-04-30T10:01:00.000Z',
      createdAt: '2026-04-30T10:02:00.000Z',
      updatedAt: '2026-04-30T10:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'answer',
      id: 'answer-visibility-v2',
      title: '第二版回答',
      content: '当前回答已经改过，但结果还没重评。',
      createdAt: '2026-04-30T10:05:00.000Z',
      updatedAt: '2026-04-30T10:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'judgment',
      id: 'judgment-visibility-v2',
      title: '判断：第二版回答还可更完整',
      content: '这是当前回答的当前判断结果，但已经过期。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-visibility-v2',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      createdAt: '2026-04-30T10:04:00.000Z',
      updatedAt: '2026-04-30T10:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'summary',
      id: 'summary-visibility-v2',
      title: '标准理解',
      content: '这是当前回答的当前答案解析，但也已经过期。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-visibility-v2',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      createdAt: '2026-04-30T10:04:30.000Z',
      updatedAt: '2026-04-30T10:04:30.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'summary',
      id: 'summary-summary-check-source',
      title: '手写总结',
      content: '这段总结后来被用户改过，所以旧检查结果会过期。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T10:06:00.000Z',
      updatedAt: '2026-04-30T10:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-check-old',
      title: '判断：第一次总结检查',
      content: '这是更早一轮的总结检查结果。',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-visibility-v2',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      sourceSummaryId: 'summary-summary-check-source',
      sourceSummaryUpdatedAt: '2026-04-30T10:05:00.000Z',
      createdAt: '2026-04-30T10:05:30.000Z',
      updatedAt: '2026-04-30T10:05:30.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-visibility-results',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-check-current',
      title: '判断：当前总结检查',
      content: '这是最新一轮总结检查结果，但现在已经过期。',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-visibility-v2',
      sourceAnswerUpdatedAt: '2026-04-30T10:03:00.000Z',
      sourceSummaryId: 'summary-summary-check-source',
      sourceSummaryUpdatedAt: '2026-04-30T10:05:00.000Z',
      createdAt: '2026-04-30T10:06:30.000Z',
      updatedAt: '2026-04-30T10:06:30.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createSummaryTypeSwitchCascadeSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '总结切型清理',
    workspaceId: 'workspace-summary-type-switch',
    rootId: 'theme-summary-type-switch',
    createdAt: '2026-04-30T11:00:00.000Z',
    updatedAt: '2026-04-30T11:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-summary-type-switch',
      title: '总结模块',
      content: '',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-summary-type-switch',
    createNode({
      type: 'question',
      id: 'question-summary-type-switch',
      title: '总结切型问题',
      content: '',
      createdAt: '2026-04-30T11:00:00.000Z',
      updatedAt: '2026-04-30T11:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-type-switch',
    createNode({
      type: 'answer',
      id: 'answer-summary-switch-current',
      title: '当前回答',
      content: '用来提供总结检查上下文。',
      createdAt: '2026-04-30T11:01:00.000Z',
      updatedAt: '2026-04-30T11:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-type-switch',
    createNode({
      type: 'summary',
      id: 'summary-switch-source',
      title: '手写总结',
      content: '这条总结一旦切型，检查结果就该跟着消失。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T11:02:00.000Z',
      updatedAt: '2026-04-30T11:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-type-switch',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-switch-result',
      title: '判断：总结检查结果',
      content: '这条结果应该跟手写总结一起失效。',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-summary-switch-current',
      sourceAnswerUpdatedAt: '2026-04-30T11:01:00.000Z',
      sourceSummaryId: 'summary-switch-source',
      sourceSummaryUpdatedAt: '2026-04-30T11:02:00.000Z',
      createdAt: '2026-04-30T11:03:00.000Z',
      updatedAt: '2026-04-30T11:03:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createCrossQuestionMoveSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '跨题移动清理',
    workspaceId: 'workspace-cross-question',
    rootId: 'theme-cross-question',
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-cross-question',
      title: '跨题模块',
      content: '',
      createdAt: '2026-04-30T12:00:00.000Z',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-cross-question',
    createNode({
      type: 'question',
      id: 'question-cross-question-a',
      title: '问题 A',
      content: '',
      currentAnswerId: 'answer-cross-question-a',
      createdAt: '2026-04-30T12:00:00.000Z',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-cross-question-a',
    createNode({
      type: 'answer',
      id: 'answer-cross-question-a',
      title: 'A 的回答',
      content: '这条回答会被移动到问题 B。',
      createdAt: '2026-04-30T12:01:00.000Z',
      updatedAt: '2026-04-30T12:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-cross-question-a',
    createNode({
      type: 'judgment',
      id: 'judgment-cross-question-a',
      title: '判断：A 的闭环结果',
      content: '移动后这条结果应该消失。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-cross-question-a',
      sourceAnswerUpdatedAt: '2026-04-30T12:01:00.000Z',
      createdAt: '2026-04-30T12:02:00.000Z',
      updatedAt: '2026-04-30T12:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-cross-question-a',
    createNode({
      type: 'summary',
      id: 'summary-cross-question-a',
      title: '标准理解：A',
      content: '移动后这条答案解析也应该消失。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-cross-question-a',
      sourceAnswerUpdatedAt: '2026-04-30T12:01:00.000Z',
      createdAt: '2026-04-30T12:03:00.000Z',
      updatedAt: '2026-04-30T12:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-cross-question',
    createNode({
      type: 'question',
      id: 'question-cross-question-b',
      title: '问题 B',
      content: '',
      createdAt: '2026-04-30T12:04:00.000Z',
      updatedAt: '2026-04-30T12:04:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createUnnamedVisibilitySnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '未命名可见性回退',
    workspaceId: 'workspace-unnamed-visibility',
    rootId: 'theme-unnamed-visibility',
    createdAt: '2026-04-30T12:30:00.000Z',
    updatedAt: '2026-04-30T12:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-unnamed-visibility',
      title: '未命名模块',
      content: '',
      createdAt: '2026-04-30T12:30:00.000Z',
      updatedAt: '2026-04-30T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-unnamed-visibility',
    createNode({
      type: 'question',
      id: 'question-unnamed-visibility',
      title: '未命名回退问题',
      content: '',
      currentAnswerId: 'answer-unnamed-current',
      createdAt: '2026-04-30T12:30:00.000Z',
      updatedAt: '2026-04-30T12:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-unnamed-visibility',
    createNode({
      type: 'answer',
      id: 'answer-unnamed-current',
      title: '',
      content: '',
      createdAt: '2026-04-30T12:31:00.000Z',
      updatedAt: '2026-04-30T12:31:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-unnamed-visibility',
    createNode({
      type: 'summary',
      id: 'summary-unnamed-answer-result',
      title: '标准理解',
      content: '验证未命名回答的配对文案。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-unnamed-current',
      sourceAnswerUpdatedAt: '2026-04-30T12:31:00.000Z',
      createdAt: '2026-04-30T12:32:00.000Z',
      updatedAt: '2026-04-30T12:32:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-unnamed-visibility',
    createNode({
      type: 'summary',
      id: 'summary-unnamed-source',
      title: '',
      content: '验证未命名总结的检查对象文案。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T12:33:00.000Z',
      updatedAt: '2026-04-30T12:33:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-unnamed-visibility',
    createNode({
      type: 'judgment',
      id: 'judgment-unnamed-summary-result',
      title: '判断：总结检查',
      content: '验证未命名总结的配对对象文案。',
      judgmentKind: 'summary-check',
      sourceAnswerId: 'answer-unnamed-current',
      sourceAnswerUpdatedAt: '2026-04-30T12:31:00.000Z',
      sourceSummaryId: 'summary-unnamed-source',
      sourceSummaryUpdatedAt: '2026-04-30T12:33:00.000Z',
      createdAt: '2026-04-30T12:34:00.000Z',
      updatedAt: '2026-04-30T12:34:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
