import { useState } from 'react';

import type { NodeTree, UiPreferences } from '../../nodeDomain';
import { createWorkspaceExport } from '../services/resourceExportService';
import { listResourceGroups } from '../services/resourceLibraryService';
import { searchWorkspaceNodes } from '../services/resourceSearchService';
import type {
  ExportContentMode,
  ExportFormat,
  ExportTarget,
  SearchScope,
} from '../resourceSearchExportTypes';
import { downloadExportFile } from '../utils/downloadExportFile';
import { collectTagMatchedNodeIds } from '../utils/resourceTreeUtils';

interface UseResourcesSearchExportOptions {
  currentModuleId: string | null;
  tree: NodeTree;
  uiPreferences?: UiPreferences | null;
  workspaceId?: string | null;
  workspaceTitle: string;
}

export function useResourcesSearchExport({
  currentModuleId,
  tree,
  uiPreferences,
  workspaceId,
  workspaceTitle,
}: UseResourcesSearchExportOptions) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportContentMode, setExportContentMode] =
    useState<ExportContentMode>('full');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportTarget, setExportTarget] = useState<ExportTarget>('current-module');
  const [includePlanSteps, setIncludePlanSteps] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('current-module');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const searchState = searchWorkspaceNodes({
    currentModuleId,
    query,
    scope,
    selectedTagIds,
    tree,
  });
  const resourceGroups = listResourceGroups(tree);
  const filterScope = scope === 'theme' ? 'theme' : 'current-module';
  const tagFilteredMatchCount = collectTagMatchedNodeIds(
    tree,
    filterScope,
    currentModuleId,
    selectedTagIds,
  ).length;
  const canExportFilteredResult =
    scope !== 'resources' && selectedTagIds.length > 0 && tagFilteredMatchCount > 0;
  const canUseExpandedContentMode = exportTarget !== 'filtered';

  return {
    canUseExpandedContentMode,
    canExportFilteredResult,
    exportContentMode,
    exportError,
    exportFormat,
    exportTarget,
    includePlanSteps,
    query,
    resourceGroups,
    scope,
    searchState,
    setExportContentMode,
    selectedTagIds,
    downloadCurrentExport,
    setExportFormat,
    setExportTarget: handleExportTargetChange,
    setIncludePlanSteps,
    setQuery,
    setScope,
    toggleTag,
  };

  function toggleTag(tagId: string) {
    setSelectedTagIds((previousTagIds) =>
      previousTagIds.includes(tagId)
        ? previousTagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...previousTagIds, tagId],
    );
  }

  function downloadCurrentExport() {
    try {
      const descriptor = createWorkspaceExport({
        contentMode: exportContentMode,
        currentModuleId,
        filterScope,
        format: exportFormat,
        includePlanSteps,
        selectedTagIds,
        target: exportTarget,
        tree,
        uiPreferences,
        workspaceId,
        workspaceTitle,
      });

      downloadExportFile(descriptor);
      setExportError(null);

      return descriptor;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请稍后重试。');
      return null;
    }
  }

  function handleExportTargetChange(nextTarget: ExportTarget) {
    setExportTarget(nextTarget);

    if (nextTarget === 'filtered') {
      setExportContentMode('full');
    }
  }
}
