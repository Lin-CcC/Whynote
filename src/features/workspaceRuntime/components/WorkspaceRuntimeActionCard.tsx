import SectionCard from '../../../ui/SectionCard';
import type { TreeNode } from '../../nodeDomain';

type WorkspaceRuntimeActionCardProps = {
  currentModule: TreeNode | null;
  isAiRunning: boolean;
  onGeneratePlanSteps: (moduleNodeId: string) => void;
  onSplitQuestion: (questionNodeId: string) => void;
  onSuggestCompletion: (planStepNodeId: string) => void;
  selectedNode: TreeNode | null;
};

export default function WorkspaceRuntimeActionCard({
  currentModule,
  isAiRunning,
  onGeneratePlanSteps,
  onSplitQuestion,
  onSuggestCompletion,
  selectedNode,
}: WorkspaceRuntimeActionCardProps) {
  const canGeneratePlanSteps = currentModule?.type === 'module' && !isAiRunning;
  const canSplitQuestion = selectedNode?.type === 'question' && !isAiRunning;
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

  function handleSuggestCompletion() {
    if (selectedNode?.type !== 'plan-step') {
      return;
    }

    onSuggestCompletion(selectedNode.id);
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
        当前只接最小闭环：模块内生成 plan-step、复合问题拆分、步骤完成建议。
      </p>
      <div className="workspace-actionGrid">
        <button
          disabled={!canGeneratePlanSteps}
          onClick={handleGeneratePlanSteps}
          type="button"
        >
          为当前模块生成 plan-step
        </button>
        <button
          disabled={!canSplitQuestion}
          onClick={handleSplitQuestion}
          type="button"
        >
          拆分当前问题
        </button>
        <button
          disabled={!canSuggestCompletion}
          onClick={handleSuggestCompletion}
          type="button"
        >
          建议完成当前步骤
        </button>
      </div>
    </SectionCard>
  );
}
