import { describe, expect, it } from 'vitest';

import {
  NodeDomainError,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  moveNode,
  validateNodeTree,
} from './index';

describe('resource fragment invariant', () => {
  it('rejects trees whose fragment sourceResourceId diverges from its parent resource', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Fragment mismatch',
      workspaceId: 'workspace-fragment-mismatch',
      rootId: 'root-fragment-mismatch',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-parent',
      title: 'Parent resource',
      sourceUri: 'file:///resource-parent.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const fragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-mismatch',
      title: 'Fragment',
      sourceResourceId: 'resource-parent',
      excerpt: 'Fragment excerpt',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    const withResource = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      resourceNode,
    );
    const validTree = insertChildNode(withResource, 'resource-parent', fragmentNode);
    const invalidTree = structuredClone(validTree);
    const invalidFragmentNode = invalidTree.nodes['resource-fragment-mismatch'];

    if (invalidFragmentNode.type !== 'resource-fragment') {
      throw new Error('expected a resource-fragment node');
    }

    invalidFragmentNode.sourceResourceId = 'resource-other';

    expect(() => validateNodeTree(invalidTree)).toThrowError(NodeDomainError);
  });

  it('auto-syncs sourceResourceId when inserting a fragment under a resource', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Fragment insert sync',
      workspaceId: 'workspace-fragment-insert',
      rootId: 'root-fragment-insert',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-insert',
      title: 'Insert resource',
      sourceUri: 'file:///resource-insert.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const fragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-insert',
      title: 'Insert fragment',
      sourceResourceId: 'wrong-resource',
      excerpt: 'Fragment excerpt',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    const withResource = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      resourceNode,
    );
    const nextTree = insertChildNode(withResource, 'resource-insert', fragmentNode);

    expect(
      nextTree.nodes['resource-fragment-insert'].type === 'resource-fragment' &&
        nextTree.nodes['resource-fragment-insert'].sourceResourceId,
    ).toBe('resource-insert');
    validateNodeTree(nextTree);
  });

  it('auto-syncs sourceResourceId when moving a fragment between resources', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Fragment move sync',
      workspaceId: 'workspace-fragment-move',
      rootId: 'root-fragment-move',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNodeA = createNode({
      type: 'resource',
      id: 'resource-a',
      title: 'Resource A',
      sourceUri: 'file:///resource-a.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNodeB = createNode({
      type: 'resource',
      id: 'resource-b',
      title: 'Resource B',
      sourceUri: 'file:///resource-b.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const fragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-move',
      title: 'Move fragment',
      sourceResourceId: 'resource-a',
      excerpt: 'Fragment excerpt',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, resourceNodeA);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNodeB);
    tree = insertChildNode(tree, 'resource-a', fragmentNode);

    const movedTree = moveNode(tree, 'resource-fragment-move', 'resource-b');

    expect(movedTree.nodes['resource-fragment-move'].parentId).toBe('resource-b');
    expect(
      movedTree.nodes['resource-fragment-move'].type === 'resource-fragment' &&
        movedTree.nodes['resource-fragment-move'].sourceResourceId,
    ).toBe('resource-b');
    validateNodeTree(movedTree);
  });
});
