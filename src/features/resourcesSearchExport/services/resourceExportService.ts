import {
  getDisplayNodeTypeLabel,
  getNodeOrThrow,
  type NodeTree,
  type TreeNode,
} from '../../nodeDomain';
import type {
  ExportFileDescriptor,
  ExportFormat,
  ExportTarget,
  SearchScope,
} from '../resourceSearchExportTypes';
import {
  collectAncestorInclusiveNodeIds,
  collectScopedNodes,
  collectTagMatchedNodeIds,
  getNodeSourceSummary,
  getNodeTagNames,
} from '../utils/resourceTreeUtils';

interface CreateWorkspaceExportOptions {
  currentModuleId: string | null;
  filterScope?: SearchScope;
  format: ExportFormat;
  includePlanSteps: boolean;
  selectedTagIds?: string[];
  target: ExportTarget;
  tree: NodeTree;
  workspaceTitle: string;
}

interface ExportBlock {
  kind: 'heading' | 'paragraph';
  level?: number;
  text: string;
}

const PLAN_STEP_STATUS_LABELS = {
  doing: '进行中',
  done: '已完成',
  todo: '待开始',
} as const;

export function createWorkspaceExport(
  options: CreateWorkspaceExportOptions,
): ExportFileDescriptor {
  const selectedTagIds = options.selectedTagIds ?? [];
  const blocks = buildExportBlocks(options, selectedTagIds);
  const content = formatBlocks(blocks, options.format);

  return {
    content,
    fileName: buildFileName(options, selectedTagIds),
    mimeType: options.format === 'markdown' ? 'text/markdown' : 'text/plain',
  };
}

function buildExportBlocks(
  options: CreateWorkspaceExportOptions,
  selectedTagIds: string[],
) {
  if (options.target === 'current-module') {
    return buildCurrentModuleBlocks(options, null);
  }

  if (options.target === 'theme') {
    return buildThemeBlocks(options, null);
  }

  const filterScope = options.filterScope ?? 'current-module';

  if (filterScope === 'resources') {
    throw new Error('资料区暂不支持按标签导出。');
  }

  if (selectedTagIds.length === 0) {
    throw new Error('请先选择至少一个标签，再导出筛选结果。');
  }

  const matchedNodeIds = collectTagMatchedNodeIds(
    options.tree,
    filterScope,
    options.currentModuleId,
    selectedTagIds,
  );

  if (matchedNodeIds.length === 0) {
    throw new Error('当前标签筛选没有可导出的节点。');
  }

  const includedNodeIds = collectAncestorInclusiveNodeIds(options.tree, matchedNodeIds);
  const selectedTagNames = selectedTagIds
    .map((tagId) => options.tree.tags[tagId]?.name)
    .filter((tagName): tagName is string => Boolean(tagName));
  const filterNote = `标签筛选：${selectedTagNames.join('、')}`;

  return filterScope === 'theme'
    ? buildThemeBlocks(options, {
        filterNote,
        includedNodeIds,
      })
    : buildCurrentModuleBlocks(options, {
        filterNote,
        includedNodeIds,
      });
}

function buildThemeBlocks(
  options: CreateWorkspaceExportOptions,
  filterContext: {
    filterNote: string;
    includedNodeIds: Set<string>;
  } | null,
) {
  const rootNode = getNodeOrThrow(options.tree, options.tree.rootId);
  const includedNodeIds =
    filterContext?.includedNodeIds ??
    new Set(collectScopedNodes(options.tree, 'theme', options.currentModuleId).map((node) => node.id));
  const blocks: ExportBlock[] = [
    {
      kind: 'heading',
      level: 1,
      text: options.workspaceTitle,
    },
  ];

  if (filterContext) {
    blocks.push({
      kind: 'paragraph',
      text: filterContext.filterNote,
    });
  }

  if (rootNode.content.trim()) {
    blocks.push({
      kind: 'paragraph',
      text: rootNode.content.trim(),
    });
  }

  for (const childId of rootNode.childIds) {
    if (!includedNodeIds.has(childId)) {
      continue;
    }

    blocks.push(
      ...renderNodeBlocks(options.tree, childId, {
        includePlanSteps: options.includePlanSteps,
        includedNodeIds,
        level: 2,
      }),
    );
  }

  return blocks;
}

function buildCurrentModuleBlocks(
  options: CreateWorkspaceExportOptions,
  filterContext: {
    filterNote: string;
    includedNodeIds: Set<string>;
  } | null,
) {
  if (!options.currentModuleId || options.tree.nodes[options.currentModuleId]?.type !== 'module') {
    throw new Error('当前没有可导出的模块。');
  }

  const moduleNode = getNodeOrThrow(options.tree, options.currentModuleId);
  const includedNodeIds =
    filterContext?.includedNodeIds ??
    new Set(collectScopedNodes(options.tree, 'current-module', options.currentModuleId).map((node) => node.id));
  const blocks: ExportBlock[] = [
    {
      kind: 'heading',
      level: 1,
      text: moduleNode.title,
    },
  ];

  if (filterContext) {
    blocks.push({
      kind: 'paragraph',
      text: filterContext.filterNote,
    });
  }

  if (moduleNode.content.trim()) {
    blocks.push({
      kind: 'paragraph',
      text: moduleNode.content.trim(),
    });
  }

  for (const childId of moduleNode.childIds) {
    if (!includedNodeIds.has(childId)) {
      continue;
    }

    blocks.push(
      ...renderNodeBlocks(options.tree, childId, {
        includePlanSteps: options.includePlanSteps,
        includedNodeIds,
        level: 2,
      }),
    );
  }

  return blocks;
}

