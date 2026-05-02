import { Fragment, type ReactNode } from 'react';

import {
  buildQuestionBlockData,
  getCurrentQuestionAnswerNodeId,
  getSummaryNodeKind,
  type QuestionBlockAnswerGroup,
  type QuestionBlockEntry,
  type QuestionBlockSummaryGroup,
  type TreeNode,
} from '../../nodeDomain';
import {
  getAnswerHistorySectionId,
  getSummaryHistorySectionId,
} from '../utils/workspaceViewState';
import CollapsedLearningNodeSummary, {
  buildCollapsedLearningNodeSummaryModel,
} from './CollapsedLearningNodeSummary';
import DocumentNodeSection from './DocumentNodeSection';
import LearningActionPanel, {
  type LearningActionSection,
} from './LearningActionPanel';
import type { MainViewNodeProps } from './mainViewTypes';

type QuestionBlockSectionProps = MainViewNodeProps & {
  renderChildNode: (nodeId: string, depth: number) => ReactNode;
};

export default function QuestionBlockSection({
  activeQuestionBlockId,
  depth,
  isInteractionLocked,
  nodeId,
  onDeleteNodeById,
  onDirectAnswerQuestion,
  onEvaluateAnswer,
  onEvaluateSummary,
  onGenerateFollowUpQuestion,
  onGenerateSummary,
  onInsertAnswerForQuestion,
  onInsertFollowUpQuestion,
  onInsertSummaryForNode,
  onSelectNode,
  onSetCurrentAnswer,
  onUpdateNode,
  onWorkspaceViewStateChange,
  registerNodeElement,
  renderChildNode,
  renderNodeInlineActions,
  renderNodeToolbarSections,
  selectedNodeId,
  tree,
  workspaceViewState,
}: QuestionBlockSectionProps) {
  const questionBlock = buildQuestionBlockData(tree, nodeId);
  const { question } = questionBlock;
  const isActive = activeQuestionBlockId === question.id;
  const isCollapsed =
    workspaceViewState.collapsedQuestionBlockIds.includes(question.id);
  const questionIsSelected = selectedNodeId === question.id;
  const isFollowUpQuestion =
    question.parentId !== null &&
    tree.nodes[question.parentId]?.type === 'question';
  const hasSelectedDescendant =
    selectedNodeId !== null &&
    selectedNodeId !== question.id &&
    isNodeWithinSubtree(tree, selectedNodeId, question.id);
  const canRenderQuestionToolbar = !hasSelectedDescendant;

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

  function isNodeBodyCollapsed(nodeIdValue: string) {
    return workspaceViewState.collapsedNodeBodyIds.includes(nodeIdValue);
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

  function selectNodeForEditing(nodeIdToSelect: string) {
    ensureNodeBodyExpanded(nodeIdToSelect);
    onSelectNode(nodeIdToSelect);
  }

  function buildCollapsedNodeSummary(node: TreeNode) {
    return (
      <CollapsedLearningNodeSummary
        {...buildCollapsedLearningNodeSummaryModel(tree, node)}
        isInteractionLocked={isInteractionLocked}
        onExpand={() => toggleNodeBody(node.id)}
      />
    );
  }

  function buildCommonNodeActionSection(nodeIdToSelect: string): LearningActionSection {
    return {
      buttons: [
        {
          disabled: isInteractionLocked,
          label: '删除',
          onClick: () => onDeleteNodeById(nodeIdToSelect),
        },
      ],
      title: '通用节点动作',
    };
  }

  function buildCommonProgressionActionSection(
    actionSourceNodeId: string,
  ): LearningActionSection {
    return {
      buttons: [
        ...(onGenerateFollowUpQuestion
          ? [
              {
                disabled: isInteractionLocked,
                label: '生成追问',
                onClick: () => onGenerateFollowUpQuestion(actionSourceNodeId),
              },
            ]
          : []),
        {
          disabled: isInteractionLocked,
          label: '插入追问',
          onClick: () => onInsertFollowUpQuestion(actionSourceNodeId),
        },
        ...(onGenerateSummary
          ? [
              {
                disabled: isInteractionLocked,
                label: '生成总结',
                onClick: () => onGenerateSummary(actionSourceNodeId),
              },
            ]
          : []),
        {
          disabled: isInteractionLocked,
          label: '插入总结',
          onClick: () => onInsertSummaryForNode(actionSourceNodeId),
        },
      ],
      title: '通用推进动作',
    };
  }

  function renderSupportNode(node: TreeNode, nodeDepth: number) {
    const inlineActions = renderNodeInlineActions?.({
      isSelected: node.id === selectedNodeId,
      node,
      selectNode: onSelectNode,
      tree,
    });

    return (
      <DocumentNodeSection
        actions={buildSupportNodeToolbar(node)}
        bodyCollapsed={isNodeBodyCollapsed(node.id)}
        collapsedSummary={
          isNodeBodyCollapsed(node.id)
            ? buildCollapsedNodeSummary(node)
            : undefined
        }
        depth={nodeDepth}
        isInteractionLocked={isInteractionLocked}
        key={node.id}
        nodeId={node.id}
        onSelectNode={onSelectNode}
        onToggleBodyCollapsed={() => toggleNodeBody(node.id)}
        onUpdateNode={onUpdateNode}
        registerNodeElement={registerNodeElement}
        selectedNodeId={selectedNodeId}
        supplementalActions={inlineActions}
        tree={tree}
      />
    );
  }

  function buildSupportNodeToolbar(node: TreeNode) {
    const runtimeOverflowSections = getRuntimeOverflowSections(node);
    const sections: LearningActionSection[] = [
      buildCommonProgressionActionSection(node.id),
      buildCommonNodeActionSection(node.id),
    ];
    const currentAnswerNodeId =
      node.parentId !== null
        ? getCurrentQuestionAnswerNodeId(tree, node.parentId)
        : null;
    const hasExplicitReturnToAnswerAction = runtimeOverflowSections.some((section) =>
      section.buttons.some(
        (button) => button.label === '回到当前回答继续修改',
      ),
    );

    if (
      currentAnswerNodeId &&
      currentAnswerNodeId !== node.id &&
      !hasExplicitReturnToAnswerAction
    ) {
      sections.push({
        buttons: [
          {
            disabled: isInteractionLocked || currentAnswerNodeId === null,
            label: '回到当前回答继续修改',
            onClick: () => {
              if (!currentAnswerNodeId) {
                return;
              }

              selectNodeForEditing(currentAnswerNodeId);
            },
          },
        ],
        title: '节点专属动作',
      });
    }

    if (
      node.type === 'summary' &&
      getSummaryNodeKind(tree, node) === 'manual' &&
      onEvaluateSummary
    ) {
      sections.push({
        buttons: [
          {
            disabled: isInteractionLocked || node.content.trim().length === 0,
            label: '检查这个总结',
            onClick: () => onEvaluateSummary(node.id),
          },
        ],
        title: '节点专属动作',
      });
    }

    return (
      <LearningActionPanel
        isVisible={true}
        overflowSections={runtimeOverflowSections}
        sections={sections}
        surface="content"
        testId={`node-actions-${node.id}`}
      />
    );
  }

  function getRuntimeOverflowSections(node: TreeNode) {
    return (
      renderNodeToolbarSections?.({
        isSelected: node.id === selectedNodeId,
        node,
        selectNode: onSelectNode,
        tree,
      }) ?? []
    );
  }

  function buildQuestionToolbar() {
    if (!canRenderQuestionToolbar) {
      return undefined;
    }

    return (
      <LearningActionPanel
        isVisible={questionIsSelected}
        sections={[
          buildCommonProgressionActionSection(question.id),
          {
            buttons: [
              ...(onDirectAnswerQuestion
                ? [
                    {
                      disabled:
                        isInteractionLocked ||
                        questionBlock.currentAnswerNodeId !== null,
                      label: '直接回答当前问题',
                      onClick: () => onDirectAnswerQuestion(question.id),
                    },
                  ]
                : []),
              {
                disabled: isInteractionLocked,
                label: '插入回答',
                onClick: () => onInsertAnswerForQuestion(question.id),
              },
            ],
            title: '当前问题动作',
          },
          buildCommonNodeActionSection(question.id),
        ]}
        surface="question"
        testId={`question-block-actions-${question.id}`}
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
      <LearningActionPanel
        isVisible={true}
        sections={[
          buildCommonProgressionActionSection(answerGroup.answer.id),
          buildCommonNodeActionSection(answerGroup.answer.id),
          {
            buttons: [
              ...(options.isCurrent && onEvaluateAnswer
                ? [
                    {
                      disabled:
                        isInteractionLocked ||
                        answerGroup.answer.content.trim().length === 0,
                      label: '重新评估当前回答',
                      onClick: () =>
                        onEvaluateAnswer(question.id, answerGroup.answer.id),
                    },
                  ]
                : []),
              ...(answerGroup.latestExplanationNode
                ? [
                    {
                      disabled: isInteractionLocked,
                      label: '查看答案解析',
                      onClick: () =>
                        onSelectNode(answerGroup.latestExplanationNode!.id),
                    },
                  ]
                : []),
              ...(!options.isCurrent
                ? [
                    {
                      disabled: isInteractionLocked,
                      label: '设为当前回答',
                      onClick: () =>
                        onSetCurrentAnswer(question.id, answerGroup.answer.id),
                    },
                  ]
                : []),
            ],
            title: '节点专属动作',
          },
        ]}
        surface="answer"
        testId={`node-actions-${answerGroup.answer.id}`}
      />
    );

    return (
      <div
        className="workspace-questionBlockGroup"
        data-current-answer={options.isCurrent}
        data-testid={`question-block-answer-group-${answerGroup.answer.id}`}
        key={answerGroup.answer.id}
      >
        <DocumentNodeSection
          actions={answerActions}
          bodyCollapsed={isNodeBodyCollapsed(answerGroup.answer.id)}
          collapsedSummary={
            isNodeBodyCollapsed(answerGroup.answer.id)
              ? buildCollapsedNodeSummary(answerGroup.answer)
              : undefined
          }
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
      <LearningActionPanel
        isVisible={true}
        sections={[
          buildCommonProgressionActionSection(summaryGroup.summary.id),
          buildCommonNodeActionSection(summaryGroup.summary.id),
          {
            buttons: [
              ...(onEvaluateSummary
                ? [
                    {
                      disabled:
                        isInteractionLocked ||
                        summaryGroup.summary.content.trim().length === 0,
                      label: '检查这个总结',
                      onClick: () => onEvaluateSummary(summaryGroup.summary.id),
                    },
                  ]
                : []),
              ...(questionBlock.currentAnswerNodeId
                ? [
                    {
                      disabled: isInteractionLocked,
                      label: '回到当前回答继续修改',
                      onClick: () =>
                        selectNodeForEditing(questionBlock.currentAnswerNodeId!),
                    },
                  ]
                : []),
            ],
            title: '节点专属动作',
          },
        ]}
        surface="content"
        testId={`node-actions-${summaryGroup.summary.id}`}
      />
    );

    return (
      <div
        className="workspace-questionBlockGroup"
        data-testid={`question-block-summary-group-${summaryGroup.summary.id}`}
        key={summaryGroup.summary.id}
      >
        <DocumentNodeSection
          actions={summaryActions}
          bodyCollapsed={isNodeBodyCollapsed(summaryGroup.summary.id)}
          collapsedSummary={
            isNodeBodyCollapsed(summaryGroup.summary.id)
              ? buildCollapsedNodeSummary(summaryGroup.summary)
              : undefined
          }
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
      data-block-chrome="document"
      className="workspace-questionBlock"
      data-active={isActive}
      data-collapsed={isCollapsed}
      data-question-level={isFollowUpQuestion ? 'follow-up' : 'root'}
      data-question-rail="none"
      data-question-selected={questionIsSelected}
      data-testid={`question-block-${question.id}`}
    >
      <DocumentNodeSection
        actions={buildQuestionToolbar()}
        bodyCollapsed={isCollapsed}
        bodyCollapsedHint="当前问题已折叠，展开后继续查看正文和后续内容。"
        depth={depth}
        headerControls={
          <button
            className="workspace-nodeBodyToggle"
            disabled={isInteractionLocked}
            onClick={toggleQuestionBlockCollapsed}
            type="button"
          >
            {isCollapsed ? '展开问题' : '收起问题'}
          </button>
        }
        isInteractionLocked={isInteractionLocked}
        keepHeaderVisibleWhenBodyCollapsed={true}
        nodeId={question.id}
        onSelectNode={onSelectNode}
        onUpdateNode={onUpdateNode}
        registerNodeElement={registerNodeElement}
        selectedNodeId={selectedNodeId}
        tree={tree}
      />
      {isCollapsed
        ? null
        : questionBlock.entries.map((entry) => (
            <Fragment key={getQuestionBlockEntryKey(entry)}>
              {renderQuestionBlockEntry(entry)}
            </Fragment>
          ))}
    </section>
  );

  function renderQuestionBlockEntry(entry: QuestionBlockEntry) {
    if (entry.type === 'answer-group') {
      return renderAnswerGroup(entry.group, {
        isCurrent: entry.group.answer.id === questionBlock.currentAnswerNodeId,
      });
    }

    if (entry.type === 'summary-group') {
      return renderSummaryGroup(entry.group);
    }

    return entry.node.type === 'question' ? (
      <div
        className="workspace-followUpSection"
        data-testid={`follow-up-section-${entry.node.id}`}
      >
        {renderChildNode(entry.node.id, depth + 1)}
      </div>
    ) : (
      renderChildNode(entry.node.id, depth + 1)
    );
  }
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}

function getQuestionBlockEntryKey(entry: QuestionBlockEntry) {
  if (entry.type === 'answer-group') {
    return entry.group.answer.id;
  }

  if (entry.type === 'summary-group') {
    return entry.group.summary.id;
  }

  return entry.node.id;
}

function isNodeWithinSubtree(
  tree: { nodes: Record<string, TreeNode> },
  nodeId: string,
  ancestorNodeId: string,
) {
  let currentNode: TreeNode | undefined = tree.nodes[nodeId];

  while (currentNode) {
    if (currentNode.id === ancestorNodeId) {
      return true;
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return false;
}
