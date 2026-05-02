import { NodeDomainError } from './nodeErrors';
import {
  getDisplayNodeTitle,
  getDisplayNodeTypeLabel,
  getJudgmentNodeKind,
  getSummaryNodeKind,
} from './nodeSemantics';
import {
  buildQuestionBlockData,
  type QuestionBlockAnswerGroup,
  type QuestionBlockEntry,
  type QuestionBlockSummaryGroup,
} from './questionBlockSemantics';
import { cloneNodeTree, getModuleScopeId, getNodeOrThrow } from './treeDocument';
import { moveNode } from './treeOperations';
import type {
  NodeTree,
  PlanStepNode,
  QuestionNode,
  SummaryNode,
  TreeNode,
} from './nodeTypes';

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

export interface StructureMapDragPermission {
  canDrag: boolean;
  canReorder: boolean;
  canReparent: boolean;
}

export interface StructureMapAnchor {
  kind:
    | 'plan-step'
    | 'question-block'
    | 'answer-group'
    | 'manual-summary-group'
    | 'scaffold-summary';
  nodeId: string;
  relatedNodeIds: string[];
}

export interface StructureMapReferencePresence {
  count: number;
  hasReferences: boolean;
}

export interface StructureMapAnswerGroupNode {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  explanationNodeId: string | null;
  historicalClosureNodeIds: string[];
  isCurrentAnswer: boolean;
  latestEvaluationNodeId: string | null;
  node: Extract<TreeNode, { type: 'answer' }>;
  referencePresence: StructureMapReferencePresence;
}

export interface StructureMapManualSummaryGroupNode {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  historicalCheckNodeIds: string[];
  latestCheckNodeId: string | null;
  node: SummaryNode;
  referencePresence: StructureMapReferencePresence;
}

export interface StructureMapScaffoldSummaryNode {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  node: SummaryNode;
  referencePresence: StructureMapReferencePresence;
}

export type StructureMapQuestionSupportingItem =
  | {
      group: StructureMapAnswerGroupNode;
      kind: 'answer-group';
    }
  | {
      group: StructureMapManualSummaryGroupNode;
      kind: 'manual-summary-group';
    };

export type StructureMapQuestionEntry =
  | {
      group: StructureMapAnswerGroupNode;
      kind: 'answer-group';
    }
  | {
      group: StructureMapManualSummaryGroupNode;
      kind: 'manual-summary-group';
    }
  | {
      kind: 'question-block';
      node: StructureMapQuestionBlockNode;
    };

export interface StructureMapQuestionBlockNode {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  entries: StructureMapQuestionEntry[];
  followUpQuestions: StructureMapQuestionBlockNode[];
  question: QuestionNode;
  referencePresence: StructureMapReferencePresence;
  supportingItems: StructureMapQuestionSupportingItem[];
}

export type StructureMapSectionItem =
  | {
      kind: 'question-block';
      node: StructureMapQuestionBlockNode;
    }
  | {
      kind: 'scaffold-summary';
      node: StructureMapScaffoldSummaryNode;
    };

export interface StructureMapSection {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  items: StructureMapSectionItem[];
  planStep: PlanStepNode;
  questionBlocks: StructureMapQuestionBlockNode[];
  scaffoldSummaries: StructureMapScaffoldSummaryNode[];
}

export interface StructureMapPresentationModel {
  drag: StructureMapDragPermission;
  moduleId: string;
  sections: StructureMapSection[];
}

type QuestionBlockAnchorEntry = Extract<QuestionBlockEntry, { type: 'node' }>['node'];

export function buildStructureMapPresentationModel(
  tree: NodeTree,
  moduleNodeId: string,
): StructureMapPresentationModel {
  const moduleNode = getNodeOrThrow(tree, moduleNodeId);

  if (moduleNode.type !== 'module') {
    throw new Error(`Node ${moduleNodeId} is not a module.`);
  }

  const sections = moduleNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is PlanStepNode => childNode?.type === 'plan-step')
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order)
    .map((planStepNode) => buildPlanStepSection(tree, planStepNode));

  return {
    drag: {
      canDrag: false,
      canReorder: false,
      canReparent: false,
    },
    moduleId: moduleNode.id,
    sections,
  };
}

