import { useEffect, useState } from 'react';

import type {
  NodeTree,
  ResourceMetadataRecord,
} from '../../nodeDomain';
import ExportPanel from '../../resourcesSearchExport/components/ExportPanel';
import LearningCitationPanel from '../../resourcesSearchExport/components/LearningCitationPanel';
import ResourceEntryPanel from '../../resourcesSearchExport/components/ResourceEntryPanel';
import ResourceFocusPanel from '../../resourcesSearchExport/components/ResourceFocusPanel';
import ResourceLibraryPanel from '../../resourcesSearchExport/components/ResourceLibraryPanel';
import SearchControlPanel from '../../resourcesSearchExport/components/SearchControlPanel';
import SearchLocatorPanel from '../../resourcesSearchExport/components/SearchLocatorPanel';
import { useResourcesSearchExport } from '../../resourcesSearchExport/hooks/useResourcesSearchExport';
import { deleteResourceNode } from '../../resourcesSearchExport/services/resourceDeleteService';
import type { ResourceImportDraft } from '../../resourcesSearchExport/services/resourceIngestTypes';
import '../../resourcesSearchExport/resourcesSearchExport.css';

type SharedResourceToolPanelProps = {
  activeResourceNodeId: string | null;
  currentModuleId: string | null;
  onApplyTreeChange: (nextTree: NodeTree) => void;
  onClearResourceFocus: () => void;
  onFocusResourceNode: (nodeId: string) => void;
  onResolveResourceSummary?: (
    draft: ResourceImportDraft,
  ) => Promise<ResourceImportDraft>;
  onSelectEditorNode: (nodeId: string) => void;
  onUpsertResourceMetadata?: (record: ResourceMetadataRecord) => Promise<void>;
  resourceMetadataByNodeId: Record<string, ResourceMetadataRecord>;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
  uiPreferences?: Parameters<typeof useResourcesSearchExport>[0]['uiPreferences'];
  workspaceId: string;
  workspaceTitle: string;
};

type RuntimeExportToolPanelProps = Pick<
  SharedResourceToolPanelProps,
  'currentModuleId' | 'tree' | 'uiPreferences' | 'workspaceId' | 'workspaceTitle'
>;

const NOOP_RESOURCE_METADATA_RECORD_UPSERT = async () => {};

