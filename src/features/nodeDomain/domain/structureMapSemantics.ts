import { NodeDomainError } from './nodeErrors';
import {
  buildQuestionBlockData,
  type QuestionBlockEntry,
} from './questionBlockSemantics';
import { getJudgmentNodeKind, getSummaryNodeKind } from './nodeSemantics';
import { cloneNodeTree, getModuleScopeId, getNodeOrThrow } from './treeDocument';
import { moveNode } from './treeOperations';
import type { NodeTree, TreeNode } from './nodeTypes';

export type StructureMapDraggableUnitType =
  | 'plan-step'
  | 'question-block'
  | 'follow-up-question'
  | 'answer-group'
  | 'summary-group'
  | 'scaffold-summary';

export type StructureMapDropRejectionCode =
  | 'NON_DRAGGABLE_NODE'
  | 'RESULT_NODE_SINGLETON'
  | 'CROSS_MODULE'
  | 'ROOT_NOT_ALLOWED'
  | 'RESOURCE_NOT_ALLOWED'
  | 'FOLLOW_UP_PARENT_LOCKED'
  | 'INVALID_PARENT_TYPE';

export interface StructureMapMoveRequest {
  index?: number;
  nodeId: string;
  targetParentNodeId: string;
}

export interface StructureMapDragUnit {
  moduleId: string | null;
  nodeId: string;
  parentNodeId: string;
  type: StructureMapDraggableUnitType;
}

export type StructureMapMoveValidationResult =
  | {
      allowed: true;
      unit: StructureMapDragUnit;
    }
  | {
      allowed: false;
      code: StructureMapDropRejectionCode;
      message: string;
      unit: StructureMapDragUnit | null;
    };

export function moveAnswerGroup(
  tree: NodeTree,
  answerNodeId: string,
  index?: number,
) {
  const answerNode = getNodeOrThrow(tree, answerNodeId);

  if (answerNode.type !== 'answer' || answerNode.parentId === null) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Answer group anchor ${answerNodeId} is invalid.`,
      {
        nodeId: answerNodeId,
      },
    );
  }

  const preservedNodeStates = collectQuestionBlockEntryNodeStates(
    tree,
    answerNode.parentId,
    answerNodeId,
  );
  const nextTree = moveQuestionBlockEntryWithinQuestion(
    tree,
    answerNode.parentId,
    answerNodeId,
    index,
  );

  return restorePreservedNodeStates(nextTree, preservedNodeStates);
}

export function moveSummaryGroup(
  tree: NodeTree,
  summaryNodeId: string,
  index?: number,
) {
  const summaryNode = getNodeOrThrow(tree, summaryNodeId);

  if (
    summaryNode.type !== 'summary' ||
    summaryNode.parentId === null ||
    getSummaryNodeKind(tree, summaryNode) !== 'manual'
  ) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Manual summary group anchor ${summaryNodeId} is invalid.`,
      {
        nodeId: summaryNodeId,
      },
    );
  }

  const preservedNodeStates = collectQuestionBlockEntryNodeStates(
    tree,
    summaryNode.parentId,
    summaryNodeId,
  );
  const nextTree = moveQuestionBlockEntryWithinQuestion(
    tree,
    summaryNode.parentId,
    summaryNodeId,
    index,
  );

  return restorePreservedNodeStates(nextTree, preservedNodeStates);
}