export function resolveStructureMapSelectionAnchor(
  tree: NodeTree,
  moduleNodeId: string | null,
  selectedNodeId: string | null,
): StructureMapAnchor | null {
  if (!moduleNodeId || !selectedNodeId || !tree.nodes[moduleNodeId] || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const model = buildStructureMapPresentationModel(tree, moduleNodeId);

  for (const section of model.sections) {
    if (section.anchor.relatedNodeIds.includes(selectedNodeId)) {
      return section.anchor;
    }

    for (const item of section.items) {
      if (item.kind === 'scaffold-summary') {
        if (item.node.anchor.relatedNodeIds.includes(selectedNodeId)) {
          return item.node.anchor;
        }
        continue;
      }

      const matchedAnchor = resolveQuestionBlockSelectionAnchor(item.node, selectedNodeId);

      if (matchedAnchor) {
        return matchedAnchor;
      }
    }
  }

  return null;
}

export function getStructureMapSelectionId(anchor: StructureMapAnchor) {
  switch (anchor.kind) {
    case 'manual-summary-group':
      return `summary-group:${anchor.nodeId}`;
    default:
      return `${anchor.kind}:${anchor.nodeId}`;
  }
}

export function getStructureMapNodeLabel(
  tree: NodeTree,
  node: TreeNode,
  fallbackLabel?: string,
) {
  const title = getDisplayNodeTitle(tree, node).trim();

  if (title.length > 0) {
    return title;
  }

  return `未命名${fallbackLabel ?? getDisplayNodeTypeLabel(tree, node)}`;
}

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

  return moveQuestionBlockEntryWithinQuestion(
    tree,
    answerNode.parentId,
    answerNodeId,
    index,
  );
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

  return moveQuestionBlockEntryWithinQuestion(
    tree,
    summaryNode.parentId,
    summaryNodeId,
    index,
  );
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

  return moveDirectChildWithinParent(tree, summaryNode.parentId, summaryNodeId, index);
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

function buildPlanStepSection(
  tree: NodeTree,
  planStepNode: PlanStepNode,
): StructureMapSection {
  const childNodes = planStepNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is TreeNode => Boolean(childNode))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
  const items: StructureMapSectionItem[] = [];
  const scaffoldSummaries: StructureMapScaffoldSummaryNode[] = [];
  const questionBlocks: StructureMapQuestionBlockNode[] = [];

  for (const childNode of childNodes) {
    if (childNode.type === 'summary' && getSummaryNodeKind(tree, childNode) === 'scaffold') {
      const scaffoldSummary = buildScaffoldSummaryNode(childNode);

      scaffoldSummaries.push(scaffoldSummary);
      items.push({
        kind: 'scaffold-summary',
        node: scaffoldSummary,
      });
      continue;
    }

    if (childNode.type === 'question') {
      const questionBlock = buildQuestionBlockNode(tree, childNode, 'plan-step');

      questionBlocks.push(questionBlock);
      items.push({
        kind: 'question-block',
        node: questionBlock,
      });
    }
  }

  return {
    anchor: createAnchor('plan-step', planStepNode.id, [planStepNode.id]),
    drag: createDragPermission('plan-step'),
    items,
    planStep: planStepNode,
    questionBlocks,
    scaffoldSummaries,
  };
}

function buildQuestionBlockNode(
  tree: NodeTree,
  questionNode: QuestionNode,
  parentType: 'plan-step' | 'question',
): StructureMapQuestionBlockNode {
  const questionBlock = buildQuestionBlockData(tree, questionNode.id);
  const entries: StructureMapQuestionEntry[] = [];
  const supportingItems: StructureMapQuestionSupportingItem[] = [];
  const followUpQuestions: StructureMapQuestionBlockNode[] = [];

  for (const entry of questionBlock.entries) {
    if (entry.type === 'answer-group') {
      const answerGroup = buildAnswerGroupNode(entry.group, questionBlock.currentAnswerNodeId);

      supportingItems.push({
        group: answerGroup,
        kind: 'answer-group',
      });
      entries.push({
        group: answerGroup,
        kind: 'answer-group',
      });
      continue;
    }

    if (entry.type === 'summary-group') {
      const summaryGroup = buildManualSummaryGroupNode(entry.group);

      supportingItems.push({
        group: summaryGroup,
        kind: 'manual-summary-group',
      });
      entries.push({
        group: summaryGroup,
        kind: 'manual-summary-group',
      });
      continue;
    }

    if (entry.node.type === 'question') {
      const followUpQuestion = buildQuestionBlockNode(tree, entry.node, 'question');

      followUpQuestions.push(followUpQuestion);
      entries.push({
        kind: 'question-block',
        node: followUpQuestion,
      });
    }
  }

  return {
    anchor: createAnchor('question-block', questionNode.id, [questionNode.id]),
    drag: createDragPermission(
      parentType === 'plan-step' ? 'question-block' : 'follow-up-question',
    ),
    entries,
    followUpQuestions,
    question: questionNode,
    referencePresence: createReferencePresence(questionNode),
    supportingItems,
  };
}

