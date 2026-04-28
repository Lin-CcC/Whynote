import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';

import SectionCard from '../../../ui/SectionCard';
import {
  getNodeOrThrow,
  type NodeTree,
  type ResourceMetadataRecord,
  type ResourceNode,
} from '../../nodeDomain';
import {
  attachResourceCitation,
  isLearningCitationSourceNode,
} from '../services/resourceCitationService';
import { createResourceFragmentEntry } from '../services/resourceEntryService';
import {
  formatNodeLabel,
  getNodePathLabel,
  getNodeSourceSummary,
} from '../utils/resourceTreeUtils';
import { getResourceImportMethodLabel } from '../utils/resourceMetadataPresentation';

type ResourceFocusPanelProps = {
  activeResourceNodeId: string | null;
  currentModuleTitle: string | null;
  onApplyTreeChange: (nextTree: NodeTree) => void;
  onClearResourceFocus?: () => void;
  onFocusResourceNode: (nodeId: string) => void;
  resourceMetadataByNodeId: Record<string, ResourceMetadataRecord>;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
};

type SubmissionFeedback =
  | {
      message: string;
      tone: 'error' | 'success';
    }
  | null;

export default function ResourceFocusPanel({
  activeResourceNodeId,
  currentModuleTitle,
  onApplyTreeChange,
  onClearResourceFocus,
  onFocusResourceNode,
  resourceMetadataByNodeId,
  selectedEditorNodeId,
  tree,
}: ResourceFocusPanelProps) {
  const [fragmentTitle, setFragmentTitle] = useState('');
  const [fragmentExcerpt, setFragmentExcerpt] = useState('');
  const [fragmentLocator, setFragmentLocator] = useState('');
  const [fragmentFeedback, setFragmentFeedback] = useState<SubmissionFeedback>(
    null,
  );
  const [citationExcerpt, setCitationExcerpt] = useState('');
  const [citationLocator, setCitationLocator] = useState('');
  const [citationFeedback, setCitationFeedback] =
    useState<SubmissionFeedback>(null);
  const activeResourceNode =
    activeResourceNodeId && tree.nodes[activeResourceNodeId]
      ? tree.nodes[activeResourceNodeId]
      : null;

  useEffect(() => {
    setFragmentTitle('');
    setFragmentExcerpt('');
    setFragmentLocator('');
    setFragmentFeedback(null);
  }, [activeResourceNode?.id]);

  useEffect(() => {
    setCitationExcerpt('');
    setCitationLocator('');
    setCitationFeedback(null);
  }, [activeResourceNode?.id, selectedEditorNodeId]);

  if (
    !activeResourceNode ||
    (activeResourceNode.type !== 'resource' &&
      activeResourceNode.type !== 'resource-fragment')
  ) {
    return null;
  }

  const resourceNode = activeResourceNode;
  const targetResourceNode = resolveTargetResourceNode(tree, resourceNode);
  const editorNode =
    selectedEditorNodeId && tree.nodes[selectedEditorNodeId]
      ? getNodeOrThrow(tree, selectedEditorNodeId)
      : null;
  const canAttachCitation = isLearningCitationSourceNode(editorNode);
  const activeResourceMetadata = resourceMetadataByNodeId[resourceNode.id] ?? null;
  const targetResourceMetadata = targetResourceNode
    ? resourceMetadataByNodeId[targetResourceNode.id] ?? null
    : null;
  const provenanceMetadata =
    resourceNode.type === 'resource'
      ? activeResourceMetadata
      : targetResourceMetadata;

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">资料定位</p>
          <h2 className="workspace-sectionTitle">当前资料焦点</h2>
        </div>
        {onClearResourceFocus ? (
          <button
            className="resources-inlineButton"
            onClick={onClearResourceFocus}
            type="button"
          >
            返回模块编辑焦点
          </button>
        ) : null}
      </div>
      <p className="workspace-helpText">
        资料定位走独立通道，不会覆盖当前模块内 editor 选区。
      </p>
      <dl className="resources-focusList">
        <div>
          <dt>节点</dt>
          <dd>{formatNodeLabel(tree, resourceNode)}</dd>
        </div>
        <div>
          <dt>路径</dt>
          <dd>{getNodePathLabel(tree, resourceNode.id)}</dd>
        </div>
        <div>
          <dt>来源摘要</dt>
          <dd>{getNodeSourceSummary(tree, resourceNode) ?? '未提供来源信息'}</dd>
        </div>
        {resourceNode.type === 'resource-fragment' ? (
          <>
            <div>
              <dt>摘录正文</dt>
              <dd>{resourceNode.excerpt || '暂无摘录正文'}</dd>
            </div>
            <div>
              <dt>定位信息</dt>
              <dd>{resourceNode.locator ?? '未记录定位信息'}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt>资料摘要</dt>
            <dd>{resourceNode.content || '暂无资料摘要'}</dd>
          </div>
        )}
        {provenanceMetadata?.importMethod ? (
          <div>
            <dt>导入方式</dt>
            <dd>{getResourceImportMethodLabel(provenanceMetadata.importMethod)}</dd>
          </div>
        ) : null}
        {provenanceMetadata?.originalFileName ? (
          <div>
            <dt>原文件名</dt>
            <dd>{provenanceMetadata.originalFileName}</dd>
          </div>
        ) : null}
        {provenanceMetadata?.sourceRelativePath ? (
          <div>
            <dt>相对路径</dt>
            <dd>{provenanceMetadata.sourceRelativePath}</dd>
          </div>
        ) : null}
        {resourceNode.type === 'resource' && activeResourceMetadata ? (
          <>
            <div>
              <dt>标题来源</dt>
              <dd>{getResourceFieldSourceLabel(activeResourceMetadata.titleSource)}</dd>
            </div>
            <div>
              <dt>概况来源</dt>
              <dd>{getResourceFieldSourceLabel(activeResourceMetadata.summarySource)}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>当前模块</dt>
          <dd>{currentModuleTitle ?? '未选中模块'}</dd>
        </div>
        <div>
          <dt>模块内编辑焦点</dt>
          <dd>
            {editorNode ? formatNodeLabel(tree, editorNode) : '当前没有模块内焦点'}
          </dd>
        </div>
      </dl>
      <form className="resources-entrySection" onSubmit={handleCreateFragment}>
        <h3 className="workspace-splitTitle">补充摘录</h3>
        {!targetResourceNode ? (
          <p className="workspace-helpText">
            当前资料焦点缺少稳定父资料，暂时无法补充摘录。
          </p>
        ) : (
          <>
            <p className="workspace-helpText">
              “新建摘录”已从主入口下沉；这里只作为当前资料焦点的补充动作。
            </p>
            <p className="workspace-helpText">
              当前挂载资料：{formatNodeLabel(tree, targetResourceNode)}
            </p>
            {resourceNode.type === 'resource-fragment' ? (
              <p className="workspace-helpText">
                当前焦点是摘录，新补充的摘录会继续挂到父资料《{targetResourceNode.title}》下。
              </p>
            ) : null}
            <label className="resources-panelField">
              <span className="resources-panelFieldLabel">摘录标题</span>
              <input
                aria-label="摘录标题"
                className="resources-panelInput"
                onChange={handleFragmentTitleChange}
                placeholder="例如：局部状态摘录"
                value={fragmentTitle}
              />
            </label>
            <label className="resources-panelField">
              <span className="resources-panelFieldLabel">摘录正文</span>
              <textarea
                aria-label="摘录正文"
                className="resources-panelInput resources-panelTextarea"
                onChange={handleFragmentExcerptChange}
                placeholder="记录后续可直接引用的稳定正文片段。"
                value={fragmentExcerpt}
              />
            </label>
            <label className="resources-panelField">
              <span className="resources-panelFieldLabel">摘录定位信息</span>
              <input
                aria-label="摘录定位信息"
                className="resources-panelInput"
                onChange={handleFragmentLocatorChange}
                placeholder="例如：第 2 节 / Hooks FAQ > state snapshots"
                value={fragmentLocator}
              />
            </label>
            <button className="resources-entryButton" type="submit">
              为当前资料补充摘录
            </button>
          </>
        )}
      </form>
      {fragmentFeedback ? (
        <p
          aria-live="polite"
          className={
            fragmentFeedback.tone === 'error'
              ? 'workspace-errorText resources-entryFeedback'
              : 'workspace-helpText resources-entryFeedback'
          }
          role={fragmentFeedback.tone === 'error' ? 'alert' : 'status'}
        >
          {fragmentFeedback.message}
        </p>
      ) : null}
      <div className="resources-entrySection">
        <h3 className="workspace-splitTitle">引用到当前学习节点</h3>
        {!editorNode ? (
          <p className="workspace-helpText">
            先在模块编辑区选中一个学习节点，再把当前资料引用进去。
          </p>
        ) : !canAttachCitation ? (
          <p className="workspace-helpText">
            当前焦点是 {formatNodeLabel(tree, editorNode)}。这里只对
            `question / answer / summary / judgment` 建立资料引用。
          </p>
        ) : (
          <form className="resources-entrySection" onSubmit={handleAttachCitation}>
            <p className="workspace-helpText">
              当前会把 {formatNodeLabel(tree, resourceNode)} 引到{' '}
              {formatNodeLabel(tree, editorNode)}。
            </p>
            {resourceNode.type === 'resource' ? (
              <>
                <p className="workspace-helpText">
                  如果你能给出稳定片段，系统会先尝试复用这份资料下已有的 fragment；若无法可靠命中，就退回为
                  resource 级引用，不会自动创建新的 fragment。
                </p>
                <label className="resources-panelField">
                  <span className="resources-panelFieldLabel">引用片段正文</span>
                  <textarea
                    aria-label="引用片段正文"
                    className="resources-panelInput resources-panelTextarea"
                    onChange={handleCitationExcerptChange}
                    placeholder="如果能稳定定位片段，这里填要优先复用的正文。"
                    value={citationExcerpt}
                  />
                </label>
                <label className="resources-panelField">
                  <span className="resources-panelFieldLabel">引用片段定位信息</span>
                  <input
                    aria-label="引用片段定位信息"
                    className="resources-panelInput"
                    onChange={handleCitationLocatorChange}
                    placeholder="例如：useState > batching / 第 2 章 / 第 15 页"
                    value={citationLocator}
                  />
                </label>
              </>
            ) : (
              <p className="workspace-helpText">
                当前焦点已经是 fragment，引用时会直接复用这个摘录，不再伪造新的定位。
              </p>
            )}
            <button className="resources-entryButton" type="submit">
              {resourceNode.type === 'resource-fragment'
                ? '引用当前摘录'
                : '引用当前资料'}
            </button>
          </form>
        )}
        {citationFeedback ? (
          <p
            aria-live="polite"
            className={
              citationFeedback.tone === 'error'
                ? 'workspace-errorText resources-entryFeedback'
                : 'workspace-helpText resources-entryFeedback'
            }
            role={citationFeedback.tone === 'error' ? 'alert' : 'status'}
          >
            {citationFeedback.message}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );

  function handleFragmentTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setFragmentTitle(event.target.value);
  }

  function handleFragmentExcerptChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setFragmentExcerpt(event.target.value);
  }

  function handleFragmentLocatorChange(event: ChangeEvent<HTMLInputElement>) {
    setFragmentLocator(event.target.value);
  }

  function handleCitationExcerptChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setCitationExcerpt(event.target.value);
  }

  function handleCitationLocatorChange(event: ChangeEvent<HTMLInputElement>) {
    setCitationLocator(event.target.value);
  }

  function handleCreateFragment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!targetResourceNode) {
      return;
    }

    try {
      const result = createResourceFragmentEntry(tree, {
        excerpt: fragmentExcerpt,
        locator: fragmentLocator,
        resourceNodeId: targetResourceNode.id,
        title: fragmentTitle,
      });

      onApplyTreeChange(result.tree);
      onFocusResourceNode(result.fragmentNode.id);
      setFragmentTitle('');
      setFragmentExcerpt('');
      setFragmentLocator('');
      setFragmentFeedback({
        message: `已为资料《${targetResourceNode.title}》补充摘录《${result.fragmentNode.title}》。`,
        tone: 'success',
      });
    } catch (error) {
      setFragmentFeedback({
        message:
          error instanceof Error ? error.message : '补充摘录失败，请稍后重试。',
        tone: 'error',
      });
    }
  }

  function handleAttachCitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editorNode || !isLearningCitationSourceNode(editorNode)) {
      return;
    }

    try {
      const result = attachResourceCitation(tree, {
        allowFragmentCreation: false,
        fragmentDraft:
          resourceNode.type === 'resource'
            ? {
                excerpt: citationExcerpt,
                locator: citationLocator,
              }
            : undefined,
        sourceNodeId: editorNode.id,
        targetNodeId: resourceNode.id,
      });

      if (result.tree !== tree) {
        onApplyTreeChange(result.tree);
      }

      onFocusResourceNode(result.targetNodeId);
      setCitationExcerpt('');
      setCitationLocator('');
      setCitationFeedback({
        message: buildCitationFeedbackMessage(
          result,
          editorNode.title,
          result.tree,
          resourceNode.type === 'resource'
            ? citationExcerpt.trim().length > 0 || citationLocator.trim().length > 0
            : false,
        ),
        tone: 'success',
      });
    } catch (error) {
      setCitationFeedback({
        message:
          error instanceof Error ? error.message : '资料引用失败，请稍后重试。',
        tone: 'error',
      });
    }
  }
}

