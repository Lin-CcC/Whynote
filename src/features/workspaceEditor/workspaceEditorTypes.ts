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

export interface EditorInsertTypeOption {
  label: string;
  value: NonRootNode['type'];
}

export type LearningActionId =
  | 'insert-plan-step'
  | 'insert-scaffold'
  | 'rephrase-scaffold'
  | 'simplify-scaffold'
  | 'add-example'
  | 'insert-question'
  | 'insert-answer'
  | 'insert-summary'
  | 'insert-judgment'
  | 'insert-resource-fragment';

export interface LearningActionPlacement {
  insertIndex: number;
  nodeType: NonRootNode['type'];
  parentNodeId: string;
  title: string;
}

export interface LearningActionOption {
  hint: string;
  id: LearningActionId;
  label: string;
}

export type WorkspaceMainViewMode = 'document' | 'structure-map';

export interface WorkspaceViewState {
  collapsedPlanStepIds: string[];
  collapsedQuestionBlockIds: string[];
  collapsedNodeBodyIds: string[];
  expandedHistorySectionIds: string[];
  mainViewMode?: WorkspaceMainViewMode;
}

export interface WorkspaceEditorSelectionState {
  currentModuleId: string | null;
  selectedNodeId: string | null;
}

export interface WorkspaceEditorLearningActionRequest {
  actionId: LearningActionId;
  currentModuleId: string | null;
  placement: LearningActionPlacement;
  selectedNodeId: string;
  tree: NodeTree;
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
  runLearningAction: (actionId: LearningActionId) => void;
  selectedNode: TreeNode | null;
  selectNode: (nodeId: string) => void;
  tree: NodeTree;
  workspaceTitle: string;
}

export interface WorkspaceEditorNodeRenderContext {
  isSelected: boolean;
  node: TreeNode;
  selectNode: (nodeId: string) => void;
  tree: NodeTree;
}

export interface WorkspaceEditorToolbarButton {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
}

export interface WorkspaceEditorToolbarSection {
  buttons: WorkspaceEditorToolbarButton[];
  title: string;
}

export interface WorkspaceEditorProps {
  initialSnapshot?: WorkspaceSnapshot;
  initialModuleId?: string;
  initialSelectedNodeId?: string;
  onGenerateFollowUpQuestion?: (sourceNodeId: string) => void;
  onGenerateSummary?: (sourceNodeId: string) => void;
  interactionLockReason?: string | null;
  isInteractionLocked?: boolean;
  onDirectAnswerQuestion?: (questionNodeId: string) => void;
  onEvaluateAnswer?: (questionNodeId: string, answerNodeId: string) => void;
  onEvaluateSummary?: (summaryNodeId: string) => void;
  onLearningActionRequest?: (
    request: WorkspaceEditorLearningActionRequest,
  ) => boolean | void;
  operations?: WorkspaceEditorOperations;
  onSnapshotChange?: (snapshot: WorkspaceSnapshot) => void;
  onSelectionChange?: (selection: WorkspaceEditorSelectionState) => void;
  onWorkspaceViewStateChange?: (state: WorkspaceViewState) => void;
  renderLeftPanelExtra?: (
    context: WorkspaceEditorRenderContext,
  ) => ReactNode;
  renderRightPanelExtra?: (
    context: WorkspaceEditorRenderContext,
  ) => ReactNode;
  renderNodeInlineActions?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => ReactNode;
  renderNodeToolbarSections?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => WorkspaceEditorToolbarSection[] | null;
  workspaceViewState?: WorkspaceViewState;
}
