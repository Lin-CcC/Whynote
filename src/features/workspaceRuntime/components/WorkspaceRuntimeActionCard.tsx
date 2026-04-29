import SectionCard from '../../../ui/SectionCard';
import type { TreeNode } from '../../nodeDomain';
import type {
  QuestionAnswerEvaluationTarget,
  SummaryCheckJudgmentContext,
  SummaryEvaluationTarget,
} from '../services/learningRuntimeContext';

type WorkspaceRuntimeActionCardProps = {
  answerExplanationNodeId: string | null;
  answerFollowUpCount: number;
  canDirectAnswerCurrentQuestion: boolean;
  currentModule: TreeNode | null;
  evaluationTarget: QuestionAnswerEvaluationTarget | null;
  hasDirectAnswerCurrentQuestion: boolean;
  isAiRunning: boolean;
  onCreateModule: () => void;
  onDirectAnswerCurrentQuestion: () => void;
  onEvaluateQuestionAnswer: (target: QuestionAnswerEvaluationTarget) => void;
  onEvaluateSummary: (target: SummaryEvaluationTarget) => void;
  onGeneratePlanSteps: (moduleNodeId: string) => void;
  onInsertAnswer: () => void;
  onSelectNode: (nodeId: string) => void;
  onSplitQuestion: (questionNodeId: string) => void;
  onSuggestCompletion: (planStepNodeId: string) => void;
  selectedNode: TreeNode | null;
  summaryCheckJudgmentContext: SummaryCheckJudgmentContext | null;
  summaryEvaluationTarget: SummaryEvaluationTarget | null;
};

type RuntimeActionStage =
  | 'question-needs-answer'
  | 'question'
  | 'answer'
  | 'judgment'
  | 'summary'
  | 'summary-check'
  | 'summary-check-result'
  | null;

