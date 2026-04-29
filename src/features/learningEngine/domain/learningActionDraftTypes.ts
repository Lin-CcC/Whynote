import type { AiExecutionMetadata } from './aiTypes';
import type {
  AnswerNodeDraft,
  JudgmentNodeDraft,
  LearningReferenceCandidate,
  QuestionNodeDraft,
  SummaryNodeDraft,
} from './moduleGenerationTypes';

export type LearningActionDraftActionId =
  | 'insert-scaffold'
  | 'rephrase-scaffold'
  | 'simplify-scaffold'
  | 'add-example'
  | 'insert-question'
  | 'insert-answer'
  | 'insert-summary'
  | 'insert-judgment';

export type LearningActionDraft =
  | AnswerNodeDraft
  | QuestionNodeDraft
  | SummaryNodeDraft
  | JudgmentNodeDraft;

export interface LearningActionDraftInput {
  actionId: LearningActionDraftActionId;
  topic: string;
  moduleTitle?: string;
  planStepTitle?: string;
  planStepSummary?: string;
  introductions?: string[];
  currentNode?: {
    type: 'plan-step' | 'question' | 'answer' | 'summary' | 'judgment';
    title: string;
    content?: string;
  };
  questionPath?: Array<{
    title: string;
    content?: string;
  }>;
  learnerAnswer?: string;
  existingQuestionTitles?: string[];
  referenceCandidates?: LearningReferenceCandidate[];
}

export interface LearningActionDraftResult {
  draft: LearningActionDraft;
  metadata: AiExecutionMetadata;
}
