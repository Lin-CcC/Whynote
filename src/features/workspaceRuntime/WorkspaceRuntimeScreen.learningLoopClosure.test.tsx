import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import type {
  AiConfig,
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from '../learningEngine';
import {
  createNode,
  createIndexedDbStorage,
  createLocalStorageStore,
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

test('evaluates an incomplete answer into judgment, summary and follow-up question with persisted citations', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：回答还不完整',
          content: '你还没有解释为什么更新会被批处理。',
          citations: [{ targetNodeId: 'resource-react-docs' }],
        },
        summary: {
          title: '总结：标准理解',
          content:
            'React 会把同一轮事件中的多个状态更新合并后再统一提交，这样可以减少重复渲染。',
          citations: [{ targetNodeId: 'fragment-batching' }],
        },
        followUpQuestions: [
          {
            title: '追问：还缺哪一步因果关系？',
            content: '请只补上为什么会减少重复渲染。',
          },
        ],
      },
    }),
  );

  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: /^问题为什么状态更新会被批处理？$/ }),
  );
  fireEvent.click(screen.getByRole('button', { name: '评估当前回答' }));

  expect(
    await screen.findByDisplayValue('判断：回答还不完整'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('总结：标准理解'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => findNodeByTitle(snapshot, '判断：回答还不完整') !== null,
  );
  const judgmentNode = findNodeByTitle(savedSnapshot, '判断：回答还不完整');
  const summaryNode = findNodeByTitle(savedSnapshot, '总结：标准理解');
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(judgmentNode?.referenceIds).toHaveLength(1);
  expect(summaryNode?.referenceIds).toHaveLength(1);
  expect(
    savedSnapshot.tree.references[judgmentNode!.referenceIds[0]].targetNodeId,
  ).toBe('resource-react-docs');
  expect(
    savedSnapshot.tree.references[summaryNode!.referenceIds[0]].targetNodeId,
  ).toBe('fragment-batching');
  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('doing');

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();
});

test('allows evaluating a leaf question while the answer node is selected', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: false,
        judgment: {
          title: '判断：回答还不完整',
          content: '你还没有解释为什么更新会被批处理。',
        },
        summary: {
          title: '总结：标准理解',
          content:
            'React 会把同一轮事件中的多个状态更新合并后再统一提交，这样可以减少重复渲染。',
        },
        followUpQuestions: [
          {
            title: '追问：还缺哪一步因果关系？',
            content: '请只补上为什么会减少重复渲染。',
          },
        ],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('回答草稿 标题'));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '评估当前回答' })).toBeEnabled();
  });

  fireEvent.click(screen.getByRole('button', { name: '评估当前回答' }));

  expect(
    await screen.findByDisplayValue('判断：回答还不完整'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('追问：还缺哪一步因果关系？'),
  ).toBeInTheDocument();
});

test('evaluates a sufficient answer into a closed question and promotes the step to done', async () => {
  const dependencies = await createPreloadedDependencies(
    createAnswerClosureSnapshot(),
    createMockProviderClient({
      'question-closure': {
        isAnswerSufficient: true,
        judgment: {
          title: '判断：已答到当前问题',
          content: '回答已经覆盖当前问题的关键点。',
        },
        summary: {
          title: '总结：标准理解',
          content:
            '批处理会把同一轮事件中的多次更新合并提交，从而减少不必要的重复渲染。',
          citations: [{ targetNodeId: 'fragment-batching' }],
        },
        followUpQuestions: [],
      },
    }),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: /^问题为什么状态更新会被批处理？$/ }),
  );
  fireEvent.click(screen.getByRole('button', { name: '评估当前回答' }));

  expect(
    await screen.findByDisplayValue('判断：已答到当前问题'),
  ).toBeInTheDocument();
  expect(
    await screen.findByDisplayValue('总结：标准理解'),
  ).toBeInTheDocument();

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => {
      const stepNode = snapshot.tree.nodes['step-answer-closure'];

      return stepNode?.type === 'plan-step' && stepNode.status === 'done';
    },
  );
  const stepNode = savedSnapshot.tree.nodes['step-answer-closure'];

  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('done');
  expect(
    Object.values(savedSnapshot.tree.nodes).some(
      (node) => node.title === '追问：还缺哪一步因果关系？',
    ),
  ).toBe(false);
});

