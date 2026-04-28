import {
  addNodeReference,
  createNode,
  createNodeReference,
  getNodeOrThrow,
  insertChildNode,
  updateNodeReference,
  type CitationPurpose,
  type NodeReference,
  type NodeTree,
  type ResourceFragmentNode,
  type TreeNode,
} from '../../nodeDomain';

const LEARNING_CITATION_SOURCE_NODE_TYPES = [
  'question',
  'answer',
  'summary',
  'judgment',
] as const;
const MIN_PARTIAL_EXCERPT_MATCH_LENGTH = 12;

type LearningCitationSourceNodeType =
  (typeof LEARNING_CITATION_SOURCE_NODE_TYPES)[number];

type NormalizedReferenceDraft = {
  focusText: string | null;
  note: string | null;
  purpose: CitationPurpose | null;
  sourceExcerpt: string | null;
  sourceLocator: string | null;
};

export type LearningCitationSourceNode = Extract<
  TreeNode,
  {
    type: LearningCitationSourceNodeType;
  }
>;

export type CitationResolution =
  | 'resource'
  | 'fragment-direct'
  | 'fragment-reused'
  | 'fragment-created';

export interface ResourceCitationFragmentDraft {
  excerpt?: string;
  locator?: string;
  title?: string;
}

export interface ResourceCitationReferenceDraft {
  focusText?: string;
  note?: string;
  purpose?: CitationPurpose;
  sourceExcerpt?: string;
  sourceLocator?: string;
}

