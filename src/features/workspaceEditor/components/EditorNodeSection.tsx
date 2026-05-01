import { Fragment } from 'react';

import { getNodeOrThrow, isScaffoldSummaryNode, type TreeNode } from '../../nodeDomain';
import CollapsedLearningNodeSummary, {
  buildCollapsedLearningNodeSummaryModel,
} from './CollapsedLearningNodeSummary';
import { getChildNodes, getDisplayTitleForNode } from '../utils/treeSelectors';
import EditableNodeCard from './EditableNodeCard';
import LearningActionPanel from './LearningActionPanel';
import type { MainViewNodeProps } from './mainViewTypes';
import QuestionBlockSection from './QuestionBlockSection';

const PLAN_STEP_STATUS_LABELS = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
} as const;

export default function EditorNodeSection(props: MainViewNodeProps) {
  const { depth, nodeId, tree } = props;
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'question') {
    return (
      <QuestionBlockSection
        {...props}
        renderChildNode={(childNodeId, childDepth) => (
          <EditorNodeSection
            {...props}
            depth={childDepth}
            key={childNodeId}
            nodeId={childNodeId}
          />
        )}
      />
    );
  }

  const childNodes = getChildNodes(tree, node.id);
  const firstChildQuestionNodeId =
    childNodes.find((childNode) => childNode.type === 'question')?.id ?? null;
  const questionChildCount = childNodes.filter(
    (childNode) => childNode.type === 'question',
  ).length;
  const inlineActions = props.renderNodeInlineActions?.({
    isSelected: node.id === props.selectedNodeId,
    node,
    selectNode: props.onSelectNode,
    tree,
  });
  const selectedNodeActions = buildSelectedNodeActions();
  const planStepCollapsed = isPlanStepCollapsed(node, props.workspaceViewState);
  const bodyCollapsed =
    planStepCollapsed ||
    (supportsNodeBodyCollapse(node) &&
      props.workspaceViewState.collapsedNodeBodyIds.includes(node.id));
  const collapsedSummary = planStepCollapsed
    ? buildCollapsedPlanStepSummary()
    : bodyCollapsed && supportsNodeBodyCollapse(node)
      ? buildCollapsedBodySummary()
      : undefined;

  function toggleNodeBodyCollapsed() {
    props.onWorkspaceViewStateChange({
      ...props.workspaceViewState,
      collapsedNodeBodyIds: toggleId(
        props.workspaceViewState.collapsedNodeBodyIds,
        node.id,
      ),
    });
  }

  function togglePlanStepCollapsed() {
    if (node.type !== 'plan-step') {
      return;
    }

    if (!planStepCollapsed) {
      props.onSelectNode(node.id);
    }

    props.onWorkspaceViewStateChange({
      ...props.workspaceViewState,
      collapsedPlanStepIds: toggleId(
        props.workspaceViewState.collapsedPlanStepIds,
        node.id,
      ),
    });
  }

  return (
    <EditableNodeCard
      actions={planStepCollapsed ? null : selectedNodeActions ?? inlineActions}
      bodyCollapsed={bodyCollapsed}
      collapsedSummary={collapsedSummary}
      depth={depth}
      headerControls={
        node.type === 'plan-step' && !planStepCollapsed ? (
          <button
            className="workspace-nodeBodyToggle"
            disabled={props.isInteractionLocked}
            onClick={(event) => {
              event.stopPropagation();
              togglePlanStepCollapsed();
            }}
            type="button"
          >
            {planStepCollapsed ? '展开步骤' : '收起步骤'}
          </button>
        ) : undefined
      }
      isInteractionLocked={props.isInteractionLocked}
      nodeId={node.id}
      onSelectNode={props.onSelectNode}
      onToggleBodyCollapsed={
        supportsNodeBodyCollapse(node) ? toggleNodeBodyCollapsed : undefined
      }
      onUpdateNode={props.onUpdateNode}
      registerNodeElement={props.registerNodeElement}
      selectedNodeId={props.selectedNodeId}
      tree={tree}
    >
      {planStepCollapsed
        ? null
        : childNodes.map((childNode) => (
            <Fragment key={childNode.id}>
              {childNode.id === firstChildQuestionNodeId && questionChildCount > 0 ? (
                <div className="workspace-splitHint">
                  <div className="workspace-splitHeader">
                    <div>
                      <p className="workspace-kicker">问题分区</p>
                      <h3 className="workspace-splitTitle">下面进入 question block 主视图</h3>
                    </div>
                    <span className="workspace-counter">{questionChildCount} 个问题块</span>
                  </div>
                  <p className="workspace-helpText">
                    question block 会把回答、对应结果和追问按链条重新组织显示，但底层树顺序保持不变。
                  </p>
                </div>
              ) : null}
              <EditorNodeSection {...props} depth={depth + 1} nodeId={childNode.id} />
            </Fragment>
          ))}
    </EditableNodeCard>
  );

  function buildSelectedNodeActions() {
    if (node.id !== props.selectedNodeId || !isScaffoldSummaryNode(tree, node)) {
      return null;
    }

    return (
      <LearningActionPanel
        sections={[
          {
            buttons: [
              ...(props.onGenerateFollowUpQuestion
                ? [
                    {
                      disabled: props.isInteractionLocked,
                      label: '生成追问',
                      onClick: () => props.onGenerateFollowUpQuestion?.(node.id),
                    },
                  ]
                : []),
              {
                disabled: props.isInteractionLocked,
                label: '插入追问',
                onClick: () => props.onInsertFollowUpQuestion(node.id),
              },
              ...(props.onGenerateSummary
                ? [
                    {
                      disabled: props.isInteractionLocked,
                      label: '生成总结',
                      onClick: () => props.onGenerateSummary?.(node.id),
                    },
                  ]
                : []),
              {
                disabled: props.isInteractionLocked,
                label: '插入总结',
                onClick: () => props.onInsertSummaryForNode(node.id),
              },
            ],
            title: '通用推进动作',
          },
          {
            buttons: [
              {
                disabled: props.isInteractionLocked,
                label: '继续修改',
                onClick: () => {
                  if (bodyCollapsed) {
                    toggleNodeBodyCollapsed();
                  }

                  props.onSelectNode(node.id);
                },
              },
              {
                disabled: props.isInteractionLocked,
                label: '删除',
                onClick: props.onDeleteNode,
              },
            ],
            title: '通用节点动作',
          },
          {
            buttons: [
              {
                disabled: props.isInteractionLocked,
                label: '换个说法',
                onClick: () => props.onRunLearningAction('rephrase-scaffold'),
              },
              {
                disabled: props.isInteractionLocked,
                label: '更基础一点',
                onClick: () => props.onRunLearningAction('simplify-scaffold'),
              },
              {
                disabled: props.isInteractionLocked,
                label: '举个例子',
                onClick: () => props.onRunLearningAction('add-example'),
              },
            ],
            title: '节点专属动作',
          },
        ]}
        testId={`node-actions-${node.id}`}
      />
    );
  }

  function buildCollapsedPlanStepSummary() {
    if (node.type !== 'plan-step') {
      return null;
    }

    const displayTitle = getDisplayTitleForNode(tree, node).trim();
    const collapsedTitle = displayTitle.length > 0 ? displayTitle : '未命名步骤';

    return (
      <div className="workspace-planStepCollapsedSummary">
        <div className="workspace-planStepCollapsedInfo">
          <div className="workspace-planStepCollapsedMeta">
            <span className="workspace-nodeType">步骤</span>
            <span
              className="workspace-planStepStatusBadge"
              data-status={node.status}
            >
              {PLAN_STEP_STATUS_LABELS[node.status]}
            </span>
          </div>
          <h3 className="workspace-planStepCollapsedTitle">{collapsedTitle}</h3>
          <p className="workspace-planStepCollapsedHint">当前步骤已折叠</p>
        </div>
        <button
          className="workspace-nodeBodyToggle"
          disabled={props.isInteractionLocked}
          onClick={(event) => {
            event.stopPropagation();
            togglePlanStepCollapsed();
          }}
          type="button"
        >
          展开步骤
        </button>
      </div>
    );
  }

  function buildCollapsedBodySummary() {
    return (
      <CollapsedLearningNodeSummary
        {...buildCollapsedLearningNodeSummaryModel(tree, node)}
        isInteractionLocked={props.isInteractionLocked}
        onExpand={toggleNodeBodyCollapsed}
      />
    );
  }
}

function supportsNodeBodyCollapse(node: TreeNode) {
  return (
    node.type === 'answer' ||
    node.type === 'judgment' ||
    node.type === 'summary'
  );
}

function isPlanStepCollapsed(
  node: TreeNode,
  workspaceViewState: MainViewNodeProps['workspaceViewState'],
) {
  return (
    node.type === 'plan-step' &&
    workspaceViewState.collapsedPlanStepIds.includes(node.id)
  );
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}
