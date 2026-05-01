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
import { getDisplayTitleForNode } from '../utils/treeSelectors';
import {
  getAnswerHistorySectionId,
  getSummaryHistorySectionId,
} from '../utils/workspaceViewState';
import CollapsedLearningNodeSummary, {
  buildCollapsedLearningNodeSummaryModel,
} from './CollapsedLearningNodeSummary';
import type { MainViewNodeProps } from './mainViewTypes';
import DocumentNodeSection from './DocumentNodeSection';
import LearningActionPanel, { type LearningActionSection } from './LearningActionPanel';

type QuestionBlockSectionProps = MainViewNodeProps & {
  renderChildNode: (nodeId: string, depth: number) => ReactNode;
};

export default function QuestionBlockSection({
  activeQuestionBlockId,
  depth,
  isInteractionLocked,
  nodeId,
  onDirectAnswerQuestion,
  onDeleteNode,
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
  selectedNodeId,
  tree,
  workspaceViewState,
}: QuestionBlockSectionProps) {
  const questionBlock = buildQuestionBlockData(tree, nodeId);
  const { question } = questionBlock;
  const isActive = activeQuestionBlockId === question.id;
  const isCollapsed =
    workspaceViewState.collapsedQuestionBlockIds.includes(question.id);
  const firstFollowUpEntryIndex = questionBlock.entries.findIndex(
    (entry) => entry.type === 'node' && entry.node.type === 'question',
  );
  const actionSourceNodeId = resolveQuestionBlockActionSourceNodeId(
    tree,
    question.id,
    selectedNodeId,
  );
  const questionIsSelected = selectedNodeId === question.id;

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

  function isNodeBodyCollapsed(nodeId: string) {
    return workspaceViewState.collapsedNodeBodyIds.includes(nodeId);
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
          label: '继续修改',
          onClick: () => selectNodeForEditing(nodeIdToSelect),
        },
        {
          disabled: isInteractionLocked,
          label: '删除',
          onClick: onDeleteNode,
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
    const supportNodeActions =
      node.id === selectedNodeId
        ? buildSelectedSupportNodeActions(node, inlineActions)
        : inlineActions;

    return (
      <DocumentNodeSection
        actions={supportNodeActions}
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
        tree={tree}
      />
    );
  }

  function buildSelectedSupportNodeActions(
    node: TreeNode,
    inlineActions: ReactNode,
  ) {
    const sections: LearningActionSection[] = [
      buildCommonProgressionActionSection(node.id),
      buildCommonNodeActionSection(node.id),
    ];

    if (
      node.type === 'summary' &&
      node.parentId !== null &&
      getSummaryNodeKind(tree, node) === 'answer-closure'
    ) {
      const currentAnswerNodeId = getCurrentQuestionAnswerNodeId(tree, node.parentId);

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

    return (
      <LearningActionPanel sections={sections} testId={`node-actions-${node.id}`}>
        {inlineActions}
      </LearningActionPanel>
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
    const answerActions =
      answerGroup.answer.id === selectedNodeId ? (
        <LearningActionPanel
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
          testId={`node-actions-${answerGroup.answer.id}`}
        />
      ) : null;

    return (
      <div
        className="workspace-questionBlockGroup"
        data-current-answer={options.isCurrent}
        data-testid={`question-block-answer-group-${answerGroup.answer.id}`}
        key={answerGroup.answer.id}
      >
        {options.isCurrent ? (
          <div className="workspace-questionBlockSectionHeader">
            <p className="workspace-kicker">当前回答</p>
          </div>
        ) : null}
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
    const summaryActions =
      summaryGroup.summary.id === selectedNodeId ? (
        <LearningActionPanel
          sections={[
            buildCommonProgressionActionSection(summaryGroup.summary.id),
            buildCommonNodeActionSection(summaryGroup.summary.id),
            {
              buttons: onEvaluateSummary
                ? [
                    {
                      disabled:
                        isInteractionLocked ||
                        summaryGroup.summary.content.trim().length === 0,
                      label: '检查这个总结',
                      onClick: () => onEvaluateSummary(summaryGroup.summary.id),
                    },
                  ]
                : [],
              title: '节点专属动作',
            },
          ]}
          testId={`node-actions-${summaryGroup.summary.id}`}
        />
      ) : null;

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
            {questionBlock.currentAnswerNodeId ? '已有当前回答' : '还没有当前回答'}
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
          <DocumentNodeSection
            depth={depth}
            isInteractionLocked={isInteractionLocked}
            nodeId={question.id}
            onSelectNode={onSelectNode}
            onUpdateNode={onUpdateNode}
            registerNodeElement={registerNodeElement}
            selectedNodeId={selectedNodeId}
            tree={tree}
          />
          {questionIsSelected ? (
            <div
              className="workspace-questionBlockActions"
              data-testid={`question-block-actions-${question.id}`}
            >
              <LearningActionPanel
                sections={[
                  buildCommonProgressionActionSection(actionSourceNodeId),
                  {
                    buttons: [
                      ...(questionIsSelected && onDirectAnswerQuestion
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
                  {
                    buttons: questionIsSelected
                      ? [
                          {
                            disabled: isInteractionLocked,
                            label: '继续修改',
                            onClick: () => onSelectNode(question.id),
                          },
                          {
                            disabled: isInteractionLocked,
                            label: '删除',
                            onClick: onDeleteNode,
                          },
                        ]
                      : [],
                    title: '通用节点动作',
                  },
                ]}
              />
            </div>
          ) : null}
          {!questionBlock.currentAnswerNodeId && isActive ? (
            <div className="workspace-questionBlockEmpty">
              <p className="workspace-helpText">
                这个问题块还没有当前回答。可以直接回答，也可以先插入一个空白回答再继续修改。
              </p>
            </div>
          ) : null}
          {questionBlock.entries.map((entry, entryIndex) => {
            return (
              <Fragment key={getQuestionBlockEntryKey(entry)}>
                {entryIndex === firstFollowUpEntryIndex ? (
                  <div className="workspace-splitHint">
                    <div className="workspace-splitHeader">
                      <div>
                        <p className="workspace-kicker">追问区</p>
                        <h3 className="workspace-splitTitle">下面进入 follow-up question</h3>
                      </div>
                      <span className="workspace-counter">按真实链条继续展开</span>
                    </div>
                    <p className="workspace-helpText">
                      追问仍然是原始子节点，只是在主视图里紧接所属回答闭环之后显示。
                    </p>
                  </div>
                ) : null}
                {renderQuestionBlockEntry(entry)}
              </Fragment>
            );
          })}
        </div>
      )}
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

    return renderChildNode(entry.node.id, depth + 1);
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

function resolveQuestionBlockActionSourceNodeId(
  tree: { nodes: Record<string, TreeNode> },
  questionNodeId: string,
  selectedNodeId: string | null,
) {
  if (!selectedNodeId) {
    return questionNodeId;
  }

  const selectedNode = tree.nodes[selectedNodeId];

  if (!selectedNode) {
    return questionNodeId;
  }

  if (selectedNode.type === 'question') {
    return selectedNode.id === questionNodeId ? selectedNode.id : questionNodeId;
  }

  return selectedNode.parentId === questionNodeId ? selectedNode.id : questionNodeId;
}
