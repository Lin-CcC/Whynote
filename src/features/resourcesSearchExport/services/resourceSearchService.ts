import {
  getDisplayNodeTypeLabel,
  type NodeTree,
} from '../../nodeDomain';
import type {
  SearchScope,
  SearchWorkspaceNodesResult,
} from '../resourceSearchExportTypes';
import {
  buildNodeSnippet,
  buildSearchableFields,
  collectScopedNodes,
  collectScopedTagOptions,
  getNodePathLabel,
  getNodeSourceSummary,
  getNodeTagNames,
} from '../utils/resourceTreeUtils';

interface SearchWorkspaceNodesOptions {
  currentModuleId: string | null;
  query: string;
  scope: SearchScope;
  selectedTagIds: string[];
  tree: NodeTree;
}

export function searchWorkspaceNodes({
  currentModuleId,
  query,
  scope,
  selectedTagIds,
  tree,
}: SearchWorkspaceNodesOptions): SearchWorkspaceNodesResult {
  const scopedNodes = collectScopedNodes(tree, scope, currentModuleId);
  const availableTags = collectScopedTagOptions(tree, scope, currentModuleId);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const effectiveTagIds =
    scope === 'resources'
      ? []
      : selectedTagIds.filter((tagId) => tree.tags[tagId] !== undefined);

  if (!normalizedQuery && effectiveTagIds.length === 0) {
    return {
      availableTags,
      results: [],
      scopedNodeCount: scopedNodes.length,
    };
  }

  const results = scopedNodes.flatMap((node, scopeIndex) => {
    const matchesSelectedTags =
      effectiveTagIds.length === 0 ||
      node.tagIds.some((tagId) => effectiveTagIds.includes(tagId));

    if (!matchesSelectedTags) {
      return [];
    }

    const searchableFields = buildSearchableFields(tree, node);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      searchableFields.some((field) => field.toLocaleLowerCase().includes(normalizedQuery));

    if (!matchesQuery) {
      return [];
    }

    const locationRatio =
      scopedNodes.length <= 1 ? 0.5 : scopeIndex / (scopedNodes.length - 1);

    return [
      {
        locationRatio,
        nodeId: node.id,
        nodeType: node.type,
        nodeTypeLabel: getDisplayNodeTypeLabel(tree, node),
        pathLabel: getNodePathLabel(tree, node.id),
        scopeIndex,
        scopeSize: scopedNodes.length,
        snippet: buildNodeSnippet(tree, node, query),
        sourceSummary: getNodeSourceSummary(tree, node),
        tagNames: getNodeTagNames(tree, node),
        title: node.title,
      },
    ];
  });

  return {
    availableTags,
    results,
    scopedNodeCount: scopedNodes.length,
  };
}