function buildAnswerGroupNode(
  group: QuestionBlockAnswerGroup,
  currentAnswerNodeId: string | null,
): StructureMapAnswerGroupNode {
  const relatedNodeIds = [
    group.answer.id,
    group.latestEvaluationNode?.id ?? null,
    group.latestExplanationNode?.id ?? null,
    ...group.historicalClosureNodes.map((node) => node.id),
  ].filter((nodeId): nodeId is string => Boolean(nodeId));

  return {
    anchor: createAnchor('answer-group', group.answer.id, relatedNodeIds),
    drag: createDragPermission('answer-group'),
    explanationNodeId: group.latestExplanationNode?.id ?? null,
    historicalClosureNodeIds: group.historicalClosureNodes.map((node) => node.id),
    isCurrentAnswer: group.answer.id === currentAnswerNodeId,
    latestEvaluationNodeId: group.latestEvaluationNode?.id ?? null,
    node: group.answer,
    referencePresence: createReferencePresence(group.answer),
  };
}

function buildManualSummaryGroupNode(
  group: QuestionBlockSummaryGroup,
): StructureMapManualSummaryGroupNode {
  const relatedNodeIds = [
    group.summary.id,
    group.latestCheckNode?.id ?? null,
    ...group.historicalCheckNodes.map((node) => node.id),
  ].filter((nodeId): nodeId is string => Boolean(nodeId));

  return {
    anchor: createAnchor('manual-summary-group', group.summary.id, relatedNodeIds),
    drag: createDragPermission('summary-group'),
    historicalCheckNodeIds: group.historicalCheckNodes.map((node) => node.id),
    latestCheckNodeId: group.latestCheckNode?.id ?? null,
    node: group.summary,
    referencePresence: createReferencePresence(group.summary),
  };
}

function buildScaffoldSummaryNode(node: SummaryNode): StructureMapScaffoldSummaryNode {
  return {
    anchor: createAnchor('scaffold-summary', node.id, [node.id]),
    drag: createDragPermission('scaffold-summary'),
    node,
    referencePresence: createReferencePresence(node),
  };
}

function resolveQuestionBlockSelectionAnchor(
  questionBlockNode: StructureMapQuestionBlockNode,
  selectedNodeId: string,
): StructureMapAnchor | null {
  if (questionBlockNode.anchor.relatedNodeIds.includes(selectedNodeId)) {
    return questionBlockNode.anchor;
  }

  for (const entry of questionBlockNode.entries) {
    if (entry.kind === 'answer-group' || entry.kind === 'manual-summary-group') {
      if (entry.group.anchor.relatedNodeIds.includes(selectedNodeId)) {
        return entry.group.anchor;
      }
      continue;
    }

    const matchedAnchor = resolveQuestionBlockSelectionAnchor(entry.node, selectedNodeId);

    if (matchedAnchor) {
      return matchedAnchor;
    }
  }

  return null;
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
      return '这个节点不能在结构地图里单独拖动。';
    case 'RESULT_NODE_SINGLETON':
      return '成对结果节点不能脱离所属回答或总结单独移动。';
    case 'CROSS_MODULE':
      return '结构地图中的重排不能跨模块进行。';
    case 'ROOT_NOT_ALLOWED':
      return '结构地图中的重排不能落到主题根节点。';
    case 'RESOURCE_NOT_ALLOWED':
      return '结构地图中的重排不能落到资料节点。';
    case 'FOLLOW_UP_PARENT_LOCKED':
      return '追问必须保留在原始父问题下面。';
    case 'INVALID_PARENT_TYPE':
      return '这个结构地图单元不能落到当前目标父节点下。';
  }
}

function moveQuestionBlockEntryWithinQuestion(
  tree: NodeTree,
  questionNodeId: string,
  entryAnchorNodeId: string,
  index?: number,
) {
  const questionBlock = buildQuestionBlockData(tree, questionNodeId);
  const sourceIndex = questionBlock.entries.findIndex(
    (entry) => getQuestionBlockEntryAnchorNodeId(entry) === entryAnchorNodeId,
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

  return (entry.node as QuestionBlockAnchorEntry).id;
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

function createAnchor(
  kind: StructureMapAnchor['kind'],
  nodeId: string,
  relatedNodeIds: string[],
): StructureMapAnchor {
  return {
    kind,
    nodeId,
    relatedNodeIds,
  };
}

function createDragPermission(
  type: StructureMapDraggableUnitType | 'follow-up-question',
): StructureMapDragPermission {
  switch (type) {
    case 'plan-step':
      return {
        canDrag: true,
        canReorder: true,
        canReparent: false,
      };
    case 'question-block':
      return {
        canDrag: true,
        canReorder: true,
        canReparent: true,
      };
    case 'follow-up-question':
      return {
        canDrag: true,
        canReorder: true,
        canReparent: false,
      };
    case 'answer-group':
    case 'summary-group':
    case 'scaffold-summary':
      return {
        canDrag: true,
        canReorder: true,
        canReparent: false,
      };
  }
}

function createReferencePresence(node: TreeNode): StructureMapReferencePresence {
  return {
    count: node.referenceIds.length,
    hasReferences: node.referenceIds.length > 0,
  };
}

function createTimestamp() {
  return new Date().toISOString();
}
