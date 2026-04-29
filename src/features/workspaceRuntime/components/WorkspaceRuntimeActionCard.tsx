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
  const canViewAnswerExplanation = answerExplanationNodeId !== null && !isAiRunning;
  const questionClosureStage = resolveQuestionClosureStage(
    selectedNode,
    evaluationTarget,
  );
  const isQuestionClosureContext = questionClosureStage !== null;
  const shouldUseInlineJudgmentPrimaryAction =
    questionClosureStage === 'judgment';
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
      {isQuestionClosureContext ? (
        <div
          className="workspace-actionCallout"
          data-testid={getQuestionClosureCalloutTestId(questionClosureStage)}
        >
          <p className="workspace-kicker">
            {getQuestionClosureCalloutTitle(questionClosureStage)}
          </p>
          <p className="workspace-helpText">
            {getQuestionClosureCalloutDescription(
              questionClosureStage,
              canViewAnswerExplanation,
            )}
          </p>
          {shouldUseInlineJudgmentPrimaryAction ? (
            <p className="workspace-actionHint">
              {getQuestionClosureHint(
                questionClosureStage,
                answerFollowUpCount,
                canViewAnswerExplanation,
              )}
            </p>
          ) : (
            <>
              <div className="workspace-actionGrid">
                {questionClosureStage === 'summary' ? (
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
                {questionClosureStage === 'question' && canReturnToAnswer ? (
                  <button
                    disabled={!canReturnToAnswer}
                    onClick={handleReturnToAnswer}
                    type="button"
                  >
                    回到当前回答继续修改
                  </button>
                ) : null}
                {questionClosureStage === 'summary' ? (
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
            </>
          )}
        </div>
      ) : null}
      {isQuestionClosureContext ? (
        <div className="workspace-secondaryActionSection">
          <div className="workspace-sectionHeader">
            <div>
              <p className="workspace-kicker">其他动作</p>
              <h3 className="workspace-subsectionTitle">需要时再用</h3>
            </div>
          </div>
          <p className="workspace-helpText">
            当前主路径已经在上面收口，这里只保留不会抢主动作的次级运行时动作。
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
              disabled={!canSuggestCompletion}
              onClick={handleSuggestCompletion}
              type="button"
            >
              查看当前步骤完成依据
            </button>
          </div>
        </div>
      ) : (
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
            重新评估当前回答
          </button>
          <button
            disabled={!canSuggestCompletion}
            onClick={handleSuggestCompletion}
            type="button"
          >
            查看当前步骤完成依据
          </button>
        </div>
      )}
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
      return '这道题已经有可评估回答，主动作先补评估闭环。';
    case 'answer':
      return '当前回答还是主编辑面。先改这版回答，再决定是否重评。';
    case 'judgment':
      return '当前 judgment 的主动作已经收口到正文卡片，左侧不再重复抢这条路径。';
    case 'summary':
      return '答案解析负责给标准理解；真正改内容时，还是回到回答。';
    default:
      return '这里只保留学习运行时主路径，不和结构动作抢职责。';
  }
}

function getQuestionClosureCalloutTestId(
  questionClosureStage: QuestionClosureStage,
) {
  return questionClosureStage === 'judgment'
    ? 'judgment-inline-actions'
    : 'answer-evaluation-callout';
}

function getQuestionClosureCalloutTitle(
  questionClosureStage: QuestionClosureStage,
) {
  switch (questionClosureStage) {
    case 'question':
      return '主动作：先评估当前回答';
    case 'answer':
      return '主动作：改完这版回答再重评';
    case 'judgment':
      return '主动作：留在正文里的当前 judgment 卡片';
    case 'summary':
      return '主动作：回到回答继续修改';
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
        ? '这道题已经有答案解析，但主动作仍然是先把当前回答评估完整。'
        : '这道题已经有可评估回答，先把 judgment 和答案解析补齐。';
    case 'answer':
      return hasAnswerExplanation
        ? '答案解析可以对照，但主路径还是留在当前回答。'
        : '先重评当前回答，把判断和答案解析补出来。';
    case 'judgment':
      return hasAnswerExplanation
        ? '判断指出缺口，提示和答案解析留在正文卡片里；左侧不再重复放同一主动作。'
        : '先回到回答补这次缺口；如果还没有答案解析，也在正文里的 judgment 卡片继续处理。';
    case 'summary':
      return '现在看的就是答案解析。对照完标准理解，再回到回答继续修改。';
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
        return `已生成 ${String(answerFollowUpCount)} 个追问，但它们现在都降成次级推进。`;
      }

      return hasAnswerExplanation
        ? '主路径会继续留在当前回答上，方便你对照后立刻改写。'
        : '先把判断和答案解析补齐，当前回答的闭环才算成形。';
    case 'judgment':
      return '回到回答补缺口仍是唯一主动作；“给我提示”和“查看答案解析”都留在正文里的当前 judgment 卡片。';
    case 'summary':
      return '答案解析已经存在。接下来优先回到回答改写，再决定是否重评。';
    default:
      return '';
  }
}
