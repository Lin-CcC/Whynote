import {
  addNodeReference,
  createNode,
  createNodeReference,
  getNodeOrThrow,
  insertChildNode,
  type NodeTree,
} from '../../nodeDomain';

import type {
  CompoundQuestionSplitResult,
  ModuleNodeDraft,
  PlanStepNodeDraft,
  QuestionClosureResult,
  QuestionNodeDraft,
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

    for (const introductionDraft of planStepDraft.introductions) {
      nextTree = appendLearningNodeDraft(
        nextTree,
        planStepNode.id,
        introductionDraft,
      );
    }

    for (const questionDraft of planStepDraft.questions) {
      nextTree = appendLearningNodeDraft(nextTree, planStepNode.id, questionDraft);
    }
  }

  return nextTree;
}

export function appendQuestionClosureToTree(
  tree: NodeTree,
  questionNodeId: string,
  closureResult: QuestionClosureResult,
) {
  let nextTree = tree;

  nextTree = appendLearningNodeDraft(
    nextTree,
    questionNodeId,
    closureResult.judgment,
  );
  nextTree = appendLearningNodeDraft(
    nextTree,
    questionNodeId,
    closureResult.summary,
  );

  for (const questionDraft of closureResult.followUpQuestions) {
    nextTree = appendLearningNodeDraft(nextTree, questionNodeId, questionDraft);
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
    nextTree = appendLearningNodeDraft(nextTree, parentQuestionNodeId, {
      type: 'question',
      title: childQuestion.title,
      content: childQuestion.content,
      citations: [],
    } satisfies QuestionNodeDraft);
  }

  return nextTree;
}

function appendLearningNodeDraft(
  tree: NodeTree,
  parentNodeId: string,
  draft: {
    type: 'question' | 'summary' | 'judgment';
    title: string;
    content: string;
    citations: Array<{ targetNodeId: string }>;
  },
) {
  const node = createNode({
    type: draft.type,
    title: draft.title,
    content: draft.content,
  });

  let nextTree = insertChildNode(tree, parentNodeId, node);

  return attachDraftCitations(nextTree, node.id, draft.citations);
}

function attachDraftCitations(
  tree: NodeTree,
  sourceNodeId: string,
  citations: Array<{ targetNodeId: string }>,
) {
  let nextTree = tree;

  for (const citation of citations) {
    const targetNode = nextTree.nodes[citation.targetNodeId];

    if (
      !targetNode ||
      (targetNode.type !== 'resource' &&
        targetNode.type !== 'resource-fragment')
    ) {
      continue;
    }

    const sourceNode = getNodeOrThrow(nextTree, sourceNodeId);
    const existingReference = sourceNode.referenceIds
      .map((referenceId) => nextTree.references[referenceId])
      .find((reference) => reference?.targetNodeId === targetNode.id);

    if (existingReference) {
      continue;
    }

    nextTree = addNodeReference(
      nextTree,
      createNodeReference({
        sourceNodeId,
        targetNodeId: targetNode.id,
      }),
    );
  }

  return nextTree;
}
