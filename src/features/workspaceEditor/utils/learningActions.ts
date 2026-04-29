import {
  getNodeOrThrow,
  isScaffoldSummaryNode,
  type NodeTree,
  type TreeNode,
} from '../../nodeDomain';
import type {
  LearningActionId,
  LearningActionPlacement,
  LearningActionOption,
} from '../workspaceEditorTypes';

export function getLearningActionOptions(
  tree: NodeTree,
  selectedNodeId: string | null,
): LearningActionOption[] {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return [];
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  return getCandidateActionIds(tree, selectedNode).flatMap((actionId) => {
    const placement = resolveLearningActionPlacement(tree, selectedNodeId, actionId);

    if (!placement) {
      return [];
    }

    return [
      {
        hint: buildLearningActionHint(tree, selectedNode, actionId),
        id: actionId,
        label: getLearningActionLabel(actionId),
      },
    ];
  });
}

export function resolveLearningActionPlacement(
  tree: NodeTree,
  selectedNodeId: string | null,
  actionId: LearningActionId,
): LearningActionPlacement | null {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return null;
  }

  const selectedNode = getNodeOrThrow(tree, selectedNodeId);

  switch (actionId) {
    case 'insert-plan-step':
      return resolvePlanStepPlacement(selectedNode);
    case 'insert-scaffold':
      return resolveScaffoldPlacement(tree, selectedNode);
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
      return resolveScaffoldTeachingPlacement(tree, selectedNode, actionId);
    case 'insert-question':
      return resolveQuestionPlacement(tree, selectedNode);
    case 'insert-answer':
      return resolveAnswerPlacement(tree, selectedNode);
    case 'insert-summary':
      return resolveSummaryPlacement(tree, selectedNode);
    case 'insert-judgment':
      return resolveJudgmentPlacement(tree, selectedNode);
    case 'insert-resource-fragment':
      return resolveResourceFragmentPlacement(selectedNode);
  }
}

function getCandidateActionIds(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionId[] {
  switch (selectedNode.type) {
    case 'module':
      return ['insert-plan-step'];
    case 'plan-step':
      return ['insert-scaffold', 'insert-question'];
    case 'question':
      return [
        'insert-answer',
        'insert-question',
        'insert-summary',
        'insert-judgment',
      ];
    case 'answer':
      return ['insert-answer', 'insert-summary', 'insert-judgment'];
    case 'summary':
      return isScaffoldSummaryNode(tree, selectedNode)
        ? [
            'rephrase-scaffold',
            'simplify-scaffold',
            'add-example',
            'insert-question',
            'insert-scaffold',
          ]
        : ['insert-answer', 'insert-summary', 'insert-judgment'];
    case 'judgment':
      return ['insert-answer', 'insert-summary', 'insert-judgment'];
    case 'resource':
    case 'resource-fragment':
      return ['insert-resource-fragment'];
    case 'theme-root':
      return [];
  }
}

function resolvePlanStepPlacement(selectedNode: TreeNode): LearningActionPlacement | null {
  if (selectedNode.type !== 'module') {
    return null;
  }

  return {
    insertIndex: selectedNode.childIds.length,
    nodeType: 'plan-step',
    parentNodeId: selectedNode.id,
    title: '新学习步骤',
  };
}

function resolveScaffoldPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionPlacement | null {
  if (selectedNode.type === 'plan-step') {
    return {
      insertIndex: getLeadingScaffoldInsertIndex(tree, selectedNode),
      nodeType: 'summary',
      parentNodeId: selectedNode.id,
      title: '新铺垫',
    };
  }

  if (!isScaffoldSummaryNode(tree, selectedNode) || selectedNode.parentId === null) {
    return null;
  }

  return {
    insertIndex: selectedNode.order + 1,
    nodeType: 'summary',
    parentNodeId: selectedNode.parentId,
    title: '新铺垫',
  };
}

function resolveQuestionPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionPlacement | null {
  if (selectedNode.type === 'question' && selectedNode.parentId !== null) {
    return {
      insertIndex: selectedNode.order + 1,
      nodeType: 'question',
      parentNodeId: selectedNode.parentId,
      title: '新问题',
    };
  }

  if (selectedNode.type === 'plan-step') {
    return {
      insertIndex: getQuestionBlockInsertIndex(tree, selectedNode),
      nodeType: 'question',
      parentNodeId: selectedNode.id,
      title: '新问题',
    };
  }

  if (!isScaffoldSummaryNode(tree, selectedNode) || selectedNode.parentId === null) {
    return null;
  }

  return {
    insertIndex: selectedNode.order + 1,
    nodeType: 'question',
    parentNodeId: selectedNode.parentId,
    title: '新问题',
  };
}

function resolveScaffoldTeachingPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
  actionId: Extract<
    LearningActionId,
    'rephrase-scaffold' | 'simplify-scaffold' | 'add-example'
  >,
): LearningActionPlacement | null {
  if (!isScaffoldSummaryNode(tree, selectedNode) || selectedNode.parentId === null) {
    return null;
  }

  return {
    insertIndex: selectedNode.order + 1,
    nodeType: 'summary',
    parentNodeId: selectedNode.parentId,
    title: getScaffoldTeachingTitle(actionId),
  };
}

function resolveAnswerPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionPlacement | null {
  const questionNode = getQuestionContextNode(tree, selectedNode);

  if (!questionNode) {
    return null;
  }

  return {
    insertIndex:
      selectedNode.type === 'answer'
        ? selectedNode.order + 1
        : getAnswerInsertIndex(tree, questionNode),
    nodeType: 'answer',
    parentNodeId: questionNode.id,
    title: '新回答',
  };
}

function resolveSummaryPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionPlacement | null {
  const questionNode = getQuestionContextNode(tree, selectedNode);

  if (!questionNode) {
    return null;
  }

  return {
    insertIndex: getQuestionClosureTailInsertIndex(questionNode),
    nodeType: 'summary',
    parentNodeId: questionNode.id,
    title: '新总结',
  };
}

function resolveJudgmentPlacement(
  tree: NodeTree,
  selectedNode: TreeNode,
): LearningActionPlacement | null {
  const questionNode = getQuestionContextNode(tree, selectedNode);

  if (!questionNode) {
    return null;
  }

  return {
    insertIndex:
      selectedNode.type === 'judgment'
        ? selectedNode.order + 1
        : questionNode.childIds.length,
    nodeType: 'judgment',
    parentNodeId: questionNode.id,
    title: '新判断',
  };
}

function resolveResourceFragmentPlacement(selectedNode: TreeNode): LearningActionPlacement | null {
  if (selectedNode.type === 'resource') {
    return {
      insertIndex: selectedNode.childIds.length,
      nodeType: 'resource-fragment',
      parentNodeId: selectedNode.id,
      title: '新摘录',
    };
  }

  if (selectedNode.type !== 'resource-fragment' || selectedNode.parentId === null) {
    return null;
  }

  return {
    insertIndex: selectedNode.order + 1,
    nodeType: 'resource-fragment',
    parentNodeId: selectedNode.parentId,
    title: '新摘录',
  };
}

function getQuestionContextNode(tree: NodeTree, selectedNode: TreeNode) {
  if (selectedNode.type === 'question') {
    return selectedNode;
  }

  if (selectedNode.parentId === null) {
    return null;
  }

  const parentNode = tree.nodes[selectedNode.parentId];

  return parentNode?.type === 'question' ? parentNode : null;
}

function getLeadingScaffoldInsertIndex(tree: NodeTree, planStepNode: TreeNode) {
  let insertIndex = 0;

  for (const childId of planStepNode.childIds) {
    const childNode = tree.nodes[childId];

    if (childNode?.type === 'summary' && isScaffoldSummaryNode(tree, childNode)) {
      insertIndex = childNode.order + 1;
      continue;
    }

    break;
  }

  return insertIndex;
}

