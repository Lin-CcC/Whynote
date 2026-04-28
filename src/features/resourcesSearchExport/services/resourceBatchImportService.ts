import type { ResourceImportMethod } from '../../nodeDomain';
import {
  buildResourceDraftFromLocalFile,
  getLocalFileRelativePath,
} from './resourceLocalFileService';
import type { ResourceImportDraft } from './resourceIngestTypes';

type BatchSelectionKind = 'files' | 'folder';
type BatchPreviewImportMethod = Extract<
  ResourceImportMethod,
  'local-file' | 'batch' | 'folder'
>;

export interface ResourceBatchPreviewReadyItem {
  id: string;
  draft: ResourceImportDraft;
  fileName: string;
  importMethod: BatchPreviewImportMethod;
  relativePath?: string;
  sourceLabel: string;
  status: 'ready';
}

export interface ResourceBatchPreviewSkippedItem {
  id: string;
  fileName: string;
  importMethod: BatchPreviewImportMethod;
  reason: string;
  relativePath?: string;
  sourceLabel: string;
  status: 'skipped';
}

export type ResourceBatchPreviewItem =
  | ResourceBatchPreviewReadyItem
  | ResourceBatchPreviewSkippedItem;

export interface ResourceBatchImportPreview {
  importBatchId: string;
  importMethod: BatchPreviewImportMethod;
  items: ResourceBatchPreviewItem[];
}

export async function buildResourceBatchImportPreview(
  files: Iterable<File>,
  options?: {
    importBatchId?: string;
    selection?: BatchSelectionKind;
  },
): Promise<ResourceBatchImportPreview> {
  const fileList = [...files];
  const selection = options?.selection ?? 'files';
  const importMethod = resolveImportMethod(selection, fileList.length);
  const importBatchId = options?.importBatchId ?? crypto.randomUUID();
  const items: ResourceBatchPreviewItem[] = [];

  for (const [index, file] of fileList.entries()) {
    const relativePath = getLocalFileRelativePath(file);
    const sourceLabel = relativePath ?? file.name;
    const itemId = `${importBatchId}:${String(index)}:${file.name}`;

    if (selection === 'folder' && !relativePath) {
      items.push({
        id: itemId,
        fileName: file.name,
        importMethod,
        reason:
          '当前环境没有返回目录相对路径，无法稳定执行文件夹导入，请改用多文件选择。',
        sourceLabel,
        status: 'skipped',
      });
      continue;
    }

    try {
      const draft = await buildResourceDraftFromLocalFile(file, {
        importBatchId,
        importMethod,
        sourceRelativePath: relativePath,
      });

      items.push({
        id: itemId,
        draft,
        fileName: file.name,
        importMethod,
        relativePath: relativePath ?? undefined,
        sourceLabel,
        status: 'ready',
      });
    } catch (error) {
      items.push({
        id: itemId,
        fileName: file.name,
        importMethod,
        reason:
          error instanceof Error
            ? error.message
            : '文件扫描失败，请稍后重试。',
        relativePath: relativePath ?? undefined,
        sourceLabel,
        status: 'skipped',
      });
    }
  }

  return {
    importBatchId,
    importMethod,
    items,
  };
}

export function countResourceBatchPreviewItems(
  preview: ResourceBatchImportPreview | null,
) {
  if (!preview) {
    return {
      readyCount: 0,
      skippedCount: 0,
      totalCount: 0,
    };
  }

  return preview.items.reduce(
    (counts, item) => {
      if (item.status === 'ready') {
        counts.readyCount += 1;
      } else {
        counts.skippedCount += 1;
      }

      counts.totalCount += 1;
      return counts;
    },
    {
      readyCount: 0,
      skippedCount: 0,
      totalCount: 0,
    },
  );
}

function resolveImportMethod(
  selection: BatchSelectionKind,
  fileCount: number,
): BatchPreviewImportMethod {
  if (selection === 'folder') {
    return 'folder';
  }

  return fileCount > 1 ? 'batch' : 'local-file';
}
