import { NodeDomainError } from './nodeErrors';
import { getCurrentQuestionAnswerNodeId, getSummaryNodeKind } from './nodeSemantics';
import {
  canParentAcceptChild,
  shouldConvertToModuleAtRoot,
} from './treeConstraints';
import {
  cloneNodeTree,
  getNodeOrThrow,
  getQuestionAnchorNodeId,
  getSubtreeNodeIds,
  isDescendantNode,
} from './treeDocument';
import type { ModuleNode, NodeTree, NonRootNode, TreeNode } from './nodeTypes';

type SwitchableLeafNodeType = 'question' | 'answer' | 'summary' | 'judgment';

interface CurrentAnswerFallbackHint {
  invalidatedAnswerId: string;
  orderedAnswerIds: string[];
}

export function insertChildNode(
  tree: NodeTree,
  parentNodeId: string,
  node: NonRootNode,
  index?: number,
) {
  if (tree.nodes[node.id]) {
    throw new NodeDomainError('DUPLICATE_NODE_ID', `Node ${node.id} already exists.`, {
      nodeId: node.id,
    });
  }

  const nextTree = cloneNodeTree(tree);
  const parentNode = getNodeOrThrow(nextTree, parentNodeId);
  const insertIndex = normalizeInsertIndex(index, parentNode.childIds.length);

  if (!canParentAcceptChild(parentNode.type, node.type)) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Cannot insert ${node.type} under ${parentNode.type}.`,
      {
        parentNodeId,
        nodeType: node.type,
      },
    );
  }

  const nextNode = normalizeNodeForParent(node, parentNode);

  nextNode.parentId = parentNode.id;
  nextNode.order = insertIndex;
  nextNode.updatedAt = createTimestamp();

  nextTree.nodes[nextNode.id] = nextNode;
  parentNode.childIds.splice(insertIndex, 0, nextNode.id);
  parentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, parentNode.id);

  if (parentNode.type === 'question' && nextNode.type === 'answer') {
    setQuestionCurrentAnswerId(nextTree, parentNode.id, nextNode.id);
  }

  return nextTree;
}

export function insertSiblingNode(
  tree: NodeTree,
  siblingNodeId: string,
  node: NonRootNode,
  position: 'before' | 'after' = 'after',
) {
  const siblingNode = getNodeOrThrow(tree, siblingNodeId);

  if (siblingNode.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot insert a sibling for the root node.',
      {
        siblingNodeId,
      },
    );
  }

  const insertIndex =
    position === 'before' ? siblingNode.order : siblingNode.order + 1;

  return insertChildNode(tree, siblingNode.parentId, node, insertIndex);
}

export function deleteNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot delete the root node.',
      {
        nodeId,
      },
    );
  }

  const initialNodeIdsToDelete = getSubtreeNodeIds(tree, nodeId);
  const { invalidatedAnswerIds, invalidatedSummaryIds } =
    collectInvalidatedSourceIds(tree, initialNodeIdsToDelete);
  const fallbackHintsByQuestionId = collectCurrentAnswerFallbackHints(
    tree,
    invalidatedAnswerIds,
  );
  const expandedNodeIdsToDelete = expandCascadeNodeIds(
    tree,
    initialNodeIdsToDelete,
    invalidatedAnswerIds,
    invalidatedSummaryIds,
  );
  const nextTree = cloneNodeTree(tree);

  removeNodeIds(nextTree, expandedNodeIdsToDelete);
  repairQuestionCurrentAnswers(nextTree, fallbackHintsByQuestionId);

  return nextTree;
}

export function moveNode(
  tree: NodeTree,
  nodeId: string,
  targetParentNodeId: string,
  index?: number,
) {
  const currentNode = getNodeOrThrow(tree, nodeId);
  const currentParentNodeId = currentNode.parentId;

  if (currentParentNodeId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot move the root node.',
      {
        nodeId,
      },
    );
  }

  if (isDescendantNode(tree, nodeId, targetParentNodeId)) {
    throw new NodeDomainError(
      'MOVE_TARGET_IS_DESCENDANT',
      'Cannot move a node into its own descendant.',
      {
        nodeId,
        targetParentNodeId,
      },
    );
  }

  const fallbackHintsByQuestionId = new Map<string, CurrentAnswerFallbackHint>();
  const nextTree = cloneNodeTree(tree);
  const node = getNonRootNodeOrThrow(nextTree, nodeId);
  const currentParentNode = getNodeOrThrow(nextTree, currentParentNodeId);
  const targetParentNode = getNodeOrThrow(nextTree, targetParentNodeId);
  const siblingCapacity =
    targetParentNode.id === currentParentNode.id
      ? targetParentNode.childIds.length - 1
      : targetParentNode.childIds.length;
  const normalizedInsertIndex = normalizeInsertIndex(
    index ?? siblingCapacity,
    siblingCapacity,
  );

  if (
    currentParentNode.type === 'question' &&
    currentNode.type === 'answer' &&
    currentParentNode.id !== targetParentNode.id &&
    currentParentNode.currentAnswerId === currentNode.id
  ) {
    fallbackHintsByQuestionId.set(
      currentParentNode.id,
      createCurrentAnswerFallbackHint(tree, currentParentNode.id, currentNode.id),
    );
  }

  currentParentNode.childIds = currentParentNode.childIds.filter(
    (childId) => childId !== node.id,
  );
  currentParentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, currentParentNode.id);

  const nextNode = normalizeNodeForParent(node, targetParentNode);

  if (!canParentAcceptChild(targetParentNode.type, nextNode.type)) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Cannot move ${nextNode.type} under ${targetParentNode.type}.`,
      {
        nodeId,
        targetParentNodeId,
      },
    );
  }

  const adjustedInsertIndex =
    targetParentNode.id === currentParentNode.id &&
    normalizedInsertIndex > node.order
      ? normalizedInsertIndex - 1
      : normalizedInsertIndex;

  nextNode.parentId = targetParentNode.id;
  nextNode.order = adjustedInsertIndex;
  nextNode.updatedAt = createTimestamp();
  nextTree.nodes[nextNode.id] = nextNode;
  targetParentNode.childIds.splice(adjustedInsertIndex, 0, nextNode.id);
  targetParentNode.updatedAt = createTimestamp();
  reindexChildren(nextTree, targetParentNode.id);

  const {
    initialNodeIdsToDelete,
    invalidatedAnswerIds,
    invalidatedSummaryIds,
  } = collectMoveCascadeCleanupState(tree, nextTree, node.id);

  if (initialNodeIdsToDelete.size > 0) {
    const expandedNodeIdsToDelete = expandCascadeNodeIds(
      nextTree,
      initialNodeIdsToDelete,
      invalidatedAnswerIds,
      invalidatedSummaryIds,
    );
    removeNodeIds(nextTree, expandedNodeIdsToDelete);
  }

  repairQuestionCurrentAnswers(nextTree, fallbackHintsByQuestionId);

  if (
    currentParentNode.id !== targetParentNode.id &&
    targetParentNode.type === 'question' &&
    nextNode.type === 'answer'
  ) {
    setQuestionCurrentAnswerId(nextTree, targetParentNode.id, nextNode.id);
  }

  return nextTree;
}