export interface AttachResourceCitationInput {
  allowFragmentCreation?: boolean;
  fragmentDraft?: ResourceCitationFragmentDraft;
  referenceDraft?: ResourceCitationReferenceDraft;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface AttachResourceCitationResult {
  reference: NodeReference;
  referenceAlreadyExisted: boolean;
  resolution: CitationResolution;
  resourceNodeId: string;
  targetNodeId: string;
  tree: NodeTree;
}

export function isLearningCitationSourceNode(
  node: TreeNode | null | undefined,
): node is LearningCitationSourceNode {
  if (!node) {
    return false;
  }

  return LEARNING_CITATION_SOURCE_NODE_TYPES.includes(
    node.type as LearningCitationSourceNodeType,
  );
}

export function attachResourceCitation(
  tree: NodeTree,
  input: AttachResourceCitationInput,
): AttachResourceCitationResult {
  const sourceNode = getNodeOrThrow(tree, input.sourceNodeId);
  const initialTargetNode = getNodeOrThrow(tree, input.targetNodeId);

  if (
    initialTargetNode.type !== 'resource' &&
    initialTargetNode.type !== 'resource-fragment'
  ) {
    throw new Error('当前只能引用 resource 或 resource-fragment。');
  }

  let nextTree = tree;
  let resolution: CitationResolution;
  let resourceNodeId: string;
  let targetNodeId: string;

  if (initialTargetNode.type === 'resource-fragment') {
    resolution = 'fragment-direct';
    resourceNodeId = initialTargetNode.sourceResourceId;
    targetNodeId = initialTargetNode.id;
  } else {
    resourceNodeId = initialTargetNode.id;
    const normalizedFragmentDraft = normalizeFragmentDraft(input.fragmentDraft);
    const reusableFragmentNode = normalizedFragmentDraft
      ? findReusableFragment(tree, initialTargetNode.id, normalizedFragmentDraft)
      : null;

    if (reusableFragmentNode) {
      resolution = 'fragment-reused';
      targetNodeId = reusableFragmentNode.id;
    } else if (
      input.allowFragmentCreation &&
      canCreateStableFragment(normalizedFragmentDraft)
    ) {
      const createdFragmentNode = createNode({
        type: 'resource-fragment',
        excerpt: normalizedFragmentDraft.excerpt,
        locator: normalizedFragmentDraft.locator,
        sourceResourceId: initialTargetNode.id,
        title: buildFragmentTitle(initialTargetNode.title, normalizedFragmentDraft),
      });

      if (createdFragmentNode.type !== 'resource-fragment') {
        throw new Error('运行时摘录创建失败。');
      }

      nextTree = insertChildNode(nextTree, initialTargetNode.id, createdFragmentNode);
      resolution = 'fragment-created';
      targetNodeId = createdFragmentNode.id;
    } else {
      resolution = 'resource';
      targetNodeId = initialTargetNode.id;
    }
  }

  const normalizedReferenceDraft = normalizeReferenceDraft(
    input.referenceDraft,
    resolution === 'resource' ? input.fragmentDraft : undefined,
  );
  const exactReference = findExactReference(
    nextTree,
    sourceNode.id,
    targetNodeId,
    normalizedReferenceDraft.focusText,
  );

  if (exactReference) {
    const updatedReferenceResult = mergeReferenceDraft(
      nextTree,
      exactReference.id,
      normalizedReferenceDraft,
    );

    return {
      reference: updatedReferenceResult.reference,
      referenceAlreadyExisted: true,
      resolution,
      resourceNodeId,
      targetNodeId,
      tree: updatedReferenceResult.tree,
    };
  }

  const genericReference = findUpgradeableGenericReference(
    nextTree,
    sourceNode.id,
    targetNodeId,
    normalizedReferenceDraft,
  );

  if (genericReference) {
    const updatedReferenceResult = mergeReferenceDraft(
      nextTree,
      genericReference.id,
      normalizedReferenceDraft,
    );

    return {
      reference: updatedReferenceResult.reference,
      referenceAlreadyExisted: true,
      resolution,
      resourceNodeId,
      targetNodeId,
      tree: updatedReferenceResult.tree,
    };
  }

  const reference = createNodeReference({
    sourceNodeId: sourceNode.id,
    targetNodeId,
    focusText: normalizedReferenceDraft.focusText ?? undefined,
    note: normalizedReferenceDraft.note ?? undefined,
    purpose: normalizedReferenceDraft.purpose ?? undefined,
    sourceExcerpt: normalizedReferenceDraft.sourceExcerpt ?? undefined,
    sourceLocator: normalizedReferenceDraft.sourceLocator ?? undefined,
  });

  return {
    reference,
    referenceAlreadyExisted: false,
    resolution,
    resourceNodeId,
    targetNodeId,
    tree: addNodeReference(nextTree, reference),
  };
}

function findReusableFragment(
  tree: NodeTree,
  resourceNodeId: string,
  draft: NormalizedFragmentDraft,
) {
  const resourceNode = getNodeOrThrow(tree, resourceNodeId);

  if (resourceNode.type !== 'resource') {
    throw new Error('fragment 复用只能发生在 resource 下面。');
  }

  const fragmentCandidates = resourceNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter(
      (node): node is ResourceFragmentNode => node?.type === 'resource-fragment',
    )
    .map((fragmentNode) => ({
      fragmentNode,
      score: scoreFragmentCandidate(fragmentNode, draft),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((leftCandidate, rightCandidate) => rightCandidate.score - leftCandidate.score);

  return fragmentCandidates[0]?.fragmentNode ?? null;
}

function scoreFragmentCandidate(
  fragmentNode: ResourceFragmentNode,
  draft: NormalizedFragmentDraft,
) {
  let score = 0;
  const normalizedFragmentLocator = normalizeMatchText(fragmentNode.locator);
  const normalizedFragmentExcerpt = normalizeMatchText(fragmentNode.excerpt);

  if (
    draft.locator &&
    normalizedFragmentLocator &&
    draft.locator === normalizedFragmentLocator
  ) {
    score += 4;
  }

  if (draft.excerpt && normalizedFragmentExcerpt) {
    if (draft.excerpt === normalizedFragmentExcerpt) {
      score += 4;
    } else if (
      draft.excerpt.length >= MIN_PARTIAL_EXCERPT_MATCH_LENGTH &&
      (normalizedFragmentExcerpt.includes(draft.excerpt) ||
        draft.excerpt.includes(normalizedFragmentExcerpt))
    ) {
      score += 2;
    }
  }

  return score;
}

function findExactReference(
  tree: NodeTree,
  sourceNodeId: string,
  targetNodeId: string,
  focusText: string | null,
) {
  return Object.values(tree.references).find((reference) => {
    if (
      reference.sourceNodeId !== sourceNodeId ||
      reference.targetNodeId !== targetNodeId
    ) {
      return false;
    }

    return normalizeMatchText(reference.focusText) === normalizeMatchText(focusText);
  });
}

function findUpgradeableGenericReference(
  tree: NodeTree,
  sourceNodeId: string,
  targetNodeId: string,
  draft: NormalizedReferenceDraft,
) {
  if (!hasReferenceDraftMetadata(draft)) {
    return null;
  }

  return Object.values(tree.references).find(
    (reference) =>
      reference.sourceNodeId === sourceNodeId &&
      reference.targetNodeId === targetNodeId &&
      !normalizeDisplayText(reference.focusText),
  );
}

function mergeReferenceDraft(
  tree: NodeTree,
  referenceId: string,
  draft: NormalizedReferenceDraft,
) {
  const reference = tree.references[referenceId];

  if (!reference) {
    throw new Error(`引用 ${referenceId} 不存在。`);
  }

  const patch: Partial<
    Pick<
      NodeReference,
      'focusText' | 'note' | 'purpose' | 'sourceExcerpt' | 'sourceLocator'
    >
  > = {};

  if (draft.focusText && draft.focusText !== reference.focusText) {
    patch.focusText = draft.focusText;
  }

  if (draft.note && draft.note !== reference.note) {
    patch.note = draft.note;
  }

  if (draft.purpose && draft.purpose !== reference.purpose) {
    patch.purpose = draft.purpose;
  }

  if (draft.sourceExcerpt && draft.sourceExcerpt !== reference.sourceExcerpt) {
    patch.sourceExcerpt = draft.sourceExcerpt;
  }

  if (draft.sourceLocator && draft.sourceLocator !== reference.sourceLocator) {
    patch.sourceLocator = draft.sourceLocator;
  }

  if (Object.keys(patch).length === 0) {
    return {
      reference,
      tree,
    };
  }

  const nextTree = updateNodeReference(tree, referenceId, patch);

  return {
    reference: nextTree.references[referenceId],
    tree: nextTree,
  };
}

type NormalizedFragmentDraft = {
  excerpt: string;
  locator: string | null;
  title: string | null;
};

function normalizeFragmentDraft(
  draft: ResourceCitationFragmentDraft | undefined,
): NormalizedFragmentDraft | null {
  if (!draft) {
    return null;
  }

  const excerpt = normalizeMatchText(draft.excerpt);
  const locator = normalizeMatchText(draft.locator);
  const title = normalizeDisplayText(draft.title);

  if (!excerpt && !locator && !title) {
    return null;
  }

  return {
    excerpt: excerpt ?? '',
    locator,
    title,
  };
}

function normalizeReferenceDraft(
  draft: ResourceCitationReferenceDraft | undefined,
  fallbackFragmentDraft?: ResourceCitationFragmentDraft,
): NormalizedReferenceDraft {
  const focusText = normalizeDisplayText(draft?.focusText);
  const note = normalizeDisplayText(draft?.note);
  const purpose = draft?.purpose ?? null;
  const sourceExcerpt = normalizeDisplayText(
    draft?.sourceExcerpt ?? fallbackFragmentDraft?.excerpt,
  );
  const sourceLocator = normalizeDisplayText(
    draft?.sourceLocator ?? fallbackFragmentDraft?.locator,
  );

  return {
    focusText,
    note,
    purpose,
    sourceExcerpt,
    sourceLocator,
  };
}

function hasReferenceDraftMetadata(draft: NormalizedReferenceDraft) {
  return Boolean(
    draft.focusText ||
      draft.note ||
      draft.purpose ||
      draft.sourceExcerpt ||
      draft.sourceLocator,
  );
}

function canCreateStableFragment(
  draft: NormalizedFragmentDraft | null,
): draft is NormalizedFragmentDraft & {
  excerpt: string;
  locator: string;
} {
  return Boolean(draft?.excerpt && draft.locator);
}

function buildFragmentTitle(
  resourceTitle: string,
  draft: NormalizedFragmentDraft & {
    excerpt: string;
    locator: string;
  },
) {
  return (
    draft.title ??
    draft.locator ??
    truncateText(draft.excerpt, 24) ??
    `${resourceTitle} 摘录`
  );
}

function normalizeMatchText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();

  return normalizedValue ? normalizedValue : null;
}

function normalizeDisplayText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ');

  return normalizedValue ? normalizedValue : null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
