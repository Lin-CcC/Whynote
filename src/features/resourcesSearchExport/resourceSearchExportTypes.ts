import type {
  NodeType,
  ResourceFragmentNode,
  ResourceNode,
} from '../nodeDomain';

export type SearchScope = 'current-module' | 'theme' | 'resources';
export type ExportFormat = 'markdown' | 'txt';
export type ExportTarget = 'current-module' | 'theme' | 'filtered';

export interface TagFilterOption {
  id: string;
  name: string;
  count: number;
}

export interface SearchResult {
  nodeId: string;
  nodeType: NodeType;
  nodeTypeLabel: string;
  title: string;
  pathLabel: string;
  snippet: string;
  sourceSummary: string | null;
  tagNames: string[];
  scopeIndex: number;
  scopeSize: number;
  locationRatio: number;
}

export interface SearchWorkspaceNodesResult {
  availableTags: TagFilterOption[];
  results: SearchResult[];
  scopedNodeCount: number;
}

export interface ResourceGroup {
  fragmentNodes: ResourceFragmentNode[];
  referenceCount: number;
  resourceNode: ResourceNode;
  sourceSummary: string;
}

export interface ExportFileDescriptor {
  content: string;
  fileName: string;
  mimeType: string;
}
