type WorkspaceRuntimeJudgmentHintCalloutProps = {
  hint: string;
  judgmentNodeId: string;
};

export default function WorkspaceRuntimeJudgmentHintCallout({
  hint,
  judgmentNodeId,
}: WorkspaceRuntimeJudgmentHintCalloutProps) {
  return (
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
  );
}
