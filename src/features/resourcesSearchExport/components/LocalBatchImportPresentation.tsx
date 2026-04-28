import type {
  ResourceBatchImportPreview,
  ResourceBatchPreviewItem,
} from '../services/resourceBatchImportService';

export interface BatchImportExecutionItem {
  fileName: string;
  reason?: string;
  sourceLabel: string;
  title?: string;
}

export interface BatchImportExecutionResult {
  failed: BatchImportExecutionItem[];
  imported: BatchImportExecutionItem[];
  importBatchId: string;
  importMethod: ResourceBatchImportPreview['importMethod'];
  skipped: BatchImportExecutionItem[];
}

type PreviewGroupProps = {
  emptyStateText: string;
  items: ResourceBatchPreviewItem[];
  title: string;
};

export function PreviewGroup({
  emptyStateText,
  items,
  title,
}: PreviewGroupProps) {
  return (
    <section className="resources-batchPreviewGroup">
      <h5 className="workspace-splitTitle">{title}</h5>
      {items.length === 0 ? (
        <p className="workspace-helpText">{emptyStateText}</p>
      ) : (
        <ul className="resources-batchPreviewList">
          {items.map((item) => (
            <li className="resources-batchPreviewItem" key={item.id}>
              <strong className="resources-libraryTitle">
                {item.status === 'ready' ? item.draft.title : item.fileName}
              </strong>
              <span className="resources-librarySummary">{item.sourceLabel}</span>
              <span className="resources-libraryMeta">
                {item.status === 'ready'
                  ? '将作为独立 resource 导入'
                  : item.reason ?? '已跳过'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ResultSummary({
  result,
}: {
  result: BatchImportExecutionResult;
}) {
  return (
    <div className="resources-batchResult">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">导入结果</p>
          <h4 className="workspace-sectionTitle">
            成功 {String(result.imported.length)} 份，失败{' '}
            {String(result.failed.length)} 份，跳过{' '}
            {String(result.skipped.length)} 份
          </h4>
        </div>
        <span className="workspace-counter">
          {getImportMethodLabel(result.importMethod)}
        </span>
      </div>
      {result.failed.length > 0 ? (
        <ResultList
          items={result.failed}
          title="失败文件"
          emptyStateText="当前没有失败文件。"
        />
      ) : null}
      {result.skipped.length > 0 ? (
        <ResultList
          items={result.skipped}
          title="已跳过文件"
          emptyStateText="当前没有跳过文件。"
        />
      ) : null}
      {result.importBatchId ? (
        <p className="resources-libraryMeta">
          导入批次：<code>{result.importBatchId}</code>
        </p>
      ) : null}
    </div>
  );
}

function ResultList({
  emptyStateText,
  items,
  title,
}: {
  emptyStateText: string;
  items: BatchImportExecutionItem[];
  title: string;
}) {
  return (
    <section className="resources-batchPreviewGroup">
      <h5 className="workspace-splitTitle">{title}</h5>
      {items.length === 0 ? (
        <p className="workspace-helpText">{emptyStateText}</p>
      ) : (
        <ul className="resources-batchPreviewList">
          {items.map((item) => (
            <li
              className="resources-batchPreviewItem resources-batchPreviewItem-result"
              key={`${title}:${item.sourceLabel}`}
            >
              <strong className="resources-libraryTitle">
                {item.title ?? item.fileName}
              </strong>
              <span className="resources-librarySummary">{item.sourceLabel}</span>
              {item.reason ? (
                <span className="resources-libraryMeta">{item.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function buildImportFeedback(result: BatchImportExecutionResult) {
  if (result.imported.length === 0) {
    return `本次没有导入任何资料，失败 ${String(result.failed.length)} 份，跳过 ${String(result.skipped.length)} 份。`;
  }

  if (result.failed.length > 0 || result.skipped.length > 0) {
    return `已导入 ${String(result.imported.length)} 份资料，失败 ${String(result.failed.length)} 份，跳过 ${String(result.skipped.length)} 份。`;
  }

  return `已成功导入 ${String(result.imported.length)} 份资料。`;
}

export function getImportMethodLabel(
  importMethod: ResourceBatchImportPreview['importMethod'],
) {
  switch (importMethod) {
    case 'folder':
      return '文件夹导入';
    case 'batch':
      return '多文件导入';
    case 'local-file':
      return '单文件导入';
  }
}
