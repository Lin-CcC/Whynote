import {
  addNodeReference,
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';

export const DEMO_MODULE_ID = 'module-state-rendering';
export const DEMO_SECOND_MODULE_ID = 'module-effects-flow';
export const DEMO_SELECTED_NODE_ID = 'question-batching';

const DEMO_TIMESTAMP = '2026-04-27T08:00:00.000Z';

export function createDemoWorkspaceSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'React 学习演练',
    workspaceId: 'workspace-demo',
    rootId: 'theme-react-learning',
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: DEMO_MODULE_ID,
      title: '状态与渲染',
      content: '围绕 state、props 与渲染节奏建立最小理解框架。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_MODULE_ID,
    createNode({
      type: 'plan-step',
      id: 'step-state-basics',
      title: '梳理 state / props / render 的关系',
      content: '先把最基本的数据流关系说清楚，再看更新节奏。',
      status: 'doing',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'step-state-basics',
    createNode({
      type: 'question',
      id: 'question-props-diff',
      title: 'state 和 props 有什么区别？',
      content: '重点区分所有权、修改方式与刷新触发关系。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'question-props-diff',
    createNode({
      type: 'answer',
      id: 'answer-props-diff',
      title: '回答草稿',
      content:
        'props 由父组件传入，state 由当前组件维护；二者变化都可能触发重新渲染。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'question-props-diff',
    createNode({
      type: 'summary',
      id: 'summary-props-diff',
      title: '一句话总结',
      content: '先看数据归属，再看谁有权改它。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'step-state-basics',
    createNode({
      type: 'question',
      id: DEMO_SELECTED_NODE_ID,
      title: '为什么 setState 会合并更新，它如何影响渲染？',
      content: '这是一个复合问题，后续由学习引擎拆成子问题继续编辑。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_SELECTED_NODE_ID,
    createNode({
      type: 'question',
      id: 'question-batching-1',
      title: '什么是合并更新？',
      content: '说明多次更新如何被收敛到一次提交。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_SELECTED_NODE_ID,
    createNode({
      type: 'question',
      id: 'question-batching-2',
      title: '合并更新为什么能减少重复渲染？',
      content: '补充 React 批处理带来的性能直觉。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_SELECTED_NODE_ID,
    createNode({
      type: 'judgment',
      id: 'judgment-batching',
      title: '当前掌握情况',
      content: '能复述机制，但对优先级和时序还需要更多例子。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_MODULE_ID,
    createNode({
      type: 'plan-step',
      id: 'step-render-boundary',
      title: '判断一次变更会影响哪些组件',
      content: '把渲染边界和组件拆分联系起来看。',
      status: 'todo',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'step-render-boundary',
    createNode({
      type: 'question',
      id: 'question-render-boundary',
      title: '组件拆分如何影响渲染成本？',
      content: '从数据变化路径和渲染边界两个角度回答。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'step-render-boundary',
    createNode({
      type: 'summary',
      id: 'summary-render-boundary',
      title: '步骤小结',
      content: '先明确变化来源，再决定是否需要进一步拆分组件。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: DEMO_SECOND_MODULE_ID,
      title: '副作用与数据流',
      content: '处理 effect、异步请求和状态同步的最小组合。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    DEMO_SECOND_MODULE_ID,
    createNode({
      type: 'plan-step',
      id: 'step-effects',
      title: '区分渲染逻辑与副作用',
      content: '避免把请求、订阅、同步逻辑直接塞进渲染推导。',
      status: 'todo',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'step-effects',
    createNode({
      type: 'question',
      id: 'question-effects',
      title: '什么时候应该使用 useEffect？',
      content: '只保留和外部系统同步的副作用，再区分依赖来源。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    'question-effects',
    createNode({
      type: 'answer',
      id: 'answer-effects',
      title: '回答草稿',
      content: '当组件需要和外部系统同步时才考虑 effect，例如订阅、网络或 DOM API。',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '暂不展开完整资料区，只保留引用目标示例。',
      sourceUri: 'https://react.dev',
      mimeType: 'text/html',
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }),
  );

  tree = addNodeReference(tree, {
    id: 'reference-batching-docs',
    sourceNodeId: DEMO_SELECTED_NODE_ID,
    targetNodeId: 'resource-react-docs',
    note: '后续可在资料区承接更精细的摘录定位。',
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  });

  return {
    ...snapshot,
    tree,
  };
}
