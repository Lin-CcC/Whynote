import type { NodeTree } from '../nodeDomain';
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
  onFocusResourceNode: (nodeId: string) => void;
  onSelectEditorNode: (nodeId: string) => void;
  onClearResourceFocus?: () => void;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
  workspaceTitle: string;
};

export default function ResourcesSearchExportPanel({
  activeResourceNodeId,
  currentModuleId,
  onFocusResourceNode,
  onSelectEditorNode,
  onClearResourceFocus,
  selectedEditorNodeId,
  tree,
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
      <ResourceFocusPanel
        activeResourceNodeId={activeResourceNodeId}
        currentModuleTitle={currentModuleTitle}
        onClearResourceFocus={onClearResourceFocus}
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
