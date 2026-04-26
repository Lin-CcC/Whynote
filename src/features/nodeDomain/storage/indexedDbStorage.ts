import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPObjectStore,
  type IDBPTransaction,
} from 'idb';

import type {
  NodeReference,
  Tag,
  TreeNode,
  WorkspaceRecord,
  WorkspaceSnapshot,
} from '../domain';
import { validateNodeTree } from '../domain';
import type {
  ResourceMetadataRecord,
  StructuredDataStorage,
} from './storageTypes';

type StoredNodeRecord = TreeNode & {
  workspaceId: string;
};

type StoredTagRecord = Tag & {
  workspaceId: string;
};

type StoredReferenceRecord = NodeReference & {
  workspaceId: string;
};

interface NodeStorageSchema extends DBSchema {
  workspaces: {
    key: string;
    value: WorkspaceRecord;
  };
  nodes: {
    key: string;
    value: StoredNodeRecord;
    indexes: { 'by-workspaceId': string };
  };
  tags: {
    key: string;
    value: StoredTagRecord;
    indexes: { 'by-workspaceId': string };
  };
  references: {
    key: string;
    value: StoredReferenceRecord;
    indexes: { 'by-workspaceId': string };
  };
  resourceMetadata: {
    key: string;
    value: ResourceMetadataRecord;
    indexes: { 'by-workspaceId': string };
  };
}

type WorkspaceStoreName =
  | 'workspaces'
  | 'nodes'
  | 'tags'
  | 'references'
  | 'resourceMetadata';

type WorkspaceTransaction = IDBPTransaction<
  NodeStorageSchema,
  WorkspaceStoreName[],
  'readwrite'
>;

type WorkspaceRecordIds = {
  nodeIds: Set<string>;
  tagIds: Set<string>;
  referenceIds: Set<string>;
  resourceMetadataIds: Set<string>;
};

type PersistedWorkspaceSnapshot = {
  workspace: WorkspaceRecord;
  nodes: StoredNodeRecord[];
  tags: StoredTagRecord[];
  references: StoredReferenceRecord[];
  resourceMetadata: ResourceMetadataRecord[];
};

const DEFAULT_DATABASE_NAME = 'whynote-node-domain';
const DATABASE_VERSION = 1;
const WORKSPACE_STORE_NAMES: WorkspaceStoreName[] = [
  'workspaces',
  'nodes',
  'tags',
  'references',
  'resourceMetadata',
];

export function createIndexedDbStorage(options?: {
  databaseName?: string;
}): StructuredDataStorage {
  return new IndexedDbNodeStorage(options?.databaseName ?? DEFAULT_DATABASE_NAME);
}

class IndexedDbNodeStorage implements StructuredDataStorage {
  private readonly databasePromise: Promise<IDBPDatabase<NodeStorageSchema>>;

  constructor(databaseName: string) {
    this.databasePromise = openDB<NodeStorageSchema>(
      databaseName,
      DATABASE_VERSION,
      {
        upgrade(database) {
          if (!database.objectStoreNames.contains('workspaces')) {
            database.createObjectStore('workspaces', {
              keyPath: 'id',
            });
          }

          if (!database.objectStoreNames.contains('nodes')) {
            const store = database.createObjectStore('nodes', {
              keyPath: 'id',
            });
            store.createIndex('by-workspaceId', 'workspaceId');
          }

          if (!database.objectStoreNames.contains('tags')) {
            const store = database.createObjectStore('tags', {
              keyPath: 'id',
            });
            store.createIndex('by-workspaceId', 'workspaceId');
          }

          if (!database.objectStoreNames.contains('references')) {
            const store = database.createObjectStore('references', {
              keyPath: 'id',
            });
            store.createIndex('by-workspaceId', 'workspaceId');
          }

          if (!database.objectStoreNames.contains('resourceMetadata')) {
            const store = database.createObjectStore('resourceMetadata', {
              keyPath: 'id',
            });
            store.createIndex('by-workspaceId', 'workspaceId');
          }
        },
      },
    );
  }

  async saveWorkspace(snapshot: WorkspaceSnapshot) {
    validateNodeTree(snapshot.tree);

    const persistedSnapshot = materializeWorkspaceSnapshot(snapshot);
    const database = await this.databasePromise;
    const existingRecordIds = await collectWorkspaceRecordIds(database, snapshot.workspace.id);
    const transaction = database.transaction(WORKSPACE_STORE_NAMES, 'readwrite');

    await replaceWorkspaceRecords(transaction, persistedSnapshot, existingRecordIds);
    await transaction.done;
  }