function renderNodeBlocks(
  tree: NodeTree,
  nodeId: string,
  options: {
    includePlanSteps: boolean;
    includedNodeIds: Set<string>;
    level: number;
  },
): ExportBlock[] {
  if (!options.includedNodeIds.has(nodeId)) {
    return [];
  }

  const node = getNodeOrThrow(tree, nodeId);
  const childIds = node.childIds.filter((childId) => options.includedNodeIds.has(childId));
  const blocks: ExportBlock[] = [];

  switch (node.type) {
    case 'plan-step':
      if (options.includePlanSteps) {
        blocks.push({
          kind: 'heading',
          level: options.level,
          text: `步骤：${node.title}（${PLAN_STEP_STATUS_LABELS[node.status]}）`,
        });
      }

      if (node.content.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: node.content.trim(),
        });
      }

      for (const childId of childIds) {
        blocks.push(
          ...renderNodeBlocks(tree, childId, {
            ...options,
            level: options.includePlanSteps ? options.level + 1 : options.level,
          }),
        );
      }

      return blocks;
    case 'resource':
      blocks.push({
        kind: 'heading',
        level: options.level,
        text: `资料：${node.title}`,
      });

      blocks.push({
        kind: 'paragraph',
        text: `来源：${getNodeSourceSummary(tree, node) ?? '未提供来源信息'}`,
      });

      if (node.content.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: node.content.trim(),
        });
      }

      for (const childId of childIds) {
        blocks.push(
          ...renderNodeBlocks(tree, childId, {
            ...options,
            level: options.level + 1,
          }),
        );
      }

      return blocks;
    case 'resource-fragment':
      blocks.push({
        kind: 'heading',
        level: options.level,
        text: `摘录：${node.title}`,
      });

      blocks.push({
        kind: 'paragraph',
        text: `来源：${getNodeSourceSummary(tree, node) ?? '摘录来源未命名'}`,
      });

      if (node.excerpt.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: node.excerpt.trim(),
        });
      }

      if (node.content.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: node.content.trim(),
        });
      }

      return blocks;
    default:
      blocks.push({
        kind: 'heading',
        level: options.level,
        text: `${getExportLabel(tree, node)}：${node.title}`,
      });

      if (node.content.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: node.content.trim(),
        });
      }

      if (node.tagIds.length > 0) {
        blocks.push({
          kind: 'paragraph',
          text: `标签：${getNodeTagNames(tree, node).join('、')}`,
        });
      }

      for (const childId of childIds) {
        blocks.push(
          ...renderNodeBlocks(tree, childId, {
            ...options,
            level: options.level + 1,
          }),
        );
      }

      return blocks;
  }
}

function formatBlocks(blocks: ExportBlock[], format: ExportFormat) {
  return blocks
    .flatMap((block) => {
      if (block.kind === 'heading') {
        return [formatHeading(block.level ?? 1, block.text, format), ''];
      }

      return [block.text, ''];
    })
    .join('\n')
    .trimEnd();
}

function formatHeading(level: number, text: string, format: ExportFormat) {
  if (format === 'markdown') {
    return `${'#'.repeat(level)} ${text}`;
  }

  return `${'  '.repeat(Math.max(level - 1, 0))}${text}`;
}

function buildFileName(
  options: CreateWorkspaceExportOptions,
  selectedTagIds: string[],
) {
  const extension = options.format === 'markdown' ? 'md' : 'txt';

  if (options.target === 'current-module') {
    const moduleNode = options.currentModuleId
      ? options.tree.nodes[options.currentModuleId]
      : null;

    return `${sanitizeFileStem(moduleNode?.title ?? '当前模块')}.${extension}`;
  }

  if (options.target === 'theme') {
    return `${sanitizeFileStem(options.workspaceTitle)}.${extension}`;
  }

  const selectedTagNames = selectedTagIds
    .map((tagId) => options.tree.tags[tagId]?.name)
    .filter((tagName): tagName is string => Boolean(tagName));
  const scopeLabel = options.filterScope === 'theme' ? '全主题' : '当前模块';

  return `${sanitizeFileStem(`${options.workspaceTitle}-${scopeLabel}-${selectedTagNames.join('-')}`)}.${extension}`;
}

function sanitizeFileStem(fileStem: string) {
  return fileStem
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
}

function getExportLabel(tree: NodeTree, node: TreeNode) {
  switch (node.type) {
    case 'module':
    case 'question':
    case 'answer':
    case 'summary':
    case 'judgment':
      return getDisplayNodeTypeLabel(tree, node);
    default:
      return node.type;
  }
}