function getQuestionBlockInsertIndex(tree: NodeTree, planStepNode: TreeNode) {
  let insertIndex = getLeadingScaffoldInsertIndex(tree, planStepNode);

  for (const childId of planStepNode.childIds) {
    const childNode = tree.nodes[childId];

    if (childNode?.type === 'summary' && isScaffoldSummaryNode(tree, childNode)) {
      continue;
    }

    if (childNode?.type === 'question') {
      insertIndex = childNode.order + 1;
      continue;
    }

    break;
  }

  return insertIndex;
}

function getAnswerInsertIndex(tree: NodeTree, questionNode: Extract<TreeNode, { type: 'question' }>) {
  let insertIndex = 0;

  for (const childId of questionNode.childIds) {
    const childNode = tree.nodes[childId];

    if (childNode?.type === 'question' || childNode?.type === 'answer') {
      insertIndex = childNode.order + 1;
      continue;
    }

    break;
  }

  return insertIndex;
}

function getQuestionClosureTailInsertIndex(
  questionNode: Extract<TreeNode, { type: 'question' }>,
) {
  return questionNode.childIds.length;
}

function getLearningActionLabel(actionId: LearningActionId) {
  switch (actionId) {
    case 'insert-plan-step':
      return '插入学习步骤';
    case 'insert-scaffold':
      return '插入铺垫 / 讲解';
    case 'rephrase-scaffold':
      return '换个说法解释';
    case 'simplify-scaffold':
      return '更基础一点';
    case 'add-example':
      return '举个例子';
    case 'insert-question':
      return '插入问题';
    case 'insert-answer':
      return '插入回答';
    case 'insert-summary':
      return '插入总结';
    case 'insert-judgment':
      return '插入判断';
    case 'insert-resource-fragment':
      return '插入摘录';
  }
}

function buildLearningActionHint(
  tree: NodeTree,
  selectedNode: TreeNode,
  actionId: LearningActionId,
) {
  switch (actionId) {
    case 'insert-plan-step':
      return '默认放到当前模块下。';
    case 'insert-scaffold':
      return selectedNode.type === 'plan-step'
        ? '默认放到当前步骤最前面，并排在问题前。'
        : '默认接在当前铺垫后方。';
    case 'rephrase-scaffold':
      return '沿着当前铺垫再补一版更好懂的讲解。';
    case 'simplify-scaffold':
      return '先退回更基础的直觉，再接回当前问题。';
    case 'add-example':
      return '给这段铺垫补一个更具体的例子。';
    case 'insert-question':
      if (selectedNode.type === 'question') {
        return '默认插在当前问题后方。';
      }

      return isScaffoldSummaryNode(tree, selectedNode)
        ? '默认接在这段铺垫后方。'
        : '默认接到当前步骤的问题区。';
    case 'insert-answer':
      if (selectedNode.type === 'question') {
        return '默认放到当前问题下，并排在总结 / 判断前。';
      }

      return selectedNode.type === 'answer'
        ? '默认接在当前回答后方。'
        : '默认回到当前问题的回答区。';
    case 'insert-summary':
      return selectedNode.type === 'summary'
        ? '默认接到当前问题链条尾部，不再插回中间。'
        : '默认接到当前问题链条尾部，作为这一段的收束。';
    case 'insert-judgment':
      return selectedNode.type === 'judgment'
        ? '默认接在当前判断后方。'
        : '默认放到当前问题闭环末尾。';
    case 'insert-resource-fragment':
      return selectedNode.type === 'resource'
        ? '默认放到当前资料下。'
        : '默认接在当前摘录后方。';
  }
}

function getScaffoldTeachingTitle(
  actionId: Extract<
    LearningActionId,
    'rephrase-scaffold' | 'simplify-scaffold' | 'add-example'
  >,
) {
  switch (actionId) {
    case 'rephrase-scaffold':
      return '换个说法理解';
    case 'simplify-scaffold':
      return '先用更基础的话说';
    case 'add-example':
      return '先举个具体例子';
  }
}
