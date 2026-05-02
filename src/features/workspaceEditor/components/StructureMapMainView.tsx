import { useState, type DragEvent } from 'react';

import {
  buildStructureMapPresentationModel,
  getNodeOrThrow,
  getStructureMapNodeLabel,
  getStructureMapSelectionId,
  resolveStructureMapSelectionAnchor,
  type NodeTree,
  type StructureMapAnchor,
  type StructureMapAnswerGroupNode,
  type StructureMapManualSummaryGroupNode,
  type StructureMapMoveRequest,
  type StructureMapMoveValidationResult,
  type StructureMapPresentationModel,
  type StructureMapQuestionBlockNode,
  type StructureMapQuestionEntry,
  type StructureMapSection,
  type StructureMapSectionItem,
} from '../../nodeDomain';

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
};

type DragState = {
  nodeId: string;
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

type StructureMapRenderProps = {
  activeDropZoneId: string | null;
  dragState: DragState | null;
  isInteractionLocked: boolean;
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onDropRequest: (
    request: Omit<StructureMapMoveRequest, 'nodeId'>,
    siblingNodeIds: string[],
  ) => void;
  onDropZoneEnter: (dropZoneId: string | null) => void;
  onOpenDocumentNode: (nodeId: string) => void;
  selectedItemId: string | null;
  tree: NodeTree;
};

export default function StructureMapMainView({
  currentModuleId,
  isInteractionLocked,
  onCreateModule,
  onMoveStructureMapNode,
  onOpenDocumentNode,
  selectedNodeId,
  tree,
  validateStructureMapMove,
}: StructureMapMainViewProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropZoneId, setActiveDropZoneId] = useState<string | null>(null);

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
  const selectedAnchor = resolveStructureMapSelectionAnchor(
    tree,
    currentModuleId,
    selectedNodeId,
  );
  const selectedItemId = selectedAnchor
    ? getStructureMapSelectionId(selectedAnchor)
    : null;
  const sectionNodeIds = model.sections.map((section) => section.anchor.nodeId);

  function handleDragStart(nodeId: string) {
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
    setDragState(null);
  }

  return (
    <div className="workspace-mainPanel">
      <div
        className="workspace-documentShell workspace-structureMapShell"
        data-layout="single-column"
        data-testid="workspace-structure-map-shell"
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
        <div className="workspace-structureMapBody">
          <StructureMapDropZone
            activeDropZoneId={activeDropZoneId}
            dragState={dragState}
            dropZoneId={createDropZoneId(currentModule.id, 0)}
            isInteractionLocked={isInteractionLocked}
            onDropRequest={() =>
              handleDropRequest(
                {
                  index: 0,
                  targetParentNodeId: currentModule.id,
                },
                sectionNodeIds,
              )
            }
            onDropZoneEnter={setActiveDropZoneId}
          />
          {model.sections.map((section, index) => (
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
                onDragStart={handleDragStart}
                onDropRequest={handleDropRequest}
                onDropZoneEnter={setActiveDropZoneId}
                onOpenDocumentNode={onOpenDocumentNode}
                section={section}
                selectedItemId={selectedItemId}
                tree={tree}
              />
              <StructureMapDropZone
                activeDropZoneId={activeDropZoneId}
                dragState={dragState}
                dropZoneId={createDropZoneId(currentModule.id, index + 1)}
                isInteractionLocked={isInteractionLocked}
                onDropRequest={() =>
                  handleDropRequest(
                    {
                      index: index + 1,
                      targetParentNodeId: currentModule.id,
                    },
                    sectionNodeIds,
                  )
                }
                onDropZoneEnter={setActiveDropZoneId}
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
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  section,
  selectedItemId,
  tree,
}: StructureMapRenderProps & {
  section: StructureMapSection;
}) {
  const itemNodeIds = section.items.map((item) => getSectionItemAnchorNodeId(item));

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
        selectedItemId={selectedItemId}
        structureRole="plan-step"
        title={getStructureMapNodeLabel(tree, section.planStep, 'step')}
      />
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
              dropZoneId={createDropZoneId(section.planStep.id, index)}
              isInteractionLocked={isInteractionLocked}
              onDropRequest={() =>
                onDropRequest(
                  {
                    index,
                    targetParentNodeId: section.planStep.id,
                  },
                  itemNodeIds,
                )
              }
              onDropZoneEnter={onDropZoneEnter}
            />
            <SectionItemNode
              activeDropZoneId={activeDropZoneId}
              dragState={dragState}
              isInteractionLocked={isInteractionLocked}
              item={item}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onOpenDocumentNode={onOpenDocumentNode}
              selectedItemId={selectedItemId}
              tree={tree}
            />
          </div>
        ))}
        <StructureMapDropZone
          activeDropZoneId={activeDropZoneId}
          dragState={dragState}
          dropZoneId={createDropZoneId(section.planStep.id, section.items.length)}
          isInteractionLocked={isInteractionLocked}
          onDropRequest={() =>
            onDropRequest(
              {
                index: section.items.length,
                targetParentNodeId: section.planStep.id,
              },
              itemNodeIds,
            )
          }
          onDropZoneEnter={onDropZoneEnter}
        />
      </div>
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
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  selectedItemId,
  tree,
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
        kindLabel="问题"
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onOpenDocumentNode={onOpenDocumentNode}
        selectedItemId={selectedItemId}
        structureRole="question"
        title={getStructureMapNodeLabel(tree, node.question, 'question')}
            />
          </div>
        </div>
      {node.entries.length > 0 ? (
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
                onDragStart={onDragStart}
                onDropRequest={onDropRequest}
                onDropZoneEnter={onDropZoneEnter}
                onOpenDocumentNode={onOpenDocumentNode}
                selectedItemId={selectedItemId}
                tree={tree}
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
              onDragStart={onDragStart}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onOpenDocumentNode={onOpenDocumentNode}
              selectedItemId={selectedItemId}
              tree={tree}
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
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  selectedItemId,
  tree,
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
              dropZoneId={createDropZoneId(node.question.id, index)}
              isInteractionLocked={isInteractionLocked}
              onDropRequest={() =>
                onDropRequest(
                  {
                    index,
                    targetParentNodeId: node.question.id,
                  },
                  entryNodeIds,
                )
              }
              onDropZoneEnter={onDropZoneEnter}
            />
            <QuestionEntryNode
              activeDropZoneId={activeDropZoneId}
              clusterTone={groupKind === 'follow-up' ? 'follow-up' : 'top-level'}
              dragState={dragState}
              entry={entry}
              isInteractionLocked={isInteractionLocked}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDropRequest={onDropRequest}
              onDropZoneEnter={onDropZoneEnter}
              onOpenDocumentNode={onOpenDocumentNode}
              selectedItemId={selectedItemId}
              tree={tree}
            />
          </div>
        ))}
        {shouldRenderTrailingDropZone ? (
          <StructureMapDropZone
            activeDropZoneId={activeDropZoneId}
            dragState={dragState}
            dropZoneId={createDropZoneId(node.question.id, node.entries.length)}
            isInteractionLocked={isInteractionLocked}
            onDropRequest={() =>
              onDropRequest(
                {
                  index: node.entries.length,
                  targetParentNodeId: node.question.id,
                },
                entryNodeIds,
              )
            }
            onDropZoneEnter={onDropZoneEnter}
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
  onDragStart,
  onDropRequest,
  onDropZoneEnter,
  onOpenDocumentNode,
  selectedItemId,
  tree,
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
      onDragStart={onDragStart}
      onDropRequest={onDropRequest}
      onDropZoneEnter={onDropZoneEnter}
      onOpenDocumentNode={onOpenDocumentNode}
      selectedItemId={selectedItemId}
      tree={tree}
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
  selectedItemId: string | null;
  structureRole: StructureRole;
  title: string;
}) {
  const itemId = getStructureMapSelectionId(anchor);

  return (
    <button
      aria-current={selectedItemId === itemId ? 'true' : undefined}
      className="workspace-structureMapButton"
      data-dragging={dragState?.nodeId === dragNodeId}
      data-kind={itemId.split(':')[0]}
      data-selected={selectedItemId === itemId}
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
      {isCurrentAnswer ? (
        <span className="workspace-structureMapBadge">当前回答</span>
      ) : null}
    </button>
  );
}

function StructureMapDropZone({
  activeDropZoneId,
  dragState,
  dropZoneId,
  isInteractionLocked,
  onDropRequest,
  onDropZoneEnter,
}: {
  activeDropZoneId: string | null;
  dragState: DragState | null;
  dropZoneId: string;
  isInteractionLocked: boolean;
  onDropRequest: () => void;
  onDropZoneEnter: (dropZoneId: string | null) => void;
}) {
  const isActive = dragState !== null && activeDropZoneId === dropZoneId;

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (isInteractionLocked || !dragState) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    onDropZoneEnter(dropZoneId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (isInteractionLocked || !dragState) {
      return;
    }

    event.preventDefault();
    onDropRequest();
  }

  return (
    <div
      className="workspace-structureMapDropZone"
      data-active={isActive}
      data-testid={dropZoneId}
      onDragLeave={() => {
        if (activeDropZoneId === dropZoneId) {
          onDropZoneEnter(null);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
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
