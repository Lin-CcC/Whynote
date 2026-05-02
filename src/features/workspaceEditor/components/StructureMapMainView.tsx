import { useEffect, useRef, useState, type DragEvent } from 'react';

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
  StructureMapFocusTarget,
  WorkspaceViewState,
} from '../workspaceEditorTypes';

type StructureMapMainViewProps = {
  currentModuleId: string | null;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
  onMoveStructureMapNode: (request: StructureMapMoveRequest) => void;
  onOpenDocumentNode: (nodeId: string) => void;
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

type StructureMapRenderProps = {
  activeDropZoneId: string | null;
  dragState: DragState | null;
  isInteractionLocked: boolean;
  onDragEnd: () => void;
  onInvalidDrop: (feedback: DropFeedback) => void;
  onDragStart: (nodeId: string) => void;
  onDropRequest: (
    request: Omit<StructureMapMoveRequest, 'nodeId'>,
    siblingNodeIds: string[],
  ) => void;
  onDropZoneEnter: (dropZoneId: string | null) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  onToggleStructureMapClusterCollapsed: (questionNodeId: string) => void;
  onToggleStructureMapFocusTarget: (target: StructureMapFocusTarget) => void;
  onToggleStructureMapFollowUpCollapsed: (questionNodeId: string) => void;
  onToggleStructureMapStepCollapsed: (planStepNodeId: string) => void;
  selectedItemId: string | null;
  selectionContext: StructureMapSelectionContext;
  structureMapFocusTarget: StructureMapFocusTarget | null;
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
  onMoveStructureMapNode,
  onOpenDocumentNode,
  onWorkspaceViewStateChange,
  selectedNodeId,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapMainViewProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropZoneId, setActiveDropZoneId] = useState<string | null>(null);
  const [dropFeedback, setDropFeedback] = useState<DropFeedback | null>(null);
  const structureMapShellRef = useRef<HTMLDivElement | null>(null);

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
  const visibleSelectionTestId = getVisibleStructureMapSelectionTestId(
    tree,
    selectedItemId,
    selectionContext,
    workspaceViewState,
  );
  const dragStatus = dragState
    ? {
        text: '拖动中：蓝色提示表示可落点，红色提示表示当前落点不允许。',
        tone: 'info' as const,
      }
    : dropFeedback
      ? {
          text: `当前落点无效：${dropFeedback.message}`,
          tone: 'invalid' as const,
        }
      : null;

  useEffect(() => {
    const shell = structureMapShellRef.current;

    if (!shell) {
      return;
    }

    const targetTestId =
      (structureMapFocusTarget
        ? getStructureMapFocusTargetTestId(structureMapFocusTarget)
        : null) ?? visibleSelectionTestId;
    const targetElement =
      targetTestId === null ? null : findElementByTestId(shell, targetTestId);

    if (!targetElement) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      targetElement.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    structureMapFocusTarget,
    visibleSelectionTestId,
    workspaceViewState.collapsedStructureMapClusterIds,
    workspaceViewState.collapsedStructureMapFollowUpIds,
    workspaceViewState.collapsedStructureMapStepIds,
  ]);

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
    setDragState({ nodeId });
  }

  function handleDragEnd() {
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

    onMoveStructureMapNode(nextRequest);
    setActiveDropZoneId(null);
    setDropFeedback(null);
    setDragState(null);
  }

  function handleInvalidDrop(feedback: DropFeedback) {
    setDropFeedback(feedback);
  }

  return (
    <div className="workspace-mainPanel">
      <div
        className="workspace-documentShell workspace-structureMapShell"
        data-layout="single-column"
        data-testid="workspace-structure-map-shell"
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
          {structureMapFocusTarget ? (
            <div className="workspace-structureMapActionRow">
              <p className="workspace-helpText">
                {getStructureMapFocusSummaryLabel(tree, structureMapFocusTarget)}
              </p>
              <button
                className="workspace-nodeBodyToggle"
                disabled={isInteractionLocked}
                onClick={() =>
                  updateWorkspaceViewState((state) => ({
                    ...state,
                    structureMapFocusTarget: null,
                  }))
                }
                type="button"
              >
                退出地图聚焦
              </button>
            </div>
          ) : null}
        </header>
        {dragStatus ? (
          <div
            className="workspace-structureMapStatus"
            data-tone={dragStatus.tone}
            role="status"
          >
            <span className="workspace-structureMapStatusText">{dragStatus.text}</span>
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
                onDragEnd={handleDragEnd}
                onInvalidDrop={handleInvalidDrop}
                onDragStart={handleDragStart}
                onDropRequest={handleDropRequest}
                onDropZoneEnter={setActiveDropZoneId}
                onOpenDocumentNode={onOpenDocumentNode}
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
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  section,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
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

  return (
    <div className="workspace-structureMapPanelBody">
      <StructureMapButton
        anchor={section.anchor}
        dragNodeId={section.planStep.id}
        dragPermission={section.drag}
        dragState={dragState}
        isCurrentAnswer={false}
        isInteractionLocked={isInteractionLocked}
        kindLabel="步骤"
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onOpenDocumentNode={onOpenDocumentNode}
        isSelectedOverride={isCollapsed && isCurrentPlanStep}
        selectedItemId={selectedItemId}
        structureRole="plan-step"
        title={getStructureMapNodeLabel(tree, section.planStep, 'step')}
      />
      <div className="workspace-structureMapActionRow">
        <button
          className="workspace-nodeBodyToggle"
          disabled={isInteractionLocked}
          onClick={() => onToggleStructureMapStepCollapsed(section.planStep.id)}
          type="button"
        >
          {isCollapsed ? '展开步骤面板' : '收起步骤面板'}
        </button>
        {isCurrentPlanStep || isFocused ? (
          <button
            className="workspace-nodeBodyToggle"
            disabled={isInteractionLocked}
            onClick={() =>
              onToggleStructureMapFocusTarget({
                kind: 'plan-step',
                nodeId: section.planStep.id,
              })
            }
            type="button"
          >
            {isFocused ? '退出步骤聚焦' : '聚焦当前步骤'}
          </button>
        ) : null}
      </div>
      {isCollapsed ? (
        <p className="workspace-helpText">当前步骤面板已折叠。</p>
      ) : (
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
                onDragEnd={onDragEnd}
                onInvalidDrop={onInvalidDrop}
                onDragStart={onDragStart}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onOpenDocumentNode={onOpenDocumentNode}
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
      )}
    </div>
  );
}

function SectionItemNode(
  props: StructureMapRenderProps & {
    item: StructureMapSectionItem;
  },
) {
  if (props.item.kind === 'scaffold-summary') {
    return (
      <div
        className="workspace-structureMapScaffoldItem"
        data-structure-role="scaffold"
        data-testid={`structure-map-scaffold-${props.item.node.node.id}`}
      >
        <StructureMapButton
          anchor={props.item.node.anchor}
          dragNodeId={props.item.node.node.id}
          dragPermission={props.item.node.drag}
          dragState={props.dragState}
          isCurrentAnswer={false}
          isInteractionLocked={props.isInteractionLocked}
          kindLabel="铺垫"
          onDragEnd={props.onDragEnd}
          onDragStart={props.onDragStart}
          onOpenDocumentNode={props.onOpenDocumentNode}
          selectedItemId={props.selectedItemId}
          structureRole="scaffold-summary"
          title={getStructureMapNodeLabel(props.tree, props.item.node.node, 'scaffold')}
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
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
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

  return (
    <div
      className="workspace-structureMapItem workspace-structureMapCluster"
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
          <div
            className="workspace-structureMapQuestionHub"
            data-structure-node="question-hub"
          >
            <StructureMapButton
              anchor={node.anchor}
              dragNodeId={node.question.id}
              dragPermission={node.drag}
              dragState={dragState}
              isCurrentAnswer={false}
              isInteractionLocked={isInteractionLocked}
              isSelectedOverride={isCollapsed && isCurrentQuestionCluster}
              kindLabel="问题"
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onOpenDocumentNode={onOpenDocumentNode}
              selectedItemId={selectedItemId}
              structureRole="question"
              title={getStructureMapNodeLabel(tree, node.question, 'question')}
            />
            <div className="workspace-structureMapActionRow">
              <button
                className="workspace-nodeBodyToggle"
                disabled={isInteractionLocked}
                onClick={() =>
                  isTopLevelCluster
                    ? onToggleStructureMapClusterCollapsed(node.question.id)
                    : onToggleStructureMapFollowUpCollapsed(node.question.id)
                }
                type="button"
              >
                {isCollapsed
                  ? isTopLevelCluster
                    ? '展开问题簇'
                    : '展开追问分支'
                  : isTopLevelCluster
                    ? '收起问题簇'
                    : '收起追问分支'}
              </button>
              {isCurrentQuestionCluster || isFocused ? (
                <button
                  className="workspace-nodeBodyToggle"
                  disabled={isInteractionLocked}
                  onClick={() =>
                    onToggleStructureMapFocusTarget({
                      kind: 'question-cluster',
                      nodeId: node.question.id,
                    })
                  }
                  type="button"
                >
                  {isFocused ? '退出问题簇聚焦' : '聚焦当前问题簇'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {isCollapsed ? (
          <p className="workspace-helpText">
            {isTopLevelCluster ? '当前问题簇已折叠。' : '当前追问分支已折叠。'}
          </p>
        ) : node.entries.length > 0 ? (
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
                  onDragEnd={onDragEnd}
                  onInvalidDrop={onInvalidDrop}
                  onDragStart={onDragStart}
                  onDropRequest={onDropRequest}
                  onDropZoneEnter={onDropZoneEnter}
                  onOpenDocumentNode={onOpenDocumentNode}
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
                onDragEnd={onDragEnd}
                onInvalidDrop={onInvalidDrop}
                onDragStart={onDragStart}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onOpenDocumentNode={onOpenDocumentNode}
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
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
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
              onDragEnd={onDragEnd}
              onInvalidDrop={onInvalidDrop}
              onDragStart={onDragStart}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onOpenDocumentNode={onOpenDocumentNode}
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
  onDragEnd,
  onInvalidDrop,
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  onToggleStructureMapClusterCollapsed,
  onToggleStructureMapFocusTarget,
  onToggleStructureMapFollowUpCollapsed,
  onToggleStructureMapStepCollapsed,
  selectedItemId,
  selectionContext,
  structureMapFocusTarget,
  tree,
  validateStructureMapMove,
  workspaceViewState,
}: StructureMapRenderProps & {
  clusterTone: 'follow-up' | 'top-level';
  entry: StructureMapQuestionEntry;
}) {
  if (entry.kind === 'answer-group') {
    return (
      <SupportingGroupNode
        anchor={entry.group.anchor}
        dragNodeId={entry.group.node.id}
        dragPermission={entry.group.drag}
        dragState={dragState}
        isCurrentAnswer={entry.group.isCurrentAnswer}
        isInteractionLocked={isInteractionLocked}
        kindLabel="回答"
        metaBadges={getAnswerGroupMetaBadges(entry.group)}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onOpenDocumentNode={onOpenDocumentNode}
        selectedItemId={selectedItemId}
        structureRole="answer-group"
        title={getStructureMapNodeLabel(tree, entry.group.node, 'answer')}
      />
    );
  }

  if (entry.kind === 'manual-summary-group') {
    return (
      <SupportingGroupNode
        anchor={entry.group.anchor}
        dragNodeId={entry.group.node.id}
        dragPermission={entry.group.drag}
        dragState={dragState}
        isCurrentAnswer={false}
        isInteractionLocked={isInteractionLocked}
        kindLabel="手写总结"
        metaBadges={getManualSummaryGroupMetaBadges(entry.group)}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onOpenDocumentNode={onOpenDocumentNode}
        selectedItemId={selectedItemId}
        structureRole="summary-group"
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
      onDragEnd={onDragEnd}
      onInvalidDrop={onInvalidDrop}
      onDragStart={onDragStart}
      onDropRequest={onDropRequest}
      onDropZoneEnter={onDropZoneEnter}
      onOpenDocumentNode={onOpenDocumentNode}
      onToggleStructureMapClusterCollapsed={onToggleStructureMapClusterCollapsed}
      onToggleStructureMapFocusTarget={onToggleStructureMapFocusTarget}
      onToggleStructureMapFollowUpCollapsed={onToggleStructureMapFollowUpCollapsed}
      onToggleStructureMapStepCollapsed={onToggleStructureMapStepCollapsed}
      selectedItemId={selectedItemId}
      selectionContext={selectionContext}
      structureMapFocusTarget={structureMapFocusTarget}
      tree={tree}
      validateStructureMapMove={validateStructureMapMove}
      workspaceViewState={workspaceViewState}
    />
  );
}

function SupportingGroupNode({
  anchor,
  dragNodeId,
  dragPermission,
  dragState,
  isCurrentAnswer,
  isInteractionLocked,
  kindLabel,
  metaBadges,
  onDragEnd,
  onDragStart,
  onOpenDocumentNode,
  selectedItemId,
  structureRole,
  title,
}: {
  anchor: StructureMapAnchor;
  dragNodeId: string;
  dragPermission: StructureMapQuestionBlockNode['drag'];
  dragState: DragState | null;
  isCurrentAnswer: boolean;
  isInteractionLocked: boolean;
  kindLabel: string;
  metaBadges: string[];
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  selectedItemId: string | null;
  structureRole: 'answer-group' | 'summary-group';
  title: string;
}) {
  return (
    <div
      className="workspace-structureMapSupportingCard"
      data-structure-role={structureRole}
      data-structure-supporting={structureRole}
      data-testid={`structure-map-supporting-${anchor.nodeId}`}
    >
      <StructureMapButton
        anchor={anchor}
        dragNodeId={dragNodeId}
        dragPermission={dragPermission}
        dragState={dragState}
        isCurrentAnswer={isCurrentAnswer}
        isInteractionLocked={isInteractionLocked}
        kindLabel={kindLabel}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onOpenDocumentNode={onOpenDocumentNode}
        selectedItemId={selectedItemId}
        structureRole={structureRole}
        title={title}
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

function StructureMapButton({
  anchor,
  dragNodeId,
  dragPermission,
  dragState,
  isCurrentAnswer,
  isInteractionLocked,
  kindLabel,
  onDragEnd,
  onDragStart,
  onOpenDocumentNode,
  isSelectedOverride = false,
  selectedItemId,
  structureRole,
  title,
}: {
  anchor: StructureMapAnchor;
  dragNodeId: string;
  dragPermission: StructureMapPresentationModel['drag'];
  dragState: DragState | null;
  isCurrentAnswer: boolean;
  isInteractionLocked: boolean;
  kindLabel: string;
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  isSelectedOverride?: boolean;
  selectedItemId: string | null;
  structureRole: StructureRole;
  title: string;
}) {
  const itemId = getStructureMapSelectionId(anchor);
  const isDragging = dragState?.nodeId === dragNodeId;
  const isSelected = isSelectedOverride || selectedItemId === itemId;

  return (
    <button
      aria-current={isSelected ? 'true' : undefined}
      className="workspace-structureMapButton"
      data-draggable={dragPermission.canDrag}
      data-dragging={isDragging}
      data-kind={itemId.split(':')[0]}
      data-selected={isSelected}
      data-structure-role={structureRole}
      data-testid={`structure-map-item-${itemId}`}
      disabled={isInteractionLocked}
      draggable={!isInteractionLocked && dragPermission.canDrag}
      onClick={() => onOpenDocumentNode(anchor.nodeId)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        if (!dragPermission.canDrag) {
          event.preventDefault();
          return;
        }

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', dragNodeId);
        }
        onDragStart(dragNodeId);
      }}
      type="button"
    >
      <span className="workspace-structureMapLabel">{kindLabel}</span>
      <span className="workspace-structureMapText">{title}</span>
      {dragPermission.canDrag ? (
        <span
          aria-hidden="true"
          className="workspace-structureMapDragHint"
          data-drag-hint={isDragging ? 'dragging' : 'ready'}
        >
          {isDragging ? '拖动中' : '可拖动'}
        </span>
      ) : null}
      {isCurrentAnswer ? (
        <span className="workspace-structureMapBadge">当前回答</span>
      ) : null}
    </button>
  );
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

function getStructureMapFocusTargetTestId(target: StructureMapFocusTarget) {
  return target.kind === 'plan-step'
    ? `structure-map-panel-${target.nodeId}`
    : `structure-map-question-${target.nodeId}`;
}

function getVisibleStructureMapSelectionTestId(
  tree: NodeTree,
  selectedItemId: string | null,
  selectionContext: StructureMapSelectionContext,
  workspaceViewState: WorkspaceViewState,
) {
  if (
    selectionContext.planStepNodeId &&
    workspaceViewState.collapsedStructureMapStepIds.includes(
      selectionContext.planStepNodeId,
    )
  ) {
    return `structure-map-panel-${selectionContext.planStepNodeId}`;
  }

  const collapsedQuestionNodeId = findCollapsedQuestionClusterNodeId(
    tree,
    selectionContext.questionNodeId,
    workspaceViewState,
  );

  if (collapsedQuestionNodeId) {
    return `structure-map-question-${collapsedQuestionNodeId}`;
  }

  return selectedItemId === null ? null : `structure-map-item-${selectedItemId}`;
}

function findCollapsedQuestionClusterNodeId(
  tree: NodeTree,
  questionNodeId: string | null,
  workspaceViewState: WorkspaceViewState,
) {
  if (!questionNodeId) {
    return null;
  }

  let currentNode: NodeTree['nodes'][string] | undefined = tree.nodes[questionNodeId];

  while (currentNode) {
    if (
      workspaceViewState.collapsedStructureMapClusterIds.includes(currentNode.id) ||
      workspaceViewState.collapsedStructureMapFollowUpIds.includes(currentNode.id)
    ) {
      return currentNode.id;
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return null;
}

function findElementByTestId(root: HTMLElement, testId: string) {
  return root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function getStructureMapFocusSummaryLabel(
  tree: NodeTree,
  target: StructureMapFocusTarget,
) {
  const targetNode = tree.nodes[target.nodeId];
  const label = targetNode ? getStructureMapNodeLabel(tree, targetNode) : target.nodeId;

  return target.kind === 'plan-step'
    ? `当前仅显示步骤：${label}`
    : `当前仅显示问题簇：${label}`;
}
