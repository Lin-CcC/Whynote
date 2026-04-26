import SectionCard from '../../../ui/SectionCard';
import type { WorkspaceRuntimeStatusState } from '../workspaceRuntimeTypes';

type WorkspaceRuntimeStatusCardProps = WorkspaceRuntimeStatusState;

export default function WorkspaceRuntimeStatusCard({
  activeAiActionLabel,
  aiError,
  completionSuggestion,
  isAiRunning,
  loadError,
  runtimeMessage,
  saveError,
  saveStatus,
}: WorkspaceRuntimeStatusCardProps) {
  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">运行时状态</p>
          <h2 className="workspace-sectionTitle">工作区运行状态</h2>
        </div>
      </div>
      <dl className="workspace-inspectorList">
        <div>
          <dt>保存</dt>
          <dd>{getSaveStatusLabel(saveStatus)}</dd>
        </div>
        <div>
          <dt>AI</dt>
          <dd>{isAiRunning ? activeAiActionLabel ?? '处理中' : '空闲'}</dd>
        </div>
      </dl>
      {isAiRunning ? (
        <p className="workspace-lockText" role="status">
          AI 正在运行，文本编辑和结构操作已临时锁定，避免旧快照覆盖新修改。
        </p>
      ) : null}
      {runtimeMessage ? <p className="workspace-helpText">{runtimeMessage}</p> : null}
      {loadError ? (
        <p className="workspace-errorText" role="alert">
          工作区加载失败：{loadError}
        </p>
      ) : null}
      {saveError ? (
        <p className="workspace-errorText" role="alert">
          工作区保存失败：{saveError}
        </p>
      ) : null}
      {aiError ? (
        <p className="workspace-errorText" role="alert">
          AI 动作失败：{aiError}
        </p>
      ) : null}
      {completionSuggestion ? (
        <div className="workspace-runtimeSuggestion">
          <p className="workspace-kicker">步骤建议</p>
          <h3 className="workspace-splitTitle">
            {completionSuggestion.shouldSuggestComplete
              ? '当前步骤可以考虑标记完成'
              : '当前步骤暂不建议完成'}
          </h3>
          <p className="workspace-helpText">{completionSuggestion.reasonSummary}</p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function getSaveStatusLabel(saveStatus: WorkspaceRuntimeStatusCardProps['saveStatus']) {
  switch (saveStatus) {
    case 'saving':
      return '保存中';
    case 'saved':
      return '已保存';
    case 'error':
      return '失败';
    case 'idle':
    default:
      return '待保存';
  }
}
