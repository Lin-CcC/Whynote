import { type ReactNode, useEffect, useRef } from 'react';

import SectionCard from '../../../ui/SectionCard';
import {
  buildQuestionBlockData,
  findNearestQuestionNodeId,
  getNodeOrThrow,
  type NodeTree,
  type TreeNode,
} from '../../nodeDomain';
import type {
  LearningActionId,
  NodeContentPatch,
  WorkspaceEditorNodeRenderContext,
  WorkspaceViewState,
} from '../workspaceEditorTypes';
import { getDisplayLabelForNode, getDisplayTitleForNode } from '../utils/treeSelectors';
import {
  getAnswerHistorySectionId,
  getSummaryHistorySectionId,
} from '../utils/workspaceViewState';
import EditorNodeSection from './EditorNodeSection';

type TextMainViewProps = {
  currentModuleId: string | null;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
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
  onSelectNode: (nodeId: string) => void;
  onSetCurrentAnswer: (questionNodeId: string, answerNodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  onWorkspaceViewStateChange: (state: WorkspaceViewState) => void;
  renderNodeInlineActions?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => ReactNode;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
  workspaceViewState: WorkspaceViewState;
};

export default function TextMainView({
  currentModuleId,
  interactionLockReason,
  isInteractionLocked,
  onCreateModule,
  onDirectAnswerQuestion,
  onEvaluateAnswer,
  onEvaluateSummary,
  onGenerateFollowUpQuestion,
  onGenerateSummary,
  onDeleteNode,
  onInsertAnswerForQuestion,
  onInsertFollowUpQuestion,
  onInsertSummaryForNode,
  onRunLearningAction,
  onSelectNode,
  onSetCurrentAnswer,
  onUpdateNode,
  onWorkspaceViewStateChange,
  renderNodeInlineActions,
  registerNodeElement,
  selectedNodeId,
  tree,
  workspaceViewState,
}: TextMainViewProps) {
  const activeQuestionBlockId = findNearestQuestionNodeId(tree, selectedNodeId);
  const lastAutoExpandedSelectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedNodeId === lastAutoExpandedSelectionIdRef.current) {
      return;
    }

    lastAutoExpandedSelectionIdRef.current = selectedNodeId;

    const nextViewState = expandWorkspaceViewStateForSelection(
      tree,
      selectedNodeId,
      workspaceViewState,
    );

    if (nextViewState !== workspaceViewState) {
      onWorkspaceViewStateChange(nextViewState);
    }
  }, [onWorkspaceViewStateChange, selectedNodeId, tree, workspaceViewState]);

  if (!currentModuleId || !tree.nodes[currentModuleId]) {
    return (
      <SectionCard>
        <p className="workspace-kicker">主视图</p>
        <h2 className="workspace-sectionTitle">还没有可编辑的模块</h2>
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            先创建一个模块，主视图才会进入 question block 编辑表面。
          </p>
          <button
            className="workspace-inlineAction"
            disabled={isInteractionLocked}
            onClick={onCreateModule}
            type="button"
          >
            新建模块
          </button>
        </div>
      </SectionCard>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);
  const selectedNode =
    selectedNodeId && tree.nodes[selectedNodeId]
      ? getNodeOrThrow(tree, selectedNodeId)
      : null;

  return (
    <div className="workspace-mainPanel">
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">Question Block Editor</p>
            <h2 className="workspace-sectionTitle">主视图编辑流</h2>
            <p className="workspace-moduleTitle">{currentModule.title}</p>
          </div>
          <span className="workspace-counter">
            {currentModule.childIds.length} 个直属节点
          </span>
        </div>
        <dl className="workspace-summaryList">
          <div>
            <dt>当前选中</dt>
            <dd>
              {selectedNode
                ? `${getDisplayLabelForNode(tree, selectedNode)} · ${getDisplayTitleForNode(tree, selectedNode)}`
                : '尚未选中节点'}
            </dd>
          </div>
          <div>
            <dt>当前 block</dt>
            <dd>
              {activeQuestionBlockId && tree.nodes[activeQuestionBlockId]
                ? getDisplayTitleForNode(
                    tree,
                    getNodeOrThrow(tree, activeQuestionBlockId),
                  )
                : '当前选中不在问题块内'}
            </dd>
          </div>
          <div>
            <dt>主视图规则</dt>
            <dd>question block 在这里重组显示，结构树仍保持真实树顺序。</dd>
          </div>
        </dl>
        {isInteractionLocked && interactionLockReason ? (
          <p className="workspace-lockText" role="status">
            {interactionLockReason}
          </p>
        ) : null}
      </SectionCard>
      <EditorNodeSection
        activeQuestionBlockId={activeQuestionBlockId}
        depth={0}
        isInteractionLocked={isInteractionLocked}
        nodeId={currentModule.id}
        onDirectAnswerQuestion={onDirectAnswerQuestion}
        onEvaluateAnswer={onEvaluateAnswer}
        onEvaluateSummary={onEvaluateSummary}
        onGenerateFollowUpQuestion={onGenerateFollowUpQuestion}
        onGenerateSummary={onGenerateSummary}
        onDeleteNode={onDeleteNode}
        onInsertAnswerForQuestion={onInsertAnswerForQuestion}
        onInsertFollowUpQuestion={onInsertFollowUpQuestion}
        onInsertSummaryForNode={onInsertSummaryForNode}
        onRunLearningAction={onRunLearningAction}
        onSelectNode={onSelectNode}
        onSetCurrentAnswer={onSetCurrentAnswer}
        onUpdateNode={onUpdateNode}
        onWorkspaceViewStateChange={onWorkspaceViewStateChange}
        registerNodeElement={registerNodeElement}
        renderNodeInlineActions={renderNodeInlineActions}
        selectedNodeId={selectedNodeId}
        tree={tree}
        workspaceViewState={workspaceViewState}
      />
    </div>
  );
}

