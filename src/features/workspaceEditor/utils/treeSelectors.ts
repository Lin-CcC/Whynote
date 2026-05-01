import {
  getAllowedChildTypes,
  getDisplayNodeTitle,
  getDisplayNodeTypeLabel,
  getJudgmentNodeKind,
  getModuleScopeId,
  getNodeOrThrow,
  isAnswerClosureSummaryNode,
  isScaffoldSummaryNode,
  isSummaryCheckJudgmentNode,
  type ModuleNode,
  type NodeTree,
  type NodeType,
  type NonRootNode,
  type TreeNode,
} from '../../nodeDomain';

type NodeField = 'title' | 'content';

export function getModuleNodes(tree: NodeTree): ModuleNode[] {
  const rootNode = getNodeOrThrow(tree, tree.rootId);

  return rootNode.childIds
    .map((childId) => tree.nodes[childId])
    .filter((node): node is ModuleNode => node?.type === 'module')
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
}

export function getChildNodes(tree: NodeTree, nodeId: string): TreeNode[] {
  const node = getNodeOrThrow(tree, nodeId);

  return node.childIds
    .map((childId) => getNodeOrThrow(tree, childId))
    .sort((leftNode, rightNode) => leftNode.order - rightNode.order);
}

export function getNodePath(tree: NodeTree, nodeId: string): TreeNode[] {
  const path: TreeNode[] = [];
  let currentNode: TreeNode | undefined = tree.nodes[nodeId];

  while (currentNode) {
    path.unshift(currentNode);
    currentNode =
      currentNode.parentId === null
        ? undefined
        : tree.nodes[currentNode.parentId];
  }

  return path;
}

export function isNodeWithinModule(
  tree: NodeTree,
  nodeId: string | null,
  moduleId: string | null,
) {
  if (!nodeId || !moduleId || !tree.nodes[nodeId] || !tree.nodes[moduleId]) {
    return false;
  }

  if (nodeId === moduleId) {
    return true;
  }

  return getModuleScopeId(tree, nodeId) === moduleId;
}

export function getDefaultSelectedNodeId(
  tree: NodeTree,
  moduleId: string | null,
) {
  if (!moduleId || !tree.nodes[moduleId]) {
    return null;
  }

  let currentNodeId = moduleId;

  while (tree.nodes[currentNodeId].childIds.length > 0) {
    currentNodeId = tree.nodes[currentNodeId].childIds[0];
  }

  return currentNodeId;
}

export function buildExpandedNodeIds(
  tree: NodeTree,
  moduleId: string | null,
) {
  const expandedNodeIds = new Set<string>();

  if (!moduleId || !tree.nodes[moduleId]) {
    return expandedNodeIds;
  }

  const pendingNodeIds = [moduleId];

  while (pendingNodeIds.length > 0) {
    const currentNodeId = pendingNodeIds.pop();

    if (!currentNodeId) {
      continue;
    }

    const currentNode = tree.nodes[currentNodeId];

    if (!currentNode || currentNode.childIds.length === 0) {
      continue;
    }

    expandedNodeIds.add(currentNodeId);
    pendingNodeIds.push(...currentNode.childIds);
  }

  return expandedNodeIds;
}

export function getNodeTypeLabel(nodeType: NodeType) {
  switch (nodeType) {
    case 'theme-root':
      return '主题';
    case 'module':
      return '模块';
    case 'plan-step':
      return '步骤';
    case 'question':
      return '问题';
    case 'answer':
      return '回答';
    case 'summary':
      return '总结';
    case 'judgment':
      return '判断';
    case 'resource':
      return '资料';
    case 'resource-fragment':
      return '摘录';
  }
}

export function getDisplayLabelForNode(tree: NodeTree, node: TreeNode) {
  return getDisplayNodeTypeLabel(tree, node);
}

export function getDisplayTitleForNode(tree: NodeTree, node: TreeNode) {
  return getDisplayNodeTitle(tree, node);
}

