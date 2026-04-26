import { expect, type Page } from '@playwright/test';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../../../src/features/nodeDomain/domain';

const NODE_DATABASE_NAME = 'whynote-node-domain';
const NODE_DATABASE_VERSION = 1;
const RECENT_WORKSPACE_STORAGE_KEY = 'whynote:recent-workspace';

const SMOKE_WORKSPACE_ID = 'workspace-playwright-smoke';
const SMOKE_ROOT_ID = 'theme-playwright-smoke';
const SMOKE_TIMESTAMP = '2026-04-27T10:00:00.000Z';

type WorkspaceSelectionState = {
  currentModuleId: string;
  selectedNodeId: string;
};

type ResourceMetadataRecord = {
  excerpt?: string;
  id: string;
  locator?: string;
  mimeType?: string;
  nodeId: string;
  nodeType: 'resource' | 'resource-fragment';
  sourceResourceId?: string;
  sourceUri?: string;
  title: string;
  updatedAt: string;
  workspaceId: string;
};

export const smokeWorkspaceSelection: WorkspaceSelectionState = {
  currentModuleId: 'module-render-basics',
  selectedNodeId: 'question-render-update',
};

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 2, name: '当前学习模块' }),
  ).toBeVisible();
}

export async function seedWorkspace(
  page: Page,
  snapshot: WorkspaceSnapshot,
  selection: WorkspaceSelectionState,
) {
  const resourceMetadata = collectResourceMetadata(snapshot);

  await page.evaluate(
    async ({ resourceMetadata, selection, snapshot }) => {
      await new Promise<void>((resolve, reject) => {
        const request = window.indexedDB.open(
          'whynote-node-domain',
          1,
        );

        request.onupgradeneeded = () => {
          const database = request.result;

          ensureStore(database, 'workspaces');
          ensureStore(database, 'nodes', 'workspaceId');
          ensureStore(database, 'tags', 'workspaceId');
          ensureStore(database, 'references', 'workspaceId');
          ensureStore(database, 'resourceMetadata', 'workspaceId');
        };
        request.onerror = () => {
          reject(request.error ?? new Error('打开 IndexedDB 失败。'));
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            [
              'workspaces',
              'nodes',
              'tags',
              'references',
              'resourceMetadata',
            ],
            'readwrite',
          );

          transaction.objectStore('workspaces').put(snapshot.workspace);

          for (const node of Object.values(snapshot.tree.nodes)) {
            transaction.objectStore('nodes').put({
              ...node,
              workspaceId: snapshot.workspace.id,
            });
          }

          for (const tag of Object.values(snapshot.tree.tags)) {
            transaction.objectStore('tags').put({
              ...tag,
              workspaceId: snapshot.workspace.id,
            });
          }

          for (const reference of Object.values(snapshot.tree.references)) {
            transaction.objectStore('references').put({
              ...reference,
              workspaceId: snapshot.workspace.id,
            });
          }

          for (const metadata of resourceMetadata) {
            transaction.objectStore('resourceMetadata').put(metadata);
          }

          transaction.oncomplete = () => {
            window.localStorage.setItem(
              'whynote:recent-workspace',
              JSON.stringify({
                focusedNodeId: selection.selectedNodeId,
                moduleId: selection.currentModuleId,
                openedAt: new Date().toISOString(),
                workspaceId: snapshot.workspace.id,
              }),
            );
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            reject(transaction.error ?? new Error('写入 smoke 工作区失败。'));
          };
          transaction.onabort = () => {
            reject(transaction.error ?? new Error('写入 smoke 工作区被中止。'));
          };
        };

        function ensureStore(
          database: IDBDatabase,
          storeName: string,
          indexName?: string,
        ) {
          if (database.objectStoreNames.contains(storeName)) {
            return;
          }

          const store = database.createObjectStore(storeName, {
            keyPath: 'id',
          });

          if (indexName) {
            store.createIndex(`by-${indexName}`, indexName);
          }
        }
      });
    },
    {
      resourceMetadata,
      selection,
      snapshot,
    },
  );

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: '当前学习模块' }),
  ).toBeVisible();
}