  async loadWorkspace(workspaceId: string) {
    const database = await this.databasePromise;
    const workspace = await database.get('workspaces', workspaceId);

    if (!workspace) {
      return null;
    }

    const [storedNodes, storedTags, storedReferences] = await Promise.all([
      database.getAllFromIndex('nodes', 'by-workspaceId', workspaceId),
      database.getAllFromIndex('tags', 'by-workspaceId', workspaceId),
      database.getAllFromIndex('references', 'by-workspaceId', workspaceId),
    ]);

    const snapshot: WorkspaceSnapshot = {
      workspace,
      tree: {
        rootId: workspace.rootNodeId,
        nodes: toNodeMap(storedNodes),
        tags: toTagMap(storedTags),
        references: toReferenceMap(storedReferences),
      },
    };

    validateNodeTree(snapshot.tree);

    return snapshot;
  }

  async deleteWorkspace(workspaceId: string) {
    const database = await this.databasePromise;
    const existingRecordIds = await collectWorkspaceRecordIds(database, workspaceId);
    const transaction = database.transaction(WORKSPACE_STORE_NAMES, 'readwrite');

    await deleteWorkspaceRecords(transaction, workspaceId, existingRecordIds);
    await transaction.done;
  }

  async listWorkspaces() {
    const database = await this.databasePromise;

    return database.getAll('workspaces');
  }

  async listResourceMetadata(workspaceId: string) {
    const database = await this.databasePromise;

    return database.getAllFromIndex(
      'resourceMetadata',
      'by-workspaceId',
      workspaceId,
    );
  }

  async close() {
    const database = await this.databasePromise;

    database.close();
  }
}

async function replaceWorkspaceRecords(
  transaction: WorkspaceTransaction,
  snapshot: PersistedWorkspaceSnapshot,
  existingRecordIds: WorkspaceRecordIds,
) {
  const nextNodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const nextTagIds = new Set(snapshot.tags.map((tag) => tag.id));
  const nextReferenceIds = new Set(
    snapshot.references.map((reference) => reference.id),
  );
  const nextResourceMetadataIds = new Set(
    snapshot.resourceMetadata.map((metadata) => metadata.id),
  );
  const requests: Array<Promise<unknown>> = [];

  for (const node of snapshot.nodes) {
    requests.push(transaction.objectStore('nodes').put(node));
  }

  for (const tag of snapshot.tags) {
    requests.push(transaction.objectStore('tags').put(tag));
  }

  for (const reference of snapshot.references) {
    requests.push(transaction.objectStore('references').put(reference));
  }

  for (const resourceMetadata of snapshot.resourceMetadata) {
    requests.push(
      transaction.objectStore('resourceMetadata').put(resourceMetadata),
    );
  }

  requests.push(
    ...deleteMissingRecords(
      transaction.objectStore('nodes'),
      existingRecordIds.nodeIds,
      nextNodeIds,
    ),
    ...deleteMissingRecords(
      transaction.objectStore('tags'),
      existingRecordIds.tagIds,
      nextTagIds,
    ),
    ...deleteMissingRecords(
      transaction.objectStore('references'),
      existingRecordIds.referenceIds,
      nextReferenceIds,
    ),
    ...deleteMissingRecords(
      transaction.objectStore('resourceMetadata'),
      existingRecordIds.resourceMetadataIds,
      nextResourceMetadataIds,
    ),
  );
  requests.push(transaction.objectStore('workspaces').put(snapshot.workspace));

  await Promise.all(requests);
}

async function deleteWorkspaceRecords(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  existingRecordIds: WorkspaceRecordIds,
) {
  const requests: Array<Promise<unknown>> = [
    transaction.objectStore('workspaces').delete(workspaceId),
    ...deleteRecordsByIds(transaction.objectStore('nodes'), existingRecordIds.nodeIds),
    ...deleteRecordsByIds(transaction.objectStore('tags'), existingRecordIds.tagIds),
    ...deleteRecordsByIds(
      transaction.objectStore('references'),
      existingRecordIds.referenceIds,
    ),
    ...deleteRecordsByIds(
      transaction.objectStore('resourceMetadata'),
      existingRecordIds.resourceMetadataIds,
    ),
  ];

  await Promise.all(requests);
}

