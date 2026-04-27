import type { PlanStepStatus } from '../../nodeDomain';

export interface PlanStepCompletionEvidence {
  stepStatus: PlanStepStatus;
  questionCount: number;
  answerCount: number;
  answeredQuestionCount: number;
  summaryCount: number;
  judgmentCount: number;
  directClosureCount: number;
  blockingJudgmentCount: number;
  refinedQuestionCount: number;
  referencedNodeCount: number;
  unresolvedQuestionTitles: string[];
  blockingTagNames: string[];
}

export interface CompletionSuggestionResult {
  shouldSuggestComplete: boolean;
  reasonSummary: string;
  reasons: string[];
  evidence: PlanStepCompletionEvidence;
}

export interface PlanStepRuntimeStatusResult {
  evidence: PlanStepCompletionEvidence;
  reasonSummary: string;
  reasons: string[];
  suggestedStatus: PlanStepStatus;
}
