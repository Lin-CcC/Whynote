import { describe, expect, it } from 'vitest';

import {
  addNodeReference,
  createNode,
  createNodeReference,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
} from '../../nodeDomain';
import {
  buildResourceDeleteImpact,
  deleteResourceNode,
} from './resourceDeleteService';

describe('resourceDeleteService', () => {
  it('deletes an unreferenced fragment without removing learning nodes', () => {
    const tree = createResourceDeleteTree();

    const result = deleteResourceNode(tree, 'fragment-unused');

    expect(result.impact.nodeType).toBe('resource-fragment');
    expect(result.impact.totalReferenceCount).toBe(0);
    expect(result.nextFocusNodeId).toBe('resource-primary');
    expect(result.tree.nodes['fragment-unused']).toBeUndefined();
    expect(result.tree.nodes['question-learning']).toBeDefined();
    expect(result.tree.nodes['answer-learning']).toBeDefined();
  });

  it('deletes a referenced fragment, clears its references, and keeps learning nodes', () => {
    const tree = createResourceDeleteTree();

    const result = deleteResourceNode(tree, 'fragment-batching');
    const impact = result.impact;

    if (impact.nodeType !== 'resource-fragment') {
      throw new Error('expected fragment delete impact');
    }

    expect(impact.referenceCount).toBe(1);
    expect(result.nextFocusNodeId).toBe('resource-primary');
    expect(result.tree.nodes['fragment-batching']).toBeUndefined();
    expect(result.tree.references['reference-fragment-batching']).toBeUndefined();
    expect(result.tree.nodes['question-learning'].referenceIds).toEqual([]);
    expect(result.tree.nodes['question-learning']).toBeDefined();
  });

  it('deletes a standalone resource with zero impact and restores focus to an adjacent resource', () => {
    const tree = createResourceDeleteTree();
    const impact = buildResourceDeleteImpact(tree, 'resource-secondary');

    const result = deleteResourceNode(tree, 'resource-secondary');

    expect(impact).toEqual({
      directReferenceCount: 0,
      fragmentCount: 0,
      fragmentReferenceCount: 0,
      nextFocusNodeId: 'resource-primary',
      nodeId: 'resource-secondary',
      nodeTitle: '第二份资料',
      nodeType: 'resource',
      totalReferenceCount: 0,
    });
    expect(result.tree.nodes['resource-secondary']).toBeUndefined();
  });

  it('deletes a resource subtree, clears resource and fragment references, and keeps learning nodes', () => {
    const tree = createResourceDeleteTree();

    const result = deleteResourceNode(tree, 'resource-primary');

    expect(result.impact).toEqual({
      directReferenceCount: 1,
      fragmentCount: 3,
      fragmentReferenceCount: 2,
      nextFocusNodeId: 'resource-secondary',
      nodeId: 'resource-primary',
      nodeTitle: 'React 官方文档',
      nodeType: 'resource',
      totalReferenceCount: 3,
    });
    expect(result.tree.nodes['resource-primary']).toBeUndefined();
    expect(result.tree.nodes['fragment-batching']).toBeUndefined();
    expect(result.tree.nodes['fragment-lifecycle']).toBeUndefined();
    expect(result.tree.nodes['fragment-unused']).toBeUndefined();
    expect(result.tree.references['reference-resource-primary']).toBeUndefined();
    expect(result.tree.references['reference-fragment-batching']).toBeUndefined();
    expect(result.tree.references['reference-fragment-lifecycle']).toBeUndefined();
    expect(result.tree.nodes['question-learning']).toBeDefined();
    expect(result.tree.nodes['answer-learning']).toBeDefined();
    expect(result.tree.nodes['judgment-learning']).toBeDefined();
    expect(result.tree.nodes['answer-learning'].referenceIds).toEqual([]);
    expect(result.tree.nodes['judgment-learning'].referenceIds).toEqual([]);
  });
});

function createResourceDeleteTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Resource delete workspace',
    workspaceId: 'workspace-resource-delete-service',
    rootId: 'theme-resource-delete-service',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-learning',
      title: '学习模块',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-learning',
    createNode({
      type: 'plan-step',
      id: 'step-learning',
      title: '理解批处理',
      status: 'doing',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-learning',
    createNode({
      type: 'question',
      id: 'question-learning',
      title: '什么是批处理？',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-learning',
    createNode({
      type: 'answer',
      id: 'answer-learning',
      title: '批处理说明',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-learning',
    createNode({
      type: 'judgment',
      id: 'judgment-learning',
      title: '判断：还差事件边界',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-primary',
      title: 'React 官方文档',
      content: '关于批处理与事件边界的资料概况。',
      sourceUri: 'https://react.dev/reference/react/useState',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-primary',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      excerpt: 'React 会先把多个 state 更新收集起来，再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-primary',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-primary',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-lifecycle',
      title: '事件边界摘录',
      excerpt: 'React 会在事件处理结束后统一处理这些更新。',
      locator: 'useState > event boundary',
      sourceResourceId: 'resource-primary',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-primary',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-unused',
      title: '未引用摘录',
      excerpt: '这条摘录还没有进入学习节点。',
      locator: 'appendix',
      sourceResourceId: 'resource-primary',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-secondary',
      title: '第二份资料',
      content: '未被引用，也没有摘录。',
      sourceUri: '本地文件：secondary.md',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-fragment-batching',
      sourceNodeId: 'question-learning',
      targetNodeId: 'fragment-batching',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-resource-primary',
      sourceNodeId: 'answer-learning',
      targetNodeId: 'resource-primary',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-fragment-lifecycle',
      sourceNodeId: 'judgment-learning',
      targetNodeId: 'fragment-lifecycle',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    }),
  );

  return tree;
}
