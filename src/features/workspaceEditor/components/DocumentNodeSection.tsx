import {
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getNodeOrThrow,
  type NodeTree,
  type PlanStepStatus,
  type TreeNode,
} from '../../nodeDomain';
import { getNodeRoleDescription } from '../utils/treeSelectors';
import type { NodeContentPatch } from '../workspaceEditorTypes';
import {
  buildDocumentNodePresentation,
  PLAN_STEP_STATUS_LABELS,
} from './documentNodePresentation';
import PlanStepStatusMenu from './PlanStepStatusMenu';

export type DocumentNodeSectionProps = {
  actions?: ReactNode;
  bodyCollapsed?: boolean;
  bodyCollapsedHint?: string;
  children?: ReactNode;
  collapsedSummary?: ReactNode;
  depth: number;
  headerControls?: ReactNode;
  isInteractionLocked: boolean;
  nodeId: string;
  onSelectNode: (nodeId: string) => void;
  onToggleBodyCollapsed?: () => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  supplementalActions?: ReactNode;
  tree: NodeTree;
};

type PendingFocusField = 'content' | 'title' | null;

export default function DocumentNodeSection({
  actions,
  bodyCollapsed = false,
  bodyCollapsedHint = '正文已折叠，展开后继续查看或编辑。',
  children,
  collapsedSummary,
  depth,
  headerControls,
  isInteractionLocked,
  nodeId,
  onSelectNode,
  onToggleBodyCollapsed,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  supplementalActions,
  tree,
}: DocumentNodeSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isTitleInputExpanded, setIsTitleInputExpanded] = useState(false);
  const [pendingFocusField, setPendingFocusField] =
    useState<PendingFocusField>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const node = getNodeOrThrow(tree, nodeId);
  const presentation = buildDocumentNodePresentation(tree, node);
  const isSelected = node.id === selectedNodeId;
  const bodyToggleLabel = `${bodyCollapsed ? '展开' : '收起'}正文`;
  const hasCollapsedSummary =
    collapsedSummary !== undefined && collapsedSummary !== null;
  const titleInputVisible =
    !bodyCollapsed &&
    isSelected &&
    (presentation.alwaysShowTitle ||
      presentation.trimmedDisplayTitle.length > 0 ||
      isTitleInputExpanded);
  const titleDisplayVisible =
    !bodyCollapsed &&
    !titleInputVisible &&
    (presentation.alwaysShowTitle ||
      presentation.trimmedDisplayTitle.length > 0);
  const showAddTitleEntry =
    !bodyCollapsed &&
    isSelected &&
    presentation.isContentNode &&
    presentation.trimmedDisplayTitle.length === 0 &&
    !isTitleInputExpanded;
  const legacyShell =
    presentation.sectionKind === 'module'
      ? 'document-root'
      : presentation.sectionKind === 'plan-step'
        ? 'section-divider'
        : 'document-node';
  const frameVisible = isSelected || isEditing;
  const titleControlVisible =
    isSelected || isEditing || hasFocusWithin || isHovered;
  const renderedActions = renderActions(actions, titleControlVisible);

  useEffect(() => {
    if (isSelected) {
      return;
    }

    setIsEditing(false);
    setIsTitleInputExpanded(false);
    setPendingFocusField(null);
  }, [isSelected]);

  useEffect(() => {
    if (!isSelected || !pendingFocusField) {
      return;
    }

    const target =
      pendingFocusField === 'title'
        ? titleInputRef.current
        : contentInputRef.current;

    if (!target) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      target.focus();
      if (pendingFocusField === 'title') {
        target.select();
      }
    });

    setPendingFocusField(null);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isSelected, pendingFocusField, titleInputVisible]);

  function handleEditableFocus(event: FocusEvent<HTMLElement>) {
    if (
      !isOwnedEditableTarget(event.target, {
        contentInputRef,
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
        titleInputRef,
      })
    ) {
      return;
    }

    setIsEditing(false);
  }

  function handleTitleBlur(event: FocusEvent<HTMLInputElement>) {
    handleEditableBlur(event);

    if (
      !presentation.alwaysShowTitle &&
      event.currentTarget.value.trim().length === 0
    ) {
      setIsTitleInputExpanded(false);
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    onUpdateNode(node.id, { title: event.target.value });
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onUpdateNode(node.id, { content: event.target.value });
  }

  function handleStatusChange(status: PlanStepStatus) {
    onUpdateNode(node.id, { status });
  }

  function handleNodeClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    onSelectNode(node.id);
  }

  function handleFocusCapture() {
    setHasFocusWithin(true);
  }

  function handleBlurCapture(event: FocusEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setHasFocusWithin(false);
  }

  function startEditingField(
    field: Exclude<PendingFocusField, null>,
    event: MouseEvent<HTMLElement>,
  ) {
    event.stopPropagation();

    if (isInteractionLocked) {
      return;
    }

    if (field === 'title') {
      setIsTitleInputExpanded(true);
    }

    setPendingFocusField(field);
    onSelectNode(node.id);
  }

  return (
    <section
      aria-selected={isSelected}
      className="workspace-documentNode"
      data-node-collapsed-summary={hasCollapsedSummary}
      data-node-editing={isEditing}
      data-node-emphasis={presentation.emphasis}
      data-node-frame-visible={frameVisible}
      data-node-section-kind={presentation.sectionKind}
      data-node-selected={isSelected}
      data-node-shell={legacyShell}
      data-node-type={node.type}
      data-testid={`editor-node-${node.id}`}
      onBlurCapture={handleBlurCapture}
      onClick={handleNodeClick}
      onFocusCapture={handleFocusCapture}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={(element) => registerNodeElement(node.id, element)}
      style={{ '--node-depth': depth } as CSSProperties}
      tabIndex={-1}
    >
      {hasCollapsedSummary ? (
        <div className="workspace-documentNodeCompactSummary">
          {collapsedSummary}
        </div>
      ) : (
        <>
          <div className="workspace-nodeHeader">
            <div className="workspace-nodeMeta">
              <span className="workspace-nodeType">
                {presentation.displayLabel}
              </span>
              {presentation.semanticVisibility.badges.map((badge) => (
                <span
                  className="workspace-semanticBadge"
                  data-badge-tone={badge.tone}
                  key={badge.key}
                >
                  {badge.label}
                </span>
              ))}
              {isSelected ? (
                <span className="workspace-selectedBadge">已选中</span>
              ) : null}
              {isEditing ? (
                <span className="workspace-editingBadge">编辑中</span>
              ) : null}
            </div>
            <div className="workspace-nodeTitleRow">
              {renderTitleField()}
              <div className="workspace-nodeTitleControls">
                {node.type === 'plan-step' ? (
                  <PlanStepStatusMenu
                    disabled={isInteractionLocked}
                    displayTitle={
                      presentation.displayTitle || presentation.displayLabel
                    }
                    nodeId={node.id}
                    onOpen={() => {
                      if (!isSelected) {
                        onSelectNode(node.id);
                      }
                    }}
                    onStatusChange={handleStatusChange}
                    status={node.status}
                  />
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
                {headerControls}
                {renderedActions ? (
                  <div
                    className="workspace-nodeTitleToolbar"
                    data-visible={titleControlVisible}
                  >
                    {renderedActions}
                  </div>
                ) : null}
              </div>
            </div>
            {isSelected ? (
              <p className="workspace-nodeSelectionHint">
                {getNodeSelectionHint(tree, node, isEditing)}
              </p>
            ) : null}
            {presentation.semanticVisibility.notes.map((note) => (
              <p className="workspace-nodeHint" key={note}>
                {note}
              </p>
            ))}
            {node.type === 'plan-step' && presentation.planStepRuntimeStatus ? (
              <>
                <p className="workspace-nodeHint">
                  {`系统判断：${PLAN_STEP_STATUS_LABELS[presentation.planStepRuntimeStatus.suggestedStatus]}。依据：${presentation.planStepRuntimeStatus.reasonSummary}`}
                </p>
                {presentation.hasManualPlanStepStatusOverride ? (
                  <p className="workspace-nodeHint">
                    {`当前状态已手动改为 ${PLAN_STEP_STATUS_LABELS[node.status]}。后续内容变化时系统会重新托管。`}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          {bodyCollapsed ? (
            <p className="workspace-nodeHint">{bodyCollapsedHint}</p>
          ) : isSelected ? (
            <textarea
              aria-label={`${presentation.displayTitle || presentation.displayLabel} 内容`}
              className="workspace-nodeContentInput"
              disabled={isInteractionLocked}
              onBlur={handleEditableBlur}
              onChange={handleContentChange}
              onClick={(event) => event.stopPropagation()}
              onFocus={handleEditableFocus}
              placeholder={presentation.contentPlaceholder}
              ref={contentInputRef}
              rows={presentation.bodyRows}
              value={node.content}
            />
          ) : (
            <button
              className="workspace-nodeContentDisplay"
              data-placeholder={node.content.trim().length === 0}
              data-testid={`editor-node-content-display-${node.id}`}
              disabled={isInteractionLocked}
              onClick={(event) => startEditingField('content', event)}
              type="button"
            >
              {node.content.trim().length > 0 ? (
                node.content
              ) : (
                <span className="workspace-nodeContentPlaceholder">
                  {presentation.contentPlaceholder}
                </span>
              )}
            </button>
          )}
          {supplementalActions ? (
            <div className="workspace-nodeSupplementalActions">
              {supplementalActions}
            </div>
          ) : null}
          {children ? (
            <div className="workspace-nodeChildren">{children}</div>
          ) : null}
        </>
      )}
    </section>
  );

  function renderTitleField() {
    if (titleInputVisible) {
      return (
        <input
          aria-label={`${presentation.displayTitle || presentation.displayLabel} 标题`}
          className="workspace-nodeTitleInput"
          data-title-tone={presentation.titleTone}
          disabled={isInteractionLocked}
          onBlur={handleTitleBlur}
          onChange={handleTitleChange}
          onClick={(event) => event.stopPropagation()}
          onFocus={handleEditableFocus}
          placeholder={presentation.titlePlaceholder}
          ref={titleInputRef}
          value={presentation.displayTitle}
        />
      );
    }

    if (showAddTitleEntry) {
      return (
        <button
          className="workspace-nodeAddTitleButton"
          data-testid={`editor-node-add-title-${node.id}`}
          disabled={isInteractionLocked}
          onClick={(event) => startEditingField('title', event)}
          type="button"
        >
          添加标题
        </button>
      );
    }

    if (!titleDisplayVisible) {
      return null;
    }

    return (
      <button
        aria-label={`${presentation.displayTitle || presentation.displayLabel} 标题`}
        className="workspace-nodeTitleDisplay"
        data-testid={`editor-node-title-display-${node.id}`}
        data-title-tone={presentation.titleTone}
        disabled={isInteractionLocked}
        onClick={(event) => startEditingField('title', event)}
        type="button"
      >
        {presentation.trimmedDisplayTitle.length > 0 ? (
          presentation.trimmedDisplayTitle
        ) : (
          <span className="workspace-nodeTitlePlaceholder">
            {presentation.titlePlaceholder}
          </span>
        )}
      </button>
    );
  }
}

function getNodeSelectionHint(
  tree: NodeTree,
  node: TreeNode,
  isEditing: boolean,
) {
  const roleDescription = getNodeRoleDescription(tree, node);

  return isEditing
    ? `${roleDescription}。现在可以直接修改标题或正文。`
    : `${roleDescription}。点击标题或正文即可继续修改。`;
}

function isOwnedEditableTarget(
  target: EventTarget | null,
  refs: {
    contentInputRef: RefObject<HTMLTextAreaElement | null>;
    titleInputRef: RefObject<HTMLInputElement | null>;
  },
) {
  return (
    target === refs.titleInputRef.current ||
    target === refs.contentInputRef.current
  );
}

function renderActions(actions: ReactNode, isVisible: boolean) {
  if (!isValidElement<{ isVisible?: boolean }>(actions)) {
    return actions;
  }

  return cloneElement(actions, {
    isVisible: (actions.props.isVisible ?? true) && isVisible,
  } as never);
}
