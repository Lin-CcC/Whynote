import SectionCard from '../../../ui/SectionCard';
import type { TreeNode } from '../../nodeDomain';
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
  onSelectNode: (nodeId: string) => void;
  onSplitQuestion: (questionNodeId: string) => void;
  onSuggestCompletion: (planStepNodeId: string) => void;
  selectedNode: TreeNode | null;
};

type QuestionClosureStage = 'question' | 'answer' | 'judgment' | 'summary' | null;

export default function WorkspaceRuntimeActionCard({
  answerExplanationNodeId,
  answerFollowUpCount,
  currentModule,
  evaluationTarget,
  isAiRunning,
  onCreateModule,
  onEvaluateQuestionAnswer,
  onGeneratePlanSteps,
  onSelectNode,
  onSplitQuestion,
  onSuggestCompletion,
  selectedNode,
}: WorkspaceRuntimeActionCardProps) {
  const canGeneratePlanSteps = currentModule?.type === 'module' && !isAiRunning;
  const canSplitQuestion = selectedNode?.type === 'question' && !isAiRunning;
  const canEvaluateQuestionAnswer = evaluationTarget !== null && !isAiRunning;
  const canSuggestCompletion = selectedNode?.type === 'plan-step' && !isAiRunning;
  const canViewAnswerExplanation =
    answerExplanationNodeId !== null && !isAiRunning;
  const questionClosureStage = resolveQuestionClosureStage(
    selectedNode,
    evaluationTarget,
  );
  const isQuestionClosureContext = questionClosureStage !== null;
  const canReturnToAnswer =
    questionClosureStage !== null &&
    questionClosureStage !== 'answer' &&
    evaluationTarget !== null &&
    !isAiRunning;
  const sectionTitle = getSectionTitle(questionClosureStage);
  const helpText = getSectionHelpText(questionClosureStage);

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

  function handleReturnToAnswer() {
    if (!evaluationTarget) {
      return;
    }

    onSelectNode(evaluationTarget.answerNodeId);
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
      {isQuestionClosureContext ? (
        <div className="workspace-actionCallout" data-testid="answer-evaluation-callout">
          <p className="workspace-kicker">
            {getQuestionClosureCalloutTitle(questionClosureStage)}
          </p>
          <p className="workspace-helpText">
            {getQuestionClosureCalloutDescription(
              questionClosureStage,
              canViewAnswerExplanation,
            )}
          </p>
          <div className="workspace-actionGrid">
            {canReturnToAnswer ? (
              <button
                className="workspace-primaryAction"
                disabled={!canReturnToAnswer}
                onClick={handleReturnToAnswer}
                type="button"
              >
                回到当前回答继续修改
              </button>
            ) : (
              <button
                className="workspace-primaryAction"
                disabled={!canEvaluateQuestionAnswer}
                onClick={handleEvaluateQuestionAnswer}
                type="button"
              >
                重新评估当前回答
              </button>
            )}
            {questionClosureStage !== 'summary' && canViewAnswerExplanation ? (
              <button
                disabled={!canViewAnswerExplanation}
                onClick={handleViewAnswerExplanation}
                type="button"
              >
                查看答案解析
              </button>
            ) : null}
            {canReturnToAnswer ? (
              <button
                disabled={!canEvaluateQuestionAnswer}
                onClick={handleEvaluateQuestionAnswer}
                type="button"
              >
                重新评估当前回答
              </button>
            ) : null}
          </div>
          <p className="workspace-actionHint">
            {getQuestionClosureHint(
              questionClosureStage,
              answerFollowUpCount,
              canViewAnswerExplanation,
            )}
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
        {!isQuestionClosureContext ? (
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

function resolveQuestionClosureStage(
  selectedNode: TreeNode | null,
  evaluationTarget: QuestionAnswerEvaluationTarget | null,
): QuestionClosureStage {
  if (!selectedNode || !evaluationTarget) {
    return null;
  }

  switch (selectedNode.type) {
    case 'question':
    case 'answer':
    case 'judgment':
    case 'summary':
      return selectedNode.type;
    default:
      return null;
  }
}

function getSectionTitle(questionClosureStage: QuestionClosureStage) {
  switch (questionClosureStage) {
    case 'question':
      return '当前问题闭环';
    case 'answer':
      return '当前回答修订';
    case 'judgment':
      return '当前判断反馈';
    case 'summary':
      return '当前答案解析';
    default:
      return '学习推进';
  }
}

function getSectionHelpText(questionClosureStage: QuestionClosureStage) {
  switch (questionClosureStage) {
    case 'question':
      return '这道题已经有可评估的回答。先看清当前闭环，再决定是继续评估还是补结构。';
    case 'answer':
      return '这里的主路径是继续修改当前回答，再重新评估；如果系统已经生成答案解析，也可以先对照标准理解。';
    case 'judgment':
      return '判断节点只负责指出当前回答的命中和缺口；主路径仍然是回到对应回答修改，再重新评估。';
    case 'summary':
      return '答案解析负责给出标准理解或纠错讲解；真正要修改内容时，还是回到对应回答继续迭代。';
    default:
      return '当前接的是最小学习闭环：规划步骤与铺垫讲解、拆分问题、评估回答、查看步骤完成依据。';
  }
}

function getQuestionClosureCalloutTitle(questionClosureStage: QuestionClosureStage) {
  switch (questionClosureStage) {
    case 'question':
      return '下一步：先评估这道题当前回答';
    case 'answer':
      return '围绕当前回答继续';
    case 'judgment':
      return '下一步：先按判断回到回答补缺口';
    case 'summary':
      return '下一步：对照答案解析，再回到回答修正';
    default:
      return '下一步';
  }
}

function getQuestionClosureCalloutDescription(
  questionClosureStage: QuestionClosureStage,
  hasAnswerExplanation: boolean,
) {
  switch (questionClosureStage) {
    case 'question':
      return hasAnswerExplanation
        ? '这道题已经有一版答案解析，可以先对照再决定是否重评。'
        : '这道题已经有可评估回答，先跑一次评估，把判断和答案解析补齐。';
    case 'answer':
      return hasAnswerExplanation
        ? '评估、答案解析、修改回答这三步里，主路径优先留在当前回答。'
        : '先重新评估当前回答，补出判断和答案解析，再决定是否追问。';
    case 'judgment':
      return hasAnswerExplanation
        ? '判断告诉你还差什么，答案解析告诉你标准理解是什么，两者都不要替代回答本身。'
        : '当前判断已经存在，但还没有配套答案解析时，主路径仍是先回到回答补当前缺口。';
    case 'summary':
      return '现在看的就是答案解析。先对照标准理解，再决定是否回到回答继续改写。';
    default:
      return '';
  }
}

function getQuestionClosureHint(
  questionClosureStage: QuestionClosureStage,
  answerFollowUpCount: number,
  hasAnswerExplanation: boolean,
) {
  switch (questionClosureStage) {
    case 'question':
    case 'answer':
      if (answerFollowUpCount > 0) {
        return `已生成 ${String(answerFollowUpCount)} 个追问，但它们现在只作为次级推进，不会抢走当前回答。`;
      }

      return hasAnswerExplanation
        ? '默认主路径会留在当前回答上，方便你先对照答案解析，再决定要不要修改后重评。'
        : '先把判断和答案解析补齐，测试时就不会再遇到“有 judgment 但没有答案解析”的主路径缺口。';
    case 'judgment':
      return '判断节点不是终点。先改回答，再重新评估；答案解析用于对照标准理解，不用于代替回答本身。';
    case 'summary':
      return '答案解析已经存在。接下来如果要继续学习动作，优先回到对应回答改写，再重新评估。';
    default:
      return '';
  }
}
