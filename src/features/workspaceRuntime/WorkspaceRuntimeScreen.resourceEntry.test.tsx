import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import {
  createIndexedDbStorage,
  createLocalStorageStore,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
  type StructuredDataStorage,
  type WorkspaceSnapshot,
} from '../nodeDomain';
import WorkspaceRuntimeScreen from './WorkspaceRuntimeScreen';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('autofills a resource from url, still allows manual edits, and makes it immediately available to library, search, export, and restore', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return `
          <html>
            <head>
              <title>React Rendering Locality</title>
              <meta
                name="description"
                content="解释局部性如何减少无关重渲染，并帮助判断状态应该放在哪里。"
              />
            </head>
            <body>
              <main>
                <p>这段正文不应该覆盖 description。</p>
              </main>
            </body>
          </html>
        `;
      },
    }),
  );
  const exportProbe = createExportProbe();
  const dependencies = createTestDependencies();
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });
  expect(
    screen.getByRole('button', {
      name: '尝试自动填充（浏览器受限）',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /URL 自动填充目前只是浏览器内的受限尝试：只对少数允许浏览器直接读取的网页可用/,
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '切换到资料区搜索' }));
  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: '局部性',
    },
  });

  expect(screen.getByText('资料区无结果')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('资料来源 URI 或说明'), {
    target: {
      value: 'https://example.com/react-locality',
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: '尝试自动填充（浏览器受限）' }),
  );

  expect(
    await screen.findByDisplayValue('React Rendering Locality'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue(
      '解释局部性如何减少无关重渲染，并帮助判断状态应该放在哪里。',
    ),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('资料标题'), {
    target: {
      value: 'React 渲染局部性笔记',
    },
  });
  fireEvent.change(screen.getByLabelText('资料概况'), {
    target: {
      value: '解释局部性如何减少无关重渲染，并补一条手动修订说明。',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  expect(
    await screen.findByRole('button', {
      name: '定位资料 React 渲染局部性笔记',
    }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('button', {
      name: '跳转到 React 渲染局部性笔记',
    }),
  ).toBeInTheDocument();

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');

  expect(
    resourceFocusCard.getByText('资料 · React 渲染局部性笔记'),
  ).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('https://example.com/react-locality'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '整个主题' }));
  fireEvent.click(screen.getByRole('button', { name: '导出内容' }));

  expect(await exportProbe.readText()).toContain('资料：React 渲染局部性笔记');
  expect(await exportProbe.readText()).toContain(
    '解释局部性如何减少无关重渲染，并补一条手动修订说明。',
  );

  await waitForSaved();

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('button', {
      name: '定位资料 React 渲染局部性笔记',
    }),
  ).toBeInTheDocument();
});

