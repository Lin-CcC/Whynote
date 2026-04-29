import SectionCard from '../../../ui/SectionCard';
import type { WorkspaceRuntimeStatusState } from '../workspaceRuntimeTypes';

type WorkspaceRuntimeStatusCardProps = WorkspaceRuntimeStatusState;

export default function WorkspaceRuntimeStatusCard({
  activeAiActionLabel,
  aiError,
  completionSuggestion,
  isAiRunning,
  isInitializing,
  loadError,
  runtimeMessage,
  saveError,
  saveStatus,
}: WorkspaceRuntimeStatusCardProps) {
  const latestResult = resolveLatestResult({
    aiError,
    completionSuggestion,
    isAiRunning,
    loadError,
    runtimeMessage,
    saveError,
    saveStatus,
  });

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">运行状态</p>
          <h2 className="workspace-sectionTitle">忙不忙 + 最近结果</h2>
        </div>
      </div>
      <dl className="workspace-inspectorList">
        <div>
          <dt>系统</dt>
          <dd>
            {getSystemStatusLabel({
              activeAiActionLabel,
              isAiRunning,
              isInitializing,
              loadError,
              saveStatus,
            })}
          </dd>
        </div>
        <div>
          <dt>最近结果</dt>
          <dd>{latestResult.label}</dd>
        </div>
      </dl>
      {isAiRunning ? (
        <p className="workspace-lockText" role="status">
          AI 正在运行，正文编辑和树操作会临时锁定，避免旧结果覆盖新修改。
        </p>
      ) : null}
      {latestResult.detail ? (
        <p
          className={
            latestResult.tone === 'error'
              ? 'workspace-errorText'
              : 'workspace-helpText'
          }
          role={latestResult.tone === 'error' ? 'alert' : 'status'}
        >
          {latestResult.detail}
        </p>
      ) : null}
    </SectionCard>
  );
}

function getSystemStatusLabel({
  activeAiActionLabel,
  isAiRunning,
  isInitializing,
  loadError,
  saveStatus,
}: {
  activeAiActionLabel: string | null;
  isAiRunning: boolean;
  isInitializing: boolean;
  loadError: string | null;
  saveStatus: WorkspaceRuntimeStatusCardProps['saveStatus'];
}) {
  if (loadError) {
    return '加载失败';
  }

  if (isInitializing) {
    return '初始化中';
  }

  if (isAiRunning) {
    return activeAiActionLabel ?? 'AI 正在运行';
  }

  switch (saveStatus) {
    case 'saving':
      return '保存中';
    case 'saved':
      return '已保存';
    case 'error':
      return '保存失败';
    case 'idle':
    default:
      return '空闲';
  }
}

function resolveLatestResult({
  aiError,
  completionSuggestion,
  isAiRunning,
  loadError,
  runtimeMessage,
  saveError,
  saveStatus,
}: Pick<
  WorkspaceRuntimeStatusCardProps,
  | 'aiError'
  | 'completionSuggestion'
  | 'isAiRunning'
  | 'loadError'
  | 'runtimeMessage'
  | 'saveError'
  | 'saveStatus'
>) {
  if (loadError) {
    return {
      detail: `工作区加载失败：${loadError}`,
      label: '工作区暂不可用',
      tone: 'error' as const,
    };
  }

  if (aiError) {
    return {
      detail: `AI 动作失败：${aiError}`,
      label: 'AI 动作失败',
      tone: 'error' as const,
    };
  }

  if (saveError) {
    return {
      detail: `工作区保存失败：${saveError}`,
      label: '自动保存失败',
      tone: 'error' as const,
    };
  }

  if (completionSuggestion) {
    return {
      detail: completionSuggestion.reasonSummary,
      label: completionSuggestion.shouldSuggestComplete
        ? '步骤可考虑完成'
        : '步骤暂不建议完成',
      tone: 'default' as const,
    };
  }

  if (runtimeMessage) {
    return {
      detail: null,
      label: runtimeMessage,
      tone: 'default' as const,
    };
  }

  if (isAiRunning) {
    return {
      detail: null,
      label: '正在处理最近一次动作',
      tone: 'default' as const,
    };
  }

  switch (saveStatus) {
    case 'saving':
      return {
        detail: null,
        label: '最近改动正在自动保存',
        tone: 'default' as const,
      };
    case 'saved':
      return {
        detail: null,
        label: '最近改动已落盘',
        tone: 'default' as const,
      };
    case 'error':
      return {
        detail: null,
        label: '最近保存未完成',
        tone: 'default' as const,
      };
    case 'idle':
    default:
      return {
        detail: null,
        label: '还没有新的动作结果',
        tone: 'default' as const,
      };
  }
}
