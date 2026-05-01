import type { ReactNode } from 'react';

import type { NodeTree } from '../../nodeDomain';
import type {
  LearningActionId,
  NodeContentPatch,
  WorkspaceEditorNodeRenderContext,
  WorkspaceViewState,
} from '../workspaceEditorTypes';

export interface MainViewNodeProps {
  activeQuestionBlockId: string | null;
  depth: number;
  isInteractionLocked: boolean;
  nodeId: string;
  onDeleteNodeById: (nodeId: string) => void;
  onDirectAnswerQuestion?: (questionNodeId: string) => void;
  onEvaluateAnswer?: (questionNodeId: string, answerNodeId: string) => void;
  onEvaluateSummary?: (summaryNodeId: string) => void;
  onGenerateFollowUpQuestion?: (sourceNodeId: string) => void;
  onGenerateSummary?: (sourceNodeId: string) => void;
  onInsertAnswerForQuestion: (questionNodeId: string) => void;
  onInsertFollowUpQuestion: (sourceNodeId: string) => void;
  onInsertSummaryForNode: (sourceNodeId: string) => void;
  onDeleteNode: () => void;
  onRunLearningAction: (actionId: LearningActionId) => void;
  onRunLearningActionForNode: (
    nodeId: string,
    actionId: LearningActionId,
  ) => void;
  onSelectNode: (nodeId: string) => void;
  onSetCurrentAnswer: (questionNodeId: string, answerNodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  onWorkspaceViewStateChange: (state: WorkspaceViewState) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  renderNodeInlineActions?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => ReactNode;
  selectedNodeId: string | null;
  tree: NodeTree;
  workspaceViewState: WorkspaceViewState;
}
