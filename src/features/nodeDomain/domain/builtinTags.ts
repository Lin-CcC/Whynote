import { createTag } from './nodeFactories';
import { upsertTag } from './treeMetadataOperations';
import type { NodeTree, Tag } from './nodeTypes';

export const BUILTIN_TAG_DEFINITIONS = [
  {
    color: '#b45309',
    id: 'tag-important',
    name: '重要',
  },
  {
    color: '#b91c1c',
    id: 'tag-unresolved',
    name: '未理解',
  },
  {
    color: '#1d4ed8',
    id: 'tag-to-verify',
    name: '待验证',
  },
  {
    color: '#0f766e',
    id: 'tag-to-organize',
    name: '待整理',
  },
] as const;

export function ensureBuiltinTags(tree: NodeTree) {
  let nextTree = tree;
  let hasChanged = false;

  for (const definition of BUILTIN_TAG_DEFINITIONS) {
    if (findTagByName(nextTree, definition.name)) {
      continue;
    }

    nextTree = upsertTag(
      nextTree,
      createTag(definition.name, {
        color: definition.color,
        id: definition.id,
      }),
    );
    hasChanged = true;
  }

  return hasChanged ? nextTree : tree;
}

export function resolveBuiltinTags(tree: NodeTree) {
  return BUILTIN_TAG_DEFINITIONS.map((definition) => {
    const existingTag = findTagByName(tree, definition.name);

    return {
      color: existingTag?.color ?? definition.color,
      id: existingTag?.id ?? definition.id,
      name: definition.name,
    };
  });
}

function findTagByName(tree: NodeTree, name: string): Tag | null {
  return Object.values(tree.tags).find((tag) => tag.name === name) ?? null;
}
