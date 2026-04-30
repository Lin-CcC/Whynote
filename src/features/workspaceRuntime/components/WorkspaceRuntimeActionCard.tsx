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
  const canReturnToAnswer =
    runtimeActionStage !== null &&
    runtimeActionStage !== 'answer' &&
    runtimeActionStage !== 'summary-check-result' &&
    evaluationTarget !== null &&
    !isAiRunning;
  const canReturnToSummary =
    summaryCheckJudgmentContext !== null && !isAiRunning;

  if (!currentModule) {
    return (
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">辅助概览</p>
            <h2 className="workspace-sectionTitle">下一步建议</h2>
          </div>
        </div>
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            当前还没有可供运行时动作使用的学习模块。先新建一个模块，再回到主视图建立 question block。
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
          <p className="workspace-kicker">辅助概览</p>
          <h2 className="workspace-sectionTitle">
            {getOverviewTitle(runtimeActionStage)}
          </h2>
        </div>
      </div>
      <p className="workspace-helpText">{getOverviewText(runtimeActionStage)}</p>
      {hasFocusedActionContext ? (
        <div
          className="workspace-actionCallout"
          data-testid={getRuntimeActionCalloutTestId(runtimeActionStage)}
        >
          <p className="workspace-kicker">下一步建议</p>
          <p className="workspace-helpText">
            {getNextStepText(runtimeActionStage, canViewAnswerExplanation)}
          </p>
          <div className="workspace-actionGrid">
            {runtimeActionStage === 'question-needs-answer' ? (
              <>
                <button
                  className="workspace-primaryAction"
                  disabled={!canDirectAnswerCurrentQuestion}
                  onClick={onDirectAnswerCurrentQuestion}
                  type="button"
                >
                  直接回答当前问题
                </button>
                <button
                  disabled={isAiRunning}
                  onClick={onInsertAnswer}
                  type="button"
                >
                  插入回答
                </button>
              </>
            ) : runtimeActionStage === 'summary' ? (
              <button
                className="workspace-primaryAction"
                disabled={!canReturnToAnswer}
                onClick={() => {
                  if (!evaluationTarget) {
                    return;
                  }

                  onSelectNode(evaluationTarget.answerNodeId);
                }}
                type="button"
              >
                回到当前回答继续修改
              </button>
            ) : runtimeActionStage === 'summary-check' ? (
              <button
                className="workspace-primaryAction"
                disabled={!canEvaluateSummary}
                onClick={() => {
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
                }}
                type="button"
              >
                检查这个总结
              </button>
            ) : runtimeActionStage === 'summary-check-result' ? (
              <button
                className="workspace-primaryAction"
                disabled={!canReturnToSummary}
                onClick={() => {
                  if (!summaryCheckJudgmentContext) {
                    return;
                  }

                  onSelectNode(summaryCheckJudgmentContext.summaryNodeId);
                }}
                type="button"
              >
                回到这个总结继续修改
              </button>
            ) : runtimeActionStage === 'judgment' ? null : (
              <button
                className="workspace-primaryAction"
                disabled={!canEvaluateQuestionAnswer}
                onClick={() => {
                  if (!evaluationTarget) {
                    return;
                  }

                  onEvaluateQuestionAnswer(evaluationTarget);
                }}
                type="button"
              >
                重新评估当前回答
              </button>
            )}
            {runtimeActionStage !== 'judgment' &&
            runtimeActionStage !== 'summary' &&
            canViewAnswerExplanation ? (
              <button
                disabled={!canViewAnswerExplanation}
                onClick={() => {
                  if (!answerExplanationNodeId) {
                    return;
                  }

                  onSelectNode(answerExplanationNodeId);
                }}
                type="button"
              >
                查看答案解析
              </button>
            ) : null}
            {runtimeActionStage === 'summary' ? (
              <button
                disabled={!canEvaluateQuestionAnswer}
                onClick={() => {
                  if (!evaluationTarget) {
                    return;
                  }

                  onEvaluateQuestionAnswer(evaluationTarget);
                }}
                type="button"
              >
                重新评估当前回答
              </button>
            ) : null}
            {runtimeActionStage === 'summary-check' && canReturnToAnswer ? (
              <button
                disabled={!canReturnToAnswer}
                onClick={() => {
                  if (!evaluationTarget) {
                    return;
                  }

                  onSelectNode(evaluationTarget.answerNodeId);
                }}
                type="button"
              >
                回到当前回答继续修改
              </button>
            ) : null}
            {runtimeActionStage === 'summary-check-result' ? (
              <button
                disabled={!canEvaluateSummary}
                onClick={() => {
                  if (summaryCheckJudgmentContext) {
                    onEvaluateSummary({
                      answerNodeId: summaryCheckJudgmentContext.answerNodeId,
                      questionNodeId: summaryCheckJudgmentContext.questionNodeId,
                      summaryNodeId: summaryCheckJudgmentContext.summaryNodeId,
                    });
                  }
                }}
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
        </div>
      ) : null}
      <div className="workspace-secondaryActionSection">
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">冗余入口</p>
            <h3 className="workspace-subsectionTitle">需要时再用</h3>
          </div>
        </div>
        <p className="workspace-helpText">
          主编辑流已经收口到中间的 question block。这里保留运行时辅助入口，但不再承担主操作面。
        </p>
        <div className="workspace-actionGrid">
          <button
            disabled={!canGeneratePlanSteps}
            onClick={() => {
              if (currentModule?.type !== 'module') {
                return;
              }

              onGeneratePlanSteps(currentModule.id);
            }}
            type="button"
          >
            为当前模块规划学习路径
          </button>
          <button
            disabled={!canSplitQuestion}
            onClick={() => {
              if (selectedNode?.type !== 'question') {
                return;
              }

              onSplitQuestion(selectedNode.id);
            }}
            type="button"
          >
            拆分当前问题
          </button>
          <button
            disabled={!canSuggestCompletion}
            onClick={() => {
              if (selectedNode?.type !== 'plan-step') {
                return;
              }

              onSuggestCompletion(selectedNode.id);
            }}
            type="button"
          >
            查看当前步骤完成依据
          </button>
        </div>
      </div>
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

function getOverviewTitle(runtimeActionStage: RuntimeActionStage) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '当前问题概览';
    case 'question':
      return '当前问题闭环概览';
    case 'answer':
      return '当前回答概览';
    case 'judgment':
      return '当前判断反馈';
    case 'summary':
      return '当前答案解析';
    case 'summary-check':
      return '当前总结检查';
    case 'summary-check-result':
      return '总结检查结果';
    default:
      return '运行时辅助概览';
  }
}

function getOverviewText(runtimeActionStage: RuntimeActionStage) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '主路径已经在主视图里提供 question block 级动作，这里只补充 AI 直答建议。';
    case 'question':
      return '这个问题已经有回答，主视图里可以直接继续编辑、切换当前回答或展开历史。';
    case 'answer':
      return '当前回答仍然以主视图里的 block 区为主，这里只给出下一步建议。';
    case 'judgment':
      return 'judgment 的提示与跳转继续留在正文 inline 入口，这张卡片只做辅助说明。';
    case 'summary':
      return '答案解析已经从“总结”里拆开显示。需要修改时，优先回到当前回答区。';
    case 'summary-check':
      return '这是对手写总结的单独检查入口，不会替代主视图里的总结编辑流。';
    case 'summary-check-result':
      return '这是总结检查结果，不是普通回答评估。';
    default:
      return '左侧卡片现在只做状态概览、下一步建议和冗余入口。';
  }
}

