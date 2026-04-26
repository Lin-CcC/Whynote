import {
  createNode,
  createWorkspaceSnapshot,
  insertChildNode,
  type WorkspaceSnapshot,
} from '../../nodeDomain';

export const INITIAL_WORKSPACE_TITLE = '新的学习主题';
export const INITIAL_MODULE_TITLE = '默认模块';

export function createInitialWorkspaceSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: INITIAL_WORKSPACE_TITLE,
  });

  const tree = insertChildNode(
    snapshot.tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      title: INITIAL_MODULE_TITLE,
      content: '先定义当前主题下的第一个学习方向。',
    }),
  );

  return {
    ...snapshot,
    tree,
  };
}
