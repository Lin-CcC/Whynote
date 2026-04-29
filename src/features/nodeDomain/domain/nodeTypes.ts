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
  'answer',
  'summary',
  'judgment',
] as const;
export const REFERENCE_TARGET_NODE_TYPES = [
  'resource',
  'resource-fragment',
] as const;
export const CITATION_PURPOSES = [
  'definition',
  'mechanism',
  'behavior',
  'example',
  'judgment',
  'background',
] as const;
export const SUMMARY_NODE_KINDS = [
  'manual',
  'scaffold',
  'answer-closure',
] as const;
export const JUDGMENT_NODE_KINDS = [
  'manual',
  'answer-closure',
  'summary-check',
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
export type CitationPurpose = (typeof CITATION_PURPOSES)[number];
export type SummaryNodeKind = (typeof SUMMARY_NODE_KINDS)[number];
export type JudgmentNodeKind = (typeof JUDGMENT_NODE_KINDS)[number];
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
  summaryKind?: SummaryNodeKind;
}

export interface JudgmentNode extends BaseNode {
  type: 'judgment';
  hint?: string;
  judgmentKind?: JudgmentNodeKind;
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
  focusText?: string;
  note?: string;
  purpose?: CitationPurpose;
  sourceExcerpt?: string;
  sourceLocator?: string;
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