function getNextStepText(
  runtimeActionStage: RuntimeActionStage,
  hasAnswerExplanation: boolean,
) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return '如果你想先让 AI 起一版回答，可以直接用下面的入口；否则回到主视图插入空白回答。';
    case 'question':
      return hasAnswerExplanation
        ? '当前问题已经有答案解析，下一步通常是继续修改当前回答或重新评估。'
        : '当前问题已经有回答，下一步通常是补齐评估链。';
    case 'answer':
      return hasAnswerExplanation
        ? '答案解析可作为对照，但回答本身仍应在主视图区继续修改。'
        : '回答还可以直接继续修改，再决定是否重新评估。';
    case 'judgment':
      return '当前 judgment 的提示、回到回答、查看答案解析都继续放在正文卡片里。';
    case 'summary':
      return '答案解析已经形成，下一步通常是回到回答继续修改。';
    case 'summary-check':
      return '这段总结代表你当前的理解，可以直接触发一次检查。';
    case 'summary-check-result':
      return '先根据检查结果回到总结继续修改，再决定是否复查。';
    default:
      return '没有聚焦到问答闭环节点时，这里只保留通用辅助入口。';
  }
}

function getRuntimeActionHint(
  runtimeActionStage: RuntimeActionStage,
  answerFollowUpCount: number,
  hasAnswerExplanation: boolean,
) {
  switch (runtimeActionStage) {
    case 'question-needs-answer':
      return 'AI 直答会生成新的 answer 节点；如果你更想手写，主视图里的“插入回答”已经完整可达。';
    case 'question':
    case 'answer':
      if (answerFollowUpCount > 0) {
        return `当前问题下面还有 ${String(answerFollowUpCount)} 个追问，但它们已经在主视图区降级为后续区。`;
      }

      return hasAnswerExplanation
        ? '当前回答、最新评估和答案解析已经在主视图区并排收口。'
        : '如果评估链还没闭合，优先补齐当前回答。';
    case 'judgment':
      return '左侧不再重复渲染 judgment 的主入口，避免和主视图区抢路径。';
    case 'summary':
      return '答案解析和手写总结已在显示层拆开，不再混在一个“总结”语义里。';
    case 'summary-check':
      return '总结检查只针对手写总结，不会自动替代回答评估。';
    case 'summary-check-result':
      return '修改总结后可以再次检查，直到总结本身稳定。';
    default:
      return '';
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