export function liftNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot lift the root node.',
      {
        nodeId,
      },
    );
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);
  const grandparentNodeId = parentNode.parentId;

  if (grandparentNodeId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot lift a root child any further.',
      {
        nodeId,
      },
    );
  }

  return moveNode(tree, nodeId, grandparentNodeId, parentNode.order + 1);
}

export function lowerNode(tree: NodeTree, nodeId: string) {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot lower the root node.',
      {
        nodeId,
      },
    );
  }

  if (node.order === 0) {
    throw new NodeDomainError(
      'MISSING_PREVIOUS_SIBLING',
      'Cannot lower a node without a previous sibling.',
      {
        nodeId,
      },
    );
  }

  const parentNode = getNodeOrThrow(tree, node.parentId);
  const previousSiblingNodeId = parentNode.childIds[node.order - 1];

  return moveNode(tree, nodeId, previousSiblingNodeId);
}

export function switchNodeType(
  tree: NodeTree,
  nodeId: string,
  nextNodeType: SwitchableLeafNodeType,
) {
  const currentNode = getNodeOrThrow(tree, nodeId);

  if (currentNode.parentId === null) {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'Cannot switch the root node type.',
      {
        nodeId,
      },
    );
  }

  if (currentNode.childIds.length > 0) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      'Only leaf nodes can switch type.',
      {
        nodeId,
      },
    );
  }

  if (currentNode.type === nextNodeType) {
    return tree;
  }

  const parentNode = getNodeOrThrow(tree, currentNode.parentId);

  if (!canParentAcceptChild(parentNode.type, nextNodeType)) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Cannot switch ${currentNode.type} to ${nextNodeType} under ${parentNode.type}.`,
      {
        nodeId,
      },
    );
  }

  const nextTree = cloneNodeTree(tree);
  const fallbackHintsByQuestionId = new Map<string, CurrentAnswerFallbackHint>();
  const invalidatedAnswerIds = new Set<string>();
  const invalidatedSummaryIds = new Set<string>();
  const nextNode = getNonRootNodeOrThrow(nextTree, nodeId);
  const nextParentNode = getNodeOrThrow(nextTree, currentNode.parentId);
  const baseNode = {
    childIds: [] as string[],
    content: nextNode.content,
    createdAt: nextNode.createdAt,
    id: nextNode.id,
    order: nextNode.order,
    parentId: nextNode.parentId,
    referenceIds: [...nextNode.referenceIds],
    tagIds: [...nextNode.tagIds],
    title: nextNode.title,
    updatedAt: createTimestamp(),
  };

  if (
    currentNode.type === 'answer' &&
    nextNodeType !== 'answer' &&
    nextParentNode.type === 'question' &&
    nextParentNode.currentAnswerId === currentNode.id
  ) {
    fallbackHintsByQuestionId.set(
      nextParentNode.id,
      createCurrentAnswerFallbackHint(tree, nextParentNode.id, currentNode.id),
    );
  }

  if (currentNode.type === 'answer' && nextNodeType !== 'answer') {
    invalidatedAnswerIds.add(currentNode.id);
  }

  if (currentNode.type === 'summary' && nextNodeType !== 'summary') {
    invalidatedSummaryIds.add(currentNode.id);
  }

  switch (nextNodeType) {
    case 'question':
      nextTree.nodes[nodeId] = {
        ...baseNode,
        type: 'question',
      };
      break;
    case 'answer':
      nextTree.nodes[nodeId] = {
        ...baseNode,
        type: 'answer',
      };
      break;
    case 'summary':
      nextTree.nodes[nodeId] = {
        ...baseNode,
        type: 'summary',
        summaryKind: nextParentNode.type === 'plan-step' ? 'scaffold' : 'manual',
      };
      break;
    case 'judgment':
      nextTree.nodes[nodeId] = {
        ...baseNode,
        type: 'judgment',
        judgmentKind: 'manual',
      };
      break;
  }

  if (invalidatedAnswerIds.size > 0 || invalidatedSummaryIds.size > 0) {
    const dependentNodeIdsToDelete = expandCascadeNodeIds(
      nextTree,
      new Set<string>(),
      invalidatedAnswerIds,
      invalidatedSummaryIds,
    );

    if (dependentNodeIdsToDelete.size > 0) {
      removeNodeIds(nextTree, dependentNodeIdsToDelete);
    }
  }

  repairQuestionCurrentAnswers(nextTree, fallbackHintsByQuestionId);

  if (nextParentNode.type === 'question' && nextNodeType === 'answer') {
    setQuestionCurrentAnswerId(nextTree, nextParentNode.id, nodeId);
  }

  return nextTree;
}

function normalizeNodeForParent(
  node: NonRootNode,
  parentNode: TreeNode,
): NonRootNode {
  if (node.type === 'resource-fragment' && parentNode.type === 'resource') {
    return {
      ...structuredClone(node),
      sourceResourceId: parentNode.id,
    };
  }

  if (parentNode.type !== 'theme-root') {
    return structuredClone(node);
  }

  if (node.type === 'resource-fragment') {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      'Cannot promote a resource fragment directly to the root level.',
      {
        nodeId: node.id,
      },
    );
  }

  if (!shouldConvertToModuleAtRoot(node.type)) {
    return structuredClone(node);
  }

  return convertNodeToModule(node);
}

function convertNodeToModule(node: NonRootNode): ModuleNode {
  return {
    id: node.id,
    type: 'module',
    title: node.title,
    content: node.content,
    parentId: node.parentId,
    childIds: [...node.childIds],
    order: node.order,
    tagIds: [...node.tagIds],
    referenceIds: [...node.referenceIds],
    createdAt: node.createdAt,
    updatedAt: createTimestamp(),
  };
}

function normalizeInsertIndex(index: number | undefined, length: number) {
  const nextIndex = index ?? length;

  if (nextIndex < 0 || nextIndex > length) {
    throw new NodeDomainError(
      'INVALID_INSERT_INDEX',
      `Insert index ${nextIndex} is out of range 0-${length}.`,
      {
        index: nextIndex,
        length,
      },
    );
  }

  return nextIndex;
}

function reindexChildren(tree: NodeTree, parentNodeId: string) {
  const parentNode = getNodeOrThrow(tree, parentNodeId);

  for (let index = 0; index < parentNode.childIds.length; index += 1) {
    const childNodeId = parentNode.childIds[index];
    const childNode = getNodeOrThrow(tree, childNodeId);
    childNode.order = index;
  }
}

function collectReferenceIdsToDelete(
  tree: NodeTree,
  nodeIdsToDelete: Set<string>,
) {
  const referenceIdsToDelete = new Set<string>();

  for (const reference of Object.values(tree.references)) {
    if (
      nodeIdsToDelete.has(reference.sourceNodeId) ||
      nodeIdsToDelete.has(reference.targetNodeId)
    ) {
      referenceIdsToDelete.add(reference.id);
    }
  }

  return referenceIdsToDelete;
}

function getNonRootNodeOrThrow(tree: NodeTree, nodeId: string): NonRootNode {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'theme-root') {
    throw new NodeDomainError(
      'ROOT_OPERATION_NOT_ALLOWED',
      'The root node cannot participate in this operation.',
      {
        nodeId,
      },
    );
  }

  return node;
}

function collectInvalidatedSourceIds(
  tree: NodeTree,
  nodeIds: Set<string>,
) {
  const invalidatedAnswerIds = new Set<string>();
  const invalidatedSummaryIds = new Set<string>();

  for (const nodeId of nodeIds) {
    const node = tree.nodes[nodeId];

    if (!node) {
      continue;
    }

    if (node.type === 'answer') {
      invalidatedAnswerIds.add(node.id);
    }

    if (node.type === 'summary') {
      invalidatedSummaryIds.add(node.id);
    }
  }

  return {
    invalidatedAnswerIds,
    invalidatedSummaryIds,
  };
}

function collectMoveCascadeCleanupState(
  previousTree: NodeTree,
  nextTree: NodeTree,
  movedNodeId: string,
) {
  const movedSubtreeNodeIds = getSubtreeNodeIds(nextTree, movedNodeId);
  const initialNodeIdsToDelete = new Set<string>();
  const invalidatedAnswerIds = new Set<string>();
  const invalidatedSummaryIds = new Set<string>();

  for (const movedSubtreeNodeId of movedSubtreeNodeIds) {
    const previousNode = previousTree.nodes[movedSubtreeNodeId];
    const nextNode = nextTree.nodes[movedSubtreeNodeId];

    if (!previousNode || !nextNode) {
      continue;
    }

    const previousQuestionAnchorId = getQuestionAnchorNodeId(previousTree, previousNode);
    const nextQuestionAnchorId = getQuestionAnchorNodeId(nextTree, nextNode);

    if (
      nextNode.type === 'answer' &&
      previousQuestionAnchorId !== nextQuestionAnchorId
    ) {
      invalidatedAnswerIds.add(nextNode.id);
    }

    if (
      nextNode.type === 'summary' &&
      getSummaryNodeKind(previousTree, previousNode) === 'manual' &&
      previousQuestionAnchorId !== nextQuestionAnchorId
    ) {
      invalidatedSummaryIds.add(nextNode.id);
    }

    if (
      (nextNode.type === 'summary' || nextNode.type === 'judgment') &&
      hasInvalidExplicitSourceQuestionContext(nextTree, nextNode)
    ) {
      initialNodeIdsToDelete.add(nextNode.id);

      if (nextNode.type === 'summary') {
        invalidatedSummaryIds.add(nextNode.id);
      }
    }
  }

  for (const node of Object.values(nextTree.nodes)) {
    if (
      node.type === 'summary' &&
      node.sourceAnswerId &&
      invalidatedAnswerIds.has(node.sourceAnswerId)
    ) {
      initialNodeIdsToDelete.add(node.id);
      invalidatedSummaryIds.add(node.id);
      continue;
    }

    if (
      node.type === 'judgment' &&
      ((node.sourceAnswerId &&
        invalidatedAnswerIds.has(node.sourceAnswerId)) ||
        (node.sourceSummaryId &&
          invalidatedSummaryIds.has(node.sourceSummaryId)))
    ) {
      initialNodeIdsToDelete.add(node.id);
    }
  }

  return {
    initialNodeIdsToDelete,
    invalidatedAnswerIds,
    invalidatedSummaryIds,
  };
}

function expandCascadeNodeIds(
  tree: NodeTree,
  initialNodeIdsToDelete: Set<string>,
  invalidatedAnswerIds: Set<string>,
  invalidatedSummaryIds: Set<string>,
) {
  const expandedNodeIdsToDelete = new Set(initialNodeIdsToDelete);
  let hasNewCascadeNode = true;

  while (hasNewCascadeNode) {
    hasNewCascadeNode = false;

    for (const node of Object.values(tree.nodes)) {
      if (expandedNodeIdsToDelete.has(node.id)) {
        continue;
      }

      if (
        node.type === 'summary' &&
        node.sourceAnswerId &&
        invalidatedAnswerIds.has(node.sourceAnswerId)
      ) {
        expandedNodeIdsToDelete.add(node.id);
        invalidatedSummaryIds.add(node.id);
        hasNewCascadeNode = true;
        continue;
      }

      if (
        node.type === 'judgment' &&
        ((node.sourceAnswerId &&
          invalidatedAnswerIds.has(node.sourceAnswerId)) ||
          (node.sourceSummaryId &&
            invalidatedSummaryIds.has(node.sourceSummaryId)))
      ) {
        expandedNodeIdsToDelete.add(node.id);
        hasNewCascadeNode = true;
      }
    }
  }

  return expandedNodeIdsToDelete;
}

function removeNodeIds(tree: NodeTree, nodeIdsToDelete: Set<string>) {
  if (nodeIdsToDelete.size === 0) {
    return;
  }

  const referenceIdsToDelete = collectReferenceIdsToDelete(tree, nodeIdsToDelete);
  const touchedParentIds = new Set<string>();

  for (const currentNode of Object.values(tree.nodes)) {
    currentNode.referenceIds = currentNode.referenceIds.filter(
      (referenceId) => !referenceIdsToDelete.has(referenceId),
    );
  }

  for (const referenceId of referenceIdsToDelete) {
    delete tree.references[referenceId];
  }

  for (const currentNodeId of nodeIdsToDelete) {
    const currentNode = tree.nodes[currentNodeId];

    if (currentNode?.parentId !== null) {
      touchedParentIds.add(currentNode.parentId);
    }

    delete tree.nodes[currentNodeId];
  }

  for (const parentNodeId of touchedParentIds) {
    const parentNode = tree.nodes[parentNodeId];

    if (!parentNode) {
      continue;
    }

    parentNode.childIds = parentNode.childIds.filter(
      (childId) => !nodeIdsToDelete.has(childId),
    );
    parentNode.updatedAt = createTimestamp();
    reindexChildren(tree, parentNodeId);
  }
}

function collectCurrentAnswerFallbackHints(
  tree: NodeTree,
  invalidatedAnswerIds: Set<string>,
) {
  const fallbackHintsByQuestionId = new Map<string, CurrentAnswerFallbackHint>();

  for (const node of Object.values(tree.nodes)) {
    if (
      node.type !== 'question' ||
      !node.currentAnswerId ||
      !invalidatedAnswerIds.has(node.currentAnswerId)
    ) {
      continue;
    }

    fallbackHintsByQuestionId.set(
      node.id,
      createCurrentAnswerFallbackHint(tree, node.id, node.currentAnswerId),
    );
  }

  return fallbackHintsByQuestionId;
}

function createCurrentAnswerFallbackHint(
  tree: NodeTree,
  questionNodeId: string,
  invalidatedAnswerId: string,
): CurrentAnswerFallbackHint {
  return {
    invalidatedAnswerId,
    orderedAnswerIds: collectOrderedAnswerIds(tree, questionNodeId),
  };
}

function repairQuestionCurrentAnswers(
  tree: NodeTree,
  fallbackHintsByQuestionId: Map<string, CurrentAnswerFallbackHint>,
) {
  for (const [questionNodeId, fallbackHint] of fallbackHintsByQuestionId) {
    const questionNode = tree.nodes[questionNodeId];

    if (questionNode?.type !== 'question') {
      continue;
    }

    setQuestionCurrentAnswerId(
      tree,
      questionNodeId,
      resolveFallbackCurrentAnswerId(tree, questionNodeId, fallbackHint),
    );
  }

  for (const node of Object.values(tree.nodes)) {
    if (node.type !== 'question' || !node.currentAnswerId) {
      continue;
    }

    const currentAnswerNode = tree.nodes[node.currentAnswerId];

    if (currentAnswerNode?.type === 'answer' && currentAnswerNode.parentId === node.id) {
      continue;
    }

    setQuestionCurrentAnswerId(
      tree,
      node.id,
      getCurrentQuestionAnswerNodeId(tree, node.id),
    );
  }
}

function resolveFallbackCurrentAnswerId(
  tree: NodeTree,
  questionNodeId: string,
  fallbackHint: CurrentAnswerFallbackHint,
) {
  const invalidatedAnswerIndex = fallbackHint.orderedAnswerIds.indexOf(
    fallbackHint.invalidatedAnswerId,
  );

  if (invalidatedAnswerIndex === -1) {
    return getCurrentQuestionAnswerNodeId(tree, questionNodeId);
  }

  for (let index = invalidatedAnswerIndex - 1; index >= 0; index -= 1) {
    const candidateAnswerId = fallbackHint.orderedAnswerIds[index];

    if (
      tree.nodes[candidateAnswerId]?.type === 'answer' &&
      tree.nodes[candidateAnswerId]?.parentId === questionNodeId
    ) {
      return candidateAnswerId;
    }
  }

  for (
    let index = invalidatedAnswerIndex + 1;
    index < fallbackHint.orderedAnswerIds.length;
    index += 1
  ) {
    const candidateAnswerId = fallbackHint.orderedAnswerIds[index];

    if (
      tree.nodes[candidateAnswerId]?.type === 'answer' &&
      tree.nodes[candidateAnswerId]?.parentId === questionNodeId
    ) {
      return candidateAnswerId;
    }
  }

  return null;
}

function collectOrderedAnswerIds(tree: NodeTree, questionNodeId: string) {
  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return [];
  }

  return questionNode.childIds.filter((childId) => tree.nodes[childId]?.type === 'answer');
}

function setQuestionCurrentAnswerId(
  tree: NodeTree,
  questionNodeId: string,
  answerNodeId: string | null,
) {
  const questionNode = tree.nodes[questionNodeId];

  if (questionNode?.type !== 'question') {
    return;
  }

  const nextCurrentAnswerId =
    answerNodeId &&
    tree.nodes[answerNodeId]?.type === 'answer' &&
    tree.nodes[answerNodeId]?.parentId === questionNode.id
      ? answerNodeId
      : null;

  if (questionNode.currentAnswerId === nextCurrentAnswerId) {
    return;
  }

  if (nextCurrentAnswerId) {
    questionNode.currentAnswerId = nextCurrentAnswerId;
  } else {
    delete questionNode.currentAnswerId;
  }

  questionNode.updatedAt = createTimestamp();
}

function hasInvalidExplicitSourceQuestionContext(
  tree: NodeTree,
  node: Extract<TreeNode, { type: 'summary' | 'judgment' }>,
) {
  const nodeQuestionAnchorId = getQuestionAnchorNodeId(tree, node);
  const sourceSummaryId = node.type === 'judgment' ? node.sourceSummaryId : undefined;

  if (!nodeQuestionAnchorId) {
    return Boolean(node.sourceAnswerId || sourceSummaryId);
  }

  if (node.sourceAnswerId) {
    const sourceAnswerQuestionAnchorId = getQuestionAnchorNodeId(
      tree,
      node.sourceAnswerId,
    );

    if (sourceAnswerQuestionAnchorId !== nodeQuestionAnchorId) {
      return true;
    }
  }

  if (sourceSummaryId) {
    const sourceSummaryQuestionAnchorId = getQuestionAnchorNodeId(
      tree,
      sourceSummaryId,
    );

    if (sourceSummaryQuestionAnchorId !== nodeQuestionAnchorId) {
      return true;
    }
  }

  return false;
}

function createTimestamp() {
  return new Date().toISOString();
}
