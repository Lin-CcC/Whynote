import { Fragment, type ReactNode } from 'react';

import {
  buildQuestionBlockData,
  getNodeOrThrow,
  type QuestionBlockAnswerGroup,
  type QuestionBlockSummaryGroup,
  type TreeNode,
} from '../../nodeDomain';
import { getDisplayTitleForNode } from '../utils/treeSelectors';
import {
  getAnswerHistorySectionId,
  getQuestionBlockHistorySectionId,
  getSummaryHistorySectionId,
} from '../utils/workspaceViewState';
import type { MainViewNodeProps } from './mainViewTypes';
import EditableNodeCard from './EditableNodeCard';

type QuestionBlockSectionProps = MainViewNodeProps & {
  renderChildNode: (nodeId: string, depth: number) => ReactNode;
};

export default function QuestionBlockSection({
  activeQuestionBlockId,
  depth,
  isInteractionLocked,
  nodeId,
  onDirectAnswerQuestion,
  onEvaluateAnswer,
  onEvaluateSummary,
  onInsertAnswerForQuestion,
  onInsertFollowUpQuestion,
  onInsertSummaryForQuestion,
  onSelectNode,
  onSetCurrentAnswer,
  onUpdateNode,
  onWorkspaceViewStateChange,
  registerNodeElement,
  renderChildNode,
  renderNodeInlineActions,
  selectedNodeId,
  tree,
  workspaceViewState,
}: QuestionBlockSectionProps) {
  const questionBlock = buildQuestionBlockData(tree, nodeId);
  const { question } = questionBlock;
  const isActive = activeQuestionBlockId === question.id;
  const isCollapsed =
    workspaceViewState.collapsedQuestionBlockIds.includes(question.id);
  const previousAnswersHistoryId = getQuestionBlockHistorySectionId(question.id);
  const isPreviousAnswersExpanded =
    workspaceViewState.expandedHistorySectionIds.includes(
      previousAnswersHistoryId,
    );
  const firstFollowUpQuestionId = questionBlock.followUpQuestionIds[0] ?? null;
  const relocatedNodeIds = new Set<string>();

  if (questionBlock.currentAnswerGroup) {
    relocatedNodeIds.add(questionBlock.currentAnswerGroup.answer.id);
    if (questionBlock.currentAnswerGroup.latestEvaluationNode) {
      relocatedNodeIds.add(questionBlock.currentAnswerGroup.latestEvaluationNode.id);
    }
    if (questionBlock.currentAnswerGroup.latestExplanationNode) {
      relocatedNodeIds.add(questionBlock.currentAnswerGroup.latestExplanationNode.id);
    }
    questionBlock.currentAnswerGroup.historicalClosureNodes.forEach((node) =>
      relocatedNodeIds.add(node.id),
    );
  }

  questionBlock.previousAnswerGroups.forEach((answerGroup) => {
    relocatedNodeIds.add(answerGroup.answer.id);
    if (answerGroup.latestEvaluationNode) {
      relocatedNodeIds.add(answerGroup.latestEvaluationNode.id);
    }
    if (answerGroup.latestExplanationNode) {
      relocatedNodeIds.add(answerGroup.latestExplanationNode.id);
    }
    answerGroup.historicalClosureNodes.forEach((node) =>
      relocatedNodeIds.add(node.id),
    );
  });

  questionBlock.summaryGroups.forEach((summaryGroup) => {
    if (summaryGroup.latestCheckNode) {
      relocatedNodeIds.add(summaryGroup.latestCheckNode.id);
    }
    summaryGroup.historicalCheckNodes.forEach((node) =>
      relocatedNodeIds.add(node.id),
    );
  });

  const mainFlowNodeIds = question.childIds.filter(
    (childId) => !relocatedNodeIds.has(childId),
  );

  function updateViewState(
    updater: (state: typeof workspaceViewState) => typeof workspaceViewState,
  ) {
    onWorkspaceViewStateChange(updater(workspaceViewState));
  }

  function toggleQuestionBlockCollapsed() {
    updateViewState((state) => ({
      ...state,
      collapsedQuestionBlockIds: toggleId(
        state.collapsedQuestionBlockIds,
        question.id,
      ),
    }));
  }

  function toggleNodeBody(nodeIdToToggle: string) {
    updateViewState((state) => ({
      ...state,
      collapsedNodeBodyIds: toggleId(
        state.collapsedNodeBodyIds,
        nodeIdToToggle,
      ),
    }));
  }

  function ensureNodeBodyExpanded(nodeIdToExpand: string) {
    if (!workspaceViewState.collapsedNodeBodyIds.includes(nodeIdToExpand)) {
      return;
    }

    updateViewState((state) => ({
      ...state,
      collapsedNodeBodyIds: state.collapsedNodeBodyIds.filter(
        (nodeIdValue) => nodeIdValue !== nodeIdToExpand,
      ),
    }));
  }

  function toggleHistorySection(sectionId: string) {
    updateViewState((state) => ({
      ...state,
      expandedHistorySectionIds: toggleId(
        state.expandedHistorySectionIds,
        sectionId,
      ),
    }));
  }

  function renderSupportNode(node: TreeNode, nodeDepth: number) {
    const inlineActions = renderNodeInlineActions?.({
      isSelected: node.id === selectedNodeId,
      node,
      selectNode: onSelectNode,
      tree,
    });

    return (
      <EditableNodeCard
        actions={inlineActions}
        bodyCollapsed={workspaceViewState.collapsedNodeBodyIds.includes(node.id)}
        depth={nodeDepth}
        isInteractionLocked={isInteractionLocked}
        key={node.id}
        nodeId={node.id}
        onSelectNode={onSelectNode}
        onToggleBodyCollapsed={() => toggleNodeBody(node.id)}
        onUpdateNode={onUpdateNode}
        registerNodeElement={registerNodeElement}
        selectedNodeId={selectedNodeId}
        tree={tree}
      />
    );
  }

  function renderAnswerGroup(
    answerGroup: QuestionBlockAnswerGroup,
    options: {
      isCurrent: boolean;
    },
  ) {
    const answerHistorySectionId = getAnswerHistorySectionId(answerGroup.answer.id);
    const isAnswerHistoryExpanded =
      workspaceViewState.expandedHistorySectionIds.includes(
        answerHistorySectionId,
      );
    const answerActions = (
      <div className="workspace-nodeActionRow">
        {options.isCurrent && onEvaluateAnswer ? (
          <button
            className="workspace-nodeActionButton"
            disabled={
              isInteractionLocked || answerGroup.answer.content.trim().length === 0
            }
            onClick={() => onEvaluateAnswer(question.id, answerGroup.answer.id)}
            type="button"
          >
            重新评估当前回答
          </button>
        ) : null}
        <button
          className="workspace-nodeActionButton"
          disabled={isInteractionLocked}
          onClick={() => {
            ensureNodeBodyExpanded(answerGroup.answer.id);
            onSelectNode(answerGroup.answer.id);
          }}
          type="button"
        >
          继续修改
        </button>
        {!options.isCurrent ? (
          <button
            className="workspace-nodeActionButton"
            disabled={isInteractionLocked}
            onClick={() => onSetCurrentAnswer(question.id, answerGroup.answer.id)}
            type="button"
          >
            设为当前回答
          </button>
        ) : null}
      </div>
    );

    return (
      <div className="workspace-questionBlockGroup" key={answerGroup.answer.id}>
        <EditableNodeCard
          actions={answerActions}
          bodyCollapsed={workspaceViewState.collapsedNodeBodyIds.includes(
            answerGroup.answer.id,
          )}
          depth={depth + 1}
          isInteractionLocked={isInteractionLocked}
          nodeId={answerGroup.answer.id}
          onSelectNode={onSelectNode}
          onToggleBodyCollapsed={() => toggleNodeBody(answerGroup.answer.id)}
          onUpdateNode={onUpdateNode}
          registerNodeElement={registerNodeElement}
          selectedNodeId={selectedNodeId}
          tree={tree}
        />
        {answerGroup.latestEvaluationNode
          ? renderSupportNode(answerGroup.latestEvaluationNode, depth + 2)
          : null}
        {answerGroup.latestExplanationNode
          ? renderSupportNode(answerGroup.latestExplanationNode, depth + 2)
          : null}
        {answerGroup.historicalClosureNodes.length > 0 ? (
          <div className="workspace-historySection">
            <button
              className="workspace-historyToggle"
              disabled={isInteractionLocked}
              onClick={() => toggleHistorySection(answerHistorySectionId)}
              type="button"
            >
              {isAnswerHistoryExpanded
                ? '收起历史评估与旧解析'
                : '展开历史评估与旧解析'}
            </button>
            {isAnswerHistoryExpanded ? (
              <div className="workspace-historyStack">
                {answerGroup.historicalClosureNodes.map((node) =>
                  renderSupportNode(node, depth + 2),
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSummaryGroup(summaryGroup: QuestionBlockSummaryGroup) {
    const summaryHistorySectionId = getSummaryHistorySectionId(
      summaryGroup.summary.id,
    );
    const isSummaryHistoryExpanded =
      workspaceViewState.expandedHistorySectionIds.includes(
        summaryHistorySectionId,
      );
    const summaryActions = (
      <div className="workspace-nodeActionRow">
        {onEvaluateSummary ? (
          <button
            className="workspace-nodeActionButton"
            disabled={
              isInteractionLocked || summaryGroup.summary.content.trim().length === 0
            }
            onClick={() => onEvaluateSummary(summaryGroup.summary.id)}
            type="button"
          >
            检查这个总结
          </button>
        ) : null}
        <button
          className="workspace-nodeActionButton"
          disabled={isInteractionLocked}
          onClick={() => {
            ensureNodeBodyExpanded(summaryGroup.summary.id);
            onSelectNode(summaryGroup.summary.id);
          }}
          type="button"
        >
          继续修改
        </button>
      </div>
    );

    return (
      <div className="workspace-questionBlockGroup" key={summaryGroup.summary.id}>
        <EditableNodeCard
          actions={summaryActions}
          bodyCollapsed={workspaceViewState.collapsedNodeBodyIds.includes(
            summaryGroup.summary.id,
          )}
          depth={depth + 1}
          isInteractionLocked={isInteractionLocked}
          nodeId={summaryGroup.summary.id}
          onSelectNode={onSelectNode}
          onToggleBodyCollapsed={() => toggleNodeBody(summaryGroup.summary.id)}
          onUpdateNode={onUpdateNode}
          registerNodeElement={registerNodeElement}
          selectedNodeId={selectedNodeId}
          tree={tree}
        />
        {summaryGroup.latestCheckNode
          ? renderSupportNode(summaryGroup.latestCheckNode, depth + 2)
          : null}
        {summaryGroup.historicalCheckNodes.length > 0 ? (
          <div className="workspace-historySection">
            <button
              className="workspace-historyToggle"
              disabled={isInteractionLocked}
              onClick={() => toggleHistorySection(summaryHistorySectionId)}
              type="button"
            >
              {isSummaryHistoryExpanded
                ? '收起历史检查结果'
                : '展开历史检查结果'}
            </button>
            {isSummaryHistoryExpanded ? (
              <div className="workspace-historyStack">
                {summaryGroup.historicalCheckNodes.map((node) =>
                  renderSupportNode(node, depth + 2),
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      className="workspace-questionBlock"
      data-active={isActive}
      data-collapsed={isCollapsed}
      data-testid={`question-block-${question.id}`}
    >
      <div className="workspace-questionBlockHeader">
        <div>
          <p className="workspace-kicker">Question Block</p>
          <h3 className="workspace-questionBlockTitle">
            {getDisplayTitleForNode(tree, question)}
          </h3>
        </div>
        <div className="workspace-questionBlockHeaderActions">
          <span className="workspace-counter">
            {questionBlock.currentAnswerGroup ? '已有当前回答' : '还没有当前回答'}
          </span>
          <button
            className="workspace-historyToggle"
            disabled={isInteractionLocked}
            onClick={toggleQuestionBlockCollapsed}
            type="button"
          >
            {isCollapsed ? '展开 block' : '收起 block'}
          </button>
        </div>
      </div>
      {isCollapsed ? null : (
        <div className="workspace-questionBlockStack">
          <EditableNodeCard
            depth={depth}
            isInteractionLocked={isInteractionLocked}
            nodeId={question.id}
            onSelectNode={onSelectNode}
            onUpdateNode={onUpdateNode}
            registerNodeElement={registerNodeElement}
            selectedNodeId={selectedNodeId}
            tree={tree}
          />
          {isActive ? (
            <div
              className="workspace-questionBlockActions"
              data-testid={`question-block-actions-${question.id}`}
            >
              {onDirectAnswerQuestion ? (
                <button
                  className="workspace-nodeActionButton"
                  disabled={
                    isInteractionLocked || questionBlock.currentAnswerGroup !== null
                  }
                  onClick={() => onDirectAnswerQuestion(question.id)}
                  type="button"
                >
                  直接回答当前问题
                </button>
              ) : null}
              <button
                className="workspace-nodeActionButton"
                disabled={isInteractionLocked}
                onClick={() => onInsertAnswerForQuestion(question.id)}
                type="button"
              >
                插入回答
              </button>
              <button
                className="workspace-nodeActionButton"
                disabled={isInteractionLocked}
                onClick={() => onInsertFollowUpQuestion(question.id)}
                type="button"
              >
                插入追问
              </button>
              <button
                className="workspace-nodeActionButton"
                disabled={isInteractionLocked}
                onClick={() => onInsertSummaryForQuestion(question.id)}
                type="button"
              >
                插入总结
              </button>
            </div>
          ) : null}
          {questionBlock.currentAnswerGroup ? (
            <div
              className="workspace-questionBlockPrimary"
              data-testid={`question-block-current-answer-${question.id}`}
            >
              <div className="workspace-questionBlockSectionHeader">
                <p className="workspace-kicker">当前回答</p>
              </div>
              {renderAnswerGroup(questionBlock.currentAnswerGroup, {
                isCurrent: true,
              })}
            </div>
          ) : isActive ? (
            <div className="workspace-questionBlockEmpty">
              <p className="workspace-helpText">
                这个问题块还没有当前回答。可以直接回答，也可以先插入一个空白回答再继续修改。
              </p>
            </div>
          ) : null}
          {mainFlowNodeIds.map((childId) => {
            const childNode = getNodeOrThrow(tree, childId);
            const summaryGroup = questionBlock.summaryGroups.find(
              (candidateGroup) => candidateGroup.summary.id === childId,
            );

            return (
              <Fragment key={childNode.id}>
                {childNode.id === firstFollowUpQuestionId ? (
                  <div className="workspace-splitHint">
                    <div className="workspace-splitHeader">
                      <div>
                        <p className="workspace-kicker">追问区</p>
                        <h3 className="workspace-splitTitle">下面进入 follow-up question</h3>
                      </div>
                      <span className="workspace-counter">
                        {questionBlock.followUpQuestionIds.length} 个追问
                      </span>
                    </div>
                    <p className="workspace-helpText">
                      追问仍然是原始子节点，只是在主视图里被放到当前回答区和历史区之后。
                    </p>
                  </div>
                ) : null}
                {summaryGroup
                  ? renderSummaryGroup(summaryGroup)
                  : renderChildNode(childNode.id, depth + 1)}
              </Fragment>
            );
          })}
          {questionBlock.previousAnswerGroups.length > 0 ? (
            <div className="workspace-historySection">
              <button
                className="workspace-historyToggle"
                disabled={isInteractionLocked}
                onClick={() => toggleHistorySection(previousAnswersHistoryId)}
                type="button"
              >
                {isPreviousAnswersExpanded ? '收起早期回答' : '展开早期回答'}
              </button>
              {isPreviousAnswersExpanded ? (
                <div
                  className="workspace-historyStack"
                  data-testid={`question-block-previous-answers-${question.id}`}
                >
                  {questionBlock.previousAnswerGroups.map((answerGroup) =>
                    renderAnswerGroup(answerGroup, {
                      isCurrent: false,
                    }),
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}
