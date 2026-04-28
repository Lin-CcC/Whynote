import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import {
  addNodeReference,
  createNode,
  createNodeReference,
  createWorkspaceSnapshot,
  insertChildNode,
  type NodeTree,
} from '../../nodeDomain';
import LearningCitationPanel from './LearningCitationPanel';

test('shows teaching citations at explanation-fragment granularity and expands into source details', () => {
  const onFocusResourceNode = vi.fn<(nodeId: string) => void>();

  render(
    <LearningCitationPanel
      onFocusResourceNode={onFocusResourceNode}
      selectedEditorNodeId="summary-teaching"
      tree={createTeachingCitationTree()}
    />,
  );

  expect(screen.getByText('解释片段对应的资料依据')).toBeInTheDocument();
  expect(
    screen.getByText('批处理会先收集同一轮事件里的更新，再统一提交。'),
  ).toBeInTheDocument();
  expect(screen.getByText('机制说明')).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: '展开依据' })[0]!);
  const expandedArticle = screen
    .getByRole('button', { name: '收起依据' })
    .closest('article');

  if (!expandedArticle) {
    throw new Error('Expected expanded citation article to exist.');
  }

  expect(within(expandedArticle).getByText('资料标题')).toBeInTheDocument();
  expect(
    within(expandedArticle).getAllByText('React 官方文档').length,
  ).toBeGreaterThan(0);
  expect(
    within(expandedArticle).getByText(
      'React 会把多个 state 更新批处理后再统一提交。',
    ),
  ).toBeInTheDocument();
  expect(
    within(expandedArticle).queryByText('关于 useState 批处理与事件边界的资料概况。'),
  ).not.toBeInTheDocument();
  expect(
    within(expandedArticle).getByText('useState > batching'),
  ).toBeInTheDocument();
  expect(
    within(expandedArticle).getAllByText(
      '这里在说明机制，展开后你可以直接对照资料里的原文或代码理解为什么会这样。',
    ).length,
  ).toBeGreaterThan(0);

  fireEvent.click(within(expandedArticle).getByRole('button', { name: '定位到摘录' }));

  expect(onFocusResourceNode).toHaveBeenCalledWith('fragment-batching');
});