function expandWorkspaceViewStateForSelection(
  tree: NodeTree,
  selectedNodeId: string | null,
  workspaceViewState: WorkspaceViewState,
) {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return workspaceViewState;
  }

  let nextViewState = workspaceViewState;
  const ancestorPlanStepIds = collectAncestorPlanStepIds(tree, selectedNodeId);
  const ancestorQuestionIds = collectAncestorQuestionIds(tree, selectedNodeId);

  for (const planStepId of ancestorPlanStepIds) {
    nextViewState = expandPlanStep(nextViewState, planStepId);
  }

  for (const questionId of ancestorQuestionIds) {
    nextViewState = expandQuestionBlock(nextViewState, questionId);
  }

  nextViewState = expandNodeBody(nextViewState, selectedNodeId);

  for (const questionId of ancestorQuestionIds) {
    const questionBlock = buildQuestionBlockData(tree, questionId);

    for (const answerGroup of questionBlock.answerGroups) {
      if (
        answerGroup.historicalClosureNodes.some((node) => node.id === selectedNodeId)
      ) {
        nextViewState = expandHistorySection(
          nextViewState,
          getAnswerHistorySectionId(answerGroup.answer.id),
        );
      }
    }

    for (const summaryGroup of questionBlock.summaryGroups) {
      const isSummaryNode =
        summaryGroup.summary.id === selectedNodeId ||
        summaryGroup.latestCheckNode?.id === selectedNodeId ||
        summaryGroup.historicalCheckNodes.some((node) => node.id === selectedNodeId);

      if (!isSummaryNode) {
        continue;
      }

      if (
        summaryGroup.historicalCheckNodes.some((node) => node.id === selectedNodeId)
      ) {
        nextViewState = expandHistorySection(
          nextViewState,
          getSummaryHistorySectionId(summaryGroup.summary.id),
        );
      }
    }
  }

  return nextViewState;
}

function collectAncestorPlanStepIds(tree: NodeTree, nodeId: string) {
  const ancestorPlanStepIds: string[] = [];
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode.parentId !== null) {
    currentNode = tree.nodes[currentNode.parentId];

    if (!currentNode) {
      break;
    }

    if (currentNode.type === 'plan-step') {
      ancestorPlanStepIds.unshift(currentNode.id);
    }
  }

  return ancestorPlanStepIds;
}

function collectAncestorQuestionIds(tree: NodeTree, nodeId: string) {
  const ancestorQuestionIds: string[] = [];
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === 'question') {
      ancestorQuestionIds.unshift(currentNode.id);
    }

    currentNode =
      currentNode.parentId === null
        ? undefined
        : tree.nodes[currentNode.parentId];
  }

  return ancestorQuestionIds;
}

function expandPlanStep(
  workspaceViewState: WorkspaceViewState,
  planStepNodeId: string,
) {
  if (!workspaceViewState.collapsedPlanStepIds.includes(planStepNodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedPlanStepIds: workspaceViewState.collapsedPlanStepIds.filter(
      (collapsedId) => collapsedId !== planStepNodeId,
    ),
  };
}

function expandQuestionBlock(
  workspaceViewState: WorkspaceViewState,
  questionNodeId: string,
) {
  if (!workspaceViewState.collapsedQuestionBlockIds.includes(questionNodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedQuestionBlockIds: workspaceViewState.collapsedQuestionBlockIds.filter(
      (collapsedId) => collapsedId !== questionNodeId,
    ),
  };
}

function expandNodeBody(
  workspaceViewState: WorkspaceViewState,
  nodeId: string,
) {
  if (!workspaceViewState.collapsedNodeBodyIds.includes(nodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedNodeBodyIds: workspaceViewState.collapsedNodeBodyIds.filter(
      (collapsedId) => collapsedId !== nodeId,
    ),
  };
}

function expandHistorySection(
  workspaceViewState: WorkspaceViewState,
  sectionId: string,
) {
  if (workspaceViewState.expandedHistorySectionIds.includes(sectionId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    expandedHistorySectionIds: [
      ...workspaceViewState.expandedHistorySectionIds,
      sectionId,
    ],
  };
}
