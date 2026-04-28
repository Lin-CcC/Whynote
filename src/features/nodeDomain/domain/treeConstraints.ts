import type {
  CitationPurpose,
  NodeType,
  ReferenceSourceNodeType,
  ReferenceTargetNodeType,
  ResourceNodeType,
} from './nodeTypes';
import {
  CITATION_PURPOSES,
  LEARNING_NODE_TYPES,
  REFERENCE_SOURCE_NODE_TYPES,
  REFERENCE_TARGET_NODE_TYPES,
  RESOURCE_NODE_TYPES,
} from './nodeTypes';

const ALLOWED_CHILDREN: Record<NodeType, readonly NodeType[]> = {
  'theme-root': ['module', 'resource'],
  module: ['plan-step', ...LEARNING_NODE_TYPES],
  'plan-step': LEARNING_NODE_TYPES,
  question: LEARNING_NODE_TYPES,
  answer: [],
  summary: [],
  judgment: [],
  resource: ['resource-fragment'],
  'resource-fragment': [],
};

export function getAllowedChildTypes(parentType: NodeType) {
  return ALLOWED_CHILDREN[parentType];
}

export function canParentAcceptChild(parentType: NodeType, childType: NodeType) {
  return ALLOWED_CHILDREN[parentType].includes(childType);
}

export function canNodeHaveChildren(nodeType: NodeType) {
  return ALLOWED_CHILDREN[nodeType].length > 0;
}

export function isLearningNodeType(
  nodeType: NodeType,
): nodeType is typeof LEARNING_NODE_TYPES[number] {
  return LEARNING_NODE_TYPES.includes(
    nodeType as (typeof LEARNING_NODE_TYPES)[number],
  );
}

export function isResourceNodeType(
  nodeType: NodeType,
): nodeType is ResourceNodeType {
  return RESOURCE_NODE_TYPES.includes(nodeType as ResourceNodeType);
}

export function isResourceFragmentNodeType(
  nodeType: NodeType,
): nodeType is 'resource-fragment' {
  return nodeType === 'resource-fragment';
}

export function isReferenceSourceNodeType(
  nodeType: NodeType,
): nodeType is ReferenceSourceNodeType {
  return REFERENCE_SOURCE_NODE_TYPES.includes(
    nodeType as ReferenceSourceNodeType,
  );
}

export function isReferenceTargetNodeType(
  nodeType: NodeType,
): nodeType is ReferenceTargetNodeType {
  return REFERENCE_TARGET_NODE_TYPES.includes(
    nodeType as ReferenceTargetNodeType,
  );
}

export function isCitationPurpose(
  purpose: string | null | undefined,
): purpose is CitationPurpose {
  if (!purpose) {
    return false;
  }

  return CITATION_PURPOSES.includes(purpose as CitationPurpose);
}

export function shouldConvertToModuleAtRoot(nodeType: NodeType) {
  return (
    nodeType !== 'module' &&
    nodeType !== 'resource' &&
    nodeType !== 'resource-fragment'
  );
}
