import SectionCard from '../../../ui/SectionCard';
import type { TreeNode } from '../../nodeDomain';
import type { LearningActionId } from '../../workspaceEditor/workspaceEditorTypes';
import type { QuestionAnswerEvaluationTarget } from '../services/learningRuntimeContext';

type WorkspaceRuntimeActionCardProps = {
  answerExplanationNodeId: string | null;
  answerFollowUpCount: number;
  currentModule: TreeNode | null;
  evaluationTarget: QuestionAnswerEvaluationTarget | null;
  isAiRunning: boolean;
  onCreateModule: () => void;
  onEvaluateQuestionAnswer: (target: QuestionAnswerEvaluationTarget) => void;
  onGeneratePlanSteps: (moduleNodeId: string) => void;
  onRunLearningAction: (actionId: LearningActionId) => void;
  onSelectNode: (nodeId: string) => void;
  onSplitQuestion: (questionNodeId: string) => void;
  onSuggestCompletion: (planStepNodeId: string) => void;
  selectedNode: TreeNode | null;
};

export default function WorkspaceRuntimeActionCard({
  answerExplanationNodeId,
  answerFollowUpCount,
  currentModule,
  evaluationTarget,
  isAiRunning,
  onCreateModule,
  onEvaluateQuestionAnswer,
  onGeneratePlanSteps,
  onRunLearningAction,
  onSelectNode,
  onSplitQuestion,
  onSuggestCompletion,
  selectedNode,
}: WorkspaceRuntimeActionCardProps) {
  const canGeneratePlanSteps = currentModule?.type === 'module' && !isAiRunning;
  const canSplitQuestion = selectedNode?.type === 'question' && !isAiRunning;
  const canEvaluateQuestionAnswer = evaluationTarget !== null && !isAiRunning;
  const canSuggestCompletion = selectedNode?.type === 'plan-step' && !isAiRunning;
  const isAnswerRevisionContext =
    selectedNode?.type === 'answer' && canEvaluateQuestionAnswer;
  const isJudgmentRevisionContext =
    selectedNode?.type === 'judgment' && canEvaluateQuestionAnswer;
  const canReturnToAnswer =
    selectedNode?.type === 'judgment' &&
    evaluationTarget !== null &&
    !isAiRunning;
  const canViewAnswerExplanation = answerExplanationNodeId !== null && !isAiRunning;
  const sectionTitle =
    isAnswerRevisionContext || isJudgmentRevisionContext
      ? '当前回答修订'
      : '学习推进';
  const helpText = isAnswerRevisionContext
    ? '这里的主路径是继续修改当前回答，再重新评估；如果系统已经生成答案解析，也可以先对照标准理解。'
    : isJudgmentRevisionContext
      ? '当前这条 judgment 已经能收窄到对应回答，所以后续动作应继续围绕这版回答，而不是退回父 question 自己找路。'
      : '当前接的是最小学习闭环：规划步骤与铺垫讲解、拆分问题、评估回答、查看步骤完成依据。';

  function handleGeneratePlanSteps() {
    if (currentModule?.type !== 'module') {
      return;
    }

    onGeneratePlanSteps(currentModule.id);
  }

  function handleSplitQuestion() {
    if (selectedNode?.type !== 'question') {
      return;
    }

    onSplitQuestion(selectedNode.id);
  }

  function handleEvaluateQuestionAnswer() {
    if (!evaluationTarget) {
      return;
    }

    onEvaluateQuestionAnswer(evaluationTarget);
  }

  function handleViewAnswerExplanation() {
    if (!answerExplanationNodeId) {
      return;
    }

    onSelectNode(answerExplanationNodeId);
  }

  function handleSuggestCompletion() {
    if (selectedNode?.type !== 'plan-step') {
      return;
    }

    onSuggestCompletion(selectedNode.id);
  }

  function handleReturnToAnswer() {
    if (!evaluationTarget) {
      return;
    }

    onSelectNode(evaluationTarget.answerNodeId);
  }

  function handleRequestHint() {
    onRunLearningAction('insert-summary');
  }

  if (!currentModule) {
    return (
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">学习推进</p>
            <h2 className="workspace-sectionTitle">下一步动作</h2>
          </div>
        </div>
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            当前还没有可供 AI 操作的学习模块。先新建一个模块，再规划学习路径或继续后续 AI 动作。
          </p>
          <button
            className="workspace-inlineAction"
            disabled={isAiRunning}
            onClick={onCreateModule}
            type="button"
          >
            新建模块
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">学习推进</p>
          <h2 className="workspace-sectionTitle">{sectionTitle}</h2>
        </div>
      </div>
      <p className="workspace-helpText">{helpText}</p>
      {isAnswerRevisionContext ? (
        <div
          className="workspace-actionCallout"
          data-testid="answer-evaluation-callout"
        >
          <p className="workspace-kicker">围绕当前回答继续</p>
          <div className="workspace-actionGrid">
            <button
              className="workspace-primaryAction"
              disabled={!canEvaluateQuestionAnswer}
              onClick={handleEvaluateQuestionAnswer}
              type="button"
            >
              重新评估当前回答
            </button>
            {answerExplanationNodeId ? (
              <button
                disabled={!canViewAnswerExplanation}
                onClick={handleViewAnswerExplanation}
                type="button"
              >
                查看答案解析
              </button>
            ) : null}
          </div>
          <p className="workspace-actionHint">
            {answerFollowUpCount > 0
              ? `已生成 ${String(answerFollowUpCount)} 个追问，但它们现在只作为次级推进，不会抢走当前回答。`
              : '默认主路径会留在当前回答上，方便你继续修改后再重新评估。'}
          </p>
        </div>
      ) : null}
      {isJudgmentRevisionContext ? (
        <div
          className="workspace-actionCallout"
          data-testid="judgment-inline-actions"
        >
          <p className="workspace-kicker">围绕当前回答继续</p>
          <div className="workspace-actionGrid">
            <button
              disabled={isAiRunning}
              onClick={handleRequestHint}
              type="button"
            >
              给我提示
            </button>
            {answerExplanationNodeId ? (
              <button
                disabled={!canViewAnswerExplanation}
                onClick={handleViewAnswerExplanation}
                type="button"
              >
                查看答案解析
              </button>
            ) : null}
            <button
              disabled={!canReturnToAnswer}
              onClick={handleReturnToAnswer}
              type="button"
            >
              回到当前回答继续修改
            </button>
          </div>
          <p className="workspace-actionHint">
            judgment 已经定位到对应回答，这里应该直接给出下一步，而不是让你退回父
            question 自己找路。
          </p>
        </div>
      ) : null}
      <div className="workspace-actionGrid">
        <button
          disabled={!canGeneratePlanSteps}
          onClick={handleGeneratePlanSteps}
          type="button"
        >
          为当前模块规划学习路径
        </button>
        <button
          disabled={!canSplitQuestion}
          onClick={handleSplitQuestion}
          type="button"
        >
          拆分当前问题
        </button>
        {!isAnswerRevisionContext ? (
          <button
            disabled={!canEvaluateQuestionAnswer}
            onClick={handleEvaluateQuestionAnswer}
            type="button"
          >
            重新评估当前回答
          </button>
        ) : null}
        <button
          disabled={!canSuggestCompletion}
          onClick={handleSuggestCompletion}
          type="button"
        >
          查看当前步骤完成依据
        </button>
      </div>
    </SectionCard>
  );
}
