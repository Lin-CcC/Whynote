import type { NodeTree, ResourceMetadataRecord } from '../nodeDomain';
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
  onSelectEditorNode: (nodeId: string) => void;
  onClearResourceFocus?: () => void;
  onUpsertResourceMetadata?: (record: ResourceMetadataRecord) => Promise<void>;
  resourceMetadataByNodeId?: Record<string, ResourceMetadataRecord>;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
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
  onSelectEditorNode,
  onClearResourceFocus,
  onUpsertResourceMetadata = NOOP_RESOURCE_METADATA_RECORD_UPSERT,
  resourceMetadataByNodeId = {},
  selectedEditorNodeId,
  tree,
  workspaceId = DEFAULT_WORKSPACE_ID,
  workspaceTitle,
}: ResourcesSearchExportPanelProps) {
  const currentModuleTitle =
    currentModuleId && tree.nodes[currentModuleId]?.type === 'module'
      ? tree.nodes[currentModuleId].title
      : null;
  const resourcesSearchExport = useResourcesSearchExport({
    currentModuleId,
    tree,
    workspaceTitle,
  });
  const hasActiveSearch =
    resourcesSearchExport.query.trim().length > 0 ||
    resourcesSearchExport.selectedTagIds.length > 0;
  const highlightedNodeId = activeResourceNodeId ?? selectedEditorNodeId;

  return (
    <>
      <ResourceEntryPanel
        activeResourceNodeId={activeResourceNodeId}
        onApplyTreeChange={onApplyTreeChange}
        onFocusResourceNode={onFocusResourceNode}
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
        onClearResourceFocus={onClearResourceFocus}
        onFocusResourceNode={onFocusResourceNode}
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
        onSelectNode={handleLocateNode}
        resourceGroups={resourcesSearchExport.resourceGroups}
        selectedNodeId={highlightedNodeId}
      />
      <ExportPanel
        canExportFilteredResult={resourcesSearchExport.canExportFilteredResult}
        exportError={resourcesSearchExport.exportError}
        exportFormat={resourcesSearchExport.exportFormat}
        exportTarget={resourcesSearchExport.exportTarget}
        includePlanSteps={resourcesSearchExport.includePlanSteps}
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

    if (node.type === 'resource' || node.type === 'resource-fragment') {
      onFocusResourceNode(node.id);
      return;
    }

    onSelectEditorNode(node.id);
  }
}
