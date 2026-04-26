import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { NodeTree } from '../../nodeDomain';
import {
  createResourceEntry,
  createResourceFragmentEntry,
  listResourceOptions,
} from '../services/resourceEntryService';

type ResourceEntryPanelProps = {
  activeResourceNodeId: string | null;
  onApplyTreeChange: (nextTree: NodeTree) => void;
  onFocusResourceNode: (nodeId: string) => void;
  tree: NodeTree;
};

type SubmissionFeedback =
  | {
      message: string;
      tone: 'error' | 'success';
    }
  | null;

export default function ResourceEntryPanel({
  activeResourceNodeId,
  onApplyTreeChange,
  onFocusResourceNode,
  tree,
}: ResourceEntryPanelProps) {
  const resourceOptions = listResourceOptions(tree);
  const preferredResourceNodeId = resolvePreferredResourceNodeId(
    tree,
    activeResourceNodeId,
    resourceOptions[0]?.id ?? '',
  );
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceSource, setResourceSource] = useState('');
  const [resourceContent, setResourceContent] = useState('');
  const [fragmentResourceNodeId, setFragmentResourceNodeId] = useState(
    preferredResourceNodeId,
  );
  const [isFragmentResourceSelectionManual, setIsFragmentResourceSelectionManual] =
    useState(false);
  const [fragmentTitle, setFragmentTitle] = useState('');
  const [fragmentExcerpt, setFragmentExcerpt] = useState('');
  const [fragmentLocator, setFragmentLocator] = useState('');
  const [feedback, setFeedback] = useState<SubmissionFeedback>(null);

  useEffect(() => {
    const hasAvailableResources = resourceOptions.length > 0;
    const hasCurrentSelection = resourceOptions.some(
      (option) => option.id === fragmentResourceNodeId,
    );

    if (!hasAvailableResources) {
      if (fragmentResourceNodeId !== '') {
        setFragmentResourceNodeId('');
      }

      if (isFragmentResourceSelectionManual) {
        setIsFragmentResourceSelectionManual(false);
      }

      return;
    }

    if (!hasCurrentSelection) {
      setFragmentResourceNodeId(preferredResourceNodeId);

      if (isFragmentResourceSelectionManual) {
        setIsFragmentResourceSelectionManual(false);
      }

      return;
    }

    if (!isFragmentResourceSelectionManual) {
      setFragmentResourceNodeId(preferredResourceNodeId);
    }
  }, [
    fragmentResourceNodeId,
    isFragmentResourceSelectionManual,
    preferredResourceNodeId,
    resourceOptions,
  ]);

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">资料入口</p>
          <h2 className="workspace-sectionTitle">添加资料与摘录</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        首版先补手动录入入口，不扩展 PDF / DOC 导入、网页抓取或外部检索。
      </p>
      <div className="resources-entryLayout">
        <form className="resources-entrySection" onSubmit={handleCreateResource}>
          <h3 className="workspace-splitTitle">新建资料</h3>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">资料标题</span>
            <input
              aria-label="资料标题"
              className="resources-panelInput"
              onChange={(event) => setResourceTitle(event.target.value)}
              placeholder="例如：React useState 官方文档"
              value={resourceTitle}
            />
          </label>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">来源 URI / 说明</span>
            <input
              aria-label="资料来源 URI 或说明"
              className="resources-panelInput"
              onChange={(event) => setResourceSource(event.target.value)}
              placeholder="例如：https://react.dev/... 或会议纪要 / 纸质书摘"
              value={resourceSource}
            />
          </label>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">资料概况</span>
            <textarea
              aria-label="资料概况"
              className="resources-panelInput resources-panelTextarea"
              onChange={(event) => setResourceContent(event.target.value)}
              placeholder="用几句话记录这份资料要点、适用范围或导入说明。"
              value={resourceContent}
            />
          </label>
          <button className="resources-entryButton" type="submit">
            创建资料
          </button>
        </form>
        <form className="resources-entrySection" onSubmit={handleCreateFragment}>
          <h3 className="workspace-splitTitle">新建摘录</h3>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">所属资料</span>
            <select
              aria-label="摘录所属资料"
              className="resources-panelInput resources-panelSelect"
              disabled={resourceOptions.length === 0}
              onChange={handleFragmentResourceNodeChange}
              value={fragmentResourceNodeId}
            >
              {resourceOptions.length === 0 ? (
                <option value="">请先创建资料</option>
              ) : (
                resourceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))
              )}
            </select>
          </label>
          <p className="workspace-helpText">
            默认跟随当前资料焦点；如果你手动改了“所属资料”，后续会优先保持你的选择。
          </p>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">摘录标题</span>
            <input
              aria-label="摘录标题"
              className="resources-panelInput"
              disabled={resourceOptions.length === 0}
              onChange={(event) => setFragmentTitle(event.target.value)}
              placeholder="例如：批处理规则"
              value={fragmentTitle}
            />
          </label>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">摘录正文</span>
            <textarea
              aria-label="摘录正文"
              className="resources-panelInput resources-panelTextarea"
              disabled={resourceOptions.length === 0}
              onChange={(event) => setFragmentExcerpt(event.target.value)}
              placeholder="录入需要稳定引用的一段摘要或原文片段。"
              value={fragmentExcerpt}
            />
          </label>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">定位信息（可选）</span>
            <input
              aria-label="摘录定位信息"
              className="resources-panelInput"
              disabled={resourceOptions.length === 0}
              onChange={(event) => setFragmentLocator(event.target.value)}
              placeholder="例如：第 2 章 / 第 15 页 / useState > batching"
              value={fragmentLocator}
            />
          </label>
          <button
            className="resources-entryButton"
            disabled={resourceOptions.length === 0}
            type="submit"
          >
            创建摘录
          </button>
          {resourceOptions.length === 0 ? (
            <p className="workspace-helpText">
              当前还没有 `resource`。先创建资料，再给它补 `resource-fragment`。
            </p>
          ) : null}
        </form>
      </div>
      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.tone === 'error'
              ? 'workspace-errorText resources-entryFeedback'
              : 'workspace-helpText resources-entryFeedback'
          }
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </SectionCard>
  );

  function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const result = createResourceEntry(tree, {
        content: resourceContent,
        sourceUri: resourceSource,
        title: resourceTitle,
      });

      onApplyTreeChange(result.tree);
      onFocusResourceNode(result.resourceNode.id);
      setFragmentResourceNodeId(result.resourceNode.id);
      setIsFragmentResourceSelectionManual(false);
      setResourceTitle('');
      setResourceSource('');
      setResourceContent('');
      setFeedback({
        message: `已创建资料《${result.resourceNode.title}》，资料区、搜索和导出会立刻使用它。`,
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : '资料创建失败，请稍后重试。',
        tone: 'error',
      });
    }
  }

  function handleFragmentResourceNodeChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const nextResourceNodeId = event.currentTarget.value;

    setFragmentResourceNodeId(nextResourceNodeId);
    setIsFragmentResourceSelectionManual(
      nextResourceNodeId !== preferredResourceNodeId,
    );
  }

  function handleCreateFragment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const result = createResourceFragmentEntry(tree, {
        excerpt: fragmentExcerpt,
        locator: fragmentLocator,
        resourceNodeId: fragmentResourceNodeId,
        title: fragmentTitle,
      });

      onApplyTreeChange(result.tree);
      onFocusResourceNode(result.fragmentNode.id);
      setFragmentTitle('');
      setFragmentExcerpt('');
      setFragmentLocator('');
      setFeedback({
        message: `已在《${tree.nodes[result.fragmentNode.sourceResourceId]?.title ?? '资料'}》下创建摘录《${result.fragmentNode.title}》。`,
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : '摘录创建失败，请稍后重试。',
        tone: 'error',
      });
    }
  }
}

function resolvePreferredResourceNodeId(
  tree: NodeTree,
  activeResourceNodeId: string | null,
  fallbackResourceNodeId: string,
) {
  if (!activeResourceNodeId || !tree.nodes[activeResourceNodeId]) {
    return fallbackResourceNodeId;
  }

  const activeNode = tree.nodes[activeResourceNodeId];

  if (activeNode.type === 'resource') {
    return activeNode.id;
  }

  if (activeNode.type === 'resource-fragment') {
    return activeNode.sourceResourceId;
  }

  return fallbackResourceNodeId;
}
