import type { MouseEvent } from 'react';

type WorkspaceRuntimeJudgmentActionsProps = {
  answerNodeId: string | null;
  hint: string;
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
  isHintVisible,
  judgmentNodeId,
  onReturnToAnswer,
  onToggleHint,
  onViewSummary,
  summaryNodeId,
}: WorkspaceRuntimeJudgmentActionsProps) {
  return (
    <section
      className="workspace-judgmentActions"
      data-testid={`judgment-inline-actions-${judgmentNodeId}`}
    >
      <div className="workspace-judgmentActionsHeader">
        <p className="workspace-kicker">下一步</p>
        <p className="workspace-helpText">看完判断后，直接在这里继续。</p>
      </div>
      <div className="workspace-nodeActionRow">
        <button
          className="workspace-nodeActionButton"
          onClick={handleButtonClick(onToggleHint)}
          type="button"
        >
          给我提示
        </button>
        <button
          className="workspace-nodeActionButton"
          disabled={!summaryNodeId}
          onClick={handleButtonClick(onViewSummary)}
          type="button"
        >
          查看答案解析
        </button>
        <button
          className="workspace-nodeActionButton"
          disabled={!answerNodeId}
          onClick={handleButtonClick(onReturnToAnswer)}
          type="button"
        >
          回到当前回答继续修改
        </button>
      </div>
      {!summaryNodeId ? (
        <p className="workspace-actionHint">当前还没有对应的答案解析。</p>
      ) : null}
      {!answerNodeId ? (
        <p className="workspace-actionHint">当前还没有定位到可回写的回答节点。</p>
      ) : null}
      {isHintVisible ? (
        <div
          className="workspace-judgmentHintCallout"
          data-testid={`judgment-inline-hint-${judgmentNodeId}`}
        >
          <p className="workspace-judgmentHintTitle">提示</p>
          <p className="workspace-helpText">只补当前缺口，不要直接展开成完整答案解析。</p>
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
