import type { NodeTree } from '../../nodeDomain';

const TAG_COLOR_BY_NAME: Record<string, string> = {
  争议点: '#dc2626',
  例子: '#db2777',
  关键节点: '#2563eb',
  定义: '#d97706',
  步骤: '#0f766e',
  重要: '#b45309',
  待整理: '#0f766e',
  待验证: '#1d4ed8',
  未理解: '#b91c1c',
};

const TAG_COLOR_FALLBACKS = [
  '#0f766e',
  '#2563eb',
  '#d97706',
  '#db2777',
  '#dc2626',
  '#7c3aed',
] as const;

export function getEditorTagColor(
  tree: NodeTree,
  tagId: string,
  fallbackIndex = 0,
) {
  const tag = tree.tags[tagId];

  if (!tag) {
    return TAG_COLOR_FALLBACKS[fallbackIndex % TAG_COLOR_FALLBACKS.length];
  }

  return (
    TAG_COLOR_BY_NAME[tag.name] ??
    tag.color ??
    TAG_COLOR_FALLBACKS[fallbackIndex % TAG_COLOR_FALLBACKS.length]
  );
}

export function getEditorTagName(tree: NodeTree, tagId: string) {
  return tree.tags[tagId]?.name ?? tagId;
}