export function getNodeDisplayName(
  tree: NodeTree,
  node: TreeNode,
  options?: {
    fallbackLabel?: string;
  },
) {
  const displayTitle = getDisplayTitleForNode(tree, node).trim();

  if (displayTitle.length > 0) {
    return displayTitle;
  }

  const fallbackLabel =
    options?.fallbackLabel?.trim() || getDisplayLabelForNode(tree, node);

  return `未命名${fallbackLabel}`;
}

export function getNodeEmphasis(node: TreeNode) {
  if (node.type === 'plan-step') {
    return 'supporting';
  }

  if (node.type === 'summary' || node.type === 'judgment') {
    return 'secondary';
  }

  return 'primary';
}

export function isDocumentContentNode(node: TreeNode) {
  return (
    node.type === 'answer' ||
    node.type === 'judgment' ||
    node.type === 'summary'
  );
}

export function doesNodeAlwaysShowDocumentTitle(node: TreeNode) {
  return !isDocumentContentNode(node);
}

export function getNodeRoleDescription(tree: NodeTree, node: TreeNode) {
  if (isScaffoldSummaryNode(tree, node)) {
    return '这里负责铺垫或前置讲解';
  }

  if (isAnswerClosureSummaryNode(tree, node)) {
    return '这里负责答案解析和标准理解';
  }

  if (isSummaryCheckJudgmentNode(tree, node)) {
    return '这里负责总结检查结果，而不是普通回答评估';
  }

  switch (node.type) {
    case 'theme-root':
      return '这里承接整个学习主题';
    case 'module':
      return '这里承接当前学习模块';
    case 'plan-step':
      return '这里承接当前学习步骤';
    case 'question':
      return '这里承接要回答的问题';
    case 'answer':
      return '这里承接当前这版回答';
    case 'summary':
      return '这里承接阶段总结';
    case 'judgment':
      return getJudgmentNodeKind(tree, node) === 'answer-closure'
        ? '这里只负责当前回答的判断缺口和反馈'
        : '这里只负责判断缺口和反馈';
    case 'resource':
      return '这里记录资料概况与来源';
    case 'resource-fragment':
      return '这里固定可回溯的资料片段';
  }
}

export function getNodeInputPlaceholder(
  nodeType: NodeType,
  field: NodeField,
) {
  if (field === 'title') {
    return `填写${getNodeTypeLabel(nodeType)}标题`;
  }

  switch (nodeType) {
    case 'module':
      return '补充模块说明';
    case 'plan-step':
      return '补充步骤说明';
    case 'question':
      return '补充问题说明';
    case 'answer':
      return '写下回答';
    case 'summary':
      return '写下总结';
    case 'judgment':
      return '写下判断';
    case 'resource':
      return '补充资料说明';
    case 'resource-fragment':
      return '补充摘录';
    case 'theme-root':
      return '补充主题说明';
  }
}

export function getNodeInputPlaceholderForNode(
  tree: NodeTree,
  node: TreeNode,
  field: NodeField,
) {
  if (field === 'title') {
    return `填写${getDisplayNodeTypeLabel(tree, node)}标题`;
  }

  if (isScaffoldSummaryNode(tree, node)) {
    return '补充铺垫';
  }

  if (isAnswerClosureSummaryNode(tree, node)) {
    return '补充答案解析';
  }

  return getNodeInputPlaceholder(node.type, field);
}

export function getDefaultChildType(parentType: NodeType) {
  const allowedChildTypes = getAllowedChildTypes(parentType);

  if (allowedChildTypes.includes('plan-step')) {
    return 'plan-step';
  }

  if (allowedChildTypes.includes('question')) {
    return 'question';
  }

  if (allowedChildTypes.includes('resource-fragment')) {
    return 'resource-fragment';
  }

  return (allowedChildTypes[0] as NonRootNode['type'] | undefined) ?? null;
}

export function getDefaultTitleForType(nodeType: NonRootNode['type']) {
  switch (nodeType) {
    case 'module':
      return '新模块';
    case 'plan-step':
      return '新步骤';
    case 'question':
      return '新问题';
    case 'answer':
      return '新回答';
    case 'summary':
      return '新总结';
    case 'judgment':
      return '新判断';
    case 'resource':
      return '新资料';
    case 'resource-fragment':
      return '新摘录';
  }
}
