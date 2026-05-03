import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import {
  buildStructureMapPresentationModel,
  findNearestQuestionNodeId,
  getNodeOrThrow,
  getStructureMapNodeLabel,
  getStructureMapSelectionId,
  resolveStructureMapSelectionAnchor,
  type NodeTree,
  type StructureMapAnchor,
  type StructureMapAnswerGroupNode,
  type StructureMapDropRejectionCode,
  type StructureMapManualSummaryGroupNode,
  type StructureMapMoveRequest,
  type StructureMapMoveValidationResult,
  type StructureMapPresentationModel,
  type StructureMapQuestionBlockNode,
  type StructureMapQuestionEntry,
  type StructureMapSection,
  type StructureMapSectionItem,
} from '../../nodeDomain';
import type {
  EditorActionAvailability,
  StructureMapFocusTarget,
  WorkspaceViewState,
} from '../workspaceEditorTypes';
import { getActionAvailability } from '../hooks/useWorkspaceEditor';

type StructureMapMainViewProps = {
  currentModuleId: string | null;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
  onDeleteStructureMapNode: (nodeId: string) => void;
  onInsertStructureMapChildNode: (nodeId: string) => void;
  onInsertStructureMapSiblingNode: (nodeId: string) => void;
  onMoveStructureMapNode: (request: StructureMapMoveRequest) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  onRenameStructureMapNode: (nodeId: string, title: string) => void;
  onSelectStructureMapNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
  validateStructureMapMove: (
    request: StructureMapMoveRequest,
  ) => StructureMapMoveValidationResult;
  onWorkspaceViewStateChange: (state: WorkspaceViewState) => void;
  workspaceViewState: WorkspaceViewState;
};

type DragState = {
  nodeId: string;
};

type DropFeedback = {
  code: StructureMapDropRejectionCode;
  message: string;
};

type MoveFeedback = {
  message: string;
  targetTestId: string | null;
};

type StructureMapDropZoneState =
  | {
      state: 'idle' | 'noop';
    }
  | {
      state: 'invalid';
      validation: Extract<StructureMapMoveValidationResult, { allowed: false }>;
    }
  | {
      state: 'valid';
      validation: Extract<StructureMapMoveValidationResult, { allowed: true }>;
    };

type StructureRole =
  | 'answer-group'
  | 'plan-step'
  | 'question'
  | 'scaffold-summary'
  | 'summary-group';

type QuestionEntryDescriptor = {
  entry: StructureMapQuestionEntry;
  index: number;
};

type StructureMapSelectionContext = {
  planStepNodeId: string | null;
  questionNodeId: string | null;
};

type StructureMapToolbarState = {
  contextKind: 'plan-step' | 'question-cluster';
  contextLabel: string;
  focusTarget: StructureMapFocusTarget;
  isFocused: boolean;
  stepCollapsed: boolean;
  stepNodeId: string | null;
};

type TitleEditingState = {
  draft: string;
  itemId: string;
  nodeId: string;
  originalTitle: string;
};

const STRUCTURE_MAP_EDGE_SCROLL_ZONE_PX = 112;
const STRUCTURE_MAP_EDGE_SCROLL_MAX_SPEED_PX = 26;

type StructureMapIconAction = {
  dataCollapsed?: boolean;
  dataStructureClusterAction?: string;
  icon: 'collapse' | 'expand' | 'focus' | 'unfocus';
  id: string;
  label: string;
  onClick: () => void;
};

type StructureMapMenuAction = {
  disabled?: boolean;
  id: string;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'default';
};

type StructureMapStatusBadge = {
  id: string;
  label: string;
  tone: 'focused';
};

type StructureMapRenderProps = {
  activeDropZoneId: string | null;
  dragState: DragState | null;
  isInteractionLocked: boolean;
  onCancelTitleEditing: () => void;
  onDeleteStructureMapNode: (nodeId: string) => void;
  onDragEnd: () => void;
  onInvalidDrop: (feedback: DropFeedback) => void;
  onDragStart: (nodeId: string) => void;
  onDropRequest: (
    request: Omit<StructureMapMoveRequest, 'nodeId'>,
    siblingNodeIds: string[],
  ) => void;
  onDropZoneEnter: (dropZoneId: string | null) => void;
  onInsertStructureMapChildNode: (nodeId: string) => void;
  onInsertStructureMapSiblingNode: (nodeId: string) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  onSelectStructureMapNode: (nodeId: string) => void;
  onStartTitleEditing: (nodeId: string, itemId: string, title: string) => void;
  onSubmitTitleEditing: () => void;
  onTitleEditingDraftChange: (draft: string) => void;
  onToggleStructureMapClusterCollapsed: (questionNodeId: string) => void;
  onToggleStructureMapFocusTarget: (target: StructureMapFocusTarget) => void;
  onToggleStructureMapFollowUpCollapsed: (questionNodeId: string) => void;
  onToggleStructureMapStepCollapsed: (planStepNodeId: string) => void;
  selectedItemId: string | null;
  selectionContext: StructureMapSelectionContext;
  structureMapFocusTarget: StructureMapFocusTarget | null;
  titleEditingState: TitleEditingState | null;
  tree: NodeTree;
  validateStructureMapMove: (
    request: StructureMapMoveRequest,
  ) => StructureMapMoveValidationResult;
  workspaceViewState: WorkspaceViewState;
};

