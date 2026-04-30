import {
  type CSSProperties,
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from 'react';

import { resolvePlanStepRuntimeStatus } from '../../learningEngine';
import {
  getNodeOrThrow,
  type NodeTree,
  type PlanStepStatus,
  type TreeNode,
} from '../../nodeDomain';
import {
  getDisplayLabelForNode,
  getDisplayTitleForNode,
  getNodeEmphasis,
  getNodeInputPlaceholderForNode,
  getNodeRoleDescription,
} from '../utils/treeSelectors';
import { getNodeSemanticVisibility } from '../utils/nodeSemanticVisibility';
import type { NodeContentPatch } from '../workspaceEditorTypes';

type EditableNodeCardProps = {
  actions?: ReactNode;
  bodyCollapsed?: boolean;
  children?: ReactNode;
  depth: number;
  isInteractionLocked: boolean;
  nodeId: string;
  onSelectNode: (nodeId: string) => void;
  onToggleBodyCollapsed?: () => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

const PLAN_STEP_STATUS_LABELS: Record<PlanStepStatus, string> = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
};

export default function EditableNodeCard({
  actions,
  bodyCollapsed = false,
  children,
  depth,
  isInteractionLocked,
  nodeId,
  onSelectNode,
  onToggleBodyCollapsed,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  tree,
}: EditableNodeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);
  const node = getNodeOrThrow(tree, nodeId);
  const isSelected = node.id === selectedNodeId;
  const displayLabel = getDisplayLabelForNode(tree, node);
  const displayTitle = getDisplayTitleForNode(tree, node);
  const planStepRuntimeStatus =
    node.type === 'plan-step'
      ? resolvePlanStepRuntimeStatus(tree, node.id)
      : null;
  const semanticVisibility = getNodeSemanticVisibility(tree, node);
  const hasManualPlanStepStatusOverride =
    node.type === 'plan-step' &&
    planStepRuntimeStatus !== null &&
    node.status !== planStepRuntimeStatus.suggestedStatus;
  const bodyToggleLabel = `${bodyCollapsed ? '展开' : '收起'}正文`;

  function handleEditableFocus(event: FocusEvent<HTMLElement>) {
    if (
      !isOwnedEditableTarget(event.target, {
        contentInputRef,
        statusSelectRef,
        titleInputRef,
      })
    ) {
      return;
    }

    if (!isSelected) {
      onSelectNode(node.id);
    }

    setIsEditing(true);
  }

  function handleEditableBlur(event: FocusEvent<HTMLElement>) {
    if (
      isOwnedEditableTarget(event.relatedTarget, {
        contentInputRef,
        statusSelectRef,
        titleInputRef,
      })
    ) {
      return;
    }

    setIsEditing(false);
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

  function handleNodeClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    onSelectNode(node.id);
  }

  return (
    <section
      aria-selected={isSelected}
      className="workspace-node"
      data-node-emphasis={getNodeEmphasis(node)}
      data-node-editing={isEditing}
      data-node-selected={isSelected}
      data-node-type={node.type}
      data-testid={`editor-node-${node.id}`}
      onClick={handleNodeClick}
      ref={(element) => registerNodeElement(node.id, element)}
      style={{ '--node-depth': depth } as CSSProperties}
      tabIndex={-1}
    >
      <div className="workspace-nodeHeader">
        <div className="workspace-nodeMeta">
          <span className="workspace-nodeType">{displayLabel}</span>
          {semanticVisibility.badges.map((badge) => (
            <span
              className="workspace-semanticBadge"
              data-badge-tone={badge.tone}
              key={badge.key}
            >
              {badge.label}
            </span>
          ))}
          {node.type === 'plan-step' ? (
            <select
              aria-label={`${displayTitle || displayLabel} 状态`}
              className="workspace-statusSelect"
              disabled={isInteractionLocked}
              onBlur={handleEditableBlur}
              onChange={handleStatusChange}
              onClick={(event) => event.stopPropagation()}
              onFocus={handleEditableFocus}
              ref={statusSelectRef}
              value={node.status}
            >
              {Object.entries(PLAN_STEP_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
          {onToggleBodyCollapsed ? (
            <button
              className="workspace-nodeBodyToggle"
              disabled={isInteractionLocked}
              onClick={(event) => {
                event.stopPropagation();
                onToggleBodyCollapsed();
              }}
              type="button"
            >
              {bodyToggleLabel}
            </button>
          ) : null}
          {isSelected ? (
            <span className="workspace-selectedBadge">已选中</span>
          ) : null}
          {isEditing ? (
            <span className="workspace-editingBadge">编辑中</span>
          ) : null}
        </div>
        {isSelected ? (
          <p className="workspace-nodeSelectionHint">
            {getNodeSelectionHint(tree, node, isEditing)}
          </p>
        ) : null}
        {semanticVisibility.notes.map((note) => (
          <p className="workspace-nodeHint" key={note}>
            {note}
          </p>
        ))}
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
      {actions ? <div className="workspace-nodeInlineActions">{actions}</div> : null}
      {bodyCollapsed ? (
        <p className="workspace-nodeHint">正文已折叠，展开后继续查看或编辑。</p>
      ) : (
        <>
          <input
            aria-label={`${displayTitle || displayLabel} 标题`}
            className="workspace-nodeTitleInput"
            disabled={isInteractionLocked}
            onBlur={handleEditableBlur}
            onChange={handleTitleChange}
            onClick={(event) => event.stopPropagation()}
            onFocus={handleEditableFocus}
            placeholder={getNodeInputPlaceholderForNode(tree, node, 'title')}
            ref={titleInputRef}
            value={displayTitle}
          />
          <textarea
            aria-label={`${displayTitle || displayLabel} 内容`}
            className="workspace-nodeContentInput"
            disabled={isInteractionLocked}
            onBlur={handleEditableBlur}
            onChange={handleContentChange}
            onClick={(event) => event.stopPropagation()}
            onFocus={handleEditableFocus}
            placeholder={getNodeInputPlaceholderForNode(tree, node, 'content')}
            ref={contentInputRef}
            rows={node.type === 'plan-step' ? 3 : 4}
            value={node.content}
          />
        </>
      )}
      {children ? <div className="workspace-nodeChildren">{children}</div> : null}
    </section>
  );
}

function getNodeSelectionHint(
  tree: NodeTree,
  node: TreeNode,
  isEditing: boolean,
) {
  const roleDescription = getNodeRoleDescription(tree, node);

  return isEditing
    ? `${roleDescription}。现在可以直接修改标题或正文。`
    : `${roleDescription}。点击输入框后会进入正文编辑。`;
}

function isOwnedEditableTarget(
  target: EventTarget | null,
  refs: {
    contentInputRef: RefObject<HTMLTextAreaElement | null>;
    statusSelectRef: RefObject<HTMLSelectElement | null>;
    titleInputRef: RefObject<HTMLInputElement | null>;
  },
) {
  return (
    target === refs.titleInputRef.current ||
    target === refs.contentInputRef.current ||
    target === refs.statusSelectRef.current
  );
}
