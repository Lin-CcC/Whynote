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
            <p className="workspace-kicker">运行时集成</p>
            <h2 className="workspace-sectionTitle">AI 动作入口</h2>
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
          <p className="workspace-kicker">运行时集成</p>
          <h2 className="workspace-sectionTitle">AI 动作入口</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        当前接的是最小学习闭环：规划步骤与铺垫讲解、拆分问题、评估回答、查看步骤完成依据。
      </p>
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
        <button
          disabled={!canEvaluateQuestionAnswer}
          onClick={handleEvaluateQuestionAnswer}
          type="button"
        >
          评估当前回答
        </button>
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
