import type { WorkspaceRecord, WorkspaceSnapshot } from '../domain';

export type ResourceImportMethod =
  | 'url'
  | 'local-file'
  | 'batch'
  | 'folder'
  | 'manual';
export type ResourceIngestStatus = 'ready' | 'partial' | 'manual';
export type ResourceTitleSource =
  | 'user'
  | 'ai-generated'
  | 'url-meta'
  | 'url-heading'
  | 'url-document-title'
  | 'url-path'
  | 'file-heading'
  | 'file-first-line'
  | 'file-name';
export type ResourceSummarySource =
  | 'user'
  | 'ai-generated'
  | 'url-meta'
  | 'url-body'
  | 'url-fallback'
  | 'file-body'
  | 'file-fallback';
export type ResourceBodyFormat = 'plain-text' | 'markdown';

export interface ResourceMetadataRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  nodeType: 'resource' | 'resource-fragment';
  title: string;
  sourceUri?: string;
  mimeType?: string;
  importMethod?: ResourceImportMethod;
  ingestStatus?: ResourceIngestStatus;
  titleSource?: ResourceTitleSource;
  summarySource?: ResourceSummarySource;
  canonicalSource?: string;
  bodyText?: string;
  bodyFormat?: ResourceBodyFormat;
  importedAt?: string;
  originalFileName?: string;
  sourceRelativePath?: string;
  importBatchId?: string;
  sourceResourceId?: string;
  locator?: string;
  excerpt?: string;
  updatedAt: string;
}

export type PreferencePrimitiveValue = boolean | number | string | null;
export type PreferenceValue =
  | PreferencePrimitiveValue
  | PreferenceValue[]
  | {
      [key: string]: PreferenceValue;
    };

export interface AppSettings {
  values: Record<string, PreferenceValue>;
  updatedAt: string;
}

export interface RecentWorkspaceState {
  workspaceId: string;
  moduleId?: string;
  focusedNodeId?: string;
  openedAt: string;
}

export interface UiPreferences {
  values: Record<string, PreferenceValue>;
  updatedAt: string;
}

export interface StructuredDataStorage {
  saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void>;
  loadWorkspace(workspaceId: string): Promise<WorkspaceSnapshot | null>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  listWorkspaces(): Promise<WorkspaceRecord[]>;
  listResourceMetadata(workspaceId: string): Promise<ResourceMetadataRecord[]>;
  upsertResourceMetadata(record: ResourceMetadataRecord): Promise<void>;
  close(): Promise<void>;
}

export interface LocalPreferenceStorage {
  saveSettings(settings: AppSettings): void;
  loadSettings(): AppSettings | null;
  saveRecentWorkspaceState(state: RecentWorkspaceState): void;
  loadRecentWorkspaceState(): RecentWorkspaceState | null;
  saveUiPreferences(preferences: UiPreferences): void;
  loadUiPreferences(): UiPreferences | null;
  clear(): void;
}
