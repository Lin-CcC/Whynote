import SectionCard from '../../../ui/SectionCard';
import type {
  ExportContentMode,
  ExportFormat,
  ExportTarget,
  SearchScope,
} from '../resourceSearchExportTypes';

type ExportPanelProps = {
  canUseExpandedContentMode: boolean;
  canExportFilteredResult: boolean;
  exportContentMode: ExportContentMode;
  exportError: string | null;
  exportFormat: ExportFormat;
  exportTarget: ExportTarget;
  includePlanSteps: boolean;
  onExportContentModeChange: (nextMode: ExportContentMode) => void;
  onExport: () => void;
  onExportFormatChange: (nextFormat: ExportFormat) => void;
  onExportTargetChange: (nextTarget: ExportTarget) => void;
  onIncludePlanStepsChange: (nextValue: boolean) => void;
  scope: SearchScope;
};

export default function ExportPanel({
  canUseExpandedContentMode,
  canExportFilteredResult,
  exportContentMode,
  exportError,
  exportFormat,
  exportTarget,
  includePlanSteps,
  onExportContentModeChange,
  onExport,
  onExportFormatChange,
  onExportTargetChange,
  onIncludePlanStepsChange,
  scope,
}: ExportPanelProps) {
  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">基础导出</p>
          <h2 className="workspace-sectionTitle">Markdown / TXT</h2>
        </div>
      </div>
      <div className="resources-exportLayout">
        <div>
          <span className="resources-panelFieldLabel">导出范围</span>
          <div className="resources-chipGroup">
            <button
              aria-pressed={exportTarget === 'current-module'}
              className="resources-tagChip"
              data-active={exportTarget === 'current-module'}
              onClick={() => onExportTargetChange('current-module')}
              type="button"
            >
              当前模块
            </button>
            <button
              aria-pressed={exportTarget === 'theme'}
              className="resources-tagChip"
              data-active={exportTarget === 'theme'}
              onClick={() => onExportTargetChange('theme')}
              type="button"
            >
              整个主题
            </button>
            <button
              aria-pressed={exportTarget === 'filtered'}
              className="resources-tagChip"
              data-active={exportTarget === 'filtered'}
              disabled={!canExportFilteredResult}
              onClick={() => onExportTargetChange('filtered')}
              type="button"
            >
              标签筛选结果
            </button>
          </div>
        </div>
        <div>
          <span className="resources-panelFieldLabel">格式</span>
          <div className="resources-chipGroup">
            <button
              aria-pressed={exportFormat === 'markdown'}
              className="resources-tagChip"
              data-active={exportFormat === 'markdown'}
              onClick={() => onExportFormatChange('markdown')}
              type="button"
            >
              Markdown
            </button>
            <button
              aria-pressed={exportFormat === 'txt'}
              className="resources-tagChip"
              data-active={exportFormat === 'txt'}
              onClick={() => onExportFormatChange('txt')}
              type="button"
            >
              TXT
            </button>
          </div>
        </div>
        <div>
          <span className="resources-panelFieldLabel">导出模式</span>
          <div className="resources-chipGroup">
            <button
              aria-pressed={exportContentMode === 'full'}
              className="resources-tagChip"
              data-active={exportContentMode === 'full'}
              onClick={() => onExportContentModeChange('full')}
              type="button"
            >
              全部内容
            </button>
            <button
              aria-pressed={exportContentMode === 'expanded-view'}
              className="resources-tagChip"
              data-active={exportContentMode === 'expanded-view'}
              disabled={!canUseExpandedContentMode}
              onClick={() => onExportContentModeChange('expanded-view')}
              type="button"
            >
              仅当前展开内容
            </button>
          </div>
        </div>
        <label className="resources-checkboxRow">
          <input
            checked={includePlanSteps}
            onChange={(event) => onIncludePlanStepsChange(event.target.checked)}
            type="checkbox"
          />
          <span>显式包含 `plan-step` 标题</span>
        </label>
        <p className="workspace-helpText">
          默认会隐藏 `plan-step` 标题，只保留其正文和子节点顺序；切到全主题时会一起导出资料树。
        </p>
        {exportTarget === 'filtered' && !canExportFilteredResult ? (
          <p className="workspace-helpText">
            {scope === 'resources'
              ? '资料区首版不支持按标签导出，请切回当前模块或全主题。'
              : '先在当前模块或全主题里选中标签并得到命中结果，才能导出筛选结果。'}
          </p>
        ) : null}
        {exportTarget === 'filtered' ? (
          <p className="workspace-helpText">
            标签筛选结果始终按全部内容导出，不读取折叠状态。
          </p>
        ) : null}
        {exportContentMode === 'expanded-view' && exportTarget !== 'filtered' ? (
          <p className="workspace-helpText">
            只裁剪学习链条里的折叠 block / 正文 / 历史区；若缺少完整 workspace 视图状态，会安全回退到完整导出。
          </p>
        ) : null}
        {exportError ? (
          <p className="workspace-errorText" role="alert">
            {exportError}
          </p>
        ) : null}
        <button className="resources-exportButton" onClick={onExport} type="button">
          导出内容
        </button>
      </div>
    </SectionCard>
  );
}
