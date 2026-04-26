export const ROOT_CHILD_NODE_TYPES = ['module', 'resource'] as const;
export const LEARNING_NODE_TYPES = [
  'question',
  'answer',
  'summary',
  'judgment',
] as const;
export const RESOURCE_NODE_TYPES = ['resource', 'resource-fragment'] as const;
export const REFERENCE_SOURCE_NODE_TYPES = [
  'module',
  'plan-step',
  'question',
  'summary',
  'judgment',
] as const;
export const REFERENCE_TARGET_NODE_TYPES = [
  'resource',
  'resource-fragment',
] as const;

export type NodeType =
  | 'theme-root'
  | 'module'
  | 'plan-step'
  | 'question'
  | 'answer'
  | 'summary'
  | 'judgment'
  | 'resource'
  | 'resource-fragment';

export type LearningNodeType = (typeof LEARNING_NODE_TYPES)[number];
export type ResourceNodeType = (typeof RESOURCE_NODE_TYPES)[number];
export type ReferenceSourceNodeType =
  (typeof REFERENCE_SOURCE_NODE_TYPES)[number];
export type ReferenceTargetNodeType =
  (typeof REFERENCE_TARGET_NODE_TYPES)[number];
export type PlanStepStatus = 'todo' | 'doing' | 'done';

export interface BaseNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  parentId: string | null;
  childIds: string[];
  order: number;
  tagIds: string[];
  referenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ThemeRootNode extends BaseNode {
  type: 'theme-root';
  parentId: null;
  order: 0;
}

export interface ModuleNode extends BaseNode {
  type: 'module';
}

export interface PlanStepNode extends BaseNode {
  type: 'plan-step';
  status: PlanStepStatus;
}

export interface QuestionNode extends BaseNode {
  type: 'question';
}

export interface AnswerNode extends BaseNode {
  type: 'answer';
}

export interface SummaryNode extends BaseNode {
  type: 'summary';
}

export interface JudgmentNode extends BaseNode {
  type: 'judgment';
}

export interface ResourceNode extends BaseNode {
  type: 'resource';
  sourceUri?: string;
  mimeType?: string;
}

export interface ResourceFragmentNode extends BaseNode {
  type: 'resource-fragment';
  sourceResourceId: string;
  locator?: string;
  excerpt: string;
}

export type TreeNode =
  | ThemeRootNode
  | ModuleNode
  | PlanStepNode
  | QuestionNode
  | AnswerNode
  | SummaryNode
  | JudgmentNode
  | ResourceNode
  | ResourceFragmentNode;

export type NonRootNode = Exclude<TreeNode, ThemeRootNode>;

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeReference {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeTree {
  rootId: string;
  nodes: Record<string, TreeNode>;
  tags: Record<string, Tag>;
  references: Record<string, NodeReference>;
}

export interface WorkspaceRecord {
  id: string;
  title: string;
  rootNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  workspace: WorkspaceRecord;
  tree: NodeTree;
}
