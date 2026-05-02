import {
  getDisplayNodeTitle,
  getDisplayNodeTypeLabel,
  getSummaryNodeKind,
} from './nodeSemantics';
import { buildQuestionBlockData } from './questionBlockSemantics';
import { getNodeOrThrow } from './treeDocument';
import type {
  NodeTree,
  PlanStepNode,
  QuestionNode,
  SummaryNode,
  TreeNode,
} from './nodeTypes';

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

export interface StructureMapSection {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  planStep: PlanStepNode;
  questionBlocks: StructureMapQuestionBlockNode[];
  scaffoldSummaries: StructureMapScaffoldSummaryNode[];
}

export interface StructureMapQuestionBlockNode {
  anchor: StructureMapAnchor;
  drag: StructureMapDragPermission;
  followUpQuestions: StructureMapQuestionBlockNode[];
  question: QuestionNode;
  referencePresence: StructureMapReferencePresence;
  supportingItems: StructureMapQuestionSupportingItem[];
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

export interface StructureMapPresentationModel {
  drag: StructureMapDragPermission;
  moduleId: string;
  sections: StructureMapSection[];
}

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
    drag: createDragPermission(),
    moduleId: moduleNode.id,
    sections,
  };
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

function buildPlanStepSection(tree: NodeTree, planStepNode: PlanStepNode): StructureMapSection {
  const childNodes = planStepNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((childNode): childNode is TreeNode => Boolean(childNode))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
  const scaffoldSummaries: StructureMapScaffoldSummaryNode[] = [];
  const questionBlocks: StructureMapQuestionBlockNode[] = [];

  for (const childNode of childNodes) {
    if (childNode.type === 'summary' && getSummaryNodeKind(tree, childNode) === 'scaffold') {
      scaffoldSummaries.push(buildScaffoldSummaryNode(childNode));
      continue;
    }

    if (childNode.type === 'question') {
      questionBlocks.push(buildQuestionBlockNode(tree, childNode));
    }
  }

  return {
    anchor: createAnchor('plan-step', planStepNode.id, [planStepNode.id]),
    drag: createDragPermission(),
    planStep: planStepNode,
    questionBlocks,
    scaffoldSummaries,
  };
}

function buildQuestionBlockNode(
  tree: NodeTree,
  questionNode: QuestionNode,
): StructureMapQuestionBlockNode {
  const questionBlock = buildQuestionBlockData(tree, questionNode.id);
  const supportingItems: StructureMapQuestionSupportingItem[] = [];
  const followUpQuestions: StructureMapQuestionBlockNode[] = [];

  for (const entry of questionBlock.entries) {
    if (entry.type === 'answer-group') {
      supportingItems.push({
        group: buildAnswerGroupNode(entry.group, questionBlock.currentAnswerNodeId),
        kind: 'answer-group',
      });
      continue;
    }

    if (entry.type === 'summary-group') {
      supportingItems.push({
        group: buildManualSummaryGroupNode(entry.group),
        kind: 'manual-summary-group',
      });
      continue;
    }

    if (entry.node.type === 'question') {
      followUpQuestions.push(buildQuestionBlockNode(tree, entry.node));
    }
  }

  return {
    anchor: createAnchor('question-block', questionNode.id, [questionNode.id]),
    drag: createDragPermission(),
    followUpQuestions,
    question: questionNode,
    referencePresence: createReferencePresence(questionNode),
    supportingItems,
  };
}

function buildAnswerGroupNode(
  group: ReturnType<typeof buildQuestionBlockData>['answerGroups'][number],
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
    drag: createDragPermission(),
    explanationNodeId: group.latestExplanationNode?.id ?? null,
    historicalClosureNodeIds: group.historicalClosureNodes.map((node) => node.id),
    isCurrentAnswer: group.answer.id === currentAnswerNodeId,
    latestEvaluationNodeId: group.latestEvaluationNode?.id ?? null,
    node: group.answer,
    referencePresence: createReferencePresence(group.answer),
  };
}

function buildManualSummaryGroupNode(
  group: ReturnType<typeof buildQuestionBlockData>['summaryGroups'][number],
): StructureMapManualSummaryGroupNode {
  const relatedNodeIds = [
    group.summary.id,
    group.latestCheckNode?.id ?? null,
    ...group.historicalCheckNodes.map((node) => node.id),
  ].filter((nodeId): nodeId is string => Boolean(nodeId));

  return {
    anchor: createAnchor('manual-summary-group', group.summary.id, relatedNodeIds),
    drag: createDragPermission(),
    historicalCheckNodeIds: group.historicalCheckNodes.map((node) => node.id),
    latestCheckNodeId: group.latestCheckNode?.id ?? null,
    node: group.summary,
    referencePresence: createReferencePresence(group.summary),
  };
}

function buildScaffoldSummaryNode(node: SummaryNode): StructureMapScaffoldSummaryNode {
  return {
    anchor: createAnchor('scaffold-summary', node.id, [node.id]),
    drag: createDragPermission(),
    node,
    referencePresence: createReferencePresence(node),
  };
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

function createDragPermission(): StructureMapDragPermission {
  return {
    canDrag: false,
    canReorder: false,
    canReparent: false,
  };
}

function createReferencePresence(node: TreeNode): StructureMapReferencePresence {
  return {
    count: node.referenceIds.length,
    hasReferences: node.referenceIds.length > 0,
  };
}