test('keeps manual fallback usable when url autofill fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByLabelText('资料来源 URI 或说明'), {
    target: {
      value: 'https://example.com/blocked',
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: '尝试自动填充（浏览器受限）' }),
  );

  expect(
    await screen.findByText(/受限自动填充未完成：这是浏览器内的受限能力/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/这不代表链接本身无效；请继续手动填写标题和资料概况。/),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('资料标题'), {
    target: {
      value: '手动兜底资料',
    },
  });
  fireEvent.change(screen.getByLabelText('资料概况'), {
    target: {
      value: '自动化失败后仍可手动补齐并提交。',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

  expect(
    await screen.findByRole('button', {
      name: '定位资料 手动兜底资料',
    }),
  ).toBeInTheDocument();
});

test.each([
  {
    content:
      '每次渲染都会形成独立的闭包快照。\n\n如果在旧闭包里读值，就会看到旧状态。\n',
    fileName: 'state-snapshot.txt',
    query: '闭包快照',
    type: 'text/plain',
  },
  {
    content:
      '# React 渲染笔记\n\n先梳理渲染边界，再决定局部状态应该放在哪里。\n',
    fileName: 'rendering-notes.md',
    query: '渲染边界',
    type: 'text/markdown',
  },
])(
  'creates a resource from uploaded local file: $fileName',
  async ({ content, fileName, query, type }) => {
    const exportProbe = createExportProbe();
    const dependencies = createTestDependencies();

    render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

    await screen.findByRole('heading', { name: '当前学习模块' });

    fireEvent.change(screen.getByLabelText('本地资料文件'), {
      target: {
        files: [new File([content], fileName, { type })],
      },
    });

    expect(await screen.findByDisplayValue(`本地文件：${fileName}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '创建资料' }));

    fireEvent.click(screen.getByRole('button', { name: '切换到资料区搜索' }));
    fireEvent.change(screen.getByLabelText('搜索关键词'), {
      target: {
        value: query,
      },
    });

    expect(
      await screen.findByRole('button', {
        name: /跳转到 /,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '整个主题' }));
    fireEvent.click(screen.getByRole('button', { name: '导出内容' }));

    expect(await exportProbe.readText()).toContain('资料：');
    expect(await exportProbe.readText()).toContain(`本地文件：${fileName}`);
  },
);

test('creates a fragment under the chosen resource, persists sourceResourceId, and restores it after remount', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceParentSnapshot(),
  );
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByLabelText('摘录标题'), {
    target: {
      value: '状态快照摘录',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录正文'), {
    target: {
      value: 'Hooks 会捕获创建该渲染时的状态快照。',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录定位信息'), {
    target: {
      value: 'Hooks FAQ > 状态快照',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建摘录' }));

  expect(
    await screen.findByRole('button', { name: '定位摘录 状态快照摘录' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '切换到资料区搜索' }));
  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: '状态快照',
    },
  });

  expect(
    await screen.findByRole('button', { name: '跳转到 状态快照摘录' }),
  ).toBeInTheDocument();

  await waitForSaved();

  const restoredSnapshot = await loadOnlyWorkspaceSnapshot(dependencies);
  const fragmentNode = findNodeByTitle(
    restoredSnapshot.tree,
    '状态快照摘录',
    'resource-fragment',
  );

  expect(fragmentNode.parentId).toBe('resource-runtime-parent');
  expect(fragmentNode.sourceResourceId).toBe('resource-runtime-parent');

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('button', { name: '定位摘录 状态快照摘录' }),
  ).toBeInTheDocument();
});

test('surfaces newly created fragments in the active search scope without refresh and keeps the focus chain usable', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceParentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(screen.getByRole('button', { name: '切换到资料区搜索' }));
  fireEvent.change(screen.getByLabelText('搜索关键词'), {
    target: {
      value: '闭包快照',
    },
  });

  expect(screen.getByText('资料区无结果')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('摘录标题'), {
    target: {
      value: '闭包快照摘录',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录正文'), {
    target: {
      value: '闭包快照会捕获当前渲染里的状态值。',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录定位信息'), {
    target: {
      value: 'Hooks FAQ > 闭包',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建摘录' }));

  fireEvent.click(
    await screen.findByRole('button', { name: '跳转到 闭包快照摘录' }),
  );

  const resourceFocusCard = await findSectionByHeading('当前资料焦点');

  expect(resourceFocusCard.getByText('摘录 · 闭包快照摘录')).toBeInTheDocument();
  expect(
    resourceFocusCard.getByText('闭包快照会捕获当前渲染里的状态值。'),
  ).toBeInTheDocument();
  expect(resourceFocusCard.getByText('Hooks FAQ > 闭包')).toBeInTheDocument();
});

test('updates the default fragment parent when resource focus changes and no manual override exists', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceParentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 渲染原理' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-rendering',
  );

  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React Hooks 参考' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-parent',
  );
});

test('maps fragment focus back to its parent resource and creates the fragment under that parent', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceParentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: '定位摘录 现有状态摘录' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-parent',
  );

  fireEvent.change(screen.getByLabelText('摘录标题'), {
    target: {
      value: '派生状态摘录',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录正文'), {
    target: {
      value: '派生状态应该尽量在渲染时按需计算。',
    },
  });
  fireEvent.change(screen.getByLabelText('摘录定位信息'), {
    target: {
      value: 'React Docs > derived state',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建摘录' }));

  await waitForSaved();

  const restoredSnapshot = await loadOnlyWorkspaceSnapshot(dependencies);
  const fragmentNode = findNodeByTitle(
    restoredSnapshot.tree,
    '派生状态摘录',
    'resource-fragment',
  );

  expect(fragmentNode.parentId).toBe('resource-runtime-parent');
  expect(fragmentNode.sourceResourceId).toBe('resource-runtime-parent');
});

test('keeps a manually selected fragment parent when resource focus changes afterwards', async () => {
  const dependencies = await createPreloadedDependencies(
    createResourceParentSnapshot(),
  );

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 渲染原理' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-rendering',
  );

  fireEvent.change(screen.getByLabelText('摘录所属资料'), {
    target: {
      value: 'resource-runtime-parent',
    },
  });
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-parent',
  );

  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React Hooks 参考' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-parent',
  );

  fireEvent.click(
    screen.getByRole('button', { name: '定位资料 React 渲染原理' }),
  );
  expect(screen.getByLabelText('摘录所属资料')).toHaveValue(
    'resource-runtime-parent',
  );
});

function createTestDependencies(options?: {
  storage?: StructuredDataStorage;
}): WorkspaceRuntimeDependencies {
  const storage =
    options?.storage ??
    createIndexedDbStorage({
      databaseName: `whynote-runtime-resource-entry-${crypto.randomUUID()}`,
    });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-resource-entry-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient() {
      return {
        async generateObject(request) {
          const rawText = JSON.stringify({ planSteps: [] });

          return {
            taskName: request.taskName,
            content: request.parse(rawText),
            model: 'mock-model',
            providerLabel: 'mock-provider',
            rawText,
          };
        },
      };
    },
    defaultLearningMode: 'standard',
  };
}

async function createPreloadedDependencies(snapshot: WorkspaceSnapshot) {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-resource-entry-preloaded-${crypto.randomUUID()}`,
  });

  await storage.saveWorkspace(snapshot);

  return createTestDependencies({
    storage,
  });
}

function createResourceParentSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '资料入口主题',
    workspaceId: 'workspace-runtime-resource-entry',
    rootId: 'theme-runtime-resource-entry',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-runtime-parent',
      title: '资料入口模块',
      content: '用于验证资源入口不会影响模块编辑。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-runtime-parent',
    createNode({
      type: 'plan-step',
      id: 'step-runtime-parent',
      title: '理解资料入口',
      content: '保持一个稳定的模块内编辑焦点。',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-runtime-parent',
      title: 'React Hooks 参考',
      content: '用于承接摘录创建的父资源。',
      sourceUri: 'https://react.dev/reference/react/hooks',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-runtime-rendering',
      title: 'React 渲染原理',
      content: '用于验证资料焦点变化时默认父资源是否同步更新。',
      sourceUri: 'https://react.dev/learn/render-and-commit',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-runtime-parent',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-runtime-parent',
      title: '现有状态摘录',
      content: '用于验证 fragment 焦点会回落到父 resource。',
      excerpt: '状态更新会在下一次渲染中体现。',
      locator: 'Hooks FAQ > state updates',
      sourceResourceId: 'resource-runtime-parent',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function createExportProbe() {
  let exportedBlob: Blob | null = null;

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) {
      throw new Error('expected export content to be materialized as Blob');
    }

    exportedBlob = blob;
    return 'blob:resource-entry-export';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  return {
    async readText() {
      if (!exportedBlob) {
        throw new Error('export blob was not created');
      }

      return exportedBlob.text();
    },
  };
}

async function loadOnlyWorkspaceSnapshot(
  dependencies: WorkspaceRuntimeDependencies,
) {
  const workspaces = await dependencies.structuredDataStorage.listWorkspaces();

  if (workspaces.length !== 1) {
    throw new Error(`expected exactly one workspace, received ${String(workspaces.length)}`);
  }

  const snapshot = await dependencies.structuredDataStorage.loadWorkspace(
    workspaces[0].id,
  );

  if (!snapshot) {
    throw new Error('expected workspace snapshot to exist');
  }

  return snapshot;
}

function findNodeByTitle<TNodeType extends NodeTree['nodes'][string]['type']>(
  tree: NodeTree,
  title: string,
  nodeType: TNodeType,
) {
  const matchedNode = Object.values(tree.nodes).find(
    (node) => node.type === nodeType && node.title === title,
  );

  if (!matchedNode) {
    throw new Error(`unable to find ${nodeType} node titled "${title}"`);
  }

  return matchedNode as Extract<NodeTree['nodes'][string], { type: TNodeType }>;
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
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });
}