function buildCitationFeedbackMessage(
  result: ReturnType<typeof attachResourceCitation>,
  sourceNodeTitle: string,
  tree: NodeTree,
  attemptedFragmentResolution: boolean,
) {
  const targetNode = getNodeOrThrow(tree, result.targetNodeId);
  const targetLabel =
    targetNode.type === 'resource-fragment'
      ? `摘录《${targetNode.title}》`
      : `资料《${targetNode.title}》`;

  if (result.referenceAlreadyExisted) {
    return `当前学习节点《${sourceNodeTitle}》已经引用了${targetLabel}，未重复创建。`;
  }

  switch (result.resolution) {
    case 'fragment-direct':
      return `已把当前摘录《${targetNode.title}》引用到《${sourceNodeTitle}》。`;
    case 'fragment-reused':
      return `已复用已有摘录《${targetNode.title}》，并把它引用到《${sourceNodeTitle}》。`;
    case 'fragment-created':
      return `当前工作树不允许自动创建新摘录；如果你看到了这条分支，说明实现出现了回归。`;
    case 'resource':
      return attemptedFragmentResolution
        ? `未找到可稳定复用的摘录，已退回为资料级引用《${targetNode.title}》。`
        : `已把资料《${targetNode.title}》引用到《${sourceNodeTitle}》。`;
  }
}

function getResourceFieldSourceLabel(source: string | null | undefined) {
  if (!source) {
    return '未记录';
  }

  if (source === 'user') {
    return '手动';
  }

  if (source === 'ai-generated') {
    return 'AI 摘要';
  }

  return '规则提取';
}

function resolveTargetResourceNode(
  tree: NodeTree,
  resourceNode:
    | ResourceNode
    | Extract<NodeTree['nodes'][string], { type: 'resource-fragment' }>,
) {
  if (resourceNode.type === 'resource') {
    return resourceNode;
  }

  const parentResourceNode = tree.nodes[resourceNode.sourceResourceId];

  return parentResourceNode?.type === 'resource' ? parentResourceNode : null;
}
