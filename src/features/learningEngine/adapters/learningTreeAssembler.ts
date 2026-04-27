import {
  createNode,
  insertChildNode,
  type NodeTree,
} from '../../nodeDomain';

import type {
  CompoundQuestionSplitResult,
  ModuleNodeDraft,
  PlanStepNodeDraft,
} from '../domain';

export function appendModuleDraftsToTree(
  tree: NodeTree,
  moduleDrafts: ModuleNodeDraft[],
  rootNodeId = tree.rootId,
) {
  let nextTree = tree;

  for (const moduleDraft of moduleDrafts) {
    const moduleNode = createNode({
      type: 'module',
      title: moduleDraft.title,
      content: moduleDraft.content,
    });

    nextTree = insertChildNode(nextTree, rootNodeId, moduleNode);
    nextTree = appendPlanStepDraftsToModule(
      nextTree,
      moduleNode.id,
      moduleDraft.planSteps,
    );
  }

  return nextTree;
}

export function appendPlanStepDraftsToModule(
  tree: NodeTree,
  moduleNodeId: string,
  planStepDrafts: PlanStepNodeDraft[],
) {
  let nextTree = tree;

  for (const planStepDraft of planStepDrafts) {
    const planStepNode = createNode({
      type: 'plan-step',
      title: planStepDraft.title,
      content: planStepDraft.content,
      status: planStepDraft.status,
    });

    nextTree = insertChildNode(nextTree, moduleNodeId, planStepNode);

    for (const questionDraft of planStepDraft.questions) {
      const questionNode = createNode({
        type: 'question',
        title: questionDraft.title,
        content: questionDraft.content,
      });

      nextTree = insertChildNode(nextTree, planStepNode.id, questionNode);
    }
  }

  return nextTree;
}

export function appendChildQuestionsToTree(
  tree: NodeTree,
  parentQuestionNodeId: string,
  splitResult: CompoundQuestionSplitResult,
) {
  let nextTree = tree;

  for (const childQuestion of splitResult.childQuestions) {
    const questionNode = createNode({
      type: 'question',
      title: childQuestion.title,
      content: childQuestion.content,
    });

    nextTree = insertChildNode(nextTree, parentQuestionNodeId, questionNode);
  }

  return nextTree;
}
