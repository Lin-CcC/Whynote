import {
  addNodeReference,
  createNode,
  createNodeReference,
  getNodeOrThrow,
  insertChildNode,
  updateNodeReference,
  type CitationPurpose,
  type NodeTree,
} from '../../nodeDomain';

import type {
  AnswerNodeDraft,
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
      nextTree = appendLearningNodeDraftToTree(
        nextTree,
        planStepNode.id,
        introductionDraft,
      );
    }

    for (const questionDraft of planStepDraft.questions) {
      nextTree = appendLearningNodeDraftToTree(nextTree, planStepNode.id, questionDraft);
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

  nextTree = appendLearningNodeDraftToTree(
    nextTree,
    questionNodeId,
    closureResult.judgment,
  );
  nextTree = appendLearningNodeDraftToTree(
    nextTree,
    questionNodeId,
    closureResult.summary,
  );

  for (const questionDraft of closureResult.followUpQuestions) {
    nextTree = appendLearningNodeDraftToTree(nextTree, questionNodeId, questionDraft);
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
    nextTree = appendLearningNodeDraftToTree(nextTree, parentQuestionNodeId, {
      type: 'question',
      title: childQuestion.title,
      content: childQuestion.content,
      citations: [],
    } satisfies QuestionNodeDraft);
  }

  return nextTree;
}

export function appendLearningNodeDraftToTree(
  tree: NodeTree,
  parentNodeId: string,
  draft:
    | AnswerNodeDraft
    | QuestionNodeDraft
    | {
        type: 'summary' | 'judgment';
        title: string;
        content: string;
        hint?: string;
        summaryKind?: 'manual' | 'scaffold' | 'answer-closure';
        judgmentKind?: 'manual' | 'answer-closure' | 'summary-check';
        citations: Array<{
          targetNodeId: string;
          focusText?: string;
          note?: string;
          purpose?: CitationPurpose;
          sourceExcerpt?: string;
          sourceLocator?: string;
        }>;
      },
  insertIndex?: number,
) {
  const node = createNode({
    type: draft.type,
    title: draft.title,
    content: draft.content,
    ...(draft.type === 'summary' && draft.summaryKind
      ? { summaryKind: draft.summaryKind }
      : {}),
    ...(draft.type === 'judgment' && draft.hint ? { hint: draft.hint } : {}),
    ...(draft.type === 'judgment' && draft.judgmentKind
      ? { judgmentKind: draft.judgmentKind }
      : {}),
  });

  let nextTree = insertChildNode(tree, parentNodeId, node, insertIndex);

  return attachDraftCitations(nextTree, node.id, draft.citations);
}

export function attachCitationDraftsToNode(
  tree: NodeTree,
  sourceNodeId: string,
  citations: Array<{
    targetNodeId: string;
    focusText?: string;
    note?: string;
    purpose?: CitationPurpose;
    sourceExcerpt?: string;
    sourceLocator?: string;
  }>,
) {
  return attachDraftCitations(tree, sourceNodeId, citations);
}

function attachDraftCitations(
  tree: NodeTree,
  sourceNodeId: string,
  citations: Array<{
    targetNodeId: string;
    focusText?: string;
    note?: string;
    purpose?: CitationPurpose;
    sourceExcerpt?: string;
    sourceLocator?: string;
  }>,
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
    const exactReference = sourceNode.referenceIds
      .map((referenceId) => nextTree.references[referenceId])
      .find(
        (reference) =>
          reference?.targetNodeId === targetNode.id &&
          normalizeCitationMatchText(reference.focusText) ===
            normalizeCitationMatchText(citation.focusText),
      );

    if (exactReference) {
      nextTree = mergeCitationMetadata(nextTree, exactReference.id, citation);
      continue;
    }

    const upgradeableGenericReference = sourceNode.referenceIds
      .map((referenceId) => nextTree.references[referenceId])
      .find(
        (reference) =>
          reference?.targetNodeId === targetNode.id &&
          !normalizeCitationMatchText(reference.focusText) &&
          hasCitationMetadata(citation),
      );

    if (upgradeableGenericReference) {
      nextTree = mergeCitationMetadata(
        nextTree,
        upgradeableGenericReference.id,
        citation,
      );
      continue;
    }

    nextTree = addNodeReference(
      nextTree,
      createNodeReference({
        sourceNodeId,
        targetNodeId: targetNode.id,
        focusText: normalizeCitationDisplayText(citation.focusText) ?? undefined,
        note: normalizeCitationDisplayText(citation.note) ?? undefined,
        purpose: citation.purpose,
        sourceExcerpt:
          normalizeCitationDisplayText(citation.sourceExcerpt) ?? undefined,
        sourceLocator:
          normalizeCitationDisplayText(citation.sourceLocator) ?? undefined,
      }),
    );
  }

  return nextTree;
}

function mergeCitationMetadata(
  tree: NodeTree,
  referenceId: string,
  citation: {
    focusText?: string;
    note?: string;
    purpose?: CitationPurpose;
    sourceExcerpt?: string;
    sourceLocator?: string;
  },
) {
  const reference = tree.references[referenceId];

  if (!reference) {
    return tree;
  }

  const focusText = normalizeCitationDisplayText(citation.focusText);
  const note = normalizeCitationDisplayText(citation.note);
  const sourceExcerpt = normalizeCitationDisplayText(citation.sourceExcerpt);
  const sourceLocator = normalizeCitationDisplayText(citation.sourceLocator);
  const patch: Partial<
    Pick<
      typeof reference,
      'focusText' | 'note' | 'purpose' | 'sourceExcerpt' | 'sourceLocator'
    >
  > = {};

  if (focusText && focusText !== reference.focusText) {
    patch.focusText = focusText;
  }

  if (note && note !== reference.note) {
    patch.note = note;
  }

  if (citation.purpose && citation.purpose !== reference.purpose) {
    patch.purpose = citation.purpose;
  }

  if (sourceExcerpt && sourceExcerpt !== reference.sourceExcerpt) {
    patch.sourceExcerpt = sourceExcerpt;
  }

  if (sourceLocator && sourceLocator !== reference.sourceLocator) {
    patch.sourceLocator = sourceLocator;
  }

  if (Object.keys(patch).length === 0) {
    return tree;
  }

  return updateNodeReference(tree, referenceId, patch);
}

function hasCitationMetadata(citation: {
  focusText?: string;
  note?: string;
  purpose?: CitationPurpose;
  sourceExcerpt?: string;
  sourceLocator?: string;
}) {
  return Boolean(
    normalizeCitationDisplayText(citation.focusText) ||
      normalizeCitationDisplayText(citation.note) ||
      citation.purpose ||
      normalizeCitationDisplayText(citation.sourceExcerpt) ||
      normalizeCitationDisplayText(citation.sourceLocator),
  );
}

function normalizeCitationMatchText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();

  return normalizedValue ? normalizedValue : null;
}

function normalizeCitationDisplayText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ');

  return normalizedValue ? normalizedValue : null;
}
