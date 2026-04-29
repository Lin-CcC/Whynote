import type { MouseEvent } from 'react';

type WorkspaceRuntimeJudgmentActionsProps = {
  answerNodeId: string | null;
  hint: string;
  isBusy: boolean;
  isHintVisible: boolean;
  judgmentNodeId: string;
  onReturnToAnswer: () => void;
  onToggleHint: () => void;
  onViewSummary: () => void;
  summaryNodeId: string | null;
};

export default function WorkspaceRuntimeJudgmentActions({
  answerNodeId,
  hint,
  isBusy,
  isHintVisible,
  judgmentNodeId,
  onReturnToAnswer,
  onToggleHint,
  onViewSummary,
  summaryNodeId,
}: WorkspaceRuntimeJudgmentActionsProps) {
  const canReturnToAnswer = Boolean(answerNodeId) && !isBusy;
  const canViewSummary = Boolean(summaryNodeId) && !isBusy;
  const canToggleHint = !isBusy;

  return (
    <section
      className="workspace-judgmentActions"
      data-testid={`judgment-inline-actions-${judgmentNodeId}`}
    >
      <div className="workspace-judgmentActionsHeader">
        <p className="workspace-kicker">下一步</p>
        <p className="workspace-helpText">
          判断只诊断缺口。主动作先回到回答补这次缺口，提示和答案解析都降成辅助动作。
        </p>
      </div>
      <button
        className="workspace-primaryAction"
        disabled={!canReturnToAnswer}
        onClick={handleButtonClick(onReturnToAnswer)}
        type="button"
      >
        回到当前回答继续修改
      </button>
      <div className="workspace-nodeActionRow">
        <button
          className="workspace-nodeActionButton"
          disabled={!canToggleHint}
          onClick={handleButtonClick(onToggleHint)}
          type="button"
        >
          给我提示
        </button>
        <button
          className="workspace-nodeActionButton"
          disabled={!canViewSummary}
          onClick={handleButtonClick(onViewSummary)}
          type="button"
        >
          查看答案解析
        </button>
      </div>
      <p className="workspace-actionHint">
        {getInlineActionHint({
          answerNodeId,
          isBusy,
          summaryNodeId,
        })}
      </p>
      {isHintVisible ? (
        <div
          className="workspace-judgmentHintCallout"
          data-testid={`judgment-inline-hint-${judgmentNodeId}`}
        >
          <p className="workspace-judgmentHintTitle">提示</p>
          <p className="workspace-helpText">
            这是围绕当前缺口的微型铺垫：只补最小背景和思考抓手，不直接摊开完整答案。
          </p>
          <pre className="workspace-judgmentHintText">{hint}</pre>
        </div>
      ) : null}
    </section>
  );

  function handleButtonClick(action: () => void) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action();
    };
  }
}

function getInlineActionHint({
  answerNodeId,
  isBusy,
  summaryNodeId,
}: {
  answerNodeId: string | null;
  isBusy: boolean;
  summaryNodeId: string | null;
}) {
  if (isBusy) {
    return 'AI 正在运行，当前 judgment 的回改、提示和答案解析动作会先临时锁定。';
  }

  if (!answerNodeId) {
    return '当前还没定位到可回改的回答，所以主动作会保持禁用。';
  }

  if (!summaryNodeId) {
    return '当前还没有对应的答案解析，所以“查看答案解析”会保持禁用。';
  }

  return '提示只推一步，答案解析负责完整讲解；真正改内容时，还是先回到回答。';
}
