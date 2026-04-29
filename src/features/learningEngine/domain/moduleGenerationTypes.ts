import type {
  CitationPurpose,
  JudgmentNodeKind,
  PlanStepStatus,
  SummaryNodeKind,
} from '../../nodeDomain';

import type { AiExecutionMetadata } from './aiTypes';
import type { LearningMode } from './learningMode';

export interface LearningNodeCitationDraft {
  targetNodeId: string;
  focusText?: string;
  note?: string;
  purpose?: CitationPurpose;
  sourceExcerpt?: string;
  sourceLocator?: string;
}

interface BaseLearningNodeDraft {
  title: string;
  content: string;
  citations: LearningNodeCitationDraft[];
}

export interface AnswerNodeDraft extends BaseLearningNodeDraft {
  type: 'answer';
}

export interface QuestionNodeDraft extends BaseLearningNodeDraft {
  type: 'question';
}

export interface SummaryNodeDraft extends BaseLearningNodeDraft {
  type: 'summary';
  summaryKind?: SummaryNodeKind;
}

export interface JudgmentNodeDraft extends BaseLearningNodeDraft {
  type: 'judgment';
  hint?: string;
  judgmentKind?: JudgmentNodeKind;
}

export interface LearningReferenceCandidate {
  targetNodeId: string;
  targetType: 'resource' | 'resource-fragment';
  title: string;
  content: string;
  locator?: string;
  sourceResourceTitle?: string;
}

export interface PlanStepNodeDraft {
  type: 'plan-step';
  title: string;
  content: string;
  introductions: SummaryNodeDraft[];
  questions: QuestionNodeDraft[];
  status: PlanStepStatus;
}

export interface ModuleNodeDraft {
  type: 'module';
  title: string;
  content: string;
  planSteps: PlanStepNodeDraft[];
}

export interface ModuleGenerationInput {
  topic: string;
  resourceSummary?: string;
  referenceCandidates?: LearningReferenceCandidate[];
  userPreferences?: string;
  mode?: LearningMode;
}

export interface ModuleGenerationResult {
  mode: LearningMode;
  modules: ModuleNodeDraft[];
  metadata: AiExecutionMetadata;
}
