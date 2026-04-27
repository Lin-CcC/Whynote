import { describe, expect, it } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
} from '../../nodeDomain';
import { attachResourceCitation } from './resourceCitationService';

describe('resourceCitationService', () => {
  it.each([
    'question-citation',
    'answer-citation',
    'summary-citation',
    'judgment-citation',
  ] as const)(
    'allows %s to cite resources and fragments',
    (sourceNodeId) => {
      const tree = createCitationTree();

      const result = attachResourceCitation(tree, {
        sourceNodeId,
        targetNodeId: 'fragment-batching',
      });

      expect(result.referenceAlreadyExisted).toBe(false);
      expect(result.resolution).toBe('fragment-direct');
      expect(result.targetNodeId).toBe('fragment-batching');
      expect(result.tree.nodes[sourceNodeId].referenceIds).toHaveLength(1);
      expect(
        result.tree.references[result.tree.nodes[sourceNodeId].referenceIds[0]]
          ?.targetNodeId,
      ).toBe('fragment-batching');
    },
  );

  it('prefers reusing an existing fragment before falling back to the resource', () => {
    const tree = createCitationTree();

    const result = attachResourceCitation(tree, {
      sourceNodeId: 'question-citation',
      targetNodeId: 'resource-react-docs',
      fragmentDraft: {
        excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
        locator: 'useState > batching',
      },
    });

    expect(result.referenceAlreadyExisted).toBe(false);
    expect(result.resolution).toBe('fragment-reused');
    expect(result.targetNodeId).toBe('fragment-batching');
    expect(result.tree.references[result.reference.id]?.targetNodeId).toBe(
      'fragment-batching',
    );
  });

  it('falls back to a resource-level citation when no stable fragment match exists', () => {
    const tree = createCitationTree();

    const result = attachResourceCitation(tree, {
      sourceNodeId: 'summary-citation',
      targetNodeId: 'resource-react-docs',
      fragmentDraft: {
        excerpt: '这段描述没有稳定对应到现有摘录。',
        locator: 'unknown',
      },
    });

    expect(result.referenceAlreadyExisted).toBe(false);
    expect(result.resolution).toBe('resource');
    expect(result.targetNodeId).toBe('resource-react-docs');
    expect(result.tree.references[result.reference.id]?.targetNodeId).toBe(
      'resource-react-docs',
    );
    expect(result.tree.nodes['resource-react-docs'].childIds).toEqual([
      'fragment-batching',
    ]);
  });
});

function createCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Citation workspace',
    workspaceId: 'workspace-citation-service',
    rootId: 'theme-citation-service',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-citation',
      title: 'Citation module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-citation',
    createNode({
      type: 'plan-step',
      id: 'step-citation',
      title: 'Step citation',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-citation',
    createNode({
      type: 'question',
      id: 'question-citation',
      title: 'Question citation',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-citation',
    createNode({
      type: 'answer',
      id: 'answer-citation',
      title: 'Answer citation',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-citation',
    createNode({
      type: 'summary',
      id: 'summary-citation',
      title: 'Summary citation',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-citation',
    createNode({
      type: 'judgment',
      id: 'judgment-citation',
      title: 'Judgment citation',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 React state 更新的资料概况。',
      sourceUri: 'https://react.dev/reference/react/useState',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}
