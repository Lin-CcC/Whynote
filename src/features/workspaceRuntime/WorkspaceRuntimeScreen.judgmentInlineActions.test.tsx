import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import type {
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from '../learningEngine';
import {
  addNodeReference,
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
  createNodeReference,
  createWorkspaceSnapshot,
  insertChildNode,
  type StructuredDataStorage,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceRuntimeScreen from './WorkspaceRuntimeScreen';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('renders inline judgment actions and generates a hint that stays distinct from the explanation while exposing hint citations', async () => {
  let taskCount = 0;
  const dependencies = await createPreloadedDependencies(
    createJudgmentInlineSnapshot(),
    () => ({
      async generateObject<T>(
        request: AiProviderObjectRequest<T>,
      ): Promise<AiProviderObjectResponse<T>> {
        taskCount += 1;
        expect(request.taskName).toBe('judgment-hint');

        const rawText = JSON.stringify({
          hint: {
            focus: '为什么会减少重复渲染',
            background:
              '关键不只是“更新被放在一起”，而是这些更新会在同一轮里先收集，再统一提交，所以不必为每次局部变化都单独重跑渲染。',
            thinkingQuestion:
              '如果中间没有“统一提交”这一步，界面为什么会更容易重复计算？',
            citations: [
              {
                targetNodeId: 'fragment-inline-feedback',
                purpose: 'background',
                note: '如果卡住，可以先看资料里解释“统一提交”的那一段。',
                sourceLocator: 'useState > batching',
              },
            ],
          },
        });

        return {
          taskName: request.taskName,
          content: request.parse(rawText) as T,
          rawText,
          model: 'mock-model',
          providerLabel: 'mock-provider',
        };
      },
    } satisfies AiProviderClient),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  const judgmentNode = await screen.findByTestId('editor-node-judgment-inline-primary');
  fireEvent.click(judgmentNode);
  const actions = within(judgmentNode).getByTestId(
    'judgment-inline-actions-judgment-inline-primary',
  );

  expect(
    within(actions).getByRole('button', { name: '给我提示' }),
  ).toBeInTheDocument();
  expect(
    within(actions).getByRole('button', { name: '查看答案解析' }),
  ).toBeInTheDocument();
  expect(
    within(actions).getByRole('button', { name: '回到当前回答继续修改' }),
  ).toBeInTheDocument();

  fireEvent.click(within(actions).getByRole('button', { name: '给我提示' }));

  const hintCallout = await screen.findByTestId(
    'judgment-inline-hint-judgment-inline-primary',
  );

  expect(taskCount).toBe(1);
  expect(hintCallout).toHaveTextContent('微型铺垫');
  expect(hintCallout).toHaveTextContent('先补哪块：为什么会减少重复渲染');
  expect(hintCallout).toHaveTextContent('关键背景：');
  expect(hintCallout).toHaveTextContent('同一轮里先收集，再统一提交');
  expect(hintCallout).toHaveTextContent('可以先想：');
  expect(hintCallout).not.toHaveTextContent('你还缺“为什么会减少重复渲染”这一条因果关系');
  expect(hintCallout).not.toHaveTextContent(
    '标准理解：React 会先收集同一轮事件里的更新，再统一提交，因此可以减少重复渲染。',
  );

  expect(await screen.findByText('提示里可参考的资料')).toBeInTheDocument();
  expect(screen.getByText('为什么会减少重复渲染')).toBeInTheDocument();
  expect(screen.getByText('判断所依据的资料')).toBeInTheDocument();
});

test('keeps only one primary action in judgment context and explains why answer explanation is disabled', async () => {
  const dependencies = await createPreloadedDependencies(
    createJudgmentInlineSnapshotWithoutSummary(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  const judgmentNode = await screen.findByTestId('editor-node-judgment-inline-primary');
  fireEvent.click(judgmentNode);

  const actions = within(judgmentNode).getByTestId(
    'judgment-inline-actions-judgment-inline-primary',
  );
  const returnButton = within(actions).getByRole('button', {
    name: '回到当前回答继续修改',
  });

  expect(screen.getAllByRole('button', { name: '回到当前回答继续修改' })).toHaveLength(
    1,
  );
  expect(returnButton).toHaveClass('workspace-primaryAction');
  expect(
    within(actions).getByRole('button', { name: '查看答案解析' }),
  ).toBeDisabled();
  expect(
    within(actions).getByText(
      '当前还没有对应的答案解析，所以“查看答案解析”会保持禁用。',
    ),
  ).toBeInTheDocument();
});

test('jumps from judgment to the matching summary and shows it as an answer explanation', async () => {
  const dependencies = await createPreloadedDependencies(
    createJudgmentInlineSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  const judgmentNode = await screen.findByTestId('editor-node-judgment-inline-primary');
  fireEvent.click(judgmentNode);

  fireEvent.click(
    within(judgmentNode).getByRole('button', { name: '查看答案解析' }),
  );

  const summaryNode = await screen.findByTestId('editor-node-summary-inline-primary');

  await waitFor(() => {
    expect(summaryNode).toHaveAttribute('data-node-selected', 'true');
    expect(summaryNode).toHaveFocus();
  });
  expect(within(summaryNode).getByText('答案解析')).toBeInTheDocument();
});

test('returns from judgment to the matching answer instead of stopping on the parent question', async () => {
  const dependencies = await createPreloadedDependencies(
    createMultiAnswerJudgmentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  const currentJudgmentNode = await screen.findByTestId(
    'editor-node-judgment-inline-current',
  );
  fireEvent.click(currentJudgmentNode);

  fireEvent.click(
    within(currentJudgmentNode).getByRole('button', {
      name: '回到当前回答继续修改',
    }),
  );

  const currentAnswerNode = await screen.findByTestId('editor-node-answer-inline-current');
  const questionNode = screen.getByTestId('editor-node-question-inline-root');
  const previousAnswerNode = screen.getByTestId('editor-node-answer-inline-previous');

  await waitFor(() => {
    expect(currentAnswerNode).toHaveAttribute('data-node-selected', 'true');
    expect(currentAnswerNode).toHaveFocus();
  });
  expect(questionNode).toHaveAttribute('data-node-selected', 'false');
  expect(previousAnswerNode).toHaveAttribute('data-node-selected', 'false');
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  createProviderClient?: () => AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-judgment-inline-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-judgment-inline-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    ...(createProviderClient ? { createProviderClient } : {}),
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createJudgmentInlineSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '判断节点内联动作',
    workspaceId: 'workspace-judgment-inline',
    rootId: 'theme-judgment-inline',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-judgment-inline',
      title: '理解批处理',
      content: '验证 judgment 节点上的就地下一步。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-judgment-inline',
    createNode({
      type: 'plan-step',
      id: 'step-judgment-inline',
      title: '先看反馈再改回答',
      content: '让 judgment 直接承接下一步动作。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-judgment-inline',
    createNode({
      type: 'question',
      id: 'question-inline-root',
      title: '为什么状态更新会被批处理？',
      content: '请解释它为什么会减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'answer',
      id: 'answer-inline-primary',
      title: '回答草稿',
      content: '因为 React 会把同一轮里的更新先放在一起。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'judgment',
      id: 'judgment-inline-primary',
      title: '判断：回答还差一点',
      content:
        '已答到的部分：\n- 你已经答到了“更新会先放在一起”这一层。\n\n还缺的关键点：\n1. 你还缺“为什么会减少重复渲染”这一条因果关系。\n\n为什么这些缺口关键：\n- 如果少了统一提交和重复计算之间的因果链，就还是停在现象层。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-primary',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'summary',
      id: 'summary-inline-primary',
      title: '标准理解',
      content:
        '标准理解：React 会先收集同一轮事件里的更新，再统一提交，因此可以减少重复渲染。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-primary',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-inline-feedback',
      title: 'React 官方文档',
      content: '关于 useState batching 的资料概况。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-inline-feedback',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-inline-feedback',
      title: '批处理摘录',
      excerpt: 'React 会先把同一轮事件里的更新收集起来，再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-inline-feedback',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-inline-judgment-support',
      sourceNodeId: 'judgment-inline-primary',
      targetNodeId: 'fragment-inline-feedback',
      focusText: '你还缺“为什么会减少重复渲染”这一条因果关系',
      note: '这里支撑当前缺口判断。',
      purpose: 'judgment',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createJudgmentInlineSnapshotWithoutSummary(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '判断节点内联动作（无答案解析）',
    workspaceId: 'workspace-judgment-inline-no-summary',
    rootId: 'theme-judgment-inline-no-summary',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-judgment-inline',
      title: '理解批处理',
      content: '验证 judgment 节点上的就地下一步。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-judgment-inline',
    createNode({
      type: 'plan-step',
      id: 'step-judgment-inline',
      title: '先看反馈再改回答',
      content: '让 judgment 直接承接下一步动作。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-judgment-inline',
    createNode({
      type: 'question',
      id: 'question-inline-root',
      title: '为什么状态更新会被批处理？',
      content: '请解释它为什么会减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'answer',
      id: 'answer-inline-primary',
      title: '回答草稿',
      content: '因为 React 会把同一轮里的更新先放在一起。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'judgment',
      id: 'judgment-inline-primary',
      title: '判断：回答还差一点',
      content:
        '已答到的部分：\n- 你已经答到了“更新会先放在一起”这一层。\n\n还缺的关键点：\n1. 你还缺“为什么会减少重复渲染”这一条因果关系。\n\n为什么这些缺口关键：\n- 如果少了统一提交和重复计算之间的因果链，就还是停在现象层。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-primary',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createMultiAnswerJudgmentSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '多轮回答定位',
    workspaceId: 'workspace-judgment-inline-multi',
    rootId: 'theme-judgment-inline-multi',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-judgment-inline-multi',
      title: '回答迭代',
      content: '验证 judgment 会回到当前这版回答。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-judgment-inline-multi',
    createNode({
      type: 'plan-step',
      id: 'step-judgment-inline-multi',
      title: '对比两版回答',
      content: '保证 judgment 回跳到对应 answer。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-judgment-inline-multi',
    createNode({
      type: 'question',
      id: 'question-inline-root',
      title: '为什么状态更新会被批处理？',
      content: '请解释它为什么会减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'answer',
      id: 'answer-inline-previous',
      title: '第一版回答',
      content: '因为 React 会先把更新合并起来。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'judgment',
      id: 'judgment-inline-previous',
      title: '判断：第一版还不完整',
      content: '第一版还没有解释为什么会减少重复渲染。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-previous',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'summary',
      id: 'summary-inline-previous',
      title: '第一版标准理解',
      content: '先补齐因果关系，再继续推进。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-previous',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'answer',
      id: 'answer-inline-current',
      title: '第二版回答',
      content: '因为 React 会把同一轮事件里的更新先收集，再统一提交。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'judgment',
      id: 'judgment-inline-current',
      title: '判断：第二版还差最后一步',
      content: '这版只差把“统一提交为什么会减少重复渲染”说透。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-current',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-inline-root',
    createNode({
      type: 'summary',
      id: 'summary-inline-current',
      title: '第二版标准理解',
      content: '同一轮里的更新会被统一提交，所以界面不需要为每次更新都单独重跑渲染。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-inline-current',
      sourceAnswerUpdatedAt: '2026-04-28T00:00:00.000Z',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
