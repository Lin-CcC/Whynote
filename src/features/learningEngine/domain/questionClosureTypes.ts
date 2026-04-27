import type { AiExecutionMetadata } from './aiTypes';
import type {
  JudgmentNodeDraft,
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