test('preserves a manual step status override across save and reload', async () => {
  const dependencies = await createPreloadedDependencies(
    createManualStatusSnapshot(),
  );
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByRole('combobox', { name: '起始步骤 的步骤状态' }), {
    target: {
      value: 'done',
    },
  });

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => {
      const stepNode = snapshot.tree.nodes['step-manual-status'];

      return stepNode?.type === 'plan-step' && stepNode.status === 'done';
    },
  );
  const stepNode = savedSnapshot.tree.nodes['step-manual-status'];

  expect(stepNode.type).toBe('plan-step');
  expect(stepNode.type === 'plan-step' ? stepNode.status : null).toBe('done');

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('combobox', { name: '起始步骤 的步骤状态' }),
  ).toHaveValue('done');
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  providerClient?: AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-learning-loop-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-learning-loop-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      return providerClient ?? createMockProviderClient({}, config);
    },
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createMockProviderClient(
  payloadByTaskName: Record<string, unknown>,
  _config?: AiConfig,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName] ?? {};
      const rawText = JSON.stringify(payload);

      return {
        taskName: request.taskName,
        content: request.parse(rawText) as T,
        model: 'mock-model',
        providerLabel: 'mock-provider',
        rawText,
      };
    },
  };
}

async function waitForSavedSnapshot(
  storage: StructuredDataStorage,
  predicate: (snapshot: WorkspaceSnapshot) => boolean,
): Promise<WorkspaceSnapshot> {
  let latestSnapshot: WorkspaceSnapshot | null = null;

  await waitFor(async () => {
    const workspaces = await storage.listWorkspaces();

    latestSnapshot = await storage.loadWorkspace(workspaces[0].id);
    expect(latestSnapshot).not.toBeNull();
    expect(predicate(latestSnapshot!)).toBe(true);
  });

  if (!latestSnapshot) {
    throw new Error('Expected saved snapshot to exist.');
  }

  return latestSnapshot;
}

function findNodeByTitle(snapshot: WorkspaceSnapshot, title: string) {
  return Object.values(snapshot.tree.nodes).find((node) => node.title === title) ?? null;
}

function createAnswerClosureSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '学习闭环主题',
    workspaceId: 'workspace-answer-closure',
    rootId: 'theme-answer-closure',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-answer-closure',
      title: '理解批处理',
      content: '验证回答后的最小闭环。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-answer-closure',
    createNode({
      type: 'plan-step',
      id: 'step-answer-closure',
      title: '理解批处理为什么成立',
      content: '先让用户回答，再由系统评估和推进。',
      status: 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-closure',
    createNode({
      type: 'summary',
      id: 'intro-answer-closure',
      title: '铺垫：先知道什么叫批处理',
      content: '先说明它发生在同一轮事件处理里，再进入判断题。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-answer-closure',
    createNode({
      type: 'question',
      id: 'question-answer-closure',
      title: '为什么状态更新会被批处理？',
      content: '请解释它为什么能减少重复渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-answer-closure',
    createNode({
      type: 'answer',
      id: 'answer-answer-closure',
      title: '回答草稿',
      content: '因为 React 会把多个更新放在一起。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 useState 和批处理的资料概况。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用于支撑回答评估。',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createManualStatusSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手动状态主题',
    workspaceId: 'workspace-manual-status',
    rootId: 'theme-manual-status',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-manual-status',
      title: '状态模块',
      content: '验证手动状态跨保存保留。',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-manual-status',
    createNode({
      type: 'plan-step',
      id: 'step-manual-status',
      title: '起始步骤',
      content: '这里只有骨架，没有真实学习证据。',
      status: 'todo',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-manual-status',
    createNode({
      type: 'question',
      id: 'question-manual-status',
      title: '起始问题',
      content: '',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
