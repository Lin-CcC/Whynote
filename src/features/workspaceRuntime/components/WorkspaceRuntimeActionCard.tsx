import SectionCard from '../../../ui/SectionCard';
import type { TreeNode } from '../../nodeDomain';

type WorkspaceRuntimeActionCardProps = {
  currentModule: TreeNode | null;
  evaluationQuestionNodeId: string | null;
  isAiRunning: boolean;
  onCreateModule: () => void;
  onEvaluateQuestionAnswer: (questionNodeId: string) => void;
  onGeneratePlanSteps: (moduleNodeId: string) => void;
  onSplitQuestion: (questionNodeId: string) => void;
  onSuggestCompletion: (planStepNodeId: string) => void;
  selectedNode: TreeNode | null;
};

export default function WorkspaceRuntimeActionCard({
  currentModule,
  evaluationQuestionNodeId,
  isAiRunning,
  onCreateModule,
  onEvaluateQuestionAnswer,
  onGeneratePlanSteps,
  onSplitQuestion,
  onSuggestCompletion,
  selectedNode,
}: WorkspaceRuntimeActionCardProps) {
  const canGeneratePlanSteps = currentModule?.type === 'module' && !isAiRunning;
  const canSplitQuestion = selectedNode?.type === 'question' && !isAiRunning;
  const canEvaluateQuestionAnswer =
    evaluationQuestionNodeId !== null && !isAiRunning;
  const canSuggestCompletion =
    selectedNode?.type === 'plan-step' && !isAiRunning;
  const shouldHighlightAnswerEvaluation =
    selectedNode?.type === 'answer' && canEvaluateQuestionAnswer;
  const sectionTitle = shouldHighlightAnswerEvaluation
    ? '下一步：继续学习'
    : '学习推进';
  const helpText = shouldHighlightAnswerEvaluation
    ? '你已经写到回答节点了。点下面这一步，系统会检查理解、补上总结，并在需要时继续追问。'
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
    if (!evaluationQuestionNodeId) {
      return;
    }

    onEvaluateQuestionAnswer(evaluationQuestionNodeId);
  }

  function handleSuggestCompletion() {
    if (selectedNode?.type !== 'plan-step') {
      return;
    }

    onSuggestCompletion(selectedNode.id);
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
            当前还没有可供 AI 操作的学习模块。先新建一个模块，再规划学习路径或继续后续
            AI 动作。
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
      {shouldHighlightAnswerEvaluation ? (
        <div className="workspace-actionCallout" data-testid="answer-evaluation-callout">
          <p className="workspace-kicker">回答后的默认下一步</p>
          <button
            className="workspace-primaryAction"
            disabled={!canEvaluateQuestionAnswer}
            onClick={handleEvaluateQuestionAnswer}
            type="button"
          >
            继续，检查我的理解
          </button>
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
        {!shouldHighlightAnswerEvaluation ? (
          <button
            disabled={!canEvaluateQuestionAnswer}
            onClick={handleEvaluateQuestionAnswer}
            type="button"
          >
            检查我的理解
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