export default function WorkspaceRuntimeActionCard({
  answerExplanationNodeId,
  answerFollowUpCount,
  canDirectAnswerCurrentQuestion,
  currentModule,
  evaluationTarget,
  hasDirectAnswerCurrentQuestion,
  isAiRunning,
  onCreateModule,
  onDirectAnswerCurrentQuestion,
  onEvaluateQuestionAnswer,
  onEvaluateSummary,
  onGeneratePlanSteps,
  onInsertAnswer,
  onSelectNode,
  onSplitQuestion,
  onSuggestCompletion,
  selectedNode,
  summaryCheckJudgmentContext,
  summaryEvaluationTarget,
}: WorkspaceRuntimeActionCardProps) {
  const canGeneratePlanSteps = currentModule?.type === 'module' && !isAiRunning;
  const canSplitQuestion = selectedNode?.type === 'question' && !isAiRunning;
  const canEvaluateQuestionAnswer = evaluationTarget !== null && !isAiRunning;
  const canEvaluateSummary =
    (summaryEvaluationTarget !== null || summaryCheckJudgmentContext !== null) &&
    !isAiRunning;
  const canSuggestCompletion = selectedNode?.type === 'plan-step' && !isAiRunning;
  const canViewAnswerExplanation = answerExplanationNodeId !== null && !isAiRunning;
  const runtimeActionStage = resolveRuntimeActionStage(
    selectedNode,
    evaluationTarget,
    hasDirectAnswerCurrentQuestion,
    summaryCheckJudgmentContext,
    summaryEvaluationTarget,
  );
  const hasFocusedActionContext = runtimeActionStage !== null;
  const shouldUseInlineJudgmentPrimaryAction =
    runtimeActionStage === 'judgment';
  const canReturnToAnswer =
    runtimeActionStage !== null &&
    runtimeActionStage !== 'answer' &&
    runtimeActionStage !== 'summary-check-result' &&
    evaluationTarget !== null &&
    !isAiRunning;
  const canReturnToSummary =
    summaryCheckJudgmentContext !== null && !isAiRunning;
  const sectionTitle = getSectionTitle(runtimeActionStage);
  const helpText = getSectionHelpText(runtimeActionStage);

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

  function handleDirectAnswerCurrentQuestion() {
    onDirectAnswerCurrentQuestion();
  }

  function handleInsertAnswer() {
    onInsertAnswer();
  }

  function handleEvaluateSummary() {
    if (summaryEvaluationTarget) {
      onEvaluateSummary(summaryEvaluationTarget);
      return;
    }

    if (summaryCheckJudgmentContext) {
      onEvaluateSummary({
        answerNodeId: summaryCheckJudgmentContext.answerNodeId,
        questionNodeId: summaryCheckJudgmentContext.questionNodeId,
        summaryNodeId: summaryCheckJudgmentContext.summaryNodeId,
      });
    }
  }

  function handleReturnToSummary() {
    if (!summaryCheckJudgmentContext) {
      return;
    }

    onSelectNode(summaryCheckJudgmentContext.summaryNodeId);
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
      {hasFocusedActionContext ? (
        <div
          className="workspace-actionCallout"
          data-testid={getRuntimeActionCalloutTestId(runtimeActionStage)}
        >
          <p className="workspace-kicker">
            {getRuntimeActionCalloutTitle(runtimeActionStage)}
          </p>
          <p className="workspace-helpText">
            {getRuntimeActionCalloutDescription(
              runtimeActionStage,
              canViewAnswerExplanation,
            )}
          </p>
          {shouldUseInlineJudgmentPrimaryAction ? (
            <p className="workspace-actionHint">
              {getRuntimeActionHint(
                runtimeActionStage,
                answerFollowUpCount,
                canViewAnswerExplanation,
              )}
            </p>
          ) : (
            <>
              <div className="workspace-actionGrid">
                {runtimeActionStage === 'question-needs-answer' ? (
                  <>
                    <button
                      className="workspace-primaryAction"
                      disabled={!canDirectAnswerCurrentQuestion}
                      onClick={handleDirectAnswerCurrentQuestion}
                      type="button"
                    >
                      直接回答当前问题
                    </button>
                    <button
                      disabled={isAiRunning}
                      onClick={handleInsertAnswer}
                      type="button"
                    >
                      插入回答
                    </button>
                  </>
                ) : runtimeActionStage === 'summary' ? (
                  <button
                    className="workspace-primaryAction"
                    disabled={!canReturnToAnswer}
                    onClick={handleReturnToAnswer}
                    type="button"
                  >
                    回到当前回答继续修改
                  </button>
                ) : runtimeActionStage === 'summary-check' ? (
                  <button
                    className="workspace-primaryAction"
                    disabled={!canEvaluateSummary}
                    onClick={handleEvaluateSummary}
                    type="button"
                  >
                    检查这个总结
                  </button>
                ) : runtimeActionStage === 'summary-check-result' ? (
                  <button
                    className="workspace-primaryAction"
                    disabled={!canReturnToSummary}
                    onClick={handleReturnToSummary}
                    type="button"
                  >
                    回到这个总结继续修改
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
                {runtimeActionStage !== 'summary' && canViewAnswerExplanation ? (
                  <button
                    disabled={!canViewAnswerExplanation}
                    onClick={handleViewAnswerExplanation}
                    type="button"
                  >
                    查看答案解析
                  </button>
                ) : null}
                {runtimeActionStage === 'question' && canReturnToAnswer ? (
                  <button
                    disabled={!canReturnToAnswer}
                    onClick={handleReturnToAnswer}
                    type="button"
                  >
                    回到当前回答继续修改
                  </button>
                ) : null}
                {runtimeActionStage === 'summary' ? (
                  <button
                    disabled={!canEvaluateQuestionAnswer}
                    onClick={handleEvaluateQuestionAnswer}
                    type="button"
                  >
                    重新评估当前回答
                  </button>
                ) : null}
                {runtimeActionStage === 'summary-check' && canReturnToAnswer ? (
                  <button
                    disabled={!canReturnToAnswer}
                    onClick={handleReturnToAnswer}
                    type="button"
                  >
                    回到当前回答继续修改
                  </button>
                ) : null}
                {runtimeActionStage === 'summary-check-result' ? (
                  <button
                    disabled={!canEvaluateSummary}
                    onClick={handleEvaluateSummary}
                    type="button"
                  >
                    重新检查这个总结
                  </button>
                ) : null}
              </div>
              <p className="workspace-actionHint">
                {getRuntimeActionHint(
                  runtimeActionStage,
                  answerFollowUpCount,
                  canViewAnswerExplanation,
                )}
              </p>
            </>
          )}
        </div>
      ) : null}
      {hasFocusedActionContext ? (
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

function resolveRuntimeActionStage(
  selectedNode: TreeNode | null,
  evaluationTarget: QuestionAnswerEvaluationTarget | null,
  hasDirectAnswerCurrentQuestion: boolean,
  summaryCheckJudgmentContext: SummaryCheckJudgmentContext | null,
  summaryEvaluationTarget: SummaryEvaluationTarget | null,
): RuntimeActionStage {
  if (summaryCheckJudgmentContext) {
    return 'summary-check-result';
  }

  if (summaryEvaluationTarget) {
    return 'summary-check';
  }

  if (!selectedNode) {
    return null;
  }

  if (selectedNode.type === 'question') {
    if (evaluationTarget) {
      return 'question';
    }

    return hasDirectAnswerCurrentQuestion ? 'question-needs-answer' : null;
  }

  if (!evaluationTarget) {
    return null;
  }

  switch (selectedNode.type) {
    case 'answer':
    case 'judgment':
    case 'summary':
      return selectedNode.type;
    default:
      return null;
  }
}

function getSectionTitle(runtimeActionStage: RuntimeActionStage) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '当前问题起答';
    case 'question':
      return '当前问题闭环';
    case 'answer':
      return '当前回答修订';
    case 'judgment':
      return '当前判断反馈';
    case 'summary':
      return '当前答案解析';
    case 'summary-check':
      return '当前总结检查';
    case 'summary-check-result':
      return '总结理解检查结果';
    default:
      return '学习推进';
  }
}

function getSectionHelpText(runtimeActionStage: RuntimeActionStage) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '这道题还没有可评估回答，先起一版 answer，再接回现有回答修订闭环。';
    case 'question':
      return '这道题已经有可评估回答，主动作先补评估闭环。';
    case 'answer':
      return '当前回答还是主编辑面。先改这版回答，再决定是否重评。';
    case 'judgment':
      return '当前 judgment 的主动作已经收口到正文卡片，左侧不再重复抢这条路径。';
    case 'summary':
      return '答案解析负责给标准理解；真正改内容时，还是回到回答。';
    case 'summary-check':
      return '这段总结代表你当前的理解。先检查它有没有缺口、偏差或边界遗漏，再决定回头改哪里。';
    case 'summary-check-result':
      return '这条 judgment 是对 summary 的理解检查结果，不是普通 answer evaluation。';
    default:
      return '这里只保留学习运行时主路径，不和结构动作抢职责。';
  }
}

function getRuntimeActionCalloutTestId(
  runtimeActionStage: RuntimeActionStage,
) {
  if (runtimeActionStage === 'question-needs-answer') {
    return 'question-direct-answer-callout';
  }

  if (runtimeActionStage === 'summary-check') {
    return 'summary-evaluation-callout';
  }

  if (runtimeActionStage === 'summary-check-result') {
    return 'summary-evaluation-result-callout';
  }

  return runtimeActionStage === 'judgment'
    ? 'judgment-inline-actions'
    : 'answer-evaluation-callout';
}

function getRuntimeActionCalloutTitle(
  runtimeActionStage: RuntimeActionStage,
) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '主动作：直接回答当前问题';
    case 'question':
      return '主动作：先评估当前回答';
    case 'answer':
      return '主动作：改完这版回答再重评';
    case 'judgment':
      return '主动作：留在正文里的当前 judgment 卡片';
    case 'summary':
      return '主动作：回到回答继续修改';
    case 'summary-check':
      return '主动作：检查这个总结';
    case 'summary-check-result':
      return '主动作：回到这个总结继续修改';
    default:
      return '下一步';
  }
}

function getRuntimeActionCalloutDescription(
  runtimeActionStage: RuntimeActionStage,
  hasAnswerExplanation: boolean,
) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '这道题还没有可评估回答。先让 AI 起一版普通 answer，或保留手动回答入口。';
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
    case 'summary-check':
      return '这段总结是你当前的理解稿。系统会单独检查它说对了什么、还缺什么、哪里可能理解偏了。';
    case 'summary-check-result':
      return '这条结果只针对当前 summary 的理解质量，不会把你带回普通回答评估链。';
    default:
      return '';
  }
}

function getRuntimeActionHint(
  runtimeActionStage: RuntimeActionStage,
  answerFollowUpCount: number,
  hasAnswerExplanation: boolean,
) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '新生成的回答会落成普通 answer 节点，并自动选中，后面直接接回评估、提示和答案解析主链。';
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
    case 'summary-check':
      return '这一步不会自动生成追问；它只负责检查这段总结的理解缺口、可能误解和下一步该补哪层。';
    case 'summary-check-result':
      return '先按这条检查结果回到总结继续修改；如果还不稳，再重新检查一次。';
    default:
      return '';
  }
}