export default function StructureMapMainView({
  currentModuleId,
  isInteractionLocked,
  onCreateModule,
  onDeleteStructureMapNode,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onMoveStructureMapNode,
  onOpenDocumentNode,
  onRenameStructureMapNode,
  onSelectStructureMapNode,
  onWorkspaceViewStateChange,
  selectedNodeId,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapMainViewProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropZoneId, setActiveDropZoneId] = useState<string | null>(null);
  const [dropFeedback, setDropFeedback] = useState<DropFeedback | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);
  const [titleEditingState, setTitleEditingState] =
    useState<TitleEditingState | null>(null);
  const [forcedScrollTargetTestId, setForcedScrollTargetTestId] = useState<
    string | null
  >(null);
  const structureMapShellRef = useRef<HTMLDivElement | null>(null);
  const autoScrollContainerRef = useRef<HTMLElement | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollVelocityRef = useRef(0);

  if (!currentModuleId || !tree.nodes[currentModuleId]) {
    return (
      <div className="workspace-mainPanel">
        <div
          className="workspace-documentShell workspace-documentShell-empty"
          data-layout="single-column"
          data-testid="workspace-structure-map-shell"
        >
          <header className="workspace-documentHeader">
            <p className="workspace-kicker">结构地图</p>
            <h2 className="workspace-documentTitle">还没有可展示的模块</h2>
          </header>
          <div className="workspace-emptyState">
            <p className="workspace-helpText">
              先创建模块，再用结构地图做定位、联动和重排。
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
        </div>
      </div>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);
  const model = buildStructureMapPresentationModel(tree, currentModuleId);
  const structureMapFocusTarget = resolveStructureMapFocusTarget(
    model,
    workspaceViewState.structureMapFocusTarget,
  );
  const focusedSections = getStructureMapSectionsForFocus(
    model,
    structureMapFocusTarget,
  );
  const selectedAnchor = resolveStructureMapSelectionAnchor(
    tree,
    currentModuleId,
    selectedNodeId,
  );
  const selectedItemId = selectedAnchor
    ? getStructureMapSelectionId(selectedAnchor)
    : null;
  const sectionNodeIds = focusedSections.map((section) => section.anchor.nodeId);
  const selectionContext = resolveStructureMapSelectionContext(tree, selectedNodeId);
  const toolbarState = resolveStructureMapToolbarState(
    model.sections,
    tree,
    selectionContext,
    structureMapFocusTarget,
    workspaceViewState,
  );
  const mapStatus = dragState
    ? {
        text: '拖动中：蓝色提示表示可落点，红色提示表示当前落点不允许。',
        tone: 'info' as const,
      }
    : dropFeedback
      ? {
          text: `当前落点无效：${dropFeedback.message}`,
          tone: 'invalid' as const,
        }
      : moveFeedback
        ? {
            text: moveFeedback.message,
            tone: 'success' as const,
          }
        : null;

  useEffect(() => {
    const shell = structureMapShellRef.current;

    if (!shell || !forcedScrollTargetTestId) {
      return;
    }
    const targetElement = findElementByTestId(shell, forcedScrollTargetTestId);

    if (!targetElement) {
      setForcedScrollTargetTestId(null);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      targetElement.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
      });
      setForcedScrollTargetTestId(null);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [forcedScrollTargetTestId]);

  useEffect(() => {
    if (!moveFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMoveFeedback(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [moveFeedback]);

  useEffect(() => {
    if (!titleEditingState || tree.nodes[titleEditingState.nodeId]) {
      return;
    }

    setTitleEditingState(null);
  }, [titleEditingState, tree]);

  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
  }, []);

  function stopAutoScroll() {
    autoScrollVelocityRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function ensureAutoScrollContainer() {
    if (autoScrollContainerRef.current?.isConnected) {
      return autoScrollContainerRef.current;
    }

    autoScrollContainerRef.current = resolveVerticalScrollContainer(
      structureMapShellRef.current,
    );

    return autoScrollContainerRef.current;
  }

  function runAutoScrollFrame() {
    const container = ensureAutoScrollContainer();
    const velocity = autoScrollVelocityRef.current;

    if (!container || velocity === 0 || !dragState) {
      stopAutoScroll();
      return;
    }

    container.scrollTop += velocity;
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScrollFrame);
  }

  function updateAutoScrollVelocity(clientY: number) {
    const container = ensureAutoScrollContainer();

    if (!container) {
      stopAutoScroll();
      return;
    }

    const containerRect = getVerticalScrollBounds(container);
    const edgeZone = Math.min(
      STRUCTURE_MAP_EDGE_SCROLL_ZONE_PX,
      containerRect.height / 3,
    );
    let nextVelocity = 0;

    if (clientY < containerRect.top + edgeZone) {
      const ratio = Math.min(
        1,
        (containerRect.top + edgeZone - clientY) / edgeZone,
      );
      nextVelocity = -Math.max(
        2,
        Math.round(STRUCTURE_MAP_EDGE_SCROLL_MAX_SPEED_PX * ratio * ratio),
      );
    } else if (clientY > containerRect.bottom - edgeZone) {
      const ratio = Math.min(
        1,
        (clientY - (containerRect.bottom - edgeZone)) / edgeZone,
      );
      nextVelocity = Math.max(
        2,
        Math.round(STRUCTURE_MAP_EDGE_SCROLL_MAX_SPEED_PX * ratio * ratio),
      );
    }

    autoScrollVelocityRef.current = nextVelocity;

    if (nextVelocity === 0) {
      stopAutoScroll();
      return;
    }

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScrollFrame);
    }
  }

  function handleShellDragOverCapture(event: DragEvent<HTMLDivElement>) {
    if (!dragState || isInteractionLocked) {
      return;
    }

    updateAutoScrollVelocity(event.clientY);
  }

  function handleShellDragLeaveCapture(event: DragEvent<HTMLDivElement>) {
    if (!dragState) {
      return;
    }

    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    stopAutoScroll();
  }

  function updateWorkspaceViewState(
    updater: (state: WorkspaceViewState) => WorkspaceViewState,
  ) {
    onWorkspaceViewStateChange(updater(workspaceViewState));
  }

  function toggleStructureMapStepCollapsed(planStepNodeId: string) {
    updateWorkspaceViewState((state) => ({
      ...state,
      collapsedStructureMapStepIds: toggleId(
        state.collapsedStructureMapStepIds,
        planStepNodeId,
      ),
    }));
  }

  function toggleStructureMapClusterCollapsed(questionNodeId: string) {
    updateWorkspaceViewState((state) => ({
      ...state,
      collapsedStructureMapClusterIds: toggleId(
        state.collapsedStructureMapClusterIds,
        questionNodeId,
      ),
    }));
  }

  function toggleStructureMapFollowUpCollapsed(questionNodeId: string) {
    updateWorkspaceViewState((state) => ({
      ...state,
      collapsedStructureMapFollowUpIds: toggleId(
        state.collapsedStructureMapFollowUpIds,
        questionNodeId,
      ),
    }));
  }

  function toggleStructureMapFocusTarget(target: StructureMapFocusTarget) {
    setMoveFeedback(null);
    updateWorkspaceViewState((state) => ({
      ...state,
      structureMapFocusTarget:
        state.structureMapFocusTarget?.kind === target.kind &&
        state.structureMapFocusTarget.nodeId === target.nodeId
          ? null
          : target,
    }));
  }

  function handleDragStart(nodeId: string) {
    setDropFeedback(null);
    setMoveFeedback(null);
    setDragState({ nodeId });
  }

  function handleDragEnd() {
    stopAutoScroll();
    setActiveDropZoneId(null);
    setDragState(null);
  }

  function handleDropRequest(
    request: Omit<StructureMapMoveRequest, 'nodeId'>,
    siblingNodeIds: string[],
  ) {
    if (!dragState || isInteractionLocked) {
      setActiveDropZoneId(null);
      return;
    }

    const nextRequest: StructureMapMoveRequest = {
      ...request,
      nodeId: dragState.nodeId,
    };

    if (
      isNoopMove(
        dragState.nodeId,
        request.index ?? siblingNodeIds.length,
        siblingNodeIds,
      )
    ) {
      setActiveDropZoneId(null);
      return;
    }

    const validation = validateStructureMapMove(nextRequest);

    if (!validation.allowed) {
      setActiveDropZoneId(null);
      return;
    }

    const movedAnchor = resolveStructureMapSelectionAnchor(
      tree,
      currentModuleId,
      dragState.nodeId,
    );
    const movedTargetTestId = movedAnchor
      ? `structure-map-item-${getStructureMapSelectionId(movedAnchor)}`
      : null;
    const movedNode = tree.nodes[dragState.nodeId];

    onMoveStructureMapNode(nextRequest);
    setActiveDropZoneId(null);
    setDropFeedback(null);
    setDragState(null);
    setForcedScrollTargetTestId(movedTargetTestId);
    setMoveFeedback({
      message: movedNode
        ? `已移动：${getStructureMapNodeLabel(tree, movedNode, '节点')}`
        : '已移动，仍停留在结构地图',
      targetTestId: movedTargetTestId,
    });
  }

  function handleInvalidDrop(feedback: DropFeedback) {
    setMoveFeedback(null);
    setDropFeedback(feedback);
  }

  function handleStartTitleEditing(nodeId: string, itemId: string, title: string) {
    if (isInteractionLocked) {
      return;
    }

    setTitleEditingState({
      draft: title,
      itemId,
      nodeId,
      originalTitle: title,
    });
  }

  function handleTitleEditingDraftChange(draft: string) {
    setTitleEditingState((previousState) =>
      previousState
        ? {
            ...previousState,
            draft,
          }
        : previousState,
    );
  }

  function handleSubmitTitleEditing() {
    setTitleEditingState((previousState) => {
      if (!previousState) {
        return previousState;
      }

      if (previousState.draft !== previousState.originalTitle) {
        onRenameStructureMapNode(previousState.nodeId, previousState.draft);
      }

      return null;
    });
  }

  function handleCancelTitleEditing() {
    setTitleEditingState(null);
  }

  return (
    <div className="workspace-mainPanel">
      <div
        className="workspace-documentShell workspace-structureMapShell"
        data-layout="single-column"
        data-structure-drop-behavior="stay-in-map"
        data-testid="workspace-structure-map-shell"
        onDragLeaveCapture={handleShellDragLeaveCapture}
        onDragOverCapture={handleShellDragOverCapture}
        onDropCapture={stopAutoScroll}
        ref={structureMapShellRef}
      >
        <header className="workspace-documentHeader">
          <div className="workspace-documentHeaderMain">
            <p className="workspace-kicker workspace-documentKicker">结构地图</p>
            <h2 className="workspace-documentTitle">
              {getStructureMapNodeLabel(tree, currentModule, '模块')}
            </h2>
          </div>
          <p className="workspace-helpText">
            这里负责按问题聚合结构、联动文档和拖动重排，正文编辑仍留在文档视图。
          </p>
        </header>
        {mapStatus ? (
          <div
            className="workspace-structureMapStatus"
            data-tone={mapStatus.tone}
            role="status"
          >
            <span className="workspace-structureMapStatusText">{mapStatus.text}</span>
          </div>
        ) : null}
        {toolbarState ? (
          <div
            className="workspace-structureMapToolbar"
            data-structure-toolbar="map-global-status"
          >
            <div
              className="workspace-structureMapToolbarContext"
              data-structure-toolbar-section="context"
            >
              <span className="workspace-structureMapToolbarLabel">
                {toolbarState.contextKind === 'plan-step' ? '步骤' : '问题'}
              </span>
              <span className="workspace-structureMapToolbarTitle">
                {toolbarState.contextLabel}
              </span>
            </div>
            <div
              className="workspace-structureMapToolbarStatus"
              data-structure-toolbar-section="status"
            >
              {toolbarState.isFocused ? (
                <span className="workspace-structureMapToolbarBadge">聚焦中</span>
              ) : null}
            </div>
            <div
              className="workspace-structureMapToolbarActions"
              data-structure-toolbar-section="actions"
            >
              {toolbarState.isFocused ? (
                <button
                  className="workspace-structureMapToolbarButton"
                  data-tone="subtle"
                  disabled={isInteractionLocked}
                  onClick={() =>
                    updateWorkspaceViewState((state) => ({
                      ...state,
                      structureMapFocusTarget: null,
                    }))
                  }
                  type="button"
                >
                  <span
                    aria-label={
                      toolbarState.focusTarget.kind === 'plan-step'
                        ? '退出步骤聚焦'
                        : '退出地图聚焦'
                    }
                  >
                    退出聚焦
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="workspace-structureMapBody">
          <StructureMapDropZone
            activeDropZoneId={activeDropZoneId}
            dragState={dragState}
            dropRequest={{
              index: 0,
              targetParentNodeId: currentModule.id,
            }}
            dropZoneId={createDropZoneId(currentModule.id, 0)}
            isInteractionLocked={isInteractionLocked}
            onDropRequest={handleDropRequest}
            onDropZoneEnter={setActiveDropZoneId}
            onInvalidDrop={handleInvalidDrop}
            siblingNodeIds={sectionNodeIds}
            validateStructureMapMove={validateStructureMapMove}
          />
          {focusedSections.map((section, index) => (
            <div
              className="workspace-structureMapSection"
              data-structure-panel={section.planStep.id}
              data-structure-role="plan-step-panel"
              data-testid={`structure-map-panel-${section.planStep.id}`}
              key={section.anchor.nodeId}
            >
              <SectionNode
                activeDropZoneId={activeDropZoneId}
                dragState={dragState}
                isInteractionLocked={isInteractionLocked}
                onCancelTitleEditing={handleCancelTitleEditing}
                onDeleteStructureMapNode={onDeleteStructureMapNode}
                onDragEnd={handleDragEnd}
                onInvalidDrop={handleInvalidDrop}
                onDragStart={handleDragStart}
                onDropRequest={handleDropRequest}
                onDropZoneEnter={setActiveDropZoneId}
                onInsertStructureMapChildNode={onInsertStructureMapChildNode}
                onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
                onOpenDocumentNode={onOpenDocumentNode}
                onSelectStructureMapNode={onSelectStructureMapNode}
                onStartTitleEditing={handleStartTitleEditing}
                onSubmitTitleEditing={handleSubmitTitleEditing}
                onTitleEditingDraftChange={handleTitleEditingDraftChange}
                onToggleStructureMapClusterCollapsed={
                  toggleStructureMapClusterCollapsed
                }
                onToggleStructureMapFocusTarget={toggleStructureMapFocusTarget}
                onToggleStructureMapFollowUpCollapsed={
                  toggleStructureMapFollowUpCollapsed
                }
                onToggleStructureMapStepCollapsed={toggleStructureMapStepCollapsed}
                section={section}
                selectedItemId={selectedItemId}
                selectionContext={selectionContext}
                structureMapFocusTarget={structureMapFocusTarget}
                titleEditingState={titleEditingState}
                tree={tree}
                validateStructureMapMove={validateStructureMapMove}
                workspaceViewState={workspaceViewState}
              />
              <StructureMapDropZone
                activeDropZoneId={activeDropZoneId}
                dragState={dragState}
                dropRequest={{
                  index: index + 1,
                  targetParentNodeId: currentModule.id,
                }}
                dropZoneId={createDropZoneId(currentModule.id, index + 1)}
                isInteractionLocked={isInteractionLocked}
                onDropRequest={handleDropRequest}
                onDropZoneEnter={setActiveDropZoneId}
                onInvalidDrop={handleInvalidDrop}
                siblingNodeIds={sectionNodeIds}
                validateStructureMapMove={validateStructureMapMove}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionNode({
  activeDropZoneId,
  dragState,
  isInteractionLocked,
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  section,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
  titleEditingState,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapRenderProps & {
  section: StructureMapSection;
}) {
  const itemNodeIds = section.items.map((item) => getSectionItemAnchorNodeId(item));
  const isCollapsed = workspaceViewState.collapsedStructureMapStepIds.includes(
    section.planStep.id,
  );
  const isCurrentPlanStep = selectionContext.planStepNodeId === section.planStep.id;
  const isFocused =
    structureMapFocusTarget?.kind === 'plan-step' &&
    structureMapFocusTarget.nodeId === section.planStep.id;
  const itemId = getStructureMapSelectionId(section.anchor);
  const nodeActionAvailability = getActionAvailability(tree, section.planStep.id);

  return (
    <div className="workspace-structureMapPanelBody">
      <StructureMapNodeCard
        actionAvailability={nodeActionAvailability}
        anchor={section.anchor}
        dragNodeId={section.planStep.id}
        dragPermission={section.drag}
        dragState={dragState}
        hasInlineStepActions
        focusAction={{
          icon: isFocused ? 'unfocus' : 'focus',
          id: 'focus-step',
          label: isFocused ? '退出步骤聚焦' : '聚焦当前步骤',
          onClick: () =>
            onToggleStructureMapFocusTarget({
              kind: 'plan-step',
              nodeId: section.planStep.id,
            }),
        }}
        isCurrentAnswer={false}
        isEditingTitle={titleEditingState?.itemId === itemId}
        isInteractionLocked={isInteractionLocked}
        collapseAction={{
          dataCollapsed: isCollapsed,
          icon: isCollapsed ? 'expand' : 'collapse',
          id: 'collapse-step',
          label: isCollapsed ? '展开面板' : '收起面板',
          onClick: () => onToggleStructureMapStepCollapsed(section.planStep.id),
        }}
        kindLabel="步骤"
        onCancelTitleEditing={onCancelTitleEditing}
        onDeleteStructureMapNode={onDeleteStructureMapNode}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onInsertStructureMapChildNode={onInsertStructureMapChildNode}
        onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
        onOpenDocumentNode={onOpenDocumentNode}
        onSelectStructureMapNode={onSelectStructureMapNode}
        onStartTitleEditing={onStartTitleEditing}
        onSubmitTitleEditing={onSubmitTitleEditing}
        onTitleEditingDraftChange={onTitleEditingDraftChange}
        isSelectedOverride={isCollapsed && isCurrentPlanStep}
        selectedItemId={selectedItemId}
        statusBadges={
          isFocused
            ? [
                {
                  id: 'focused',
                  label: '聚焦中',
                  tone: 'focused',
                },
              ]
            : undefined
        }
        structureRole="plan-step"
        title={getStructureMapNodeLabel(tree, section.planStep, 'step')}
        titleEditingDraft={
          titleEditingState?.itemId === itemId ? titleEditingState.draft : null
        }
      />
      {!isCollapsed ? (
        <div className="workspace-structureMapList">
          {section.items.map((item, index) => (
            <div
              className="workspace-structureMapSlot"
              data-structure-role={
                item.kind === 'scaffold-summary' ? 'scaffold-slot' : 'cluster-slot'
              }
              key={getSectionItemAnchorNodeId(item)}
            >
              <StructureMapDropZone
                activeDropZoneId={activeDropZoneId}
                dragState={dragState}
                dropRequest={{
                  index,
                  targetParentNodeId: section.planStep.id,
                }}
                dropZoneId={createDropZoneId(section.planStep.id, index)}
                isInteractionLocked={isInteractionLocked}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onInvalidDrop={onInvalidDrop}
                siblingNodeIds={itemNodeIds}
                validateStructureMapMove={validateStructureMapMove}
              />
              <SectionItemNode
                activeDropZoneId={activeDropZoneId}
                dragState={dragState}
                isInteractionLocked={isInteractionLocked}
                item={item}
                onCancelTitleEditing={onCancelTitleEditing}
                onDeleteStructureMapNode={onDeleteStructureMapNode}
                onDragEnd={onDragEnd}
                onInvalidDrop={onInvalidDrop}
                onDragStart={onDragStart}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onInsertStructureMapChildNode={onInsertStructureMapChildNode}
                onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
                onOpenDocumentNode={onOpenDocumentNode}
                onSelectStructureMapNode={onSelectStructureMapNode}
                onStartTitleEditing={onStartTitleEditing}
                onSubmitTitleEditing={onSubmitTitleEditing}
                onTitleEditingDraftChange={onTitleEditingDraftChange}
                onToggleStructureMapClusterCollapsed={
                  onToggleStructureMapClusterCollapsed
                }
                onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
                onToggleStructureMapFollowUpCollapsed={
                  onToggleStructureMapFollowUpCollapsed
                }
                onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
                selectedItemId={selectedItemId}
                selectionContext={selectionContext}
                structureMapFocusTarget={structureMapFocusTarget}
                titleEditingState={titleEditingState}
                tree={tree}
                validateStructureMapMove={validateStructureMapMove}
                workspaceViewState={workspaceViewState}
              />
            </div>
          ))}
          <StructureMapDropZone
            activeDropZoneId={activeDropZoneId}
            dragState={dragState}
            dropRequest={{
              index: section.items.length,
              targetParentNodeId: section.planStep.id,
            }}
            dropZoneId={createDropZoneId(section.planStep.id, section.items.length)}
            isInteractionLocked={isInteractionLocked}
            onDropRequest={onDropRequest}
            onDropZoneEnter={onDropZoneEnter}
            onInvalidDrop={onInvalidDrop}
            siblingNodeIds={itemNodeIds}
            validateStructureMapMove={validateStructureMapMove}
          />
        </div>
      ) : null}
    </div>
  );
}

function SectionItemNode(
  props: StructureMapRenderProps & {
    item: StructureMapSectionItem;
  },
) {
  if (props.item.kind === 'scaffold-summary') {
    const itemId = getStructureMapSelectionId(props.item.node.anchor);
    const nodeActionAvailability = getActionAvailability(
      props.tree,
      props.item.node.node.id,
    );

    return (
      <div
        className="workspace-structureMapScaffoldItem"
        data-structure-role="scaffold"
        data-testid={`structure-map-scaffold-${props.item.node.node.id}`}
      >
        <StructureMapNodeCard
          actionAvailability={nodeActionAvailability}
          anchor={props.item.node.anchor}
          dragNodeId={props.item.node.node.id}
          dragPermission={props.item.node.drag}
          dragState={props.dragState}
          isCurrentAnswer={false}
          isEditingTitle={props.titleEditingState?.itemId === itemId}
          isInteractionLocked={props.isInteractionLocked}
          kindLabel="铺垫"
          onCancelTitleEditing={props.onCancelTitleEditing}
          onDeleteStructureMapNode={props.onDeleteStructureMapNode}
          onDragEnd={props.onDragEnd}
          onDragStart={props.onDragStart}
          onInsertStructureMapChildNode={props.onInsertStructureMapChildNode}
          onInsertStructureMapSiblingNode={props.onInsertStructureMapSiblingNode}
          onOpenDocumentNode={props.onOpenDocumentNode}
          onSelectStructureMapNode={props.onSelectStructureMapNode}
          onStartTitleEditing={props.onStartTitleEditing}
          onSubmitTitleEditing={props.onSubmitTitleEditing}
          onTitleEditingDraftChange={props.onTitleEditingDraftChange}
          selectedItemId={props.selectedItemId}
          structureRole="scaffold-summary"
          title={getStructureMapNodeLabel(props.tree, props.item.node.node, 'scaffold')}
          titleEditingDraft={
            props.titleEditingState?.itemId === itemId
              ? props.titleEditingState.draft
              : null
          }
        />
      </div>
    );
  }

  return <QuestionBlockNode {...props} clusterTone="top-level" node={props.item.node} />;
}

function QuestionBlockNode({
  activeDropZoneId,
  clusterTone,
  dragState,
  isInteractionLocked,
  node,
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
  titleEditingState,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapRenderProps & {
  clusterTone: 'follow-up' | 'top-level';
  node: StructureMapQuestionBlockNode;
}) {
  const entryNodeIds = node.entries.map((entry) => getQuestionEntryAnchorNodeId(entry));
  const entryDescriptors = node.entries.map((entry, index) => ({
    entry,
    index,
  }));
  const supportingEntries = entryDescriptors.filter(
    (descriptor) => descriptor.entry.kind !== 'question-block',
  );
  const followUpEntries = entryDescriptors.filter(
    (descriptor) => descriptor.entry.kind === 'question-block',
  );
  const hasSupportingEntries = supportingEntries.length > 0;
  const hasFollowUpEntries = followUpEntries.length > 0;
  const isTopLevelCluster = clusterTone === 'top-level';
  const isCollapsed = isTopLevelCluster
    ? workspaceViewState.collapsedStructureMapClusterIds.includes(
        node.question.id,
      )
    : workspaceViewState.collapsedStructureMapFollowUpIds.includes(
        node.question.id,
      );
  const isCurrentQuestionCluster =
    selectionContext.questionNodeId === node.question.id;
  const isFocused =
    structureMapFocusTarget?.kind === 'question-cluster' &&
    structureMapFocusTarget.nodeId === node.question.id;
  const itemId = getStructureMapSelectionId(node.anchor);
  const collapseTooltip = isCollapsed ? '展开问题簇' : '收起问题簇';
  const nodeActionAvailability = getActionAvailability(tree, node.question.id);

  return (
    <div
      className="workspace-structureMapItem workspace-structureMapCluster"
      data-cluster-active={isCurrentQuestionCluster || isFocused}
      data-structure-cluster={node.question.id}
      data-structure-layout="logic-graph"
      data-structure-level={clusterTone}
      data-structure-role="question-cluster"
      data-testid={`structure-map-question-${node.question.id}`}
    >
      <div
        className="workspace-structureMapClusterCanvas"
        data-structure-layout="logic-graph"
      >
        <div
          className="workspace-structureMapClusterRegion workspace-structureMapClusterRegionMain"
          data-has-branch={hasFollowUpEntries ? 'true' : 'false'}
          data-has-supporting={hasSupportingEntries ? 'true' : 'false'}
          data-structure-cluster-region="main"
        >
          <div className="workspace-structureMapClusterHeader">
            <div
              className="workspace-structureMapQuestionHub"
              data-structure-node="question-hub"
            >
              <StructureMapNodeCard
                actionAvailability={nodeActionAvailability}
                anchor={node.anchor}
                dragNodeId={node.question.id}
                dragPermission={node.drag}
                dragState={dragState}
                hasInlineClusterActions
                focusAction={{
                  icon: isFocused ? 'unfocus' : 'focus',
                  id: 'focus-cluster',
                  label: isFocused ? '退出问题聚焦' : '聚焦当前问题簇',
                  onClick: () =>
                    onToggleStructureMapFocusTarget({
                      kind: 'question-cluster',
                      nodeId: node.question.id,
                    }),
                }}
                collapseAction={{
                  dataCollapsed: isCollapsed,
                  dataStructureClusterAction: 'collapse',
                  icon: isCollapsed ? 'expand' : 'collapse',
                  id: 'collapse-cluster',
                  label: collapseTooltip,
                  onClick: () =>
                    isTopLevelCluster
                      ? onToggleStructureMapClusterCollapsed(node.question.id)
                      : onToggleStructureMapFollowUpCollapsed(node.question.id),
                }}
                isCurrentAnswer={false}
                isEditingTitle={titleEditingState?.itemId === itemId}
                isInteractionLocked={isInteractionLocked}
                onCancelTitleEditing={onCancelTitleEditing}
                isSelectedOverride={isCollapsed && isCurrentQuestionCluster}
                kindLabel="问题"
                onDragEnd={onDragEnd}
                onDragStart={onDragStart}
                onDeleteStructureMapNode={onDeleteStructureMapNode}
                onInsertStructureMapChildNode={onInsertStructureMapChildNode}
                onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
                onOpenDocumentNode={onOpenDocumentNode}
                onSelectStructureMapNode={onSelectStructureMapNode}
                onStartTitleEditing={onStartTitleEditing}
                onSubmitTitleEditing={onSubmitTitleEditing}
                onTitleEditingDraftChange={onTitleEditingDraftChange}
                selectedItemId={selectedItemId}
                statusBadges={
                  isFocused
                    ? [
                        {
                          id: 'focused',
                          label: '聚焦中',
                          tone: 'focused',
                        },
                      ]
                    : undefined
                }
                structureRole="question"
                title={getStructureMapNodeLabel(tree, node.question, 'question')}
                titleEditingDraft={
                  titleEditingState?.itemId === itemId
                    ? titleEditingState.draft
                    : null
                }
              />
            </div>
          </div>
        </div>
        {!isCollapsed && node.entries.length > 0 ? (
          <div className="workspace-structureMapClusterBody">
            {supportingEntries.length > 0 ? (
              <>
                <StructureMapConnector
                  connector="supporting-spine"
                  role="supporting"
                  segment="root"
                />
                <QuestionEntryGroup
                  activeDropZoneId={activeDropZoneId}
                  clusterTone={clusterTone}
                  descriptors={supportingEntries}
                  dragState={dragState}
                  entryNodeIds={entryNodeIds}
                  groupKind="supporting"
                  isInteractionLocked={isInteractionLocked}
                  node={node}
                  onCancelTitleEditing={onCancelTitleEditing}
                  onDeleteStructureMapNode={onDeleteStructureMapNode}
                  onDragEnd={onDragEnd}
                  onInvalidDrop={onInvalidDrop}
                  onDragStart={onDragStart}
                  onDropRequest={onDropRequest}
                  onDropZoneEnter={onDropZoneEnter}
                  onInsertStructureMapChildNode={onInsertStructureMapChildNode}
                  onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
                  onOpenDocumentNode={onOpenDocumentNode}
                  onSelectStructureMapNode={onSelectStructureMapNode}
                  onStartTitleEditing={onStartTitleEditing}
                  onSubmitTitleEditing={onSubmitTitleEditing}
                  onTitleEditingDraftChange={onTitleEditingDraftChange}
                  onToggleStructureMapClusterCollapsed={
                    onToggleStructureMapClusterCollapsed
                  }
                  onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
                  onToggleStructureMapFollowUpCollapsed={
                    onToggleStructureMapFollowUpCollapsed
                  }
                  onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
                  selectedItemId={selectedItemId}
                  selectionContext={selectionContext}
                  structureMapFocusTarget={structureMapFocusTarget}
                  titleEditingState={titleEditingState}
                  tree={tree}
                  validateStructureMapMove={validateStructureMapMove}
                  workspaceViewState={workspaceViewState}
                />
              </>
            ) : null}
            {followUpEntries.length > 0 ? (
              <QuestionEntryGroup
                activeDropZoneId={activeDropZoneId}
                clusterTone={clusterTone}
                descriptors={followUpEntries}
                dragState={dragState}
                entryNodeIds={entryNodeIds}
                groupKind="follow-up"
                isInteractionLocked={isInteractionLocked}
                node={node}
                onCancelTitleEditing={onCancelTitleEditing}
                onDeleteStructureMapNode={onDeleteStructureMapNode}
                onDragEnd={onDragEnd}
                onInvalidDrop={onInvalidDrop}
                onDragStart={onDragStart}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onInsertStructureMapChildNode={onInsertStructureMapChildNode}
                onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
                onOpenDocumentNode={onOpenDocumentNode}
                onSelectStructureMapNode={onSelectStructureMapNode}
                onStartTitleEditing={onStartTitleEditing}
                onSubmitTitleEditing={onSubmitTitleEditing}
                onTitleEditingDraftChange={onTitleEditingDraftChange}
                onToggleStructureMapClusterCollapsed={
                  onToggleStructureMapClusterCollapsed
                }
                onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
                onToggleStructureMapFollowUpCollapsed={
                  onToggleStructureMapFollowUpCollapsed
                }
                onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
                selectedItemId={selectedItemId}
                selectionContext={selectionContext}
                structureMapFocusTarget={structureMapFocusTarget}
                titleEditingState={titleEditingState}
                tree={tree}
                validateStructureMapMove={validateStructureMapMove}
                workspaceViewState={workspaceViewState}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuestionEntryGroup({
  activeDropZoneId,
  clusterTone,
  descriptors,
  dragState,
  entryNodeIds,
  groupKind,
  isInteractionLocked,
  node,
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
  titleEditingState,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapRenderProps & {
  clusterTone: 'follow-up' | 'top-level';
  descriptors: QuestionEntryDescriptor[];
  entryNodeIds: string[];
  groupKind: 'follow-up' | 'supporting';
  node: StructureMapQuestionBlockNode;
}) {
  const lastDescriptor = descriptors[descriptors.length - 1];
  const shouldRenderTrailingDropZone = lastDescriptor?.index === node.entries.length - 1;
  const branchDirection =
    groupKind === 'follow-up'
      ? clusterTone === 'top-level'
        ? 'down-right'
        : 'down'
      : undefined;
  const connectorKind =
    groupKind === 'supporting' ? 'supporting-spine' : 'follow-up-trunk';
  const connectorRole = groupKind === 'supporting' ? 'supporting' : 'branch';

  return (
    <div
      className={
        groupKind === 'supporting'
          ? 'workspace-structureMapClusterRegion workspace-structureMapClusterRegionSupporting'
          : 'workspace-structureMapClusterRegion workspace-structureMapClusterRegionBranch'
      }
      data-structure-attachment={
        groupKind === 'supporting' ? 'supporting-rail' : undefined
      }
      data-structure-branch={groupKind === 'follow-up' ? 'follow-up' : undefined}
      data-structure-branch-direction={branchDirection}
      data-structure-cluster-region={
        groupKind === 'supporting' ? 'supporting' : 'branch'
      }
      data-structure-role={
        groupKind === 'supporting' ? 'supporting-group' : 'follow-up-group'
      }
      data-structure-connector={connectorKind}
      data-testid={
        groupKind === 'supporting'
          ? `structure-map-supporting-group-${node.question.id}`
          : `structure-map-branch-${node.question.id}`
      }
    >
      {groupKind === 'follow-up' ? (
        <StructureMapConnector
          connector={connectorKind}
          role={connectorRole}
          segment="root"
        />
      ) : null}
      <div
        className={
          groupKind === 'supporting'
            ? 'workspace-structureMapSupportingList'
            : 'workspace-structureMapBranchList'
        }
        data-structure-connector={connectorKind}
      >
        <StructureMapConnector
          connector={connectorKind}
          role={connectorRole}
          segment={groupKind === 'supporting' ? 'spine' : 'trunk'}
        />
        {descriptors.map(({ entry, index }) => (
          <div
            className={
              groupKind === 'supporting'
                ? 'workspace-structureMapSlot workspace-structureMapSupportingSlot'
                : 'workspace-structureMapSlot workspace-structureMapBranchNode'
            }
            data-structure-branch={groupKind === 'follow-up' ? 'follow-up' : undefined}
            data-structure-role={
              entry.kind === 'question-block' ? 'follow-up-node' : 'supporting-node'
            }
            key={getQuestionEntryAnchorNodeId(entry)}
          >
            <StructureMapConnector
              connector={connectorKind}
              role={connectorRole}
              segment="leaf"
            />
            <StructureMapDropZone
              activeDropZoneId={activeDropZoneId}
              dragState={dragState}
              dropRequest={{
                index,
                targetParentNodeId: node.question.id,
              }}
              dropZoneId={createDropZoneId(node.question.id, index)}
              isInteractionLocked={isInteractionLocked}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onInvalidDrop={onInvalidDrop}
              siblingNodeIds={entryNodeIds}
              validateStructureMapMove={validateStructureMapMove}
            />
            <QuestionEntryNode
              activeDropZoneId={activeDropZoneId}
              clusterTone={groupKind === 'follow-up' ? 'follow-up' : 'top-level'}
              dragState={dragState}
              entry={entry}
              isInteractionLocked={isInteractionLocked}
              onCancelTitleEditing={onCancelTitleEditing}
              onDeleteStructureMapNode={onDeleteStructureMapNode}
              onDragEnd={onDragEnd}
              onInvalidDrop={onInvalidDrop}
              onDragStart={onDragStart}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onInsertStructureMapChildNode={onInsertStructureMapChildNode}
              onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
              onOpenDocumentNode={onOpenDocumentNode}
              onSelectStructureMapNode={onSelectStructureMapNode}
              onStartTitleEditing={onStartTitleEditing}
              onSubmitTitleEditing={onSubmitTitleEditing}
              onTitleEditingDraftChange={onTitleEditingDraftChange}
              onToggleStructureMapClusterCollapsed={
                onToggleStructureMapClusterCollapsed
              }
              onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
              onToggleStructureMapFollowUpCollapsed={
                onToggleStructureMapFollowUpCollapsed
              }
              onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
              selectedItemId={selectedItemId}
              selectionContext={selectionContext}
              structureMapFocusTarget={structureMapFocusTarget}
              titleEditingState={titleEditingState}
              tree={tree}
              validateStructureMapMove={validateStructureMapMove}
              workspaceViewState={workspaceViewState}
            />
          </div>
        ))}
        {shouldRenderTrailingDropZone ? (
          <StructureMapDropZone
            activeDropZoneId={activeDropZoneId}
            dragState={dragState}
            dropRequest={{
              index: node.entries.length,
              targetParentNodeId: node.question.id,
            }}
            dropZoneId={createDropZoneId(node.question.id, node.entries.length)}
            isInteractionLocked={isInteractionLocked}
            onDropRequest={onDropRequest}
            onDropZoneEnter={onDropZoneEnter}
            onInvalidDrop={onInvalidDrop}
            siblingNodeIds={entryNodeIds}
            validateStructureMapMove={validateStructureMapMove}
          />
        ) : null}
      </div>
    </div>
  );
}

function StructureMapConnector({
  connector,
  role,
  segment,
}: {
  connector: 'follow-up-trunk' | 'supporting-spine';
  role: 'branch' | 'supporting';
  segment: 'leaf' | 'root' | 'spine' | 'trunk';
}) {
  return (
    <div
      aria-hidden="true"
      className="workspace-structureMapConnector"
      data-structure-connector={connector}
      data-structure-connector-role={role}
      data-structure-connector-segment={segment}
    />
  );
}

function QuestionEntryNode({
  activeDropZoneId,
  clusterTone,
  dragState,
  entry,
  isInteractionLocked,
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
  titleEditingState,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapRenderProps & {
  clusterTone: 'follow-up' | 'top-level';
  entry: StructureMapQuestionEntry;
}) {
  if (entry.kind === 'answer-group') {
    const nodeActionAvailability = getActionAvailability(tree, entry.group.node.id);

    return (
      <SupportingGroupNode
        actionAvailability={nodeActionAvailability}
        anchor={entry.group.anchor}
        dragNodeId={entry.group.node.id}
        dragPermission={entry.group.drag}
        dragState={dragState}
        isCurrentAnswer={entry.group.isCurrentAnswer}
        isInteractionLocked={isInteractionLocked}
        kindLabel="回答"
        metaBadges={getAnswerGroupMetaBadges(entry.group)}
        onCancelTitleEditing={onCancelTitleEditing}
        onDeleteStructureMapNode={onDeleteStructureMapNode}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onInsertStructureMapChildNode={onInsertStructureMapChildNode}
        onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
        onOpenDocumentNode={onOpenDocumentNode}
        onSelectStructureMapNode={onSelectStructureMapNode}
        onStartTitleEditing={onStartTitleEditing}
        onSubmitTitleEditing={onSubmitTitleEditing}
        onTitleEditingDraftChange={onTitleEditingDraftChange}
        selectedItemId={selectedItemId}
        structureRole="answer-group"
        titleEditingState={titleEditingState}
        title={getStructureMapNodeLabel(tree, entry.group.node, 'answer')}
      />
    );
  }

  if (entry.kind === 'manual-summary-group') {
    const nodeActionAvailability = getActionAvailability(tree, entry.group.node.id);

    return (
      <SupportingGroupNode
        actionAvailability={nodeActionAvailability}
        anchor={entry.group.anchor}
        dragNodeId={entry.group.node.id}
        dragPermission={entry.group.drag}
        dragState={dragState}
        isCurrentAnswer={false}
        isInteractionLocked={isInteractionLocked}
        kindLabel="手写总结"
        metaBadges={getManualSummaryGroupMetaBadges(entry.group)}
        onCancelTitleEditing={onCancelTitleEditing}
        onDeleteStructureMapNode={onDeleteStructureMapNode}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onInsertStructureMapChildNode={onInsertStructureMapChildNode}
        onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
        onOpenDocumentNode={onOpenDocumentNode}
        onSelectStructureMapNode={onSelectStructureMapNode}
        onStartTitleEditing={onStartTitleEditing}
        onSubmitTitleEditing={onSubmitTitleEditing}
        onTitleEditingDraftChange={onTitleEditingDraftChange}
        selectedItemId={selectedItemId}
        structureRole="summary-group"
        titleEditingState={titleEditingState}
        title={getStructureMapNodeLabel(tree, entry.group.node, 'summary')}
      />
    );
  }

  return (
    <QuestionBlockNode
      activeDropZoneId={activeDropZoneId}
      clusterTone={clusterTone}
      dragState={dragState}
      isInteractionLocked={isInteractionLocked}
      node={entry.node}
      onCancelTitleEditing={onCancelTitleEditing}
      onDeleteStructureMapNode={onDeleteStructureMapNode}
      onDragEnd={onDragEnd}
      onInvalidDrop={onInvalidDrop}
      onDragStart={onDragStart}
      onDropRequest={onDropRequest}
      onDropZoneEnter={onDropZoneEnter}
      onInsertStructureMapChildNode={onInsertStructureMapChildNode}
      onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
      onOpenDocumentNode={onOpenDocumentNode}
      onSelectStructureMapNode={onSelectStructureMapNode}
      onStartTitleEditing={onStartTitleEditing}
      onSubmitTitleEditing={onSubmitTitleEditing}
      onTitleEditingDraftChange={onTitleEditingDraftChange}
      onToggleStructureMapClusterCollapsed={onToggleStructureMapClusterCollapsed}
      onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
      onToggleStructureMapFollowUpCollapsed={onToggleStructureMapFollowUpCollapsed}
      onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
      selectedItemId={selectedItemId}
      selectionContext={selectionContext}
      structureMapFocusTarget={structureMapFocusTarget}
      titleEditingState={titleEditingState}
      tree={tree}
      validateStructureMapMove={validateStructureMapMove}
      workspaceViewState={workspaceViewState}
    />
  );
}

function SupportingGroupNode({
  actionAvailability,
  anchor,
  dragNodeId,
  dragPermission,
  dragState,
  isCurrentAnswer,
  isInteractionLocked,
  kindLabel,
  metaBadges,
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onDragStart,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  selectedItemId,
  structureRole,
  titleEditingState,
  title,
}: {
  actionAvailability: EditorActionAvailability;
  anchor: StructureMapAnchor;
  dragNodeId: string;
  dragPermission: StructureMapQuestionBlockNode['drag'];
  dragState: DragState | null;
  isCurrentAnswer: boolean;
  isInteractionLocked: boolean;
  kindLabel: string;
  metaBadges: string[];
  onCancelTitleEditing: () => void;
  onDeleteStructureMapNode: (nodeId: string) => void;
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onInsertStructureMapChildNode: (nodeId: string) => void;
  onInsertStructureMapSiblingNode: (nodeId: string) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  onSelectStructureMapNode: (nodeId: string) => void;
  onStartTitleEditing: (nodeId: string, itemId: string, title: string) => void;
  onSubmitTitleEditing: () => void;
  onTitleEditingDraftChange: (draft: string) => void;
  selectedItemId: string | null;
  structureRole: 'answer-group' | 'summary-group';
  titleEditingState: TitleEditingState | null;
  title: string;
}) {
  const itemId = getStructureMapSelectionId(anchor);

  return (
    <div
      className="workspace-structureMapSupportingCard"
      data-structure-role={structureRole}
      data-structure-supporting={structureRole}
      data-testid={`structure-map-supporting-${anchor.nodeId}`}
    >
      <StructureMapNodeCard
        actionAvailability={actionAvailability}
        anchor={anchor}
        dragNodeId={dragNodeId}
        dragPermission={dragPermission}
        dragState={dragState}
        isCurrentAnswer={isCurrentAnswer}
        isEditingTitle={titleEditingState?.itemId === itemId}
        isInteractionLocked={isInteractionLocked}
        kindLabel={kindLabel}
        onCancelTitleEditing={onCancelTitleEditing}
        onDeleteStructureMapNode={onDeleteStructureMapNode}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onInsertStructureMapChildNode={onInsertStructureMapChildNode}
        onInsertStructureMapSiblingNode={onInsertStructureMapSiblingNode}
        onOpenDocumentNode={onOpenDocumentNode}
        onSelectStructureMapNode={onSelectStructureMapNode}
        onStartTitleEditing={onStartTitleEditing}
        onSubmitTitleEditing={onSubmitTitleEditing}
        onTitleEditingDraftChange={onTitleEditingDraftChange}
        selectedItemId={selectedItemId}
        structureRole={structureRole}
        title={title}
        titleEditingDraft={
          titleEditingState?.itemId === itemId ? titleEditingState.draft : null
        }
      />
      {metaBadges.length > 0 ? (
        <div className="workspace-structureMapMetaList">
          {metaBadges.map((badge) => (
            <span className="workspace-structureMapMetaBadge" key={badge}>
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StructureMapNodeCard({
  actionAvailability,
  anchor,
  collapseAction,
  dragNodeId,
  dragPermission,
  dragState,
  focusAction,
  hasInlineClusterActions = false,
  hasInlineStepActions = false,
  isCurrentAnswer,
  isEditingTitle,
  isInteractionLocked,
  kindLabel,
  menuActions = [],
  onCancelTitleEditing,
  onDeleteStructureMapNode,
  onDragEnd,
  onDragStart,
  onInsertStructureMapChildNode,
  onInsertStructureMapSiblingNode,
  onOpenDocumentNode,
  onSelectStructureMapNode,
  onStartTitleEditing,
  onSubmitTitleEditing,
  onTitleEditingDraftChange,
  isSelectedOverride = false,
  selectedItemId,
  statusBadges = [],
  structureRole,
  title,
  titleEditingDraft,
}: {
  actionAvailability: EditorActionAvailability;
  anchor: StructureMapAnchor;
  collapseAction?: StructureMapIconAction;
  dragNodeId: string;
  dragPermission: StructureMapPresentationModel['drag'];
  dragState: DragState | null;
  focusAction?: StructureMapIconAction;
  hasInlineClusterActions?: boolean;
  hasInlineStepActions?: boolean;
  isCurrentAnswer: boolean;
  isEditingTitle: boolean;
  isInteractionLocked: boolean;
  kindLabel: string;
  menuActions?: StructureMapMenuAction[];
  onCancelTitleEditing: () => void;
  onDeleteStructureMapNode: (nodeId: string) => void;
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onInsertStructureMapChildNode: (nodeId: string) => void;
  onInsertStructureMapSiblingNode: (nodeId: string) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  onSelectStructureMapNode: (nodeId: string) => void;
  onStartTitleEditing: (nodeId: string, itemId: string, title: string) => void;
  onSubmitTitleEditing: () => void;
  onTitleEditingDraftChange: (draft: string) => void;
  isSelectedOverride?: boolean;
  selectedItemId: string | null;
  statusBadges?: StructureMapStatusBadge[];
  structureRole: StructureRole;
  title: string;
  titleEditingDraft: string | null;
}) {
  const itemId = getStructureMapSelectionId(anchor);
  const isDragging = dragState?.nodeId === dragNodeId;
  const isSelected = isSelectedOverride || selectedItemId === itemId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dragStartAllowedRef = useRef(false);
  const actionVisibility =
    isDragging || isEditingTitle || isFocusWithin || isMenuOpen || isSelected
      ? 'active'
      : isHovered
        ? 'hover'
        : 'default';
  const allStatusBadges = [...statusBadges];
  const hasFocusedBadge = allStatusBadges.some((badge) => badge.tone === 'focused');
  const resolvedMenuActions = isEditingTitle
    ? menuActions
    : [
        {
          id: 'edit-title',
          label: '编辑标题',
          onClick: () => onStartTitleEditing(dragNodeId, itemId, title),
        },
        ...(actionAvailability.canInsertChild
          ? [
              {
                id: 'insert-child',
                label: '添加子节点',
                onClick: () => onInsertStructureMapChildNode(anchor.nodeId),
              },
            ]
          : []),
        ...(actionAvailability.canInsertSibling
          ? [
              {
                id: 'insert-sibling',
                label: '添加同级节点',
                onClick: () => onInsertStructureMapSiblingNode(anchor.nodeId),
              },
            ]
          : []),
        ...(actionAvailability.canDelete
          ? [
              {
                id: 'delete-node',
                label: '删除节点',
                onClick: () => onDeleteStructureMapNode(anchor.nodeId),
                tone: 'danger' as const,
              },
            ]
          : []),
        ...menuActions,
      ];

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleDocumentPointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isMenuOpen]);

  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmitTitleEditing();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelTitleEditing();
    }
  }

  function isDragExcludedTarget(target: EventTarget | null) {
    return target instanceof Element
      ? target.closest('[data-structure-node-drag-excluded="true"]') !== null
      : false;
  }

  function handlePointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartAllowedRef.current =
      !isInteractionLocked &&
      dragPermission.canDrag &&
      !isDragExcludedTarget(event.target);
  }

  function handleSurfaceDragStart(event: DragEvent<HTMLElement>) {
    if (!dragPermission.canDrag || !dragStartAllowedRef.current) {
      event.preventDefault();
      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragNodeId);
      const transparentDragPreview = getTransparentDragPreviewImage();

      if (transparentDragPreview) {
        event.dataTransfer.setDragImage(transparentDragPreview, 0, 0);
      }
    }

    onDragStart(dragNodeId);
  }

  function handleSurfaceDragEnd() {
    dragStartAllowedRef.current = false;
    onDragEnd();
  }

  return (
    <div
      aria-current={isSelected ? 'true' : undefined}
      className="workspace-structureMapButton"
      data-draggable={dragPermission.canDrag}
      data-dragging={isDragging}
      data-kind={itemId.split(':')[0]}
      data-selected={isSelected}
      data-structure-node-draggable-surface="true"
      data-structure-node-action-visibility={actionVisibility}
      data-structure-node-current-answer={isCurrentAnswer ? 'true' : 'false'}
      data-structure-node-editable="title"
      data-structure-node-editing={isEditingTitle}
      data-structure-node-focused={hasFocusedBadge ? 'true' : 'false'}
      data-structure-role={structureRole}
      data-testid={`structure-map-item-${itemId}`}
      draggable={!isInteractionLocked && dragPermission.canDrag}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setIsFocusWithin(false);
      }}
      onClick={(event) => {
        if (isEditingTitle || isDragExcludedTarget(event.target)) {
          return;
        }

        onSelectStructureMapNode(anchor.nodeId);
      }}
      onDragEnd={handleSurfaceDragEnd}
      onDragStart={handleSurfaceDragStart}
      onFocusCapture={() => setIsFocusWithin(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerCancelCapture={() => {
        dragStartAllowedRef.current = false;
      }}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUpCapture={() => {
        dragStartAllowedRef.current = false;
      }}
      ref={rootRef}
    >
      <div className="workspace-structureMapButtonMain">
        <span className="workspace-structureMapLabel">{kindLabel}</span>
        {isEditingTitle ? (
          <input
            aria-label={`${title || kindLabel} 标题`}
            autoFocus
            className="workspace-structureMapTitleInput"
            data-structure-node-drag-excluded="true"
            data-structure-node-editable="title"
            data-structure-node-title-zone="true"
            onBlur={onSubmitTitleEditing}
            onChange={(event) => onTitleEditingDraftChange(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            type="text"
            value={titleEditingDraft ?? title}
          />
        ) : (
          <button
            className="workspace-structureMapTitleButton"
            data-structure-node-editable="title"
            data-structure-node-title-zone="true"
            disabled={isInteractionLocked}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              onSelectStructureMapNode(anchor.nodeId);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartTitleEditing(dragNodeId, itemId, title);
            }}
            type="button"
          >
            <span className="workspace-structureMapText">{title}</span>
          </button>
        )}
        {allStatusBadges.map((badge) => (
          <span
            className="workspace-structureMapBadge"
            data-structure-node-status="badge"
            data-tone={badge.tone}
            key={badge.id}
          >
            {badge.label}
          </span>
        ))}
      </div>
      <div
        className="workspace-structureMapNodeActions"
        data-structure-node-action-zone="true"
        data-structure-cluster-actions={hasInlineClusterActions ? 'inline' : undefined}
        data-structure-node-drag-excluded="true"
        data-structure-node-action-visibility={actionVisibility}
        data-structure-step-actions={hasInlineStepActions ? 'inline' : undefined}
      >
        {!isEditingTitle ? (
          <button
            aria-label="在文档中查看"
            className="workspace-structureMapNodeIconButton"
            data-structure-node-action-style="icon"
            data-testid={`structure-map-open-document-${itemId}`}
            disabled={isInteractionLocked}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDocumentNode(anchor.nodeId);
            }}
            title="在文档中查看"
            type="button"
          >
            <StructureMapActionIcon icon="document" />
          </button>
        ) : null}
        {!isEditingTitle && focusAction ? (
          <button
            aria-label={focusAction.label}
            className="workspace-structureMapNodeIconButton"
            data-structure-node-focus-action="true"
            data-structure-node-action-style="icon"
            disabled={isInteractionLocked}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              focusAction.onClick();
            }}
            title={focusAction.label}
            type="button"
          >
            <StructureMapActionIcon icon={focusAction.icon} />
          </button>
        ) : null}
        {!isEditingTitle && resolvedMenuActions.length > 0 ? (
          <div
            className="workspace-structureMapNodeMenu"
            data-structure-node-action-style="menu"
            data-structure-node-drag-excluded="true"
            data-structure-node-menu="more"
            data-testid={`structure-map-node-menu-${itemId}`}
          >
            <button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label={`更多操作：${title || kindLabel}`}
              className="workspace-structureMapNodeIconButton"
              data-structure-node-action-style="menu"
              data-structure-node-menu="more"
              disabled={isInteractionLocked}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen((currentIsOpen) => !currentIsOpen);
              }}
              title="更多操作"
              type="button"
            >
              <StructureMapActionIcon icon="more" />
            </button>
            {isMenuOpen ? (
              <div
                className="workspace-nodeActionPopover"
                data-structure-node-drag-excluded="true"
                role="menu"
              >
                <section className="workspace-nodeActionPopoverSection">
                  <p className="workspace-nodeActionPopoverTitle">节点操作</p>
                  <div className="workspace-nodeActionPopoverList">
                    {resolvedMenuActions.map((action) => (
                      <button
                        className="workspace-nodeActionPopoverButton"
                        data-tone={action.tone ?? 'default'}
                        disabled={action.disabled === true}
                        key={action.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsMenuOpen(false);
                          action.onClick();
                        }}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : null}
        {!isEditingTitle && collapseAction ? (
          <button
            aria-label={collapseAction.label}
            className="workspace-structureMapNodeIconButton"
            data-collapsed={
              collapseAction.dataCollapsed === undefined
                ? undefined
                : collapseAction.dataCollapsed
                  ? 'true'
                  : 'false'
            }
            data-structure-cluster-action={collapseAction.dataStructureClusterAction}
            data-structure-node-action-style="icon"
            data-structure-node-collapse-action="true"
            disabled={isInteractionLocked}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              collapseAction.onClick();
            }}
            title={collapseAction.label}
            type="button"
          >
            <StructureMapActionIcon icon={collapseAction.icon} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StructureMapActionIcon({
  icon,
}: {
  icon:
    | 'collapse'
    | 'document'
    | 'drag'
    | 'expand'
    | 'focus'
    | 'more'
    | 'unfocus';
}) {
  switch (icon) {
    case 'document':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="M7 5.5H5.75A1.75 1.75 0 0 0 4 7.25v7A1.75 1.75 0 0 0 5.75 16h7a1.75 1.75 0 0 0 1.75-1.75V13"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
          <path
            d="M9 11 15.25 4.75M11 4.75h4.25V9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'collapse':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="m5.5 11.75 4.5-4.5 4.5 4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      );
    case 'expand':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="m5.5 8.25 4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      );
    case 'focus':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="M2.9 10c1.7-3.25 4.45-4.88 7.1-4.88S15.4 6.75 17.1 10c-1.7 3.25-4.45 4.88-7.1 4.88S4.6 13.25 2.9 10Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <circle
            cx="10"
            cy="10"
            r="2.35"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'unfocus':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="M3.4 10c1.55-2.98 4.03-4.47 6.6-4.47 1.2 0 2.38.33 3.45.98M16.6 10c-1.55 2.98-4.03 4.47-6.6 4.47-1.2 0-2.38-.33-3.45-.98"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M7.95 10a2.05 2.05 0 0 0 2.05 2.05 2.03 2.03 0 0 0 1.12-.33M12.05 10A2.05 2.05 0 0 0 10 7.95c-.4 0-.77.12-1.08.31"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="m4.5 15.5 11-11"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'more':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="5" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="15" cy="10" r="1.6" />
        </svg>
      );
    case 'drag':
      return (
        <svg
          aria-hidden="true"
          className="workspace-structureMapActionIcon"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="7" cy="5.5" r="1.15" />
          <circle cx="13" cy="5.5" r="1.15" />
          <circle cx="7" cy="10" r="1.15" />
          <circle cx="13" cy="10" r="1.15" />
          <circle cx="7" cy="14.5" r="1.15" />
          <circle cx="13" cy="14.5" r="1.15" />
        </svg>
      );
  }
}

function getTransparentDragPreviewImage() {
  if (typeof Image === 'undefined') {
    return null;
  }

  const transparentImage = new Image();
  transparentImage.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  return transparentImage;
}

function resolveVerticalScrollContainer(element: HTMLElement | null) {
  let current = element?.parentElement ?? null;

  while (current) {
    if (isVerticallyScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : null;
}

function isVerticallyScrollable(element: HTMLElement) {
  const { overflowY } = window.getComputedStyle(element);

  if (!['auto', 'scroll', 'overlay'].includes(overflowY)) {
    return false;
  }

  return element.scrollHeight > element.clientHeight;
}

function getVerticalScrollBounds(element: HTMLElement) {
  if (element === document.scrollingElement) {
    return {
      bottom: window.innerHeight,
      height: window.innerHeight,
      top: 0,
    };
  }

  const { top, bottom, height } = element.getBoundingClientRect();

  return {
    bottom,
    height,
    top,
  };
}

function StructureMapDropZone({
  activeDropZoneId,
  dragState,
  dropRequest,
  dropZoneId,
  isInteractionLocked,
  onDropRequest,
  onDropZoneEnter,
  onInvalidDrop,
  siblingNodeIds,
  validateStructureMapMove,
}: {
  activeDropZoneId: string | null;
  dragState: DragState | null;
  dropRequest: Omit<StructureMapMoveRequest, 'nodeId'>;
  dropZoneId: string;
  isInteractionLocked: boolean;
  onDropRequest: (
    request: Omit<StructureMapMoveRequest, 'nodeId'>,
    siblingNodeIds: string[],
  ) => void;
  onDropZoneEnter: (dropZoneId: string | null) => void;
  onInvalidDrop: (feedback: DropFeedback) => void;
  siblingNodeIds: string[];
  validateStructureMapMove: (
    request: StructureMapMoveRequest,
  ) => StructureMapMoveValidationResult;
}) {
  const dropZoneState = resolveStructureMapDropZoneState(
    dragState,
    isInteractionLocked,
    dropRequest,
    siblingNodeIds,
    validateStructureMapMove,
  );
  const isActive = dragState !== null && activeDropZoneId === dropZoneId;
  const dropZoneLabel = getStructureMapDropZoneLabel(dropZoneState, isActive);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (isInteractionLocked || !dragState) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect =
        dropZoneState.state === 'valid' ? 'move' : 'none';
    }
    onDropZoneEnter(dropZoneId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (isInteractionLocked || !dragState) {
      return;
    }

    event.preventDefault();
    if (dropZoneState.state === 'invalid') {
      onInvalidDrop({
        code: dropZoneState.validation.code,
        message: dropZoneState.validation.message,
      });
      return;
    }

    if (dropZoneState.state === 'valid') {
      onDropRequest(dropRequest, siblingNodeIds);
    }
  }

  return (
    <div
      className="workspace-structureMapDropZone"
      data-active={isActive}
      data-drop-rejection-code={
        dropZoneState.state === 'invalid'
          ? dropZoneState.validation.code
          : undefined
      }
      data-drop-state={dropZoneState.state}
      data-testid={dropZoneId}
      onDragLeave={() => {
        if (activeDropZoneId === dropZoneId) {
          onDropZoneEnter(null);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dropZoneLabel ? (
        <span aria-hidden="true" className="workspace-structureMapDropZoneLabel">
          {dropZoneLabel}
        </span>
      ) : null}
    </div>
  );
}

function getSectionItemAnchorNodeId(item: StructureMapSectionItem) {
  return item.node.anchor.nodeId;
}

function getQuestionEntryAnchorNodeId(entry: StructureMapQuestionEntry) {
  return entry.kind === 'question-block' ? entry.node.anchor.nodeId : entry.group.anchor.nodeId;
}

function getAnswerGroupMetaBadges(group: StructureMapAnswerGroupNode) {
  const badges: string[] = [];

  if (group.latestEvaluationNodeId) {
    badges.push('评估');
  }

  if (group.explanationNodeId) {
    badges.push('解析');
  }

  if (group.historicalClosureNodeIds.length > 0) {
    badges.push(`历史 ${group.historicalClosureNodeIds.length}`);
  }

  return badges;
}

function getManualSummaryGroupMetaBadges(group: StructureMapManualSummaryGroupNode) {
  const badges: string[] = [];

  if (group.latestCheckNodeId) {
    badges.push('检查');
  }

  if (group.historicalCheckNodeIds.length > 0) {
    badges.push(`历史 ${group.historicalCheckNodeIds.length}`);
  }

  return badges;
}

function createDropZoneId(parentNodeId: string, index: number) {
  return `structure-map-dropzone-${parentNodeId}-${String(index)}`;
}

function isNoopMove(
  draggedNodeId: string,
  targetIndex: number,
  siblingNodeIds: string[],
) {
  const draggedIndex = siblingNodeIds.findIndex((nodeId) => nodeId === draggedNodeId);

  if (draggedIndex === -1) {
    return false;
  }

  const effectiveIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;

  return effectiveIndex === draggedIndex;
}

function resolveStructureMapDropZoneState(
  dragState: DragState | null,
  isInteractionLocked: boolean,
  request: Omit<StructureMapMoveRequest, 'nodeId'>,
  siblingNodeIds: string[],
  validateStructureMapMove: (
    request: StructureMapMoveRequest,
  ) => StructureMapMoveValidationResult,
): StructureMapDropZoneState {
  if (!dragState || isInteractionLocked) {
    return {
      state: 'idle',
    };
  }

  const targetIndex = request.index ?? siblingNodeIds.length;

  if (isNoopMove(dragState.nodeId, targetIndex, siblingNodeIds)) {
    return {
      state: 'noop',
    };
  }

  const validation = validateStructureMapMove({
    ...request,
    nodeId: dragState.nodeId,
  });

  if (!validation.allowed) {
    return {
      state: 'invalid',
      validation,
    };
  }

  return {
    state: 'valid',
    validation,
  };
}

function getStructureMapDropZoneLabel(
  dropZoneState: StructureMapDropZoneState,
  isActive: boolean,
) {
  switch (dropZoneState.state) {
    case 'valid':
      return isActive ? '松手放到这里' : '可落点';
    case 'invalid':
      return isActive ? '不能放这里' : null;
    case 'noop':
      return isActive ? '当前位置' : null;
    case 'idle':
      return null;
  }
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function resolveStructureMapToolbarState(
  sections: StructureMapSection[],
  tree: NodeTree,
  selectionContext: StructureMapSelectionContext,
  focusTarget: StructureMapFocusTarget | null,
  workspaceViewState: WorkspaceViewState,
): StructureMapToolbarState | null {
  if (focusTarget?.kind === 'question-cluster') {
    return createQuestionClusterToolbarState(
      sections,
      tree,
      focusTarget.nodeId,
      true,
      workspaceViewState,
    );
  }

  if (focusTarget?.kind === 'plan-step') {
    return createPlanStepToolbarState(
      tree,
      focusTarget.nodeId,
      true,
      workspaceViewState,
    );
  }

  const fallbackStepNodeId = selectionContext.planStepNodeId ?? sections[0]?.planStep.id ?? null;

  if (fallbackStepNodeId) {
    return createPlanStepToolbarState(
      tree,
      fallbackStepNodeId,
      false,
      workspaceViewState,
    );
  }

  if (selectionContext.questionNodeId) {
    return createQuestionClusterToolbarState(
      sections,
      tree,
      selectionContext.questionNodeId,
      false,
      workspaceViewState,
    );
  }

  return null;
}

function createQuestionClusterToolbarState(
  sections: StructureMapSection[],
  tree: NodeTree,
  questionNodeId: string,
  isFocused: boolean,
  workspaceViewState: WorkspaceViewState,
): StructureMapToolbarState | null {
  const questionNode = tree.nodes[questionNodeId];
  const section = findStructureMapSectionForQuestionNodeId(sections, questionNodeId);

  if (!questionNode) {
    return null;
  }

  return {
    contextKind: 'question-cluster',
    contextLabel: getStructureMapNodeLabel(tree, questionNode, 'question'),
    focusTarget: {
      kind: 'question-cluster',
      nodeId: questionNodeId,
    },
    isFocused,
    stepNodeId: section?.planStep.id ?? null,
    stepCollapsed:
      section === null
        ? false
        : workspaceViewState.collapsedStructureMapStepIds.includes(section.planStep.id),
  };
}

function createPlanStepToolbarState(
  tree: NodeTree,
  planStepNodeId: string,
  isFocused: boolean,
  workspaceViewState: WorkspaceViewState,
): StructureMapToolbarState | null {
  const planStepNode = tree.nodes[planStepNodeId];

  if (!planStepNode) {
    return null;
  }

  return {
    contextKind: 'plan-step',
    contextLabel: getStructureMapNodeLabel(tree, planStepNode, 'step'),
    focusTarget: {
      kind: 'plan-step',
      nodeId: planStepNodeId,
    },
    isFocused,
    stepNodeId: planStepNodeId,
    stepCollapsed: workspaceViewState.collapsedStructureMapStepIds.includes(
      planStepNodeId,
    ),
  };
}

function findStructureMapSectionForQuestionNodeId(
  sections: StructureMapSection[],
  questionNodeId: string,
) {
  return (
    sections.find((section) =>
      findQuestionBlockNode(section.questionBlocks, questionNodeId),
    ) ?? null
  );
}

function resolveStructureMapSelectionContext(
  tree: NodeTree,
  selectedNodeId: string | null,
): StructureMapSelectionContext {
  return {
    planStepNodeId: findNearestPlanStepNodeId(tree, selectedNodeId),
    questionNodeId: findNearestQuestionNodeId(tree, selectedNodeId),
  };
}

function findNearestPlanStepNodeId(
  tree: NodeTree,
  nodeId: string | null | undefined,
) {
  if (!nodeId || !tree.nodes[nodeId]) {
    return null;
  }

  let currentNode: NodeTree['nodes'][string] | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === 'plan-step') {
      return currentNode.id;
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return null;
}

function resolveStructureMapFocusTarget(
  model: StructureMapPresentationModel,
  focusTarget: StructureMapFocusTarget | null,
) {
  if (!focusTarget) {
    return null;
  }

  if (focusTarget.kind === 'plan-step') {
    return model.sections.some((section) => section.planStep.id === focusTarget.nodeId)
      ? focusTarget
      : null;
  }

  return model.sections.some((section) =>
    findQuestionBlockNode(section.questionBlocks, focusTarget.nodeId),
  )
    ? focusTarget
    : null;
}

function getStructureMapSectionsForFocus(
  model: StructureMapPresentationModel,
  focusTarget: StructureMapFocusTarget | null,
) {
  if (!focusTarget) {
    return model.sections;
  }

  if (focusTarget.kind === 'plan-step') {
    return model.sections.filter((section) => section.planStep.id === focusTarget.nodeId);
  }

  const focusedSection = model.sections.find((section) =>
    findQuestionBlockNode(section.questionBlocks, focusTarget.nodeId),
  );

  if (!focusedSection) {
    return model.sections;
  }

  const focusedQuestionBlock = findQuestionBlockNode(
    focusedSection.questionBlocks,
    focusTarget.nodeId,
  );

  if (!focusedQuestionBlock) {
    return model.sections;
  }

  const focusedQuestionItem: StructureMapSectionItem = {
    kind: 'question-block',
    node: focusedQuestionBlock,
  };

  return [
    {
      ...focusedSection,
      items: [focusedQuestionItem],
      questionBlocks: [focusedQuestionBlock],
      scaffoldSummaries: [],
    },
  ];
}

function findQuestionBlockNode(
  questionBlocks: StructureMapQuestionBlockNode[],
  nodeId: string,
): StructureMapQuestionBlockNode | null {
  for (const questionBlock of questionBlocks) {
    if (questionBlock.question.id === nodeId) {
      return questionBlock;
    }

    const nestedQuestionBlocks = questionBlock.entries
      .filter((entry): entry is Extract<StructureMapQuestionEntry, { kind: 'question-block' }> =>
        entry.kind === 'question-block',
      )
      .map((entry) => entry.node);
    const nestedMatch = findQuestionBlockNode(nestedQuestionBlocks, nodeId);

    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function findElementByTestId(root: HTMLElement, testId: string) {
  return root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