export function WorkspaceRuntimeResourcesToolPanel({
  activeResourceNodeId,
  currentModuleId,
  onApplyTreeChange,
  onClearResourceFocus,
  onFocusResourceNode,
  onResolveResourceSummary,
  onSelectEditorNode,
  onUpsertResourceMetadata = NOOP_RESOURCE_METADATA_RECORD_UPSERT,
  resourceMetadataByNodeId,
  selectedEditorNodeId,
  tree,
  uiPreferences,
  workspaceId,
  workspaceTitle,
}: SharedResourceToolPanelProps) {
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(
    null,
  );
  const currentModuleTitle =
    currentModuleId && tree.nodes[currentModuleId]?.type === 'module'
      ? tree.nodes[currentModuleId].title
      : null;
  const resourcesSearchExport = useResourcesSearchExport({
    currentModuleId,
    tree,
    uiPreferences,
    workspaceId,
    workspaceTitle,
  });
  const hasActiveSearch =
    resourcesSearchExport.query.trim().length > 0 ||
    resourcesSearchExport.selectedTagIds.length > 0;
  const highlightedNodeId = activeResourceNodeId ?? selectedEditorNodeId;

  useEffect(() => {
    if (pendingDeleteNodeId && !tree.nodes[pendingDeleteNodeId]) {
      setPendingDeleteNodeId(null);
    }

    if (activeResourceNodeId && !tree.nodes[activeResourceNodeId]) {
      onClearResourceFocus();
    }
  }, [activeResourceNodeId, onClearResourceFocus, pendingDeleteNodeId, tree]);

  return (
    <>
      <ResourceEntryPanel
        activeResourceNodeId={activeResourceNodeId}
        onApplyTreeChange={onApplyTreeChange}
        onFocusResourceNode={onFocusResourceNode}
        onResolveResourceSummary={onResolveResourceSummary}
        onUpsertResourceMetadata={onUpsertResourceMetadata}
        tree={tree}
        workspaceId={workspaceId}
      />
      <ResourceFocusPanel
        activeResourceNodeId={activeResourceNodeId}
        currentModuleTitle={currentModuleTitle}
        onApplyTreeChange={onApplyTreeChange}
        onCancelDeleteNode={() => {
          setPendingDeleteNodeId(null);
        }}
        onClearResourceFocus={onClearResourceFocus}
        onConfirmDeleteNode={handleConfirmDeleteNode}
        onFocusResourceNode={onFocusResourceNode}
        onRequestDeleteNode={handleRequestDeleteNode}
        pendingDeleteNodeId={pendingDeleteNodeId}
        resourceMetadataByNodeId={resourceMetadataByNodeId}
        selectedEditorNodeId={selectedEditorNodeId}
        tree={tree}
      />
      <SearchControlPanel
        availableTags={resourcesSearchExport.searchState.availableTags}
        currentModuleTitle={currentModuleTitle}
        onQueryChange={resourcesSearchExport.setQuery}
        onScopeChange={resourcesSearchExport.setScope}
        onToggleTag={resourcesSearchExport.toggleTag}
        query={resourcesSearchExport.query}
        scope={resourcesSearchExport.scope}
        selectedTagIds={resourcesSearchExport.selectedTagIds}
      />
      <SearchLocatorPanel
        currentModuleTitle={currentModuleTitle}
        hasActiveSearch={hasActiveSearch}
        onSelectNode={handleLocateNode}
        results={resourcesSearchExport.searchState.results}
        scope={resourcesSearchExport.scope}
        selectedNodeId={highlightedNodeId}
      />
      <ResourceLibraryPanel
        onRequestDeleteNode={handleRequestDeleteNode}
        onSelectNode={handleLocateNode}
        resourceGroups={resourcesSearchExport.resourceGroups}
        resourceMetadataByNodeId={resourceMetadataByNodeId}
        selectedNodeId={highlightedNodeId}
        tree={tree}
      />
    </>
  );

  function handleLocateNode(nodeId: string) {
    const node = tree.nodes[nodeId];

    if (!node) {
      return;
    }

    setPendingDeleteNodeId(null);

    if (node.type === 'resource' || node.type === 'resource-fragment') {
      onFocusResourceNode(node.id);
      return;
    }

    onSelectEditorNode(node.id);
  }

  function handleRequestDeleteNode(nodeId: string) {
    const node = tree.nodes[nodeId];

    if (!node) {
      return;
    }

    if (node.type !== 'resource' && node.type !== 'resource-fragment') {
      return;
    }

    onFocusResourceNode(node.id);
    setPendingDeleteNodeId(node.id);
  }

  function handleConfirmDeleteNode() {
    if (!pendingDeleteNodeId || !tree.nodes[pendingDeleteNodeId]) {
      return;
    }

    const result = deleteResourceNode(tree, pendingDeleteNodeId);

    onApplyTreeChange(result.tree);
    setPendingDeleteNodeId(null);

    if (result.nextFocusNodeId) {
      onFocusResourceNode(result.nextFocusNodeId);
      return;
    }

    onClearResourceFocus();
  }
}

export function WorkspaceRuntimeReferencesToolPanel({
  onFocusResourceNode,
  selectedEditorNodeId,
  tree,
}: Pick<
  SharedResourceToolPanelProps,
  'onFocusResourceNode' | 'selectedEditorNodeId' | 'tree'
>) {
  return (
    <LearningCitationPanel
      onFocusResourceNode={onFocusResourceNode}
      selectedEditorNodeId={selectedEditorNodeId}
      tree={tree}
    />
  );
}

export function WorkspaceRuntimeExportToolPanel({
  currentModuleId,
  tree,
  uiPreferences,
  workspaceId,
  workspaceTitle,
}: RuntimeExportToolPanelProps) {
  const resourcesSearchExport = useResourcesSearchExport({
    currentModuleId,
    tree,
    uiPreferences,
    workspaceId,
    workspaceTitle,
  });

  return (
    <ExportPanel
      canUseExpandedContentMode={resourcesSearchExport.canUseExpandedContentMode}
      canExportFilteredResult={resourcesSearchExport.canExportFilteredResult}
      exportContentMode={resourcesSearchExport.exportContentMode}
      exportError={resourcesSearchExport.exportError}
      exportFormat={resourcesSearchExport.exportFormat}
      exportTarget={resourcesSearchExport.exportTarget}
      includePlanSteps={resourcesSearchExport.includePlanSteps}
      onExportContentModeChange={resourcesSearchExport.setExportContentMode}
      onExport={resourcesSearchExport.downloadCurrentExport}
      onExportFormatChange={resourcesSearchExport.setExportFormat}
      onExportTargetChange={resourcesSearchExport.setExportTarget}
      onIncludePlanStepsChange={resourcesSearchExport.setIncludePlanSteps}
      scope={resourcesSearchExport.scope}
    />
  );
}
