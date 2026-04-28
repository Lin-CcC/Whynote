import {
  getDisplayNodeTypeLabel,
  type NodeTree,
  type TreeNode,
} from '../../nodeDomain';
import type { SearchScope } from '../resourceSearchExportTypes';

export function collectScopedNodes(
  tree: NodeTree,
  scope: SearchScope,
  currentModuleId: string | null,
) {
  switch (scope) {
    case 'current-module':
      if (!currentModuleId || tree.nodes[currentModuleId]?.type !== 'module') {
        return [];
      }

      return traverseSubtree(tree, currentModuleId);
    case 'resources':
      return tree.nodes[tree.rootId].childIds.flatMap((childId) =>
        tree.nodes[childId]?.type === 'resource' ? traverseSubtree(tree, childId) : [],
      );
    case 'theme':
      return tree.nodes[tree.rootId].childIds.flatMap((childId) =>
        tree.nodes[childId] ? traverseSubtree(tree, childId) : [],
      );
  }
}

export function collectScopedTagOptions(
  tree: NodeTree,
  scope: SearchScope,
  currentModuleId: string | null,
) {
  if (scope === 'resources') {
    return [];
  }

  const tagUsageCountMap = new Map<string, number>();

  for (const node of collectScopedNodes(tree, scope, currentModuleId)) {
    const uniqueTagIds = new Set(node.tagIds);

    for (const tagId of uniqueTagIds) {
      if (!tree.tags[tagId]) {
        continue;
      }

      tagUsageCountMap.set(tagId, (tagUsageCountMap.get(tagId) ?? 0) + 1);
    }
  }

  return [...tagUsageCountMap.entries()]
    .map(([tagId, count]) => ({
      count,
      id: tagId,
      name: tree.tags[tagId]?.name ?? tagId,
    }))
    .sort((leftTag, rightTag) => leftTag.name.localeCompare(rightTag.name, 'zh-Hans-CN'));
}

export function collectTagMatchedNodeIds(
  tree: NodeTree,
  scope: SearchScope,
  currentModuleId: string | null,
  selectedTagIds: string[],
) {
  if (scope === 'resources' || selectedTagIds.length === 0) {
    return [];
  }

  const allowedTagIds = new Set(
    selectedTagIds.filter((tagId) => tree.tags[tagId] !== undefined),
  );

  return collectScopedNodes(tree, scope, currentModuleId)
    .filter((node) => node.tagIds.some((tagId) => allowedTagIds.has(tagId)))
    .map((node) => node.id);
}

export function collectAncestorInclusiveNodeIds(
  tree: NodeTree,
  nodeIds: string[],
) {
  const includedNodeIds = new Set<string>();

  for (const nodeId of nodeIds) {
    let currentNode: TreeNode | undefined = tree.nodes[nodeId];

    while (currentNode) {
      includedNodeIds.add(currentNode.id);
      currentNode =
        currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
    }
  }

  return includedNodeIds;
}

export function getNodeTagNames(tree: NodeTree, node: TreeNode) {
  return node.tagIds
    .map((tagId) => tree.tags[tagId]?.name)
    .filter((tagName): tagName is string => Boolean(tagName))
    .sort((leftTag, rightTag) => leftTag.localeCompare(rightTag, 'zh-Hans-CN'));
}

export function getNodePathLabel(tree: NodeTree, nodeId: string) {
  const titles: string[] = [];
  let currentNode: TreeNode | undefined = tree.nodes[nodeId];

  while (currentNode) {
    if (currentNode.type !== 'theme-root') {
      titles.unshift(currentNode.title);
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return titles.join(' / ');
}

export function formatNodeLabel(tree: NodeTree, node: TreeNode) {
  return `${getDisplayNodeTypeLabel(tree, node)} · ${node.title}`;
}

export function getNodeSourceSummary(tree: NodeTree, node: TreeNode) {
  if (node.type === 'resource') {
    return (
      node.sourceUri ??
      node.mimeType ??
      truncateText(node.content.trim(), 88) ??
      '未提供来源信息'
    );
  }

  if (node.type !== 'resource-fragment') {
    return null;
  }

  const sourceNode = tree.nodes[node.sourceResourceId];
  const sourceParts = [sourceNode?.title, node.locator].filter(Boolean);

  if (sourceParts.length > 0) {
    return sourceParts.join(' · ');
  }

  return truncateText(node.excerpt.trim(), 88) ?? '摘录来源未命名';
}

export function buildSearchableFields(tree: NodeTree, node: TreeNode) {
  const fields = [node.title, node.content, ...getNodeTagNames(tree, node)];

  if (node.type === 'resource') {
    fields.push(node.sourceUri ?? '', node.mimeType ?? '', getNodeSourceSummary(tree, node) ?? '');
  }

  if (node.type === 'resource-fragment') {
    const sourceNode = tree.nodes[node.sourceResourceId];

    fields.push(
      node.excerpt,
      node.locator ?? '',
      sourceNode?.title ?? '',
      getNodeSourceSummary(tree, node) ?? '',
    );
  }

  return fields.filter((field) => field.trim().length > 0);
}

export function buildNodeSnippet(
  tree: NodeTree,
  node: TreeNode,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchableFields = buildSearchableFields(tree, node);

  if (!normalizedQuery) {
    return truncateText(searchableFields[1] ?? searchableFields[0] ?? '', 120) ?? '';
  }

  for (const field of searchableFields) {
    const normalizedField = field.toLocaleLowerCase();
    const matchIndex = normalizedField.indexOf(normalizedQuery);

    if (matchIndex === -1) {
      continue;
    }

    return trimAroundMatch(field, matchIndex, normalizedQuery.length, 120);
  }

  return truncateText(searchableFields[0] ?? '', 120) ?? '';
}

export function getScopeLabel(
  scope: SearchScope,
  currentModuleTitle: string | null,
) {
  switch (scope) {
    case 'current-module':
      return currentModuleTitle ? `当前模块 · ${currentModuleTitle}` : '当前模块';
    case 'theme':
      return '全主题';
    case 'resources':
      return '资料区';
  }
}

export function getEmptyStateLabel(scope: SearchScope) {
  switch (scope) {
    case 'current-module':
      return '当前模块无结果';
    case 'theme':
      return '当前主题无结果';
    case 'resources':
      return '资料区无结果';
  }
}

function traverseSubtree(tree: NodeTree, nodeId: string): TreeNode[] {
  const traversedNodes: TreeNode[] = [];
  const node = tree.nodes[nodeId];

  if (!node) {
    return traversedNodes;
  }

  traversedNodes.push(node);

  for (const childId of node.childIds) {
    traversedNodes.push(...traverseSubtree(tree, childId));
  }

  return traversedNodes;
}

function truncateText(text: string, maxLength: number) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return null;
  }

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 1).trimEnd()}…`;
}

function trimAroundMatch(
  text: string,
  matchIndex: number,
  queryLength: number,
  maxLength: number,
) {
  if (text.length <= maxLength) {
    return text.trim();
  }

  const padding = Math.max(18, Math.floor((maxLength - queryLength) / 2));
  const sliceStart = Math.max(0, matchIndex - padding);
  const sliceEnd = Math.min(text.length, matchIndex + queryLength + padding);
  const slice = text.slice(sliceStart, sliceEnd).trim();
  const prefix = sliceStart > 0 ? '…' : '';
  const suffix = sliceEnd < text.length ? '…' : '';

  return `${prefix}${slice}${suffix}`;
}
