import type { ReactNode } from 'react';

import type { NodeTree } from '../../nodeDomain';
import type {
  NodeContentPatch,
  WorkspaceEditorNodeRenderContext,
  WorkspaceViewState,
} from '../workspaceEditorTypes';

export interface MainViewNodeProps {
  activeQuestionBlockId: string | null;
  depth: number;
  isInteractionLocked: boolean;
  nodeId: string;
  onDirectAnswerQuestion?: (questionNodeId: string) => void;
  onEvaluateAnswer?: (questionNodeId: string, answerNodeId: string) => void;
  onEvaluateSummary?: (summaryNodeId: string) => void;
  onGenerateFollowUpQuestion?: (sourceNodeId: string) => void;
  onGenerateSummary?: (sourceNodeId: string) => void;
  onInsertAnswerForQuestion: (questionNodeId: string) => void;
  onInsertFollowUpQuestion: (
    questionNodeId: string,
    options?: {
      sourceNodeId?: string | null;
    },
  ) => void;
  onInsertSummaryForQuestion: (questionNodeId: string) => void;
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
