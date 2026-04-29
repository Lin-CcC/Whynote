import type { AiExecutionMetadata } from './aiTypes';
import type {
  JudgmentNodeDraft,
  LearningNodeCitationDraft,
  LearningReferenceCandidate,
  QuestionNodeDraft,
  SummaryNodeDraft,
} from './moduleGenerationTypes';

export interface QuestionClosureInput {
  topic: string;
  moduleTitle?: string;
  planStepTitle?: string;
  planStepSummary?: string;
  introductions?: string[];
  questionPath: Array<{
    title: string;
    content?: string;
  }>;
  learnerAnswer: string;
  referenceCandidates?: LearningReferenceCandidate[];
}

export interface QuestionClosureResult {
  isAnswerSufficient: boolean;
  judgment: JudgmentNodeDraft;
  summary: SummaryNodeDraft;
  followUpQuestions: QuestionNodeDraft[];
  metadata: AiExecutionMetadata;
}

export interface JudgmentHintInput {
  topic: string;
  moduleTitle?: string;
  planStepTitle?: string;
  planStepSummary?: string;
  introductions?: string[];
  questionPath: QuestionClosureInput['questionPath'];
  learnerAnswer: string;
  judgmentContent: string;
  summaryContent?: string;
  referenceCandidates?: LearningReferenceCandidate[];
}

export interface JudgmentHintResult {
  hint: string;
  citations: LearningNodeCitationDraft[];
  metadata: AiExecutionMetadata;
}
