import { useEffect, useState } from 'react';

import type {
  NodeTree,
  ResourceMetadataRecord,
  UiPreferences,
} from '../nodeDomain';
import type { ResourceImportDraft } from './services/resourceIngestTypes';
import { deleteResourceNode } from './services/resourceDeleteService';
import ResourceEntryPanel from './components/ResourceEntryPanel';
import LearningCitationPanel from './components/LearningCitationPanel';
import ResourceFocusPanel from './components/ResourceFocusPanel';
import SearchControlPanel from './components/SearchControlPanel';
import ExportPanel from './components/ExportPanel';
import ResourceLibraryPanel from './components/ResourceLibraryPanel';
import SearchLocatorPanel from './components/SearchLocatorPanel';
import { useResourcesSearchExport } from './hooks/useResourcesSearchExport';
import './resourcesSearchExport.css';

type ResourcesSearchExportPanelProps = {
  activeResourceNodeId: string | null;
  currentModuleId: string | null;
  onApplyTreeChange: (nextTree: NodeTree) => void;
  onFocusResourceNode: (nodeId: string) => void;
  onResolveResourceSummary?: (
    draft: ResourceImportDraft,
  ) => Promise<ResourceImportDraft>;
  onSelectEditorNode: (nodeId: string) => void;
  onClearResourceFocus?: () => void;
  onUpsertResourceMetadata?: (record: ResourceMetadataRecord) => Promise<void>;
  resourceMetadataByNodeId?: Record<string, ResourceMetadataRecord>;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
  uiPreferences?: UiPreferences | null;
  workspaceId?: string;
  workspaceTitle: string;
};

const NOOP_RESOURCE_METADATA_RECORD_UPSERT = async () => {};
const DEFAULT_WORKSPACE_ID = 'workspace-preview';

export default function ResourcesSearchExportPanel({
  activeResourceNodeId,
  currentModuleId,
  onApplyTreeChange,
  onFocusResourceNode,
  onResolveResourceSummary,
  onSelectEditorNode,
  onClearResourceFocus,
  onUpsertResourceMetadata = NOOP_RESOURCE_METADATA_RECORD_UPSERT,
  resourceMetadataByNodeId = {},
  selectedEditorNodeId,
  tree,
  uiPreferences,
  workspaceId = DEFAULT_WORKSPACE_ID,
  workspaceTitle,
}: ResourcesSearchExportPanelProps) {
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
      onClearResourceFocus?.();
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
      <LearningCitationPanel
        onFocusResourceNode={onFocusResourceNode}
        selectedEditorNodeId={selectedEditorNodeId}
        tree={tree}
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
      <ExportPanel
        canUseExpandedContentMode={
          resourcesSearchExport.canUseExpandedContentMode
        }
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

    onClearResourceFocus?.();
  }
}