export function moveScaffoldWithinStep(
  tree: NodeTree,
  summaryNodeId: string,
  index?: number,
) {
  const summaryNode = getNodeOrThrow(tree, summaryNodeId);

  if (
    summaryNode.type !== 'summary' ||
    summaryNode.parentId === null ||
    getSummaryNodeKind(tree, summaryNode) !== 'scaffold'
  ) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Scaffold summary ${summaryNodeId} is invalid.`,
      {
        nodeId: summaryNodeId,
      },
    );
  }

  const preservedNodeStates = [createPreservedNodeState(summaryNode)];
  const nextTree = moveDirectChildWithinParent(
    tree,
    summaryNode.parentId,
    summaryNodeId,
    index,
  );

  return restorePreservedNodeStates(nextTree, preservedNodeStates);
}

export function validateStructureMapMove(
  tree: NodeTree,
  request: StructureMapMoveRequest,
): StructureMapMoveValidationResult {
  const unitResult = resolveStructureMapDragUnit(tree, request.nodeId);

  if (!unitResult.allowed) {
    return unitResult;
  }

  const targetParentNode = getNodeOrThrow(tree, request.targetParentNodeId);
  const sourceUnit = unitResult.unit;

  if (targetParentNode.type === 'theme-root') {
    return rejectStructureMapMove('ROOT_NOT_ALLOWED', sourceUnit);
  }

  if (targetParentNode.type === 'resource' || targetParentNode.type === 'resource-fragment') {
    return rejectStructureMapMove('RESOURCE_NOT_ALLOWED', sourceUnit);
  }

  if (sourceUnit.moduleId !== getModuleScopeId(tree, targetParentNode.id)) {
    return rejectStructureMapMove('CROSS_MODULE', sourceUnit);
  }

  switch (sourceUnit.type) {
    case 'plan-step':
      return targetParentNode.type === 'module'
        ? { allowed: true, unit: sourceUnit }
        : rejectStructureMapMove('INVALID_PARENT_TYPE', sourceUnit);
    case 'question-block':
      return targetParentNode.type === 'plan-step'
        ? { allowed: true, unit: sourceUnit }
        : rejectStructureMapMove('INVALID_PARENT_TYPE', sourceUnit);
    case 'follow-up-question':
      return targetParentNode.id === sourceUnit.parentNodeId
        ? { allowed: true, unit: sourceUnit }
        : rejectStructureMapMove('FOLLOW_UP_PARENT_LOCKED', sourceUnit);
    case 'answer-group':
    case 'summary-group':
      return targetParentNode.type === 'question' && targetParentNode.id === sourceUnit.parentNodeId
        ? { allowed: true, unit: sourceUnit }
        : rejectStructureMapMove('INVALID_PARENT_TYPE', sourceUnit);
    case 'scaffold-summary':
      return targetParentNode.type === 'plan-step' &&
        targetParentNode.id === sourceUnit.parentNodeId
        ? { allowed: true, unit: sourceUnit }
        : rejectStructureMapMove('INVALID_PARENT_TYPE', sourceUnit);
  }
}

export function moveStructureMapNode(
  tree: NodeTree,
  request: StructureMapMoveRequest,
) {
  const validation = validateStructureMapMove(tree, request);

  if (!validation.allowed) {
    throw new NodeDomainError('INVALID_CHILD_TYPE', validation.message, {
      code: validation.code,
      nodeId: request.nodeId,
      targetParentNodeId: request.targetParentNodeId,
    });
  }

  switch (validation.unit.type) {
    case 'plan-step':
    case 'question-block':
      return moveNode(
        tree,
        validation.unit.nodeId,
        request.targetParentNodeId,
        request.index,
      );
    case 'follow-up-question':
      return moveQuestionBlockEntryWithinQuestion(
        tree,
        validation.unit.parentNodeId,
        validation.unit.nodeId,
        request.index,
      );
    case 'answer-group':
      return moveAnswerGroup(tree, validation.unit.nodeId, request.index);
    case 'summary-group':
      return moveSummaryGroup(tree, validation.unit.nodeId, request.index);
    case 'scaffold-summary':
      return moveScaffoldWithinStep(tree, validation.unit.nodeId, request.index);
  }
}

function resolveStructureMapDragUnit(
  tree: NodeTree,
  nodeId: string,
): StructureMapMoveValidationResult {
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'judgment') {
    return rejectStructureMapMove(
      getJudgmentNodeKind(tree, node) === 'summary-check'
        ? 'RESULT_NODE_SINGLETON'
        : 'NON_DRAGGABLE_NODE',
      null,
    );
  }

  if (node.type === 'summary') {
    const summaryKind = getSummaryNodeKind(tree, node);

    if (summaryKind === 'answer-closure') {
      return rejectStructureMapMove('RESULT_NODE_SINGLETON', null);
    }

    if (summaryKind === 'manual' && node.parentId !== null) {
      return allowStructureMapUnit(tree, node, 'summary-group');
    }

    if (summaryKind === 'scaffold' && node.parentId !== null) {
      return allowStructureMapUnit(tree, node, 'scaffold-summary');
    }

    return rejectStructureMapMove('NON_DRAGGABLE_NODE', null);
  }

  if (node.type === 'answer' && node.parentId !== null) {
    return allowStructureMapUnit(tree, node, 'answer-group');
  }

  if (node.type === 'question' && node.parentId !== null) {
    const parentNode = getNodeOrThrow(tree, node.parentId);

    if (parentNode.type === 'plan-step') {
      return allowStructureMapUnit(tree, node, 'question-block');
    }

    if (parentNode.type === 'question') {
      return allowStructureMapUnit(tree, node, 'follow-up-question');
    }
  }

  if (node.type === 'plan-step' && node.parentId !== null) {
    return allowStructureMapUnit(tree, node, 'plan-step');
  }

  return rejectStructureMapMove('NON_DRAGGABLE_NODE', null);
}

function allowStructureMapUnit(
  tree: NodeTree,
  node: TreeNode,
  type: StructureMapDraggableUnitType,
): StructureMapMoveValidationResult {
  return {
    allowed: true,
    unit: {
      moduleId: getModuleScopeId(tree, node.id),
      nodeId: node.id,
      parentNodeId: node.parentId ?? '',
      type,
    },
  };
}

function rejectStructureMapMove(
  code: StructureMapDropRejectionCode,
  unit: StructureMapDragUnit | null,
): StructureMapMoveValidationResult {
  return {
    allowed: false,
    code,
    message: getStructureMapDropRejectionMessage(code),
    unit,
  };
}

function getStructureMapDropRejectionMessage(code: StructureMapDropRejectionCode) {
  switch (code) {
    case 'NON_DRAGGABLE_NODE':
      return 'This node is not draggable in the structure map.';
    case 'RESULT_NODE_SINGLETON':
      return 'Paired result nodes cannot move on their own.';
    case 'CROSS_MODULE':
      return 'Structure map moves cannot cross module boundaries.';
    case 'ROOT_NOT_ALLOWED':
      return 'Structure map moves cannot target the theme root.';
    case 'RESOURCE_NOT_ALLOWED':
      return 'Structure map moves cannot target resources.';
    case 'FOLLOW_UP_PARENT_LOCKED':
      return 'Follow-up questions must stay under their original parent question.';
    case 'INVALID_PARENT_TYPE':
      return 'The target parent type is not allowed for this structure map unit.';
  }
}

function moveQuestionBlockEntryWithinQuestion(
  tree: NodeTree,
  questionNodeId: string,
  entryAnchorNodeId: string,
  index?: number,
) {
  const questionBlock = buildQuestionBlockData(tree, questionNodeId);
  const sourceIndex = questionBlock.entries.findIndex((entry) =>
    getQuestionBlockEntryAnchorNodeId(entry) === entryAnchorNodeId,
  );

  if (sourceIndex === -1) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Question block entry ${entryAnchorNodeId} was not found.`,
      {
        nodeId: entryAnchorNodeId,
        questionNodeId,
      },
    );
  }

  const orderedEntries = reorderEntries(questionBlock.entries, sourceIndex, index);
  const nextChildIds = orderedEntries.flatMap((entry) => getQuestionBlockEntryNodeIds(entry));

  return rewriteParentChildOrder(tree, questionNodeId, nextChildIds);
}

