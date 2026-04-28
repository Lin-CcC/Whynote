import { type ChangeEvent, type FormEvent, useState } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { NodeTree, ResourceMetadataRecord } from '../../nodeDomain';
import { autoFillResourceDraftFromUrl } from '../services/resourceAutoFillService';
import { createResourceEntry } from '../services/resourceEntryService';
import { createResourceMetadataRecord } from '../services/resourceIngestMetadataService';
import type { ResourceImportDraft } from '../services/resourceIngestTypes';
import { buildResourceDraftFromLocalFile } from '../services/resourceLocalFileService';
import LocalBatchImportPanel from './LocalBatchImportPanel';

type ResourceEntryPanelProps = {
  activeResourceNodeId?: string | null;
  onApplyTreeChange: (nextTree: NodeTree) => void;
  onFocusResourceNode: (nodeId: string) => void;
  onUpsertResourceMetadata: (record: ResourceMetadataRecord) => Promise<void>;
  tree: NodeTree;
  workspaceId: string;
};

type SubmissionFeedback =
  | {
      message: string;
      tone: 'error' | 'success';
    }
  | null;

const BROWSER_LIMITED_URL_AUTO_FILL_HELP_TEXT =
  'URL 自动补全目前只是浏览器内的受限尝试：只对少数允许浏览器直接读取的网页可用，很多第三方站点会被 CORS 或访问策略拦住。失败不代表链接无效，你仍可继续手动补标题和资料概况。';

export default function ResourceEntryPanel({
  activeResourceNodeId: _activeResourceNodeId,
  onApplyTreeChange,
  onFocusResourceNode,
  onUpsertResourceMetadata,
  tree,
  workspaceId,
}: ResourceEntryPanelProps) {
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceSource, setResourceSource] = useState('');
  const [resourceContent, setResourceContent] = useState('');
  const [preparedDraft, setPreparedDraft] = useState<ResourceImportDraft | null>(
    null,
  );
  const [isResourceAutoFillRunning, setIsResourceAutoFillRunning] = useState(false);
  const [isLocalFileImportRunning, setIsLocalFileImportRunning] = useState(false);
  const [feedback, setFeedback] = useState<SubmissionFeedback>(null);

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">资料入口</p>
          <h2 className="workspace-sectionTitle">资料入口</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        {BROWSER_LIMITED_URL_AUTO_FILL_HELP_TEXT}
        同时保留单份资料录入，并把本地资料入口升级为可预览、可过滤的批量导入。
      </p>
      <form className="resources-entryLayout" onSubmit={handleCreateResource}>
        <div className="resources-entrySection">
          <h3 className="workspace-splitTitle">新建单份资料</h3>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">资料标题</span>
            <input
              aria-label="资料标题"
              className="resources-panelInput"
              onChange={handleResourceTitleChange}
              placeholder="例如：React useState 官方文档"
              value={resourceTitle}
            />
          </label>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">来源 URL / 说明</span>
            <input
              aria-label="资料来源 URI 或说明"
              className="resources-panelInput"
              onChange={handleResourceSourceChange}
              placeholder="例如：https://react.dev/... 或会议纪要 / 纸质书摘"
              value={resourceSource}
            />
          </label>
          <div className="resources-entryActionRow">
            <button
              className="resources-entryButton"
              disabled={isLocalFileImportRunning || isResourceAutoFillRunning}
              onClick={() => {
                void handleAutoFillResourceDraft();
              }}
              type="button"
            >
              {isResourceAutoFillRunning
                ? '尝试读取中…'
                : '尝试自动补全（浏览器受限）'}
            </button>
          </div>
          <p className="workspace-helpText">
            这不是通用网页抓取器。浏览器只能尝试读取当前明确允许直接访问的 URL。
          </p>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">本地资料文件（单份预填）</span>
            <input
              accept=".txt,.md,text/plain,text/markdown,text/x-markdown"
              aria-label="本地资料文件"
              className="resources-panelInput resources-fileInput"
              disabled={isLocalFileImportRunning || isResourceAutoFillRunning}
              onChange={(event) => {
                void handleLocalFileImport(event);
              }}
              type="file"
            />
          </label>
          <p className="workspace-helpText">
            单文件预填继续保留：优先支持 `.txt` / `.md`，不会在这轮扩展到 PDF / DOCX。
          </p>
          <label className="resources-panelField">
            <span className="resources-panelFieldLabel">资料概况</span>
            <textarea
              aria-label="资料概况"
              className="resources-panelInput resources-panelTextarea"
              onChange={handleResourceContentChange}
              placeholder="用几句话记录这份资料讲什么、适合在什么问题下被引用。"
              value={resourceContent}
            />
          </label>
          <button
            className="resources-entryButton"
            disabled={isLocalFileImportRunning || isResourceAutoFillRunning}
            type="submit"
          >
            创建资料
          </button>
        </div>
        <LocalBatchImportPanel
          onApplyTreeChange={onApplyTreeChange}
          onFocusResourceNode={onFocusResourceNode}
          onUpsertResourceMetadata={onUpsertResourceMetadata}
          tree={tree}
          workspaceId={workspaceId}
        />
      </form>
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

  function handleResourceTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setResourceTitle(event.target.value);
  }

  function handleResourceSourceChange(event: ChangeEvent<HTMLInputElement>) {
    setResourceSource(event.target.value);
  }

  function handleResourceContentChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setResourceContent(event.target.value);
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const sourceDraft = preparedDraft;
      const result = createResourceEntry(tree, {
        content: resourceContent,
        mimeType: sourceDraft?.ingest.mimeType,
        sourceUri: resourceSource,
        title: resourceTitle,
      });
      const metadataRecord = createResourceMetadataRecord({
        draft: sourceDraft,
        resourceNode: result.resourceNode,
        submittedContent: resourceContent,
        submittedSourceUri: resourceSource,
        submittedTitle: resourceTitle,
        workspaceId,
      });

      await onUpsertResourceMetadata(metadataRecord);
      onApplyTreeChange(result.tree);
      onFocusResourceNode(result.resourceNode.id);
      resetForm();
      setFeedback({
        message: `已创建资料《${result.resourceNode.title}》，资料区、搜索、定位和导出会立刻使用它。`,
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

  async function handleAutoFillResourceDraft() {
    setIsResourceAutoFillRunning(true);

    try {
      const draft = await autoFillResourceDraftFromUrl({
        sourceUrl: resourceSource,
      });

      applyPreparedDraft(draft);
      setFeedback({
        message:
          '当前链接允许浏览器直接读取，已预填资料标题和概况；创建时会一并保存可供后续引用的正文基础。',
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '受限自动补全未完成，请直接手动填写标题和资料概况。',
        tone: 'error',
      });
    } finally {
      setIsResourceAutoFillRunning(false);
    }
  }

  async function handleLocalFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    setIsLocalFileImportRunning(true);

    try {
      const draft = await buildResourceDraftFromLocalFile(file);

      applyPreparedDraft(draft);
      setFeedback({
        message: `已从 ${file.name} 预填标题和资料概况，创建后会一并保存可供后续引用的正文基础。`,
        tone: 'success',
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '本地文件导入失败，请改用手动填写。',
        tone: 'error',
      });
    } finally {
      setIsLocalFileImportRunning(false);
    }
  }

  function applyPreparedDraft(draft: ResourceImportDraft) {
    setPreparedDraft(draft);
    setResourceTitle(draft.title);
    setResourceSource(draft.sourceUri);
    setResourceContent(draft.content);
  }

  function resetForm() {
    setPreparedDraft(null);
    setResourceTitle('');
    setResourceSource('');
    setResourceContent('');
  }
}
