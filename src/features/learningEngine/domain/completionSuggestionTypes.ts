import type { PlanStepStatus } from '../../nodeDomain';

export interface PlanStepCompletionEvidence {
  stepStatus: PlanStepStatus;
  questionCount: number;
  answerCount: number;
  answeredQuestionCount: number;
  summaryCount: number;
  judgmentCount: number;
  blockingJudgmentCount: number;
  unresolvedQuestionTitles: string[];
  blockingTagNames: string[];
}

export interface CompletionSuggestionResult {
  shouldSuggestComplete: boolean;
  reasonSummary: string;
  reasons: string[];
  evidence: PlanStepCompletionEvidence;
}
