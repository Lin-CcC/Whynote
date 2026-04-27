import { Fragment, type CSSProperties, type ChangeEvent } from 'react';

import { resolvePlanStepRuntimeStatus } from '../../learningEngine';
import { getNodeOrThrow, type NodeTree, type PlanStepStatus } from '../../nodeDomain';
import {
  getChildNodes,
  getDisplayLabelForNode,
  getNodeEmphasis,
  getNodeInputPlaceholderForNode,
} from '../utils/treeSelectors';
import type { NodeContentPatch } from '../workspaceEditorTypes';

type EditorNodeSectionProps = {
  depth: number;
  isInteractionLocked: boolean;
  nodeId: string;
  onSelectNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

const PLAN_STEP_STATUS_LABELS: Record<PlanStepStatus, string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
};

export default function EditorNodeSection({
  depth,
  isInteractionLocked,
  nodeId,
  onSelectNode,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  tree,
}: EditorNodeSectionProps) {
  const node = getNodeOrThrow(tree, nodeId);
  const childNodes = getChildNodes(tree, node.id);
  const isSelected = node.id === selectedNodeId;
  const splitQuestionCount =
    node.type === 'question'
      ? childNodes.filter((childNode) => childNode.type === 'question').length
      : 0;
  const firstSplitQuestionNodeId =
    node.type === 'question'
      ? childNodes.find((childNode) => childNode.type === 'question')?.id ?? null
      : null;
  const planStepRuntimeStatus =
    node.type === 'plan-step'
      ? resolvePlanStepRuntimeStatus(tree, node.id)
      : null;
  const hasManualPlanStepStatusOverride =
    node.type === 'plan-step' &&
    planStepRuntimeStatus !== null &&
    node.status !== planStepRuntimeStatus.suggestedStatus;

  function handleEditableFocus() {
    if (!isSelected) {
      onSelectNode(node.id);
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    onUpdateNode(node.id, { title: event.target.value });
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onUpdateNode(node.id, { content: event.target.value });
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    onUpdateNode(node.id, { status: event.target.value as PlanStepStatus });
  }

  return (
    <section
      className="workspace-node"
      data-node-emphasis={getNodeEmphasis(node)}
      data-node-selected={isSelected}
      data-node-type={node.type}
      data-testid={`editor-node-${node.id}`}
      onClick={() => onSelectNode(node.id)}
      ref={(element) => registerNodeElement(node.id, element)}
      style={{ '--node-depth': depth } as CSSProperties}
      tabIndex={-1}
    >
      <div className="workspace-nodeHeader">
        <div className="workspace-nodeMeta">
          <span className="workspace-nodeType">
            {getDisplayLabelForNode(tree, node)}
          </span>
          {node.type === 'plan-step' ? (
            <select
              aria-label={`${node.title} 的步骤状态`}
              className="workspace-statusSelect"
              disabled={isInteractionLocked}
              onChange={handleStatusChange}
              onClick={(event) => event.stopPropagation()}
              onFocus={handleEditableFocus}
              value={node.status}
            >
              {Object.entries(PLAN_STEP_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
          {isSelected ? <span className="workspace-selectedBadge">已聚焦</span> : null}
        </div>
        {node.type === 'plan-step' && planStepRuntimeStatus ? (
          <>
            <p className="workspace-nodeHint">
              {`系统判断：${PLAN_STEP_STATUS_LABELS[planStepRuntimeStatus.suggestedStatus]}。依据：${planStepRuntimeStatus.reasonSummary}`}
            </p>
            {hasManualPlanStepStatusOverride ? (
              <p className="workspace-nodeHint">
                {`当前状态已手动改为 ${PLAN_STEP_STATUS_LABELS[node.status]}。后续内容变化时系统会重新托管。`}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <input
        aria-label={`${node.title || getDisplayLabelForNode(tree, node)} 标题`}
        className="workspace-nodeTitleInput"
        disabled={isInteractionLocked}
        onChange={handleTitleChange}
        onClick={(event) => event.stopPropagation()}
        onFocus={handleEditableFocus}
        value={node.title}
      />
      <textarea
        aria-label={`${node.title || getDisplayLabelForNode(tree, node)} 内容`}
        className="workspace-nodeContentInput"
        disabled={isInteractionLocked}
        onChange={handleContentChange}
        onClick={(event) => event.stopPropagation()}
        onFocus={handleEditableFocus}
        placeholder={getNodeInputPlaceholderForNode(tree, node, 'content')}
        rows={node.type === 'plan-step' ? 3 : 4}
        value={node.content}
      />
      {childNodes.length > 0 ? (
        <div className="workspace-nodeChildren">
          {childNodes.map((childNode) => (
            <Fragment key={childNode.id}>
              {childNode.id === firstSplitQuestionNodeId ? (
                <div className="workspace-splitHint">
                  <div className="workspace-splitHeader">
                    <div>
                      <p className="workspace-kicker">自动拆分结果</p>
                      <h3 className="workspace-splitTitle">
                        父问题保留，子问题显式承接
                      </h3>
                    </div>
                    <span className="workspace-counter">{splitQuestionCount} 个子问题</span>
                  </div>
                  <p className="workspace-helpText">
                    子问题仍按节点真实顺序展开；若需要继续升降级、插入或删除，先选中对应节点再用左侧结构操作入口。
                  </p>
                </div>
              ) : null}
              <EditorNodeSection
                depth={depth + 1}
                isInteractionLocked={isInteractionLocked}
                key={childNode.id}
                nodeId={childNode.id}
                onSelectNode={onSelectNode}
                onUpdateNode={onUpdateNode}
                registerNodeElement={registerNodeElement}
                selectedNodeId={selectedNodeId}
                tree={tree}
              />
            </Fragment>
          ))}
        </div>
      ) : null}
    </section>
  );
}
