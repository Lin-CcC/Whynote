import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

test('checks a manual summary through summary-evaluation instead of question closure', async () => {
  const observedTaskNames: string[] = [];
  const dependencies = await createPreloadedDependencies(
    createManualSummaryCheckSnapshot(),
    createTrackingProviderClient(
      {
        'summary-evaluation': {
          judgment: {
            title: '判断：这段总结还可再补',
            correctPoints: '你已经抓到了“先收集再统一提交”这条主线。',
            missingPoints: ['还没有说明为什么统一提交会减少重复渲染。'],
            possibleMisunderstandings: ['“更快”像性能结论，但没有交代它和渲染次数之间的关系。'],
            nextFocus: '先把“统一提交 -> 减少重复渲染”这条因果链补完整。',
          },
          hint: {
            focus: '先补清楚统一提交为什么会减少重复渲染',
            background: '关键不在“更快”两个字，而在于界面不必为同一轮里的每次更新都单独提交一次。',
            thinkingQuestion: '如果每次更新都立刻提交，界面会多出哪一步重复工作？',
          },
        },
      },
      observedTaskNames,
    ),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.focus(screen.getByLabelText('手写总结 标题'));

  const callout = await screen.findByTestId('summary-evaluation-callout');

  expect(
    within(callout).getByRole('button', { name: '检查这个总结' }),
  ).toBeEnabled();

  fireEvent.click(within(callout).getByRole('button', { name: '检查这个总结' }));

  expect(
    await screen.findByDisplayValue('判断：这段总结还可再补'),
  ).toBeInTheDocument();
  expect(
    await screen.findByTestId('summary-evaluation-result-callout'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '回到这个总结继续修改' }),
  ).toBeInTheDocument();
  expect(observedTaskNames).toContain('summary-evaluation');
  expect(observedTaskNames).not.toContain('question-closure');

  const savedSnapshot = await waitForSavedSnapshot(
    dependencies.structuredDataStorage,
    (snapshot) => findNodeByTitle(snapshot, '判断：这段总结还可再补') !== null,
  );
  const judgmentNode = findNodeByTitle(savedSnapshot, '判断：这段总结还可再补');
  const answerNode = savedSnapshot.tree.nodes['answer-summary-check'];
  const summaryNode = savedSnapshot.tree.nodes['summary-summary-check'];

  expect(judgmentNode?.type).toBe('judgment');
  expect(judgmentNode?.type === 'judgment' ? judgmentNode.judgmentKind : null).toBe(
    'summary-check',
  );
  expect(judgmentNode?.type === 'judgment' ? judgmentNode.hint : null).toContain(
    '先补哪块',
  );
  expect(judgmentNode).toMatchObject({
    type: 'judgment',
    sourceAnswerId: 'answer-summary-check',
    sourceAnswerUpdatedAt: answerNode?.updatedAt,
    sourceSummaryId: 'summary-summary-check',
    sourceSummaryUpdatedAt: summaryNode?.updatedAt,
  });
});

async function createPreloadedDependencies(
  snapshot: WorkspaceSnapshot,
  providerClient: AiProviderClient,
) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-summary-check-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);
  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-summary-check-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(_config: AiConfig) {
      return providerClient;
    },
    defaultLearningMode: 'standard',
  } satisfies WorkspaceRuntimeDependencies;
}

function createTrackingProviderClient(
  payloadByTaskName: Record<string, unknown>,
  observedTaskNames: string[],
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      observedTaskNames.push(request.taskName);
      const payload = payloadByTaskName[request.taskName] ?? {};
      const rawText =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

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

function createManualSummaryCheckSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '手写总结检查',
    workspaceId: 'workspace-summary-check',
    rootId: 'theme-summary-check',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-summary-check',
      title: '理解批处理',
      content: '验证手写 summary 的理解检查。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-summary-check',
    createNode({
      type: 'plan-step',
      id: 'step-summary-check',
      title: '先写一版自己的总结',
      content: '不要直接拿答案解析，先让用户自己总结一版。',
      status: 'doing',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-summary-check',
    createNode({
      type: 'question',
      id: 'question-summary-check',
      title: '为什么同一轮更新会被统一提交？',
      content: '请解释它为什么能减少重复渲染。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-check',
    createNode({
      type: 'answer',
      id: 'answer-summary-check',
      title: '当前回答',
      content: '因为 React 会把同一轮里的更新先收集起来。',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-summary-check',
    createNode({
      type: 'summary',
      id: 'summary-summary-check',
      title: '手写总结',
      content: '批处理就是把更新放一起，所以会更快。',
      summaryKind: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
