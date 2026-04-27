import type { ReactNode } from 'react';

import type {
  TreeNode,
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

export interface WorkspaceEditorSelectionState {
  currentModuleId: string | null;
  selectedNodeId: string | null;
}

export interface ExternalTreeChangeOptions {
  nextSelectedNodeId?: string | null;
  preferredModuleId?: string | null;
}

export interface WorkspaceEditorRenderContext
  extends WorkspaceEditorSelectionState {
  applyTreeChange: (
    nextTree: NodeTree,
    options?: ExternalTreeChangeOptions,
  ) => void;
  createModule: () => void;
  currentModule: TreeNode | null;
  selectedNode: TreeNode | null;
  selectNode: (nodeId: string) => void;
  tree: NodeTree;
  workspaceTitle: string;
}

export interface WorkspaceEditorProps {
  initialSnapshot?: WorkspaceSnapshot;
  initialModuleId?: string;
  initialSelectedNodeId?: string;
  interactionLockReason?: string | null;
  isInteractionLocked?: boolean;
  operations?: WorkspaceEditorOperations;
  onSnapshotChange?: (snapshot: WorkspaceSnapshot) => void;
  onSelectionChange?: (selection: WorkspaceEditorSelectionState) => void;
  renderLeftPanelExtra?: (
    context: WorkspaceEditorRenderContext,
  ) => ReactNode;
  renderRightPanelExtra?: (
    context: WorkspaceEditorRenderContext,
  ) => ReactNode;
}