function moveDirectChildWithinParent(
  tree: NodeTree,
  parentNodeId: string,
  childNodeId: string,
  index?: number,
) {
  const parentNode = getNodeOrThrow(tree, parentNodeId);
  const sourceIndex = parentNode.childIds.indexOf(childNodeId);

  if (sourceIndex === -1) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Child ${childNodeId} does not belong to parent ${parentNodeId}.`,
      {
        nodeId: childNodeId,
        parentNodeId,
      },
    );
  }

  const nextChildIds = reorderEntries(parentNode.childIds, sourceIndex, index);

  return rewriteParentChildOrder(tree, parentNodeId, nextChildIds);
}

function rewriteParentChildOrder(
  tree: NodeTree,
  parentNodeId: string,
  nextChildIds: string[],
) {
  const parentNode = getNodeOrThrow(tree, parentNodeId);

  if (nextChildIds.length !== parentNode.childIds.length) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Cannot rewrite children for ${parentNodeId} with a mismatched child count.`,
      {
        parentNodeId,
      },
    );
  }

  if (nextChildIds.every((childId, index) => parentNode.childIds[index] === childId)) {
    return tree;
  }

  const nextTree = cloneNodeTree(tree);
  const nextParentNode = getNodeOrThrow(nextTree, parentNodeId);

  nextParentNode.childIds = [...nextChildIds];
  nextParentNode.updatedAt = createTimestamp();

  for (let childIndex = 0; childIndex < nextParentNode.childIds.length; childIndex += 1) {
    const childNodeId = nextParentNode.childIds[childIndex];
    const childNode = getNodeOrThrow(nextTree, childNodeId);

    childNode.order = childIndex;
  }

  return nextTree;
}

function reorderEntries<T>(entries: T[], sourceIndex: number, index?: number) {
  const normalizedIndex = normalizeInsertIndex(index ?? entries.length, entries.length);
  const nextEntries = [...entries];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);

  if (movedEntry === undefined) {
    return entries;
  }

  const adjustedIndex =
    normalizedIndex > sourceIndex ? normalizedIndex - 1 : normalizedIndex;

  nextEntries.splice(adjustedIndex, 0, movedEntry);

  return nextEntries;
}

function normalizeInsertIndex(index: number, length: number) {
  if (index < 0 || index > length) {
    throw new NodeDomainError(
      'INVALID_INSERT_INDEX',
      `Insert index ${index} is out of range 0-${length}.`,
      {
        index,
        length,
      },
    );
  }

  return index;
}

