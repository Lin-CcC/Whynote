import { describe, expect, it } from 'vitest';

import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  validateNodeTree,
} from '../nodeDomain';
import {
  appendChildQuestionsToTree,
  appendModuleDraftsToTree,
} from './adapters';

describe('learningTreeAssembler', () => {
  it('materializes introductions, questions and citations into the existing node tree', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Assembler',
      workspaceId: 'workspace-assembler',
      rootId: 'root-assembler',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'resource',
        id: 'resource-assembler',
        title: '事件循环资料',
        content: '总览事件循环、调用栈和任务队列。',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    tree = appendModuleDraftsToTree(tree, [
      {
        type: 'module',
        title: '理解事件循环',
        content: '建立基础认识。',
        planSteps: [
          {
            type: 'plan-step',
            title: '明确核心概念',
            content: '先分清任务队列和调用栈。',
            introductions: [
              {
                type: 'summary',
                title: '铺垫：为什么先看调用栈和任务队列',
                content: '先说明这两个概念分别负责什么，再进入真正的问题。',
                citations: [{ targetNodeId: 'resource-assembler' }],
              },
            ],
            questions: [
              {
                type: 'question',
                title: '调用栈和任务队列分别负责什么？',
                content: '请用一段具体执行过程解释它们的分工。',
                citations: [{ targetNodeId: 'resource-assembler' }],
              },
            ],
            status: 'todo',
          },
        ],
      },
    ]);

    const moduleId = tree.nodes[tree.rootId].childIds.find(
      (childId) => tree.nodes[childId].type === 'module',
    );

    if (!moduleId) {
      throw new Error('Expected module to be inserted.');
    }

    const planStepId = tree.nodes[moduleId].childIds[0];
    const [introductionId, questionId] = tree.nodes[planStepId].childIds;
    const introductionNode = tree.nodes[introductionId];
    const questionNode = tree.nodes[questionId];

    expect(introductionNode.type).toBe('summary');
    expect(questionNode.type).toBe('question');
    expect(introductionNode.referenceIds).toHaveLength(1);
    expect(questionNode.referenceIds).toHaveLength(1);
    expect(
      tree.references[introductionNode.referenceIds[0]].targetNodeId,
    ).toBe('resource-assembler');
    expect(tree.references[questionNode.referenceIds[0]].targetNodeId).toBe(
      'resource-assembler',
    );
    validateNodeTree(tree);
  });

  it('materializes child question drafts beneath an existing parent question', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Assembler split',
      workspaceId: 'workspace-assembler-split',
      rootId: 'root-assembler-split',
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    let tree = insertChildNode(
      snapshot.tree,
      snapshot.tree.rootId,
      createNode({
        type: 'module',
        id: 'module-split',
        title: 'Module',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    tree = insertChildNode(
      tree,
      'module-split',
      createNode({
        type: 'plan-step',
        id: 'step-split',
        title: 'Step',
        status: 'todo',
        createdAt: '2026-04-27T00:00:00.000Z',
      }),
    );

    const parentQuestionNode = createNode({
      type: 'question',
      id: 'parent-question',
      title: '什么是事件循环，它为什么重要？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    tree = insertChildNode(tree, 'step-split', parentQuestionNode);
    tree = appendChildQuestionsToTree(tree, 'parent-question', {
      parentQuestion: {
        type: 'question',
        title: '什么是事件循环，它为什么重要？',
        content: '',
      },
      childQuestions: [
        {
          type: 'question',
          title: '什么是事件循环？',
          content: '',
          originalIndex: 0,
          dependsOnIndices: [],
          dependencyConfidence: 1,
        },
        {
          type: 'question',
          title: '它为什么重要？',
          content: '',
          originalIndex: 1,
          dependsOnIndices: [0],
          dependencyConfidence: 0.9,
        },
      ],
      orderingStrategy: 'dependency',
      metadata: {
        providerLabel: 'mock-provider',
        model: 'mock-model',
      },
    });

    expect(tree.nodes['parent-question'].childIds).toHaveLength(2);
    expect(tree.nodes[tree.nodes['parent-question'].childIds[0]].type).toBe(
      'question',
    );
    expect(tree.nodes[tree.nodes['parent-question'].childIds[1]].type).toBe(
      'question',
    );
    validateNodeTree(tree);
  });
});
