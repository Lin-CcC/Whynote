import {
  attachTagToNode,
  createNode,
  createTag,
  createWorkspaceSnapshot,
  insertChildNode,
  upsertTag,
  type WorkspaceSnapshot,
} from '../../nodeDomain';
import { getAnswerHistorySectionId } from '../../workspaceEditor/utils/workspaceViewState';
import { createWorkspaceExport } from './resourceExportService';

test('exports the current module to markdown and hides plan-step titles by default', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    format: 'markdown',
    includePlanSteps: false,
    target: 'current-module',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.fileName).toBe('状态与批处理.md');
  expect(result.content).toContain('# 状态与批处理');
  expect(result.content).not.toContain('步骤：先理解批处理');
  expect(result.content).toContain('## 问题：什么是批处理？');
});

test('can include plan-step titles explicitly during module export', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    format: 'markdown',
    includePlanSteps: true,
    target: 'current-module',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('## 步骤：先理解批处理（进行中）');
  expect(result.content).toContain('### 铺垫：先建立批处理直觉');
  expect(result.content).toContain('### 问题：什么是批处理？');
});

test('exports filtered theme results while preserving resource ancestors', () => {
  const snapshot = createResourcesExportSnapshot();

  const result = createWorkspaceExport({
    currentModuleId: 'module-batching',
    filterScope: 'theme',
    format: 'txt',
    includePlanSteps: false,
    selectedTagIds: ['tag-reference'],
    target: 'filtered',
    tree: snapshot.tree,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('React 学习主题');
  expect(result.content).toContain('标签筛选：待验证');
  expect(result.content).toContain('资料：React 官方文档');
  expect(result.content).toContain('摘录：批处理摘录');
  expect(result.content).not.toContain('模块：状态与批处理');
});

test('keeps the default current-module export fully intact even when workspace view state collapses content', () => {
  const snapshot = createExpandedViewExportSnapshot();

  const result = createWorkspaceExport({
    contentMode: 'full',
    currentModuleId: 'module-expanded-export',
    format: 'markdown',
    includePlanSteps: false,
    target: 'current-module',
    tree: snapshot.tree,
    uiPreferences: createExpandedViewPreferences(snapshot.workspace.id),
    workspaceId: snapshot.workspace.id,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('这段正文默认仍应导出。');
  expect(result.content).toContain('标签：折叠标签');
  expect(result.content).toContain('整块折叠问题');
  expect(result.content).toContain('旧总结检查结果');
});

test('omits collapsed blocks, collapsed bodies, and collapsed history in expanded current-module export', () => {
  const snapshot = createExpandedViewExportSnapshot();

  const result = createWorkspaceExport({
    contentMode: 'expanded-view',
    currentModuleId: 'module-expanded-export',
    format: 'markdown',
    includePlanSteps: false,
    target: 'current-module',
    tree: snapshot.tree,
    uiPreferences: createExpandedViewPreferences(snapshot.workspace.id),
    workspaceId: snapshot.workspace.id,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('当前展开问题');
  expect(result.content).toContain('折叠正文回答');
  expect(result.content).not.toContain('这段正文默认仍应导出。');
  expect(result.content).not.toContain('标签：折叠标签');
  expect(result.content).toContain('展开回答历史评估');
  expect(result.content).toContain('展开回答旧解析');
  expect(result.content).not.toContain('旧总结检查结果');
  expect(result.content).not.toContain('整块折叠问题');
  expect(result.content).not.toContain('整块折叠回答正文。');
});

test('applies expanded-view trimming to theme export while keeping the root resource tree intact', () => {
  const snapshot = createExpandedViewExportSnapshot();

  const result = createWorkspaceExport({
    contentMode: 'expanded-view',
    currentModuleId: 'module-expanded-export',
    format: 'markdown',
    includePlanSteps: false,
    target: 'theme',
    tree: snapshot.tree,
    uiPreferences: createExpandedViewPreferences(snapshot.workspace.id),
    workspaceId: snapshot.workspace.id,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('资料：全局资料');
  expect(result.content).toContain('这份资料应该在 theme 导出里保留。');
  expect(result.content).not.toContain('整块折叠问题');
  expect(result.content).not.toContain('整块折叠回答正文。');
});

test('keeps filtered export on full-content semantics even if expanded-view mode is requested', () => {
  const snapshot = createExpandedViewExportSnapshot();

  const result = createWorkspaceExport({
    contentMode: 'expanded-view',
    currentModuleId: 'module-expanded-export',
    filterScope: 'current-module',
    format: 'markdown',
    includePlanSteps: false,
    selectedTagIds: ['tag-collapsed-body'],
    target: 'filtered',
    tree: snapshot.tree,
    uiPreferences: createExpandedViewPreferences(snapshot.workspace.id),
    workspaceId: snapshot.workspace.id,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('折叠正文回答');
  expect(result.content).toContain('这段正文默认仍应导出。');
  expect(result.content).toContain('标签：折叠标签');
});

test.each([
  {
    name: 'missing workspace view state',
    uiPreferences: null,
  },
  {
    name: 'incomplete workspace view state',
    uiPreferences: {
      updatedAt: '2026-05-01T10:00:00.000Z',
      values: {
        workspaceViews: {
          'workspace-expanded-export': {
            collapsedPlanStepIds: [],
            collapsedNodeBodyIds: ['answer-collapsed-body'],
            collapsedQuestionBlockIds: ['question-collapsed-block'],
            mainViewMode: 'document',
          },
        },
      },
    },
  },
])('falls back to full export when $name', ({ uiPreferences }) => {
  const snapshot = createExpandedViewExportSnapshot();

  const result = createWorkspaceExport({
    contentMode: 'expanded-view',
    currentModuleId: 'module-expanded-export',
    format: 'markdown',
    includePlanSteps: false,
    target: 'current-module',
    tree: snapshot.tree,
    uiPreferences,
    workspaceId: snapshot.workspace.id,
    workspaceTitle: snapshot.workspace.title,
  });

  expect(result.content).toContain('这段正文默认仍应导出。');
  expect(result.content).toContain('整块折叠问题');
  expect(result.content).toContain('旧总结检查结果');
});

function createResourcesExportSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: 'React 学习主题',
    workspaceId: 'workspace-resources-export',
    rootId: 'theme-resources-export',
    createdAt: '2026-04-27T11:30:00.000Z',
    updatedAt: '2026-04-27T11:30:00.000Z',
  });
  const referenceTag = createTag('待验证', {
    id: 'tag-reference',
    createdAt: '2026-04-27T11:30:00.000Z',
    updatedAt: '2026-04-27T11:30:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-batching',
      title: '状态与批处理',
      content: '当前模块聚焦状态更新批处理。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-batching',
    createNode({
      type: 'plan-step',
      id: 'step-batching',
      title: '先理解批处理',
      content: '先看状态更新如何合并。',
      status: 'doing',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-batching',
    createNode({
      type: 'summary',
      id: 'summary-introduction',
      title: '先建立批处理直觉',
      content: '先用前置讲解建立问题背景。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-batching',
    createNode({
      type: 'question',
      id: 'question-batching',
      title: '什么是批处理？',
      content: '理解 React 为什么会批量提交 state 更新。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-batching',
    createNode({
      type: 'answer',
      id: 'answer-batching',
      title: '回答草稿',
      content: '批处理会把多次更新合并到一次提交里。',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '批处理与并发更新说明。',
      sourceUri: 'https://react.dev/reference/react/useState',
      mimeType: 'text/html',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      content: '用于解释批处理的上下文。',
      excerpt: 'React 会把多个 state 更新批量处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-27T11:30:00.000Z',
      updatedAt: '2026-04-27T11:30:00.000Z',
    }),
  );
  tree = upsertTag(tree, referenceTag);
  tree = attachTagToNode(tree, 'fragment-batching', 'tag-reference');

  return {
    ...snapshot,
    tree,
  };
}

function createExpandedViewExportSnapshot(): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot({
    title: '折叠导出主题',
    workspaceId: 'workspace-expanded-export',
    rootId: 'theme-expanded-export',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  });
  const collapsedTag = createTag('折叠标签', {
    id: 'tag-collapsed-body',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-expanded-export',
      title: '折叠导出模块',
      content: '模块正文。',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-expanded-export',
    createNode({
      type: 'plan-step',
      id: 'step-expanded-export',
      title: '折叠导出步骤',
      content: '步骤正文。',
      status: 'doing',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-expanded-export',
    createNode({
      type: 'question',
      id: 'question-expanded',
      title: '当前展开问题',
      content: '这个问题块会部分折叠导出。',
      currentAnswerId: 'answer-open',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'answer',
      id: 'answer-open',
      title: '展开回答',
      content: '这段正文会继续导出。',
      createdAt: '2026-05-01T10:01:00.000Z',
      updatedAt: '2026-05-01T10:01:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'judgment',
      id: 'judgment-open-history',
      title: '展开回答历史评估',
      content: '这段历史评估在展开历史区后应继续导出。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:02:00.000Z',
      updatedAt: '2026-05-01T10:02:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'summary',
      id: 'summary-open-history',
      title: '展开回答旧解析',
      content: '这段历史解析在展开历史区后应继续导出。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:03:00.000Z',
      updatedAt: '2026-05-01T10:03:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'judgment',
      id: 'judgment-open-latest',
      title: '展开回答最新评估',
      content: '这段最新评估应继续导出。',
      judgmentKind: 'answer-closure',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:04:00.000Z',
      updatedAt: '2026-05-01T10:04:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'summary',
      id: 'summary-open-latest',
      title: '展开回答最新解析',
      content: '这段最新解析应继续导出。',
      summaryKind: 'answer-closure',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:05:00.000Z',
      updatedAt: '2026-05-01T10:05:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'answer',
      id: 'answer-collapsed-body',
      title: '折叠正文回答',
      content: '这段正文默认仍应导出。',
      createdAt: '2026-05-01T10:06:00.000Z',
      updatedAt: '2026-05-01T10:06:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'summary',
      id: 'summary-manual',
      title: '手写总结',
      content: '这段手写总结应继续导出。',
      summaryKind: 'manual',
      createdAt: '2026-05-01T10:07:00.000Z',
      updatedAt: '2026-05-01T10:07:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-history',
      title: '旧总结检查结果',
      content: '这段历史总结检查在默认收起时不应导出。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      sourceSummaryUpdatedAt: '2026-05-01T10:07:00.000Z',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:08:00.000Z',
      updatedAt: '2026-05-01T10:08:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-expanded',
    createNode({
      type: 'judgment',
      id: 'judgment-summary-latest',
      title: '当前总结检查结果',
      content: '这段最新总结检查应继续导出。',
      judgmentKind: 'summary-check',
      sourceSummaryId: 'summary-manual',
      sourceSummaryUpdatedAt: '2026-05-01T10:07:00.000Z',
      sourceAnswerId: 'answer-open',
      sourceAnswerUpdatedAt: '2026-05-01T10:01:00.000Z',
      createdAt: '2026-05-01T10:09:00.000Z',
      updatedAt: '2026-05-01T10:09:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-expanded-export',
    createNode({
      type: 'question',
      id: 'question-collapsed-block',
      title: '整块折叠问题',
      content: '整块折叠问题正文。',
      createdAt: '2026-05-01T10:10:00.000Z',
      updatedAt: '2026-05-01T10:10:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-collapsed-block',
    createNode({
      type: 'answer',
      id: 'answer-collapsed-block',
      title: '整块折叠回答',
      content: '整块折叠回答正文。',
      createdAt: '2026-05-01T10:11:00.000Z',
      updatedAt: '2026-05-01T10:11:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-theme-root',
      title: '全局资料',
      content: '这份资料应该在 theme 导出里保留。',
      sourceUri: 'https://example.com/export',
      mimeType: 'text/html',
      createdAt: '2026-05-01T10:12:00.000Z',
      updatedAt: '2026-05-01T10:12:00.000Z',
    }),
  );

  tree = upsertTag(tree, collapsedTag);
  tree = attachTagToNode(tree, 'answer-collapsed-body', 'tag-collapsed-body');

  return {
    ...snapshot,
    tree,
  };
}

function createExpandedViewPreferences(workspaceId: string) {
  return {
    updatedAt: '2026-05-01T10:13:00.000Z',
    values: {
      workspaceViews: {
        [workspaceId]: {
          collapsedPlanStepIds: [],
          collapsedNodeBodyIds: ['answer-collapsed-body'],
          collapsedQuestionBlockIds: ['question-collapsed-block'],
          expandedHistorySectionIds: [getAnswerHistorySectionId('answer-open')],
          mainViewMode: 'document',
        },
      },
    },
  };
}
