import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import type { NodeTree, ResourceMetadataRecord } from '../../nodeDomain';
import { createResourceMetadataRecord } from '../services/resourceIngestMetadataService';
import { createResourceEntry } from '../services/resourceEntryService';
import {
  buildResourceBatchImportPreview,
  countResourceBatchPreviewItems,
  type ResourceBatchImportPreview,
  type ResourceBatchPreviewItem,
} from '../services/resourceBatchImportService';
import {
  buildImportFeedback,
  getImportMethodLabel,
  PreviewGroup,
  ResultSummary,
  type BatchImportExecutionItem,
  type BatchImportExecutionResult,
} from './LocalBatchImportPresentation';

type LocalBatchImportPanelProps = {
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

const FOLDER_IMPORT_FALLBACK_TEXT =
  '当前环境不支持稳定的文件夹选择，首版保留了目录导入入口结构，请先使用多文件批量导入。';

export default function LocalBatchImportPanel({
  onApplyTreeChange,
  onFocusResourceNode,
  onUpsertResourceMetadata,
  tree,
  workspaceId,
}: LocalBatchImportPanelProps) {
  const [preview, setPreview] = useState<ResourceBatchImportPreview | null>(null);
  const [result, setResult] = useState<BatchImportExecutionResult | null>(null);
  const [feedback, setFeedback] = useState<SubmissionFeedback>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const canSelectFolders = supportsDirectorySelection();
  const previewCounts = countResourceBatchPreviewItems(preview);
  const isBusy = isScanning || isImporting;

  useEffect(() => {
    const input = folderInputRef.current;

    if (!input || !canSelectFolders) {
      return;
    }

    input.setAttribute('directory', '');
    input.setAttribute('webkitdirectory', '');
  }, [canSelectFolders]);

  return (
    <div className="resources-entrySection">
      <h3 className="workspace-splitTitle">批量导入本地资料</h3>
      <label className="resources-panelField">
        <span className="resources-panelFieldLabel">选择多个文件（.txt / .md）</span>
        <input
          accept=".txt,.md,text/plain,text/markdown,text/x-markdown"
          aria-label="批量导入本地文件"
          className="resources-panelInput resources-fileInput"
          disabled={isBusy}
          multiple
          onChange={(event) => {
            void handlePreviewSelection(event, 'files');
          }}
          type="file"
        />
      </label>
      <label className="resources-panelField">
        <span className="resources-panelFieldLabel">导入整个文件夹（递归）</span>
        <input
          accept=".txt,.md,text/plain,text/markdown,text/x-markdown"
          aria-label="批量导入文件夹"
          className="resources-panelInput resources-fileInput"
          disabled={!canSelectFolders || isBusy}
          multiple
          onChange={(event) => {
            void handlePreviewSelection(event, 'folder');
          }}
          ref={folderInputRef}
          type="file"
        />
      </label>
      <p className="workspace-helpText">
        {canSelectFolders
          ? '文件夹导入会递归读取浏览器返回的目录文件列表，并在正式导入前先展示预览、过滤和跳过结果。'
          : FOLDER_IMPORT_FALLBACK_TEXT}
      </p>
      {preview ? (
        <div className="resources-batchPreview" aria-label="批量导入预览">
          <div className="workspace-sectionHeader">
            <div>
              <p className="workspace-kicker">导入预览</p>
              <h4 className="workspace-sectionTitle">
                将导入 {String(previewCounts.readyCount)} 份，跳过{' '}
                {String(previewCounts.skippedCount)} 份
              </h4>
            </div>
            <span className="workspace-counter">
              {getImportMethodLabel(preview.importMethod)}
            </span>
          </div>
          <div className="resources-batchPreviewGrid">
            <PreviewGroup
              emptyStateText="当前选择里没有可导入文件。"
              items={preview.items.filter(
                (item): item is Extract<ResourceBatchPreviewItem, { status: 'ready' }> =>
                  item.status === 'ready',
              )}
              title="将导入"
            />
            <PreviewGroup
              emptyStateText="当前没有要跳过的文件。"
              items={preview.items.filter(
                (item): item is Extract<ResourceBatchPreviewItem, { status: 'skipped' }> =>
                  item.status === 'skipped',
              )}
              title="将跳过"
            />
          </div>
          <div className="resources-entryActionRow">
            <button
              className="resources-entryButton"
              disabled={isBusy || previewCounts.readyCount === 0}
              onClick={() => {
                void handleImportPreview();
              }}
              type="button"
            >
              {isImporting
                ? '正在导入…'
                : `导入 ${String(previewCounts.readyCount)} 份资料`}
            </button>
            <button
              className="resources-inlineButton"
              disabled={isBusy}
              onClick={handleClearPreview}
              type="button"
            >
              清除预览
            </button>
          </div>
        </div>
      ) : null}
      {result ? <ResultSummary result={result} /> : null}
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
    </div>
  );

  async function handlePreviewSelection(
    event: ChangeEvent<HTMLInputElement>,
    selection: 'files' | 'folder',
  ) {
    const files = event.target.files ? [...event.target.files] : [];

    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setIsScanning(true);
    setFeedback(null);
    setResult(null);

    try {
      const nextPreview = await buildResourceBatchImportPreview(files, {
        selection,
      });

      setPreview(nextPreview);
      const counts = countResourceBatchPreviewItems(nextPreview);
      setFeedback({
        message:
          counts.readyCount > 0
            ? `已完成导入预览：将导入 ${String(counts.readyCount)} 份，跳过 ${String(counts.skippedCount)} 份。`
            : `当前选择没有可导入文件，共跳过 ${String(counts.skippedCount)} 份。`,
        tone: counts.readyCount > 0 ? 'success' : 'error',
      });
    } catch (error) {
      setPreview(null);
      setFeedback({
        message:
          error instanceof Error ? error.message : '批量文件扫描失败，请稍后重试。',
        tone: 'error',
      });
    } finally {
      setIsScanning(false);
    }
  }

  async function handleImportPreview() {
    if (!preview) {
      return;
    }

    setIsImporting(true);
    setFeedback(null);

    try {
      let nextTree = tree;
      let lastImportedNodeId: string | null = null;
      const imported: BatchImportExecutionItem[] = [];
      const failed: BatchImportExecutionItem[] = [];
      const skipped = preview.items
        .filter(
          (item): item is Extract<ResourceBatchPreviewItem, { status: 'skipped' }> =>
            item.status === 'skipped',
        )
        .map((item) => ({
          fileName: item.fileName,
          reason: item.reason,
          sourceLabel: item.sourceLabel,
        }));

      for (const item of preview.items) {
        if (item.status !== 'ready') {
          continue;
        }

        try {
          const creationResult = createResourceEntry(nextTree, {
            content: item.draft.content,
            mimeType: item.draft.ingest.mimeType,
            sourceUri: item.draft.sourceUri,
            title: item.draft.title,
          });
          const metadataRecord = createResourceMetadataRecord({
            draft: item.draft,
            resourceNode: creationResult.resourceNode,
            submittedContent: item.draft.content,
            submittedSourceUri: item.draft.sourceUri,
            submittedTitle: item.draft.title,
            workspaceId,
          });

          await onUpsertResourceMetadata(metadataRecord);
          nextTree = creationResult.tree;
          lastImportedNodeId = creationResult.resourceNode.id;
          imported.push({
            fileName: item.fileName,
            sourceLabel: item.sourceLabel,
            title: creationResult.resourceNode.title,
          });
        } catch (error) {
          failed.push({
            fileName: item.fileName,
            reason:
              error instanceof Error ? error.message : '导入失败，请稍后重试。',
            sourceLabel: item.sourceLabel,
          });
        }
      }

      if (imported.length > 0) {
        onApplyTreeChange(nextTree);

        if (lastImportedNodeId) {
          onFocusResourceNode(lastImportedNodeId);
        }
      }

      const nextResult: BatchImportExecutionResult = {
        failed,
        imported,
        importBatchId: preview.importBatchId,
        importMethod: preview.importMethod,
        skipped,
      };

      setPreview(null);
      setResult(nextResult);
      setFeedback({
        message: buildImportFeedback(nextResult),
        tone: imported.length > 0 ? 'success' : 'error',
      });
    } finally {
      setIsImporting(false);
    }
  }

  function handleClearPreview() {
    setPreview(null);
    setResult(null);
    setFeedback(null);
  }
}

function supportsDirectorySelection() {
  if (typeof document === 'undefined') {
    return false;
  }

  const input = document.createElement('input') as HTMLInputElement & {
    webkitdirectory?: boolean;
  };

  return 'webkitdirectory' in input;
}
