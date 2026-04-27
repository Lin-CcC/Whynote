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
  it('materializes generated learning paths and child question drafts into the existing node tree', () => {
    const snapshot = createWorkspaceSnapshot({
      title: 'Assembler',
      workspaceId: 'workspace-assembler',
      rootId: 'root-assembler',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    let tree = appendModuleDraftsToTree(snapshot.tree, [
      {
        type: 'module',
        title: '理解事件循环',
        content: '建立基础认识。',
        planSteps: [
          {
            type: 'plan-step',
            title: '明确核心概念',
            content: '先分清任务队列和调用栈。',
            questions: [
              {
                type: 'question',
                title: '铺垫：调用栈和任务队列分别做什么？',
                content: '先补齐事件循环所依赖的基础术语。',
              },
              {
                type: 'question',
                title: '事件循环如何协调同步代码与异步任务？',
                content: '围绕一次完整执行过程来理解。',
              },
            ],
            status: 'todo',
          },
          {
            type: 'plan-step',
            title: '验证执行顺序',
            content: '通过例子确认执行过程。',
            questions: [
              {
                type: 'question',
                title: '如何验证宏任务与微任务的先后关系？',
                content: '选一个最小案例观察输出顺序。',
              },
            ],
            status: 'todo',
          },
        ],
      },
    ]);
    const moduleId = tree.nodes[tree.rootId].childIds[0];
    const planStepId = tree.nodes[moduleId].childIds[0];
    const generatedQuestionIds = tree.nodes[planStepId].childIds;
    const parentQuestionNode = createNode({
      type: 'question',
      id: 'parent-question',
      title: '什么是事件循环，它为什么重要？',
      createdAt: '2026-04-27T00:00:00.000Z',
    });

    tree = insertChildNode(tree, planStepId, parentQuestionNode);
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

    expect(tree.nodes[moduleId].type).toBe('module');
    expect(tree.nodes[planStepId].type).toBe('plan-step');
    expect(generatedQuestionIds).toHaveLength(2);
    expect(tree.nodes[generatedQuestionIds[0]].type).toBe('question');
    expect(tree.nodes[generatedQuestionIds[1]].type).toBe('question');
    expect(tree.nodes['parent-question'].childIds).toHaveLength(2);
    validateNodeTree(tree);
  });
});
