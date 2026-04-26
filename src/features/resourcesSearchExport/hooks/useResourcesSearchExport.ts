import { useState } from 'react';

import type { NodeTree } from '../../nodeDomain';
import { createWorkspaceExport } from '../services/resourceExportService';
import { listResourceGroups } from '../services/resourceLibraryService';
import { searchWorkspaceNodes } from '../services/resourceSearchService';
import type {
  ExportFormat,
  ExportTarget,
  SearchScope,
} from '../resourceSearchExportTypes';
import { downloadExportFile } from '../utils/downloadExportFile';
import { collectTagMatchedNodeIds } from '../utils/resourceTreeUtils';

interface UseResourcesSearchExportOptions {
  currentModuleId: string | null;
  tree: NodeTree;
  workspaceTitle: string;
}

export function useResourcesSearchExport({
  currentModuleId,
  tree,
  workspaceTitle,
}: UseResourcesSearchExportOptions) {
  const [exportError, setExportError] = useState<string | null>(null);
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

  return {
    canExportFilteredResult,
    exportError,
    exportFormat,
    exportTarget,
    includePlanSteps,
    query,
    resourceGroups,
    scope,
    searchState,
    selectedTagIds,
    downloadCurrentExport,
    setExportFormat,
    setExportTarget,
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
        currentModuleId,
        filterScope,
        format: exportFormat,
        includePlanSteps,
        selectedTagIds,
        target: exportTarget,
        tree,
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
}