async function collectWorkspaceRecordIds(
  database: IDBPDatabase<NodeStorageSchema>,
  workspaceId: string,
): Promise<WorkspaceRecordIds> {
  const [nodeIds, tagIds, referenceIds, resourceMetadataIds] = await Promise.all([
    database.getAllKeysFromIndex('nodes', 'by-workspaceId', workspaceId),
    database.getAllKeysFromIndex('tags', 'by-workspaceId', workspaceId),
    database.getAllKeysFromIndex('references', 'by-workspaceId', workspaceId),
    database.getAllKeysFromIndex('resourceMetadata', 'by-workspaceId', workspaceId),
  ]);

  return {
    nodeIds: new Set(nodeIds),
    tagIds: new Set(tagIds),
    referenceIds: new Set(referenceIds),
    resourceMetadataIds: new Set(resourceMetadataIds),
  };
}

function deleteMissingRecords<
  StoreName extends 'nodes' | 'tags' | 'references' | 'resourceMetadata',
>(
  store: IDBPObjectStore<NodeStorageSchema, WorkspaceStoreName[], StoreName, 'readwrite'>,
  existingIds: Set<string>,
  nextIds: Set<string>,
) {
  const staleIds = [...existingIds].filter((id) => !nextIds.has(id));

  return deleteRecordsByIds(store, staleIds);
}

function deleteRecordsByIds<
  StoreName extends 'nodes' | 'tags' | 'references' | 'resourceMetadata',
>(
  store: IDBPObjectStore<NodeStorageSchema, WorkspaceStoreName[], StoreName, 'readwrite'>,
  recordIds: Iterable<string>,
) {
  return [...recordIds].map((recordId) => store.delete(recordId));
}

function toResourceMetadataRecords(snapshot: WorkspaceSnapshot) {
  const records: ResourceMetadataRecord[] = [];

  for (const node of Object.values(snapshot.tree.nodes)) {
    if (node.type === 'resource') {
      records.push({
        id: node.id,
        workspaceId: snapshot.workspace.id,
        nodeId: node.id,
        nodeType: 'resource',
        title: node.title,
        sourceUri: node.sourceUri,
        mimeType: node.mimeType,
        updatedAt: node.updatedAt,
      });
    }

    if (node.type === 'resource-fragment') {
      records.push({
        id: node.id,
        workspaceId: snapshot.workspace.id,
        nodeId: node.id,
        nodeType: 'resource-fragment',
        title: node.title,
        sourceResourceId: node.sourceResourceId,
        locator: node.locator,
        excerpt: node.excerpt,
        updatedAt: node.updatedAt,
      });
    }
  }

  return records;
}

function materializeWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): PersistedWorkspaceSnapshot {
  return {
    workspace: structuredClone(snapshot.workspace),
    nodes: Object.values(snapshot.tree.nodes).map((node) => ({
      ...structuredClone(node),
      workspaceId: snapshot.workspace.id,
    })),
    tags: Object.values(snapshot.tree.tags).map((tag) => ({
      ...structuredClone(tag),
      workspaceId: snapshot.workspace.id,
    })),
    references: Object.values(snapshot.tree.references).map((reference) => ({
      ...structuredClone(reference),
      workspaceId: snapshot.workspace.id,
    })),
    resourceMetadata: toResourceMetadataRecords(snapshot).map((record) =>
      structuredClone(record),
    ),
  };
}

function toNodeMap(storedNodes: StoredNodeRecord[]) {
  return Object.fromEntries(
    storedNodes.map(({ workspaceId: _workspaceId, ...node }) => [node.id, node]),
  ) as Record<string, TreeNode>;
}

function toTagMap(storedTags: StoredTagRecord[]) {
  return Object.fromEntries(
    storedTags.map(({ workspaceId: _workspaceId, ...tag }) => [tag.id, tag]),
  ) as Record<string, Tag>;
}

function toReferenceMap(storedReferences: StoredReferenceRecord[]) {
  return Object.fromEntries(
    storedReferences.map(({ workspaceId: _workspaceId, ...reference }) => [
      reference.id,
      reference,
    ]),
  ) as Record<string, NodeReference>;
}
