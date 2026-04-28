import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import {
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
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

test('reuses an existing fragment for an answer citation, persists it after remount, and keeps the focus chain usable', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceCitationSnapshot(),
  );
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  expect(await screen.findByDisplayValue('资料引用模块')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '回答批处理答案' }));
  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 官方文档' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');

  fireEvent.change(resourceFocusCard.getByLabelText('引用片段正文'), {
    target: {
      value: 'React 会把多个 state 更新批处理后再统一提交。',
    },
  });
  fireEvent.change(resourceFocusCard.getByLabelText('引用片段定位信息'), {
    target: {
      value: 'useState > batching',
    },
  });
  fireEvent.click(resourceFocusCard.getByRole('button', { name: '引用当前资料' }));

  const citationSection = await findSectionByHeading('当前学习节点引用');
  const reusedFocusCard = await findSectionByHeading('当前资料焦点');

  expect(citationSection.getByText('补充来源')).toBeInTheDocument();
  expect(citationSection.getByText('摘录引用')).toBeInTheDocument();
  expect(
    citationSection.getByText('React 官方文档 / 批处理摘录'),
  ).toBeInTheDocument();
  expect(reusedFocusCard.getByText('摘录 · 批处理摘录')).toBeInTheDocument();
  expect(screen.getByText('被引用 1 次')).toBeInTheDocument();
  await waitForSaved();

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(await screen.findByDisplayValue('资料引用模块')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '回答批处理答案' }));

  const restoredCitationSection = await findSectionByHeading('当前学习节点引用');

  expect(restoredCitationSection.getByText('补充来源')).toBeInTheDocument();
  fireEvent.click(
    restoredCitationSection.getByRole('button', { name: '定位到摘录' }),
  );

  const restoredFocusCard = await findSectionByHeading('当前资料焦点');

  expect(restoredFocusCard.getByText('摘录 · 批处理摘录')).toBeInTheDocument();
  expect(
    restoredFocusCard.getByText('React 会把多个 state 更新批处理后再统一提交。'),
  ).toBeInTheDocument();
});

test('falls back to a resource-level citation when runtime cannot resolve a stable fragment', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceCitationSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  expect(await screen.findByDisplayValue('资料引用模块')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '回答批处理答案' }));
  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 官方文档' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');

  fireEvent.change(resourceFocusCard.getByLabelText('引用片段正文'), {
    target: {
      value: '这段描述没有稳定对应到现有摘录。',
    },
  });
  fireEvent.change(resourceFocusCard.getByLabelText('引用片段定位信息'), {
    target: {
      value: 'unknown',
    },
  });
  fireEvent.click(resourceFocusCard.getByRole('button', { name: '引用当前资料' }));

  const citationSection = await findSectionByHeading('当前学习节点引用');
  const fallbackFocusCard = await findSectionByHeading('当前资料焦点');

  expect(citationSection.getByText('补充来源')).toBeInTheDocument();
  expect(citationSection.getByText('资料级引用')).toBeInTheDocument();
  expect(citationSection.getAllByText('React 官方文档')).toHaveLength(2);
  expect(
    citationSection.getByText('这段描述没有稳定对应到现有摘录。'),
  ).toBeInTheDocument();
  expect(
    citationSection.queryByText('关于 useState 和批处理的资料概况。'),
  ).not.toBeInTheDocument();
  expect(
    citationSection.getByRole('button', { name: '定位到资料' }),
  ).toBeInTheDocument();
  expect(fallbackFocusCard.getByText('资料 · React 官方文档')).toBeInTheDocument();
  expect(
    fallbackFocusCard.queryByText('摘录 · 批处理摘录'),
  ).not.toBeInTheDocument();
});

function createTestDependencies(options?: {
  storage?: StructuredDataStorage;
}): WorkspaceRuntimeDependencies {
  const storage =
    options?.storage ??
    createIndexedDbStorage({
      databaseName: `whynote-runtime-resource-citation-${crypto.randomUUID()}`,
    });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-resource-citation-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    defaultLearningMode: 'standard',
  };
}

async function createPreloadedDependencies(snapshot: WorkspaceSnapshot) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-resource-citation-preloaded-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);

  return createTestDependencies({
    storage,
  });
}

function createResourceCitationSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '资料引用主题',
    workspaceId: 'workspace-resource-citation',
    rootId: 'theme-resource-citation',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-resource-citation',
      title: '资料引用模块',
      content: '用于验证学习运行时的 resource / fragment 引用闭环。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-resource-citation',
    createNode({
      type: 'plan-step',
      id: 'step-resource-citation',
      title: '理解批处理',
      content: '回答阶段需要能直接引用资料。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-resource-citation',
    createNode({
      type: 'question',
      id: 'question-resource-citation',
      title: '什么是批处理？',
      content: '理解 React 为什么会合并多次状态更新。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-resource-citation',
    createNode({
      type: 'answer',
      id: 'answer-resource-citation',
      title: '批处理答案',
      content: '回答节点也应该能直接引用资料，而不是只留给问题或总结。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
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
      sourceUri: 'https://react.dev/reference/react/useState',
      mimeType: 'text/html',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用于解释批处理的上下文。',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

async function findSectionByHeading(name: string) {
  const heading = await screen.findByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Unable to find section for heading "${name}".`);
  }

  return within(section);
}

async function waitForSaved() {
  await waitFor(() => {
    expect(screen.getByText('待保存', { selector: 'dd' })).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText('已保存', { selector: 'dd' })).toBeInTheDocument();
  });
}
