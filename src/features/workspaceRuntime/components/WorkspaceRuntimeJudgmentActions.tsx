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
        <p className="workspace-helpText">
          这里先分清三件事：判断只做诊断，提示只推一步，答案解析才负责把机制讲清楚。
        </p>
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
      {summaryNodeId ? (
        <p className="workspace-actionHint">
          当前答案解析已就绪；如果你要对照更完整的标准理解，再点“查看答案解析”。
        </p>
      ) : (
        <p className="workspace-actionHint">
          当前还没有对应的答案解析，所以“查看答案解析”会保持禁用。
        </p>
      )}
      {answerNodeId ? (
        <p className="workspace-actionHint">
          已定位到当前这版回答；主路径仍然是先回去补 judgment 指出的缺口，再重新评估。
        </p>
      ) : (
        <p className="workspace-actionHint">
          当前还没有定位到可回改的回答节点，所以“回到当前回答继续修改”会保持禁用。
        </p>
      )}
      {isHintVisible ? (
        <div
          className="workspace-judgmentHintCallout"
          data-testid={`judgment-inline-hint-${judgmentNodeId}`}
        >
          <p className="workspace-judgmentHintTitle">提示</p>
          <p className="workspace-helpText">
            这是围绕当前缺口的微型铺垫：补最小背景，给继续思考的抓手，不直接摊开完整答案。
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
