import type { WorkspaceRecord, WorkspaceSnapshot } from '../domain';

export interface ResourceMetadataRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  nodeType: 'resource' | 'resource-fragment';
  title: string;
  sourceUri?: string;
  mimeType?: string;
  sourceResourceId?: string;
  locator?: string;
  excerpt?: string;
  updatedAt: string;
}

export type PreferenceValue = boolean | number | string | null;

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