function getQuestionBlockEntryAnchorNodeId(entry: QuestionBlockEntry) {
  if (entry.type === 'answer-group') {
    return entry.group.answer.id;
  }

  if (entry.type === 'summary-group') {
    return entry.group.summary.id;
  }

  return entry.node.id;
}

function getQuestionBlockEntryNodeIds(entry: QuestionBlockEntry) {
  if (entry.type === 'answer-group') {
    return [
      entry.group.answer.id,
      ...entry.group.historicalClosureNodes.map((node) => node.id),
      ...(entry.group.latestEvaluationNode ? [entry.group.latestEvaluationNode.id] : []),
      ...(entry.group.latestExplanationNode ? [entry.group.latestExplanationNode.id] : []),
    ];
  }

  if (entry.type === 'summary-group') {
    return [
      entry.group.summary.id,
      ...entry.group.historicalCheckNodes.map((node) => node.id),
      ...(entry.group.latestCheckNode ? [entry.group.latestCheckNode.id] : []),
    ];
  }

  return [entry.node.id];
}

function createTimestamp() {
  return new Date().toISOString();
}

type PreservedNodeState = {
  id: string;
  sourceAnswerId?: string;
  sourceAnswerUpdatedAt?: string;
  sourceSummaryId?: string;
  sourceSummaryUpdatedAt?: string;
  updatedAt: string;
};

function collectQuestionBlockEntryNodeStates(
  tree: NodeTree,
  questionNodeId: string,
  entryAnchorNodeId: string,
) {
  const questionBlock = buildQuestionBlockData(tree, questionNodeId);
  const entry = questionBlock.entries.find(
    (candidateEntry) => getQuestionBlockEntryAnchorNodeId(candidateEntry) === entryAnchorNodeId,
  );

  if (!entry) {
    throw new NodeDomainError(
      'INVALID_CHILD_TYPE',
      `Question block entry ${entryAnchorNodeId} was not found.`,
      {
        nodeId: entryAnchorNodeId,
        questionNodeId,
      },
    );
  }

  return getQuestionBlockEntryNodeIds(entry).map((nodeId) =>
    createPreservedNodeState(getNodeOrThrow(tree, nodeId)),
  );
}

function createPreservedNodeState(node: TreeNode): PreservedNodeState {
  return {
    id: node.id,
    ...('sourceAnswerId' in node && node.sourceAnswerId
      ? { sourceAnswerId: node.sourceAnswerId }
      : {}),
    ...('sourceAnswerUpdatedAt' in node && node.sourceAnswerUpdatedAt
      ? { sourceAnswerUpdatedAt: node.sourceAnswerUpdatedAt }
      : {}),
    ...('sourceSummaryId' in node && node.sourceSummaryId
      ? { sourceSummaryId: node.sourceSummaryId }
      : {}),
    ...('sourceSummaryUpdatedAt' in node && node.sourceSummaryUpdatedAt
      ? { sourceSummaryUpdatedAt: node.sourceSummaryUpdatedAt }
      : {}),
    updatedAt: node.updatedAt,
  };
}

function restorePreservedNodeStates(
  tree: NodeTree,
  preservedNodeStates: PreservedNodeState[],
) {
  if (preservedNodeStates.length === 0) {
    return tree;
  }

  const nextTree = cloneNodeTree(tree);

  for (const preservedNodeState of preservedNodeStates) {
    const nextNode = getNodeOrThrow(nextTree, preservedNodeState.id);

    nextNode.updatedAt = preservedNodeState.updatedAt;

    if ('sourceAnswerId' in nextNode) {
      if (preservedNodeState.sourceAnswerId) {
        nextNode.sourceAnswerId = preservedNodeState.sourceAnswerId;
      } else {
        delete nextNode.sourceAnswerId;
      }
    }

    if ('sourceAnswerUpdatedAt' in nextNode) {
      if (preservedNodeState.sourceAnswerUpdatedAt) {
        nextNode.sourceAnswerUpdatedAt = preservedNodeState.sourceAnswerUpdatedAt;
      } else {
        delete nextNode.sourceAnswerUpdatedAt;
      }
    }

    if ('sourceSummaryId' in nextNode) {
      if (preservedNodeState.sourceSummaryId) {
        nextNode.sourceSummaryId = preservedNodeState.sourceSummaryId;
      } else {
        delete nextNode.sourceSummaryId;
      }
    }

    if ('sourceSummaryUpdatedAt' in nextNode) {
      if (preservedNodeState.sourceSummaryUpdatedAt) {
        nextNode.sourceSummaryUpdatedAt = preservedNodeState.sourceSummaryUpdatedAt;
      } else {
        delete nextNode.sourceSummaryUpdatedAt;
      }
    }
  }

  return nextTree;
}
