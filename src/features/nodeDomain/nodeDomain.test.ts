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
  switchNodeType,
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

  it('promotes newly inserted answers to currentAnswerId and falls back when the current answer is removed', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Current answer semantics',
      workspaceId: 'workspace-current-answer',
      rootId: 'root-current-answer',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-current-answer',
        title: 'Module',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-current-answer',
      createNode({
        type: 'question',
        id: 'question-current-answer',
        title: 'Question',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-current-answer',
      createNode({
        type: 'answer',
        id: 'answer-current-answer-v1',
        title: 'Answer v1',
        content: 'v1',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-current-answer',
      createNode({
        type: 'answer',
        id: 'answer-current-answer-v2',
        title: 'Answer v2',
        content: 'v2',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    expect(tree.nodes['question-current-answer']).toMatchObject({
      type: 'question',
      currentAnswerId: 'answer-current-answer-v2',
    });

    const afterDeletingCurrentAnswer = deleteNode(tree, 'answer-current-answer-v2');

    expect(afterDeletingCurrentAnswer.nodes['question-current-answer']).toMatchObject({
      type: 'question',
      currentAnswerId: 'answer-current-answer-v1',
    });

    const afterDeletingLastAnswer = deleteNode(
      afterDeletingCurrentAnswer,
      'answer-current-answer-v1',
    );
    const questionNode = afterDeletingLastAnswer.nodes['question-current-answer'];

    expect(questionNode.type).toBe('question');
    expect(questionNode.type === 'question' ? questionNode.currentAnswerId : null).toBe(
      undefined,
    );
  });

  it('cascades paired answer-closure and summary-check results when their sources disappear', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Cascade cleanup',
      workspaceId: 'workspace-cascade-cleanup',
      rootId: 'root-cascade-cleanup',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-cascade-cleanup',
        title: 'Module',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-cascade-cleanup',
      createNode({
        type: 'question',
        id: 'question-cascade-cleanup',
        title: 'Question',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cascade-cleanup',
      createNode({
        type: 'answer',
        id: 'answer-cascade-cleanup',
        title: 'Answer',
        content: 'answer',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cascade-cleanup',
      createNode({
        type: 'judgment',
        id: 'judgment-answer-cascade',
        title: 'Answer closure judgment',
        content: 'closure judgment',
        judgmentKind: 'answer-closure',
        sourceAnswerId: 'answer-cascade-cleanup',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cascade-cleanup',
      createNode({
        type: 'summary',
        id: 'summary-answer-cascade',
        title: 'Answer closure summary',
        content: 'closure summary',
        summaryKind: 'answer-closure',
        sourceAnswerId: 'answer-cascade-cleanup',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cascade-cleanup',
      createNode({
        type: 'summary',
        id: 'summary-manual-cascade',
        title: 'Manual summary',
        content: 'manual summary',
        summaryKind: 'manual',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cascade-cleanup',
      createNode({
        type: 'judgment',
        id: 'judgment-summary-cascade',
        title: 'Summary check judgment',
        content: 'summary check',
        judgmentKind: 'summary-check',
        sourceSummaryId: 'summary-manual-cascade',
        sourceSummaryUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    const afterDeletingAnswer = deleteNode(tree, 'answer-cascade-cleanup');

    expect(afterDeletingAnswer.nodes['judgment-answer-cascade']).toBeUndefined();
    expect(afterDeletingAnswer.nodes['summary-answer-cascade']).toBeUndefined();
    expect(afterDeletingAnswer.nodes['summary-manual-cascade']).toBeDefined();
    expect(afterDeletingAnswer.nodes['judgment-summary-cascade']).toBeDefined();

    const afterDeletingSummary = deleteNode(afterDeletingAnswer, 'summary-manual-cascade');

    expect(afterDeletingSummary.nodes['judgment-summary-cascade']).toBeUndefined();
  });

  it('cascades explicit paired results when answers or manual summaries move across questions', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Move cascade cleanup',
      workspaceId: 'workspace-move-cascade-cleanup',
      rootId: 'root-move-cascade-cleanup',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-move-cascade-cleanup',
        title: 'Module',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-move-cascade-cleanup',
      createNode({
        type: 'question',
        id: 'question-move-cascade-a',
        title: 'Question A',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-move-cascade-cleanup',
      createNode({
        type: 'question',
        id: 'question-move-cascade-b',
        title: 'Question B',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'answer',
        id: 'answer-move-cascade-v1',
        title: 'Answer v1',
        content: 'v1',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'answer',
        id: 'answer-move-cascade-v2',
        title: 'Answer v2',
        content: 'v2',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'judgment',
        id: 'judgment-move-answer-closure',
        title: 'Answer closure judgment',
        content: 'closure judgment',
        judgmentKind: 'answer-closure',
        sourceAnswerId: 'answer-move-cascade-v2',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'summary',
        id: 'summary-move-answer-closure',
        title: 'Answer closure summary',
        content: 'closure summary',
        summaryKind: 'answer-closure',
        sourceAnswerId: 'answer-move-cascade-v2',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'summary',
        id: 'summary-move-manual-kept',
        title: 'Manual summary kept',
        content: 'manual kept',
        summaryKind: 'manual',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'judgment',
        id: 'judgment-move-summary-check-with-answer',
        title: 'Summary check with answer context',
        content: 'summary check',
        judgmentKind: 'summary-check',
        sourceAnswerId: 'answer-move-cascade-v2',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        sourceSummaryId: 'summary-move-manual-kept',
        sourceSummaryUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'summary',
        id: 'summary-move-manual-shift',
        title: 'Manual summary shift',
        content: 'manual shift',
        summaryKind: 'manual',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-move-cascade-a',
      createNode({
        type: 'judgment',
        id: 'judgment-move-summary-check-only',
        title: 'Summary check only',
        content: 'summary check only',
        judgmentKind: 'summary-check',
        sourceSummaryId: 'summary-move-manual-shift',
        sourceSummaryUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    const afterMovingAnswer = moveNode(
      tree,
      'answer-move-cascade-v2',
      'question-move-cascade-b',
    );

    expect(afterMovingAnswer.nodes['judgment-move-answer-closure']).toBeUndefined();
    expect(afterMovingAnswer.nodes['summary-move-answer-closure']).toBeUndefined();
    expect(
      afterMovingAnswer.nodes['judgment-move-summary-check-with-answer'],
    ).toBeUndefined();
    expect(afterMovingAnswer.nodes['question-move-cascade-a']).toMatchObject({
      type: 'question',
      currentAnswerId: 'answer-move-cascade-v1',
    });
    expect(afterMovingAnswer.nodes['question-move-cascade-b']).toMatchObject({
      type: 'question',
      currentAnswerId: 'answer-move-cascade-v2',
    });
    validateNodeTree(afterMovingAnswer);

    const afterMovingSummary = moveNode(
      afterMovingAnswer,
      'summary-move-manual-shift',
      'question-move-cascade-b',
    );

    expect(afterMovingSummary.nodes['judgment-move-summary-check-only']).toBeUndefined();
    validateNodeTree(afterMovingSummary);
  });

  it('rejects explicit source pairs that cross question boundaries', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Cross question source validation',
      workspaceId: 'workspace-cross-question-source-validation',
      rootId: 'root-cross-question-source-validation',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-cross-question-source-validation',
        title: 'Module',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-cross-question-source-validation',
      createNode({
        type: 'question',
        id: 'question-cross-question-a',
        title: 'Question A',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-cross-question-source-validation',
      createNode({
        type: 'question',
        id: 'question-cross-question-b',
        title: 'Question B',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cross-question-a',
      createNode({
        type: 'answer',
        id: 'answer-cross-question-a',
        title: 'Answer A',
        content: 'answer a',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cross-question-a',
      createNode({
        type: 'summary',
        id: 'summary-cross-question-a',
        title: 'Summary A',
        content: 'summary a',
        summaryKind: 'manual',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cross-question-b',
      createNode({
        type: 'answer',
        id: 'answer-cross-question-b',
        title: 'Answer B',
        content: 'answer b',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-cross-question-b',
      createNode({
        type: 'summary',
        id: 'summary-cross-question-b',
        title: 'Summary B',
        content: 'summary b',
        summaryKind: 'manual',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    const crossAnswerSummaryTree = insertChildNode(
      tree,
      'question-cross-question-a',
      createNode({
        type: 'summary',
        id: 'summary-cross-answer-source',
        title: 'Cross answer source',
        content: 'cross answer source',
        summaryKind: 'answer-closure',
        sourceAnswerId: 'answer-cross-question-b',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    expect(() => validateNodeTree(crossAnswerSummaryTree)).toThrowError(
      /同一个 question 语境/,
    );

    const crossAnswerJudgmentTree = insertChildNode(
      tree,
      'question-cross-question-a',
      createNode({
        type: 'judgment',
        id: 'judgment-cross-answer-source',
        title: 'Cross answer judgment',
        content: 'cross answer judgment',
        judgmentKind: 'answer-closure',
        sourceAnswerId: 'answer-cross-question-b',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    expect(() => validateNodeTree(crossAnswerJudgmentTree)).toThrowError(
      /同一个 question 语境/,
    );

    const crossSummaryJudgmentTree = insertChildNode(
      tree,
      'question-cross-question-a',
      createNode({
        type: 'judgment',
        id: 'judgment-cross-summary-source',
        title: 'Cross summary judgment',
        content: 'cross summary judgment',
        judgmentKind: 'summary-check',
        sourceSummaryId: 'summary-cross-question-b',
        sourceSummaryUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    expect(() => validateNodeTree(crossSummaryJudgmentTree)).toThrowError(
      /同一个 question 语境/,
    );
  });

  it('falls back and cascades cleanup when the current answer switches to a non-answer type', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Type switch cleanup',
      workspaceId: 'workspace-type-switch-cleanup',
      rootId: 'root-type-switch-cleanup',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-type-switch-cleanup',
        title: 'Module',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'module-type-switch-cleanup',
      createNode({
        type: 'question',
        id: 'question-type-switch-cleanup',
        title: 'Question',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-type-switch-cleanup',
      createNode({
        type: 'answer',
        id: 'answer-type-switch-v1',
        title: 'Answer v1',
        content: 'v1',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-type-switch-cleanup',
      createNode({
        type: 'answer',
        id: 'answer-type-switch-v2',
        title: 'Answer v2',
        content: 'v2',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );
    tree = insertChildNode(
      tree,
      'question-type-switch-cleanup',
      createNode({
        type: 'judgment',
        id: 'judgment-type-switch-v2',
        title: 'Answer closure judgment',
        content: 'closure judgment',
        judgmentKind: 'answer-closure',
        sourceAnswerId: 'answer-type-switch-v2',
        sourceAnswerUpdatedAt: '2026-04-30T00:00:00.000Z',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    );

    const switchedTree = switchNodeType(
      tree,
      'answer-type-switch-v2',
      'summary',
    );

    expect(switchedTree.nodes['answer-type-switch-v2']).toMatchObject({
      type: 'summary',
    });
    expect(switchedTree.nodes['judgment-type-switch-v2']).toBeUndefined();
    expect(switchedTree.nodes['question-type-switch-cleanup']).toMatchObject({
      type: 'question',
      currentAnswerId: 'answer-type-switch-v1',
    });
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

    const withAnswerReference = addNodeReference(
      tree,
      createNodeReference({
        id: 'reference-answer-resource',
        sourceNodeId: 'answer-scope',
        targetNodeId: 'resource-scope',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    expect(withAnswerReference.nodes['answer-scope'].referenceIds).toEqual([
      'reference-answer-resource',
    ]);
    validateNodeTree(withAnswerReference);
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
