import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';

import SectionCard from '../../../ui/SectionCard';
import {
  getNodeOrThrow,
  isScaffoldSummaryNode,
  type CitationPurpose,
  type NodeTree,
  type ResourceMetadataRecord,
  type ResourceNode,
  type TreeNode,
} from '../../nodeDomain';
import {
  attachResourceCitation,
  isLearningCitationSourceNode,
} from '../services/resourceCitationService';
import { buildResourceDeleteImpact } from '../services/resourceDeleteService';
import { createResourceFragmentEntry } from '../services/resourceEntryService';
import ResourceDeleteConfirmPanel from './ResourceDeleteConfirmPanel';
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
  onCancelDeleteNode: () => void;
  onClearResourceFocus?: () => void;
  onConfirmDeleteNode: () => void;
  onFocusResourceNode: (nodeId: string) => void;
  onRequestDeleteNode: (nodeId: string) => void;
  pendingDeleteNodeId: string | null;
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

const CITATION_PURPOSE_OPTIONS: Array<{
  description: string;
  label: string;
  value: CitationPurpose;
}> = [
  {
    value: 'definition',
    label: '概念定义',
    description: '这里是在定义概念或术语。',
  },
  {
    value: 'mechanism',
    label: '机制说明',
    description: '这里是在解释为什么会这样运作。',
  },
  {
    value: 'behavior',
    label: '行为解释',
    description: '这里是在解释代码或规则会产生什么行为。',
  },
  {
    value: 'example',
    label: '例子来源',
    description: '这里是在说明这个例子借自资料里的哪一段。',
  },
  {
    value: 'judgment',
    label: '支撑判断',
    description: '这里是在支撑当前判断或指出用户遗漏。',
  },
  {
    value: 'background',
    label: '补背景说明',
    description: '这里是在补必要背景，帮助用户理解上下文。',
  },
];