test('keeps generic references in supplemental sources instead of turning them into teaching citation blocks', () => {
  render(
    <LearningCitationPanel
      onFocusResourceNode={() => {}}
      selectedEditorNodeId="answer-generic"
      tree={createGenericCitationTree()}
    />,
  );

  expect(screen.queryByText('解释片段对应的资料依据')).not.toBeInTheDocument();
  expect(screen.getByText('补充来源')).toBeInTheDocument();

  const supplementalSection = screen.getByText('补充来源').closest('section');

  if (!supplementalSection) {
    throw new Error('Expected supplemental citation section to exist.');
  }

  expect(within(supplementalSection).getByText('资料级引用')).toBeInTheDocument();
  expect(
    within(supplementalSection).getByText(
      '当前只记录到来源资料，尚未保存可直接展示的原文片段。',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('这是 AI 资料概况，不应出现在引用片段里。'),
  ).not.toBeInTheDocument();
});

test('keeps focus-text citations without stable anchors in supplemental sources', () => {
  render(
    <LearningCitationPanel
      onFocusResourceNode={() => {}}
      selectedEditorNodeId="summary-unanchored"
      tree={createUnanchoredTeachingCitationTree()}
    />,
  );

  expect(screen.queryByText('解释片段对应的资料依据')).not.toBeInTheDocument();
  expect(screen.getByText('补充来源')).toBeInTheDocument();
  expect(screen.getByText('资料级引用')).toBeInTheDocument();
});

test('keeps locator-only resource teaching citations honest instead of inventing an excerpt', () => {
  render(
    <LearningCitationPanel
      onFocusResourceNode={() => {}}
      selectedEditorNodeId="summary-locator-only"
      tree={createLocatorOnlyTeachingCitationTree()}
    />,
  );

  expect(screen.getByText('解释片段对应的资料依据')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开依据' }));
  const expandedArticle = screen
    .getByRole('button', { name: '收起依据' })
    .closest('article');

  if (!expandedArticle) {
    throw new Error('Expected expanded locator-only citation article to exist.');
  }

  expect(
    within(expandedArticle).getByText(
      '当前这条引用只记录了稳定定位，尚未保存可直接展示的原文片段。',
    ),
  ).toBeInTheDocument();
  expect(within(expandedArticle).getByText('useState > queueing')).toBeInTheDocument();
  expect(
    screen.queryByText('这是资源卡片摘要，不是原文引文。'),
  ).not.toBeInTheDocument();
});

function createTeachingCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Teaching citation workspace',
    workspaceId: 'workspace-teaching-citation',
    rootId: 'theme-teaching-citation',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-teaching',
      title: 'Teaching citation module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-teaching',
    createNode({
      type: 'plan-step',
      id: 'step-teaching',
      title: 'Step teaching',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-teaching',
    createNode({
      type: 'summary',
      id: 'summary-teaching',
      title: '标准理解',
      content:
        '批处理会先收集同一轮事件里的更新，再统一提交。\n\n如果忽略事件边界，就很难理解为什么这不会变成每次 setState 都立刻渲染。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-react-docs',
      title: 'React 官方文档',
      content: '关于 useState 批处理与事件边界的资料概况。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'resource-react-docs',
    createNode({
      type: 'resource-fragment',
      id: 'fragment-batching',
      title: '批处理摘录',
      excerpt: 'React 会把多个 state 更新批处理后再统一提交。',
      locator: 'useState > batching',
      sourceResourceId: 'resource-react-docs',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-teaching-fragment',
      sourceNodeId: 'summary-teaching',
      targetNodeId: 'fragment-batching',
      focusText: '批处理会先收集同一轮事件里的更新，再统一提交。',
      note: '这里在说明机制，展开后你可以直接对照资料里的原文或代码理解为什么会这样。',
      purpose: 'mechanism',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-teaching-resource',
      sourceNodeId: 'summary-teaching',
      targetNodeId: 'resource-react-docs',
      focusText:
        '如果忽略事件边界，就很难理解为什么这不会变成每次 setState 都立刻渲染。',
      note: '这里在补背景说明，展开后可以快速补齐事件边界和更新收集之间的上下文。',
      purpose: 'background',
      sourceExcerpt:
        'Updates are queued during the same event before React commits.',
      sourceLocator: 'useState > queueing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}

function createGenericCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Generic citation workspace',
    workspaceId: 'workspace-generic-citation',
    rootId: 'theme-generic-citation',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-generic',
      title: 'Generic citation module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-generic',
    createNode({
      type: 'plan-step',
      id: 'step-generic',
      title: 'Step generic',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-generic',
    createNode({
      type: 'question',
      id: 'question-generic',
      title: 'Question generic',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'question-generic',
    createNode({
      type: 'answer',
      id: 'answer-generic',
      title: 'Answer generic',
      content: '这是一个普通回答。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-generic',
      title: 'Generic resource',
      content: '这是 AI 资料概况，不应出现在引用片段里。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-generic',
      sourceNodeId: 'answer-generic',
      targetNodeId: 'resource-generic',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}

function createLocatorOnlyTeachingCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Locator-only teaching citation workspace',
    workspaceId: 'workspace-locator-only-teaching-citation',
    rootId: 'theme-locator-only-teaching-citation',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-locator-only',
      title: 'Locator-only teaching module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-locator-only',
    createNode({
      type: 'plan-step',
      id: 'step-locator-only',
      title: 'Step locator-only',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-locator-only',
    createNode({
      type: 'summary',
      id: 'summary-locator-only',
      title: '定位型讲解',
      content: '这里在解释为什么队列会在同一轮事件结束后统一提交。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-locator-only',
      title: 'Locator-only resource',
      content: '这是资源卡片摘要，不是原文引文。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-locator-only',
      sourceNodeId: 'summary-locator-only',
      targetNodeId: 'resource-locator-only',
      focusText: '这里在解释为什么队列会在同一轮事件结束后统一提交。',
      note: '这里需要让用户至少知道可以回到 queueing 那一节核对依据。',
      purpose: 'mechanism',
      sourceLocator: 'useState > queueing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}

function createUnanchoredTeachingCitationTree(): NodeTree {
  const snapshot = createWorkspaceSnapshot({
    title: 'Unanchored teaching citation workspace',
    workspaceId: 'workspace-unanchored-teaching-citation',
    rootId: 'theme-unanchored-teaching-citation',
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  });

  let tree = snapshot.tree;

  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'module',
      id: 'module-unanchored',
      title: 'Unanchored teaching citation module',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'module-unanchored',
    createNode({
      type: 'plan-step',
      id: 'step-unanchored',
      title: 'Step unanchored',
      status: 'doing',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    'step-unanchored',
    createNode({
      type: 'summary',
      id: 'summary-unanchored',
      title: '未锚定解释',
      content: '这里有一段解释，但它还没明确落到资料里的具体片段。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = insertChildNode(
    tree,
    snapshot.workspace.rootNodeId,
    createNode({
      type: 'resource',
      id: 'resource-unanchored',
      title: 'Unanchored resource',
      content: '只有资料概况，没有明确的原文片段或定位。',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );
  tree = addNodeReference(
    tree,
    createNodeReference({
      id: 'reference-unanchored',
      sourceNodeId: 'summary-unanchored',
      targetNodeId: 'resource-unanchored',
      focusText: '这里有一段解释，但它还没明确落到资料里的具体片段。',
      note: '这里本来想支撑一段解释，但还缺少稳定锚点。',
      purpose: 'background',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }),
  );

  return tree;
}
