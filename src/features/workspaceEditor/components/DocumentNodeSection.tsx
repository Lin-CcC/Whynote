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
} from '../../nodeDomain';
import type {
  NodeContentPatch,
  WorkspaceTagVisibilityMode,
} from '../workspaceEditorTypes';
import {
  buildDocumentNodePresentation,
  PLAN_STEP_STATUS_LABELS,
} from './documentNodePresentation';
import NodeTagCluster from './NodeTagCluster';
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
  keepHeaderVisibleWhenBodyCollapsed?: boolean;
  nodeId: string;
  onActivateTagRail: (tagId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleNodeTag: (nodeId: string, tagId: string) => void;
  onToggleBodyCollapsed?: () => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  showSemanticNotes?: boolean;
  supplementalActions?: ReactNode;
  tagVisibilityMode: WorkspaceTagVisibilityMode;
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
  keepHeaderVisibleWhenBodyCollapsed = false,
  nodeId,
  onActivateTagRail,
  onSelectNode,
  onToggleNodeTag,
  onToggleBodyCollapsed,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  showSemanticNotes = false,
  supplementalActions,
  tagVisibilityMode,
  tree,
}: DocumentNodeSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeField, setActiveField] = useState<PendingFocusField>(null);
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
  const isInlineDocumentSurface =
    presentation.sectionKind === 'question' || presentation.isContentNode;
  const bodyToggleLabel = `${bodyCollapsed ? '展开' : '收起'}正文`;
  const hasCollapsedSummary =
    collapsedSummary !== undefined && collapsedSummary !== null;
  const canShowTitleWhileCollapsed =
    !bodyCollapsed || keepHeaderVisibleWhenBodyCollapsed;
  const contentInputVisible =
    !bodyCollapsed &&
    (pendingFocusField === 'content' || activeField === 'content');
  const titleControlVisible =
    isSelected || isEditing || hasFocusWithin || isHovered;
  const titleInputVisible =
    !bodyCollapsed &&
    isSelected &&
    (presentation.alwaysShowTitle ||
      presentation.trimmedDisplayTitle.length > 0 ||
      isTitleInputExpanded);
  const titleDisplayVisible =
    canShowTitleWhileCollapsed &&
    !titleInputVisible &&
    (presentation.alwaysShowTitle ||
      presentation.trimmedDisplayTitle.length > 0);
  const showAddTitleEntry =
    !bodyCollapsed &&
    isSelected &&
    titleControlVisible &&
    presentation.isContentNode &&
    presentation.trimmedDisplayTitle.length === 0 &&
    !titleInputVisible;
  const legacyShell =
    presentation.sectionKind === 'module'
      ? 'document-root'
      : presentation.sectionKind === 'plan-step'
        ? 'section-divider'
        : isInlineDocumentSurface
          ? 'document-inline'
          : 'document-node';
  const visibleSemanticBadges = titleControlVisible
    ? presentation.semanticVisibility.badges
    : presentation.semanticVisibility.badges.filter(isPersistentSemanticBadge);
  const showNodeTypeLabel = shouldShowNodeTypeLabel(
    presentation.sectionKind,
    titleControlVisible,
  );
  const reserveNodeMeta =
    presentation.sectionKind !== 'resource' ||
    presentation.semanticVisibility.badges.length > 0;
  const showNodeMeta = reserveNodeMeta || visibleSemanticBadges.length > 0;
  const frameVisible = hasFocusWithin || isEditing || pendingFocusField !== null;
  const hasTitleControls =
    node.type === 'plan-step' ||
    onToggleBodyCollapsed !== undefined ||
    Boolean(headerControls) ||
    Boolean(actions);
  const titleControlsVisible = hasTitleControls && titleControlVisible;
  const renderedActions = renderActions(actions, titleControlVisible);
  const planStepRuntimeHintLines =
    node.type === 'plan-step' && presentation.planStepRuntimeStatus
      ? [
          `系统判断：${PLAN_STEP_STATUS_LABELS[presentation.planStepRuntimeStatus.suggestedStatus]}。依据：${presentation.planStepRuntimeStatus.reasonSummary}`,
          ...(presentation.hasManualPlanStepStatusOverride
            ? [
                `当前状态已手动改为 ${PLAN_STEP_STATUS_LABELS[node.status]}。后续内容变化时系统会重新托管。`,
              ]
            : []),
        ]
      : [];

  useEffect(() => {
    if (isSelected) {
      return;
    }

    setIsEditing(false);
    setActiveField(null);
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
      setPendingFocusField(null);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [contentInputVisible, isSelected, pendingFocusField, titleInputVisible]);

  useEffect(() => {
    if (!contentInputVisible) {
      return;
    }

    syncContentInputHeight(contentInputRef.current);
  }, [contentInputVisible, node.content]);

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

    setActiveField(
      event.target === titleInputRef.current ? 'title' : 'content',
    );
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

    setActiveField(null);
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
    syncContentInputHeight(event.currentTarget);
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

    if (bodyCollapsed) {
      onSelectNode(node.id);
      return;
    }

    if (field === 'title') {
      setIsTitleInputExpanded(true);
    }

    setActiveField(field);
    setIsEditing(true);
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
      data-node-chrome={isInlineDocumentSurface ? 'document' : 'section'}
      data-node-rail={presentation.sectionKind === 'plan-step' ? 'separator' : 'none'}
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
            {showNodeMeta ? (
              <div className="workspace-nodeMeta">
                {reserveNodeMeta ? (
                  <span
                    aria-hidden={!showNodeTypeLabel}
                    className="workspace-nodeType"
                    data-visible={showNodeTypeLabel}
                  >
                    {presentation.displayLabel}
                  </span>
                ) : null}
                {visibleSemanticBadges.map((badge) => (
                  <span
                    aria-hidden={badge.visibility !== 'persistent' && !titleControlVisible}
                    className="workspace-semanticBadge"
                    data-badge-tone={badge.tone}
                    data-badge-visibility={badge.visibility}
                    data-visible={badge.visibility === 'persistent' || titleControlVisible}
                    key={badge.key}
                  >
                    {badge.label}
                  </span>
                ))}
                <NodeTagCluster
                  isInteractionLocked={isInteractionLocked}
                  isVisible={titleControlVisible}
                  nodeId={node.id}
                  onActivateTagRail={onActivateTagRail}
                  onToggleTag={onToggleNodeTag}
                  tagVisibilityMode={tagVisibilityMode}
                  tree={tree}
                />
              </div>
            ) : null}
            <div className="workspace-nodeTitleRow">
              {renderTitleField()}
              {hasTitleControls ? (
                <div
                  className="workspace-nodeTitleControls"
                  aria-hidden={!titleControlsVisible}
                  data-visible={titleControlsVisible}
                >
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
                      runtimeHintLines={planStepRuntimeHintLines}
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
                  {headerControls ? (
                    <div
                      className="workspace-nodeHeaderControls"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {headerControls}
                    </div>
                  ) : null}
                  {renderedActions ? (
                    <div
                      className="workspace-nodeTitleToolbar"
                      aria-hidden={!titleControlsVisible}
                      data-visible={titleControlsVisible}
                    >
                      {renderedActions}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {bodyCollapsed ? (
            <p className="workspace-nodeHint">{bodyCollapsedHint}</p>
          ) : showSemanticNotes &&
            presentation.semanticVisibility.notes.length > 0 ? (
            <div className="workspace-nodeSemanticNotes">
              {presentation.semanticVisibility.notes.map((note) => (
                <p className="workspace-nodeSemanticNote" key={note}>
                  {note}
                </p>
              ))}
            </div>
          ) : null}
          {!bodyCollapsed && contentInputVisible ? (
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
          ) : bodyCollapsed ? null : (
            <button
              aria-label={`${presentation.displayTitle || presentation.displayLabel} 内容`}
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

function syncContentInputHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function isPersistentSemanticBadge(
  badge: ReturnType<
    typeof buildDocumentNodePresentation
  >['semanticVisibility']['badges'][number],
) {
  return badge.visibility === 'persistent';
}

function shouldShowNodeTypeLabel(
  sectionKind: ReturnType<typeof buildDocumentNodePresentation>['sectionKind'],
  isContextVisible: boolean,
) {
  if (sectionKind === 'module' || sectionKind === 'plan-step') {
    return true;
  }

  return isContextVisible;
}

