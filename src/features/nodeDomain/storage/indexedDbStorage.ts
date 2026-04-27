import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPObjectStore,
  type IDBPTransaction,
} from 'idb';

import type {
  NodeReference,
  ResourceNode,
  Tag,
  TreeNode,
  WorkspaceRecord,
  WorkspaceSnapshot,
} from '../domain';
import { validateNodeTree } from '../domain';
import type {
  ResourceImportMethod,
  ResourceIngestStatus,
  ResourceMetadataRecord,
  ResourceSummarySource,
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

    const database = await this.databasePromise;
    const existingResourceMetadata = await collectWorkspaceResourceMetadata(
      database,
      snapshot.workspace.id,
    );
    const persistedSnapshot = materializeWorkspaceSnapshot(
      snapshot,
      buildResourceMetadataMap(existingResourceMetadata),
    );
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

  async upsertResourceMetadata(record: ResourceMetadataRecord) {
    const database = await this.databasePromise;

    await database.put('resourceMetadata', structuredClone(record));
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

async function collectWorkspaceResourceMetadata(
  database: IDBPDatabase<NodeStorageSchema>,
  workspaceId: string,
) {
  return database.getAllFromIndex('resourceMetadata', 'by-workspaceId', workspaceId);
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

function toResourceMetadataRecords(
  snapshot: WorkspaceSnapshot,
  existingMetadataByNodeId: Map<string, ResourceMetadataRecord>,
) {
  const records: ResourceMetadataRecord[] = [];

  for (const node of Object.values(snapshot.tree.nodes)) {
    if (node.type === 'resource') {
      const existingMetadata = existingMetadataByNodeId.get(node.id);

      records.push({
        id: node.id,
        workspaceId: snapshot.workspace.id,
        nodeId: node.id,
        nodeType: 'resource',
        title: node.title,
        sourceUri: node.sourceUri,
        mimeType: node.mimeType,
        importMethod: existingMetadata?.importMethod ?? inferResourceImportMethod(node),
        ingestStatus: existingMetadata?.ingestStatus ?? inferResourceIngestStatus(node),
        titleSource: existingMetadata?.titleSource ?? 'user',
        summarySource:
          existingMetadata?.summarySource ?? inferResourceSummarySource(node),
        canonicalSource: existingMetadata?.canonicalSource,
        bodyText: existingMetadata?.bodyText,
        bodyFormat: existingMetadata?.bodyFormat,
        importedAt: existingMetadata?.importedAt ?? node.createdAt,
        updatedAt: node.updatedAt,
      });
    }

    if (node.type === 'resource-fragment') {
      const existingMetadata = existingMetadataByNodeId.get(node.id);

      records.push({
        id: node.id,
        workspaceId: snapshot.workspace.id,
        nodeId: node.id,
        nodeType: 'resource-fragment',
        title: node.title,
        importMethod: existingMetadata?.importMethod,
        ingestStatus: existingMetadata?.ingestStatus,
        titleSource: existingMetadata?.titleSource,
        summarySource: existingMetadata?.summarySource,
        canonicalSource: existingMetadata?.canonicalSource,
        bodyText: existingMetadata?.bodyText,
        bodyFormat: existingMetadata?.bodyFormat,
        importedAt: existingMetadata?.importedAt,
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
  existingMetadataByNodeId: Map<string, ResourceMetadataRecord>,
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
    resourceMetadata: toResourceMetadataRecords(
      snapshot,
      existingMetadataByNodeId,
    ).map((record) => structuredClone(record)),
  };
}

function buildResourceMetadataMap(records: ResourceMetadataRecord[]) {
  return new Map(records.map((record) => [record.nodeId, record]));
}

function inferResourceImportMethod(node: ResourceNode): ResourceImportMethod {
  if (node.sourceUri && /^https?:\/\//u.test(node.sourceUri)) {
    return 'url';
  }

  if (
    node.sourceUri?.startsWith('本地文件：') ||
    node.mimeType === 'text/plain' ||
    node.mimeType === 'text/markdown' ||
    node.mimeType === 'text/x-markdown'
  ) {
    return 'local-file';
  }

  return 'manual';
}

function inferResourceIngestStatus(node: ResourceNode): ResourceIngestStatus {
  switch (inferResourceImportMethod(node)) {
    case 'url':
      return 'partial';
    case 'local-file':
    case 'manual':
      return 'manual';
  }
}

function inferResourceSummarySource(node: ResourceNode): ResourceSummarySource {
  if (node.content.trim().length > 0) {
    return 'user';
  }

  switch (inferResourceImportMethod(node)) {
    case 'url':
      return 'url-fallback';
    case 'local-file':
      return 'file-fallback';
    case 'manual':
      return 'user';
  }
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
