import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

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

const DEFAULT_DATABASE_NAME = 'whynote-node-domain';
const DATABASE_VERSION = 1;

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
    await this.deleteWorkspace(snapshot.workspace.id);

    const database = await this.databasePromise;
    const transaction = database.transaction(
      ['workspaces', 'nodes', 'tags', 'references', 'resourceMetadata'],
      'readwrite',
    );

    void transaction.objectStore('workspaces').put(snapshot.workspace);

    for (const node of Object.values(snapshot.tree.nodes)) {
      void transaction.objectStore('nodes').put({
        ...node,
        workspaceId: snapshot.workspace.id,
      });
    }

    for (const tag of Object.values(snapshot.tree.tags)) {
      void transaction.objectStore('tags').put({
        ...tag,
        workspaceId: snapshot.workspace.id,
      });
    }

    for (const reference of Object.values(snapshot.tree.references)) {
      void transaction.objectStore('references').put({
        ...reference,
        workspaceId: snapshot.workspace.id,
      });
    }

    for (const resourceMetadata of toResourceMetadataRecords(snapshot)) {
      void transaction.objectStore('resourceMetadata').put(resourceMetadata);
    }

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

    await Promise.all([
      database.delete('workspaces', workspaceId),
      deleteStoreRecordsByWorkspaceId(database, 'nodes', workspaceId),
      deleteStoreRecordsByWorkspaceId(database, 'tags', workspaceId),
      deleteStoreRecordsByWorkspaceId(database, 'references', workspaceId),
      deleteStoreRecordsByWorkspaceId(database, 'resourceMetadata', workspaceId),
    ]);
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

async function deleteStoreRecordsByWorkspaceId(
  database: IDBPDatabase<NodeStorageSchema>,
  storeName: 'nodes' | 'tags' | 'references' | 'resourceMetadata',
  workspaceId: string,
) {
  const keys = await database.getAllKeysFromIndex(
    storeName,
    'by-workspaceId',
    workspaceId,
  );

  if (keys.length === 0) {
    return;
  }

  const transaction = database.transaction(storeName, 'readwrite');

  for (const key of keys) {
    void transaction.store.delete(key);
  }

  await transaction.done;
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
