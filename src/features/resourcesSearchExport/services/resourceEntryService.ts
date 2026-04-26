import {
  createNode,
  getNodeOrThrow,
  insertChildNode,
  type NodeTree,
  type ResourceFragmentNode,
  type ResourceNode,
} from '../../nodeDomain';
import { getNodeSourceSummary } from '../utils/resourceTreeUtils';

export interface CreateResourceDraft {
  content: string;
  sourceUri: string;
  title: string;
}

export interface CreateResourceFragmentDraft {
  excerpt: string;
  locator: string;
  resourceNodeId: string;
  title: string;
}

export interface ResourceOption {
  id: string;
  sourceSummary: string;
  title: string;
}

export function listResourceOptions(tree: NodeTree): ResourceOption[] {
  return tree.nodes[tree.rootId].childIds.flatMap((childId) => {
    const node = tree.nodes[childId];

    if (!node || node.type !== 'resource') {
      return [];
    }

    return [
      {
        id: node.id,
        sourceSummary: getNodeSourceSummary(tree, node) ?? '未提供来源信息',
        title: node.title,
      },
    ];
  });
}

export function createResourceEntry(
  tree: NodeTree,
  draft: CreateResourceDraft,
): {
  resourceNode: ResourceNode;
  tree: NodeTree;
} {
  const title = requireField(draft.title, '资料标题');
  const createdNode = createNode({
    type: 'resource',
    content: normalizeOptionalText(draft.content) ?? '',
    sourceUri: normalizeOptionalText(draft.sourceUri) ?? undefined,
    title,
  });

  if (createdNode.type !== 'resource') {
    throw new Error('资料节点创建失败。');
  }

  return {
    resourceNode: createdNode,
    tree: insertChildNode(tree, tree.rootId, createdNode),
  };
}

export function createResourceFragmentEntry(
  tree: NodeTree,
  draft: CreateResourceFragmentDraft,
): {
  fragmentNode: ResourceFragmentNode;
  tree: NodeTree;
} {
  const resourceNode = getNodeOrThrow(tree, draft.resourceNodeId);

  if (resourceNode.type !== 'resource') {
    throw new Error('摘录必须挂到现有资料节点下。');
  }

  const createdNode = createNode({
    type: 'resource-fragment',
    content: '',
    excerpt: requireField(draft.excerpt, '摘录正文'),
    locator: normalizeOptionalText(draft.locator) ?? undefined,
    sourceResourceId: resourceNode.id,
    title: requireField(draft.title, '摘录标题'),
  });

  if (createdNode.type !== 'resource-fragment') {
    throw new Error('摘录节点创建失败。');
  }

  return {
    fragmentNode: createdNode,
    tree: insertChildNode(tree, resourceNode.id, createdNode),
  };
}

function normalizeOptionalText(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function requireField(value: string, label: string) {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw new Error(`${label}不能为空。`);
  }

  return normalizedValue;
}