export function createSmokeWorkspaceSnapshot() {
  const snapshot = createWorkspaceSnapshot({
    createdAt: SMOKE_TIMESTAMP,
    rootId: SMOKE_ROOT_ID,
    title: 'Playwright Smoke 主题',
    updatedAt: SMOKE_TIMESTAMP,
    workspaceId: SMOKE_WORKSPACE_ID,
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      content: '聚焦状态更新、渲染触发和组件边界。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'module-render-basics',
      title: '渲染基础',
      type: 'module',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );
  tree = insertChildNode(
    tree,
    'module-render-basics',
    createNode({
      content: '先把最小渲染链路看清，再继续深入。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'step-render-entry',
      status: 'doing',
      title: '观察渲染入口',
      type: 'plan-step',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );
  tree = insertChildNode(
    tree,
    'step-render-entry',
    createNode({
      content: '确认一次状态变化如何进入渲染流程。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'question-render-update',
      title: '为什么状态更新会触发重渲染？',
      type: 'question',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      content: '区分渲染和副作用同步，不把交互先锁死。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'module-effect-switch',
      title: '副作用切换',
      type: 'module',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );
  tree = insertChildNode(
    tree,
    'module-effect-switch',
    createNode({
      content: '看哪些逻辑该留在渲染，哪些需要进入副作用。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'step-effect-boundary',
      status: 'doing',
      title: '分清渲染与同步',
      type: 'plan-step',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );
  tree = insertChildNode(
    tree,
    'step-effect-boundary',
    createNode({
      content: '只在需要和外部系统同步时再考虑副作用。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'question-effect-sync',
      title: '什么时候需要同步副作用？',
      type: 'question',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      content: '和 render / commit 基本链路相关的参考资料。',
      createdAt: SMOKE_TIMESTAMP,
      id: 'resource-render-docs',
      mimeType: 'text/html',
      sourceUri: 'https://react.dev/learn/render-and-commit',
      title: 'React 渲染文档',
      type: 'resource',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-render-docs',
    createNode({
      content: '帮助解释渲染和提交之间的关系。',
      createdAt: SMOKE_TIMESTAMP,
      excerpt: 'React 会先调用组件，再把变更提交到 DOM。',
      id: 'fragment-render-commit',
      locator: 'render-and-commit',
      sourceResourceId: 'resource-render-docs',
      title: '渲染与提交摘录',
      type: 'resource-fragment',
      updatedAt: SMOKE_TIMESTAMP,
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}

function collectResourceMetadata(snapshot: WorkspaceSnapshot) {
  const records: ResourceMetadataRecord[] = [];

  for (const node of Object.values(snapshot.tree.nodes)) {
    if (node.type === 'resource') {
      records.push({
        id: node.id,
        mimeType: node.mimeType,
        nodeId: node.id,
        nodeType: 'resource',
        sourceUri: node.sourceUri,
        title: node.title,
        updatedAt: node.updatedAt,
        workspaceId: snapshot.workspace.id,
      });
    }

    if (node.type === 'resource-fragment') {
      records.push({
        excerpt: node.excerpt,
        id: node.id,
        locator: node.locator,
        nodeId: node.id,
        nodeType: 'resource-fragment',
        sourceResourceId: node.sourceResourceId,
        title: node.title,
        updatedAt: node.updatedAt,
        workspaceId: snapshot.workspace.id,
      });
    }
  }

  return records;
}

export const browserStorageKeys = {
  databaseName: NODE_DATABASE_NAME,
  databaseVersion: NODE_DATABASE_VERSION,
  recentWorkspaceStorageKey: RECENT_WORKSPACE_STORAGE_KEY,
} as const;
