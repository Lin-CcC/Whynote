import type {
  NonRootNode,
  NodeTree,
  PlanStepStatus,
  WorkspaceSnapshot,
} from '../nodeDomain';

export interface WorkspaceEditorOperations {
  insertChildNode: (
    tree: NodeTree,
    parentNodeId: string,
    node: NonRootNode,
    index?: number,
  ) => NodeTree;
  insertSiblingNode: (
    tree: NodeTree,
    siblingNodeId: string,
    node: NonRootNode,
    position?: 'before' | 'after',
  ) => NodeTree;
  deleteNode: (tree: NodeTree, nodeId: string) => NodeTree;
  liftNode: (tree: NodeTree, nodeId: string) => NodeTree;
  lowerNode: (tree: NodeTree, nodeId: string) => NodeTree;
}

export interface NodeContentPatch {
  title?: string;
  content?: string;
  status?: PlanStepStatus;
}

export interface EditorActionAvailability {
  canInsertChild: boolean;
  canInsertSibling: boolean;
  canDelete: boolean;
  canLift: boolean;
  canLower: boolean;
}

export interface WorkspaceEditorProps {
  initialSnapshot?: WorkspaceSnapshot;
  initialModuleId?: string;
  initialSelectedNodeId?: string;
  operations?: WorkspaceEditorOperations;
}
