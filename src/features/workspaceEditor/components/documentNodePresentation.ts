import { resolvePlanStepRuntimeStatus } from '../../learningEngine';
import type { NodeTree, TreeNode } from '../../nodeDomain';
import {
  doesNodeAlwaysShowDocumentTitle,
  getDisplayLabelForNode,
  getDisplayTitleForNode,
  getNodeEmphasis,
  getNodeInputPlaceholderForNode,
  isDocumentContentNode,
} from '../utils/treeSelectors';
import { getNodeSemanticVisibility } from '../utils/nodeSemanticVisibility';

const PLAN_STEP_STATUS_LABELS = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
} as const;

export type DocumentNodePresentation = {
  alwaysShowTitle: boolean;
  contentPlaceholder: string;
  displayLabel: string;
  displayTitle: string;
  emphasis: ReturnType<typeof getNodeEmphasis>;
  hasManualPlanStepStatusOverride: boolean;
  isContentNode: boolean;
  semanticVisibility: ReturnType<typeof getNodeSemanticVisibility>;
  titlePlaceholder: string;
  titleTone: 'default' | 'light';
  trimmedDisplayTitle: string;
  typeLabel: string;
  bodyRows: number;
  planStepRuntimeStatus: ReturnType<typeof resolvePlanStepRuntimeStatus> | null;
  sectionKind: 'module' | 'plan-step' | 'question' | 'content' | 'resource';
};

export function buildDocumentNodePresentation(
  tree: NodeTree,
  node: TreeNode,
): DocumentNodePresentation {
  const displayLabel = getDisplayLabelForNode(tree, node);
  const displayTitle = getDisplayTitleForNode(tree, node);
  const planStepRuntimeStatus =
    node.type === 'plan-step'
      ? resolvePlanStepRuntimeStatus(tree, node.id)
      : null;
  const semanticVisibility = getNodeSemanticVisibility(tree, node);
  const isContentNode = isDocumentContentNode(node);

  return {
    alwaysShowTitle: doesNodeAlwaysShowDocumentTitle(node),
    bodyRows: node.type === 'plan-step' ? 3 : 4,
    contentPlaceholder: getNodeInputPlaceholderForNode(tree, node, 'content'),
    displayLabel,
    displayTitle,
    emphasis: getNodeEmphasis(node),
    hasManualPlanStepStatusOverride:
      node.type === 'plan-step' &&
      planStepRuntimeStatus !== null &&
      node.status !== planStepRuntimeStatus.suggestedStatus,
    isContentNode,
    planStepRuntimeStatus,
    sectionKind: getDocumentSectionKind(node),
    semanticVisibility,
    titlePlaceholder: getNodeInputPlaceholderForNode(tree, node, 'title'),
    titleTone: isContentNode ? 'light' : 'default',
    trimmedDisplayTitle: displayTitle.trim(),
    typeLabel: displayLabel,
  };
}

export { PLAN_STEP_STATUS_LABELS };

function getDocumentSectionKind(
  node: TreeNode,
): DocumentNodePresentation['sectionKind'] {
  switch (node.type) {
    case 'module':
      return 'module';
    case 'plan-step':
      return 'plan-step';
    case 'question':
      return 'question';
    case 'answer':
    case 'judgment':
    case 'summary':
      return 'content';
    case 'resource':
    case 'resource-fragment':
    case 'theme-root':
      return 'resource';
  }
}
