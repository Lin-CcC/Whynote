import { describe, expect, it } from 'vitest';

import {
  NodeDomainError,
  addNodeReference,
  attachTagToNode,
  createNode,
  createNodeReference,
  createTag,
  createWorkspaceSnapshot,
  deleteNode,
  getModuleScopeId,
  insertChildNode,
  insertSiblingNode,
  liftNode,
  lowerNode,
  moveNode,
  upsertTag,
  validateNodeTree,
} from './index';

describe('nodeDomain', () => {
  it('enforces root-level constraints', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Root constraints',
      workspaceId: 'workspace-root',
      rootId: 'root-root',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-1',
      title: 'Module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-1',
      title: 'Resource',
      sourceUri: 'file:///resource.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    const withModule = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    const withResource = insertChildNode(
      withModule,
      snapshot.tree.rootId,
      resourceNode,
    );

    expect(withResource.nodes[snapshot.tree.rootId].childIds).toEqual([
      'module-1',
      'resource-1',
    ]);
    expect(() =>
      insertChildNode(
        snapshot.tree,
        snapshot.tree.rootId,
        createNode({
          type: 'question',
          id: 'question-illegal',
          title: 'Why is this illegal?',
          createdAt: '2026-04-27T00:00:00.000Z',
        }),
      ),
    ).toThrowError(NodeDomainError);
  });

  it('supports insert, move, lower and lift across valid learning nodes', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Tree operations',
      workspaceId: 'workspace-tree',
      rootId: 'root-tree',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-tree',
      title: 'Module tree',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-tree',
      title: 'Step 1',
      status: 'doing',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const firstQuestionNode = createNode({
      type: 'question',
      id: 'question-first',
      title: 'First question',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const secondQuestionNode = createNode({
      type: 'question',
      id: 'question-second',
      title: 'Second question',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const answerNode = createNode({
      type: 'answer',
      id: 'answer-first',
      title: 'Answer',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    const withModule = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    const withPlanStep = insertChildNode(withModule, 'module-tree', planStepNode);
    const withFirstQuestion = insertChildNode(
      withPlanStep,
      'plan-step-tree',
      firstQuestionNode,
    );
    const withSecondQuestion = insertSiblingNode(
      withFirstQuestion,
      'question-first',
      secondQuestionNode,
    );
    const withAnswer = insertSiblingNode(
      withSecondQuestion,
      'question-second',
      answerNode,
    );
    const lowered = lowerNode(withAnswer, 'question-second');

    expect(lowered.nodes['question-second'].parentId).toBe('question-first');
    expect(lowered.nodes['question-first'].childIds).toEqual(['question-second']);

    const lifted = liftNode(lowered, 'question-second');
    expect(lifted.nodes['question-second'].parentId).toBe('plan-step-tree');
    expect(lifted.nodes['plan-step-tree'].childIds).toEqual([
      'question-first',
      'question-second',
      'answer-first',
    ]);

    const moved = moveNode(lifted, 'answer-first', 'question-first');
    expect(moved.nodes['answer-first'].parentId).toBe('question-first');
    validateNodeTree(moved);
  });

  it('converts promoted learning nodes to module at root while preserving relations', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Promotion',
      workspaceId: 'workspace-promote',
      rootId: 'root-promote',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-promote',
      title: 'Origin module',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-promote',
      title: 'Reference material',
      sourceUri: 'file:///reference.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-promote',
      title: 'Step 1',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-promote',
      title: 'Composite question',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const childQuestionNode = createNode({
      type: 'question',
      id: 'question-child',
      title: 'Split child question',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const tag = createTag('重要', {
      id: 'tag-important',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNode);
    tree = insertChildNode(tree, 'module-promote', planStepNode);
    tree = insertChildNode(tree, 'plan-step-promote', questionNode);
    tree = insertChildNode(tree, 'question-promote', childQuestionNode);
    tree = upsertTag(tree, tag);
    tree = attachTagToNode(tree, 'question-promote', 'tag-important');
    tree = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-promote',
        sourceNodeId: 'question-promote',
        targetNodeId: 'resource-promote',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const liftedToModule = liftNode(tree, 'question-promote');
    const liftedToRoot = liftNode(liftedToModule, 'question-promote');

    expect(liftedToRoot.nodes['question-promote'].type).toBe('module');
    expect(liftedToRoot.nodes['question-promote'].parentId).toBe('root-promote');
    expect(liftedToRoot.nodes['question-promote'].tagIds).toEqual(['tag-important']);
    expect(liftedToRoot.nodes['question-promote'].referenceIds).toEqual([
      'reference-promote',
    ]);
    expect(liftedToRoot.nodes['question-promote'].childIds).toEqual([
      'question-child',
    ]);
    validateNodeTree(liftedToRoot);
  });

  it('tracks module scope, tags and reference legality', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Scope and metadata',
      workspaceId: 'workspace-scope',
      rootId: 'root-scope',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-scope',
      title: 'Module scope',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const planStepNode = createNode({
      type: 'plan-step',
      id: 'plan-step-scope',
      title: 'Step scope',
      status: 'done',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-scope',
      title: 'Why?',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const answerNode = createNode({
      type: 'answer',
      id: 'answer-scope',
      title: 'Because',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-scope',
      title: 'Resource scope',
      sourceUri: 'file:///scope.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceFragmentNode = createNode({
      type: 'resource-fragment',
      id: 'resource-fragment-scope',
      title: 'Fragment scope',
      sourceResourceId: 'resource-scope',
      excerpt: 'quoted fragment',
      locator: 'L10-L12',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const tag = createTag('待验证', {
      id: 'tag-verify',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNode);
    tree = insertChildNode(tree, 'module-scope', planStepNode);
    tree = insertChildNode(tree, 'plan-step-scope', questionNode);
    tree = insertSiblingNode(tree, 'question-scope', answerNode);
    tree = insertChildNode(tree, 'resource-scope', resourceFragmentNode);
    tree = upsertTag(tree, tag);
    tree = attachTagToNode(tree, 'answer-scope', 'tag-verify');
    tree = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-fragment',
        sourceNodeId: 'module-scope',
        targetNodeId: 'resource-fragment-scope',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    expect(getModuleScopeId(tree, 'question-scope')).toBe('module-scope');
    expect(getModuleScopeId(tree, 'resource-fragment-scope')).toBeNull();
    expect(tree.nodes['answer-scope'].tagIds).toEqual(['tag-verify']);
    expect(() =>
      addNodeReference(
        tree,
        createNodeReference({
          id: 'reference-illegal-answer',
          sourceNodeId: 'answer-scope',
          targetNodeId: 'resource-scope',
          createdAt: '2026-04-27T00:00:00.000Z',
        }),
      ),
    ).toThrowError(NodeDomainError);
  });

  it('deletes subtrees and clears dangling references', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Delete subtree',
      workspaceId: 'workspace-delete',
      rootId: 'root-delete',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const moduleNode = createNode({
      type: 'module',
      id: 'module-delete',
      title: 'Module delete',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const questionNode = createNode({
      type: 'question',
      id: 'question-delete',
      title: 'Delete me',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    const resourceNode = createNode({
      type: 'resource',
      id: 'resource-delete',
      title: 'Reference delete',
      sourceUri: 'file:///delete.md',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = insertChildNode(snapshot.tree, snapshot.tree.rootId, moduleNode);
    tree = insertChildNode(tree, snapshot.tree.rootId, resourceNode);
    tree = insertChildNode(tree, 'module-delete', questionNode);
    tree = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-delete',
        sourceNodeId: 'module-delete',
        targetNodeId: 'resource-delete',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const deletedTree = deleteNode(tree, 'resource-delete');

    expect(deletedTree.nodes['resource-delete']).toBeUndefined();
    expect(deletedTree.references['reference-delete']).toBeUndefined();
    expect(deletedTree.nodes['module-delete'].referenceIds).toEqual([]);
    validateNodeTree(deletedTree);
  });
});