export default function ResourceFocusPanel({
  activeResourceNodeId,
  currentModuleTitle,
  onApplyTreeChange,
  onCancelDeleteNode,
  onClearResourceFocus,
  onConfirmDeleteNode,
  onFocusResourceNode,
  onRequestDeleteNode,
  pendingDeleteNodeId,
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
  const [citationFocusText, setCitationFocusText] = useState('');
  const [citationPurpose, setCitationPurpose] =
    useState<CitationPurpose>('mechanism');
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

    const selectedNode =
      selectedEditorNodeId && tree.nodes[selectedEditorNodeId]
        ? getNodeOrThrow(tree, selectedEditorNodeId)
        : null;

    if (selectedNode && isTeachingCitationNode(selectedNode)) {
      setCitationFocusText(buildDefaultCitationFocusText(selectedNode));
      setCitationPurpose(getDefaultCitationPurpose(tree, selectedNode));
      return;
    }

    setCitationFocusText('');
    setCitationPurpose('mechanism');
  }, [activeResourceNode?.id, selectedEditorNodeId, tree]);

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
  const captureTeachingCitation =
    editorNode && isTeachingCitationNode(editorNode);
  const deleteImpact =
    pendingDeleteNodeId === resourceNode.id
      ? buildResourceDeleteImpact(tree, resourceNode.id)
      : null;
  const currentModuleLabel = currentModuleTitle ?? '未选中模块';
  const editorFocusLabel = editorNode
    ? formatNodeLabel(tree, editorNode)
    : '当前没有编辑焦点';

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
            回到编辑焦点
          </button>
        ) : null}
      </div>
      <p className="workspace-helpText">
        资料焦点是独立通道，不会覆盖当前模块内的编辑选区。
      </p>
      {resourceNode.type === 'resource' ? (
        <p className="workspace-helpText">
          这里会同时保留资料概况和正文基础。资料概况只负责说明“这份资料大概讲什么”，不会自动当成引用正文。
        </p>
      ) : null}
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
          <>
            <div>
              <dt>资料概况</dt>
              <dd>{resourceNode.content || '暂无资料概况'}</dd>
            </div>
            {activeResourceMetadata?.bodyText ? (
              <div>
                <dt>正文基础预览</dt>
                <dd>{buildBodyFoundationPreview(activeResourceMetadata.bodyText)}</dd>
              </div>
            ) : null}
          </>
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
          <dd className="workspace-inspectorClamp" title={currentModuleLabel}>
            {currentModuleLabel}
          </dd>
        </div>
        <div>
          <dt>模块内编辑焦点</dt>
          <dd className="workspace-inspectorClamp" title={editorFocusLabel}>
            {editorFocusLabel}
          </dd>
        </div>
      </dl>

      <div className="resources-entrySection">
        <h3 className="workspace-splitTitle">资源动作</h3>
        <p className="workspace-helpText">
          当前资源区把常用动作收成“定位 / 补摘录 / 引用 / 删除”这条短路径。删除不会直接执行，必须先看影响确认。
        </p>
        <div className="resources-entryActionRow">
          {resourceNode.type === 'resource-fragment' && targetResourceNode ? (
            <button
              className="resources-inlineButton"
              onClick={() => onFocusResourceNode(targetResourceNode.id)}
              type="button"
            >
              定位父资料
            </button>
          ) : null}
          <button
            className="resources-inlineButton"
            onClick={() => onRequestDeleteNode(resourceNode.id)}
            type="button"
          >
            {resourceNode.type === 'resource' ? '删除资料' : '删除摘录'}
          </button>
        </div>
        {deleteImpact ? (
          <ResourceDeleteConfirmPanel
            impact={deleteImpact}
            onCancel={onCancelDeleteNode}
            onConfirm={onConfirmDeleteNode}
          />
        ) : null}
      </div>

      <form className="resources-entrySection" onSubmit={handleCreateFragment}>
        <h3 className="workspace-splitTitle">补充摘录</h3>
        {!targetResourceNode ? (
          <p className="workspace-helpText">
            当前资料焦点缺少稳定父资料，暂时无法补充摘录。
          </p>
        ) : (
          <>
            <p className="workspace-helpText">
              “新建摘录”已经降为补充动作，这里只负责给当前资料补一个可稳定回跳的片段。
            </p>
            <p className="workspace-helpText">
              当前挂载资料：{formatNodeLabel(tree, targetResourceNode)}
            </p>
            {resourceNode.type === 'resource-fragment' ? (
              <p className="workspace-helpText">
                当前焦点已经是摘录，新补的摘录会继续挂在父资料《
                {targetResourceNode.title}》下面。
              </p>
            ) : null}
            <label className="resources-panelField">
              <span className="resources-panelFieldLabel">摘录标题</span>
              <input
                aria-label="摘录标题"
                className="resources-panelInput"
                onChange={handleFragmentTitleChange}
                placeholder="例如：状态快照摘录"
                value={fragmentTitle}
              />
            </label>
            <label className="resources-panelField">
              <span className="resources-panelFieldLabel">摘录正文</span>
              <textarea
                aria-label="摘录正文"
                className="resources-panelInput resources-panelTextarea"
                onChange={handleFragmentExcerptChange}
                placeholder="记录后续会被稳定引用的原文或代码片段。"
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
            <p className="workspace-helpText">
              这一步不会把页面变成参考文献列表；只会记录当前解释里确实需要资料支撑的那一段。
            </p>
            {captureTeachingCitation ? (
              <>
                <label className="resources-panelField">
                  <span className="resources-panelFieldLabel">对应解释片段</span>
                  <textarea
                    aria-label="对应解释片段"
                    className="resources-panelInput resources-panelTextarea"
                    onChange={handleCitationFocusTextChange}
                    placeholder="写清当前哪一句或哪一段解释在用这份资料。"
                    value={citationFocusText}
                  />
                </label>
                <label className="resources-panelField">
                  <span className="resources-panelFieldLabel">引用用途</span>
                  <select
                    aria-label="引用用途"
                    className="resources-panelInput resources-panelSelect"
                    onChange={handleCitationPurposeChange}
                    value={citationPurpose}
                  >
                    {CITATION_PURPOSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="workspace-helpText">
                  {getCitationPurposeDescription(citationPurpose)}
                </p>
              </>
            ) : null}
            {resourceNode.type === 'resource' ? (
              <>
                <p className="workspace-helpText">
                  资料卡里的“资料概况”只用于帮助判断这份资料讲什么，不会自动当成引用正文。真正的引用依据优先来自摘录、正文片段或定位信息。
                </p>
                <p className="workspace-helpText">
                  如果你能给出稳定片段，系统会先尝试复用这份资料下已有的
                  fragment；如果无法可靠命中，就退回为 resource
                  级引用，但仍会保留你填的原文片段和定位提示。
                </p>
                {captureTeachingCitation ? (
                  <p className="workspace-helpText">
                    当前是教学引用。为了让引用块稳定回答“这段解释依据资料里的哪一部分”，至少填写引用片段正文或定位信息；否则这条引用只会停留在资料级粗引用。
                  </p>
                ) : null}
                <label className="resources-panelField">
                  <span className="resources-panelFieldLabel">引用片段正文</span>
                  <textarea
                    aria-label="引用片段正文"
                    className="resources-panelInput resources-panelTextarea"
                    onChange={handleCitationExcerptChange}
                    placeholder="尽量填写当前解释真正依据的那一段原文或代码。"
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

  function handleCitationFocusTextChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setCitationFocusText(event.target.value);
  }

  function handleCitationPurposeChange(event: ChangeEvent<HTMLSelectElement>) {
    setCitationPurpose(event.target.value as CitationPurpose);
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

    if (
      captureTeachingCitation &&
      resourceNode.type === 'resource' &&
      !citationExcerpt.trim() &&
      !citationLocator.trim()
    ) {
      setCitationFeedback({
        message:
          '教学引用需要落到具体资料片段。请填写“引用片段正文”或“引用片段定位信息”，或先在资料区定位到一个摘录再引用。',
        tone: 'error',
      });
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
        referenceDraft: buildReferenceDraft(editorNode, {
          focusText: citationFocusText,
          purpose: citationPurpose,
        }),
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

function buildReferenceDraft(
  editorNode: Extract<TreeNode, { type: 'question' | 'answer' | 'summary' | 'judgment' }>,
  draft: {
    focusText: string;
    purpose: CitationPurpose;
  },
) {
  if (!isTeachingCitationNode(editorNode)) {
    return undefined;
  }

  const normalizedFocusText =
    draft.focusText.trim() || buildDefaultCitationFocusText(editorNode);

  return {
    focusText: normalizedFocusText,
    note: getCitationPurposeDescription(draft.purpose),
    purpose: draft.purpose,
  };
}

function isTeachingCitationNode(
  node: TreeNode | null | undefined,
): node is Extract<TreeNode, { type: 'summary' | 'judgment' }> {
  return node?.type === 'summary' || node?.type === 'judgment';
}

function buildDefaultCitationFocusText(
  node: Extract<TreeNode, { type: 'summary' | 'judgment' }>,
) {
  const paragraphs = node.content
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs[0] ?? node.title.trim();
  }

  return node.title.trim();
}

function getDefaultCitationPurpose(
  tree: NodeTree,
  node: Extract<TreeNode, { type: 'summary' | 'judgment' }>,
): CitationPurpose {
  if (node.type === 'judgment') {
    return 'judgment';
  }

  if (isScaffoldSummaryNode(tree, node)) {
    return 'background';
  }

  return 'mechanism';
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
    return `当前学习节点《${sourceNodeTitle}》已经引用了${targetLabel}；如有新的解释片段或用途说明，也已同步补到原引用上。`;
  }

  switch (result.resolution) {
    case 'fragment-direct':
      return `已把当前摘录《${targetNode.title}》引用到《${sourceNodeTitle}》。`;
    case 'fragment-reused':
      return `已复用已有摘录《${targetNode.title}》，并把它引用到《${sourceNodeTitle}》。`;
    case 'fragment-created':
      return '当前工作树不允许自动创建新摘录；如果你看到了这条分支，说明实现出现了回归。';
    case 'resource':
      return attemptedFragmentResolution
        ? `没找到可稳定复用的摘录，已退回为资料级引用《${targetNode.title}》，但仍保留了本次填写的原文片段和定位提示。`
        : `已把资料《${targetNode.title}》引用到《${sourceNodeTitle}》。`;
  }
}

function getCitationPurposeDescription(purpose: CitationPurpose) {
  return (
    CITATION_PURPOSE_OPTIONS.find((option) => option.value === purpose)
      ?.description ?? '这里是在补充当前解释真正依赖的资料依据。'
  );
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

function buildBodyFoundationPreview(bodyText: string, maxLength = 240) {
  const normalizedBodyText = bodyText.replace(/\s+/gu, ' ').trim();

  if (normalizedBodyText.length <= maxLength) {
    return normalizedBodyText;
  }

  return `${normalizedBodyText.slice(0, maxLength - 1).trimEnd()}…`;
}
