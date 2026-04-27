import type { AiExecutionMetadata } from './aiTypes';
import type { LearningMode } from './learningMode';
import type {
  LearningReferenceCandidate,
  PlanStepNodeDraft,
} from './moduleGenerationTypes';

export interface PlanStepGenerationInput {
  topic: string;
  moduleTitle: string;
  moduleSummary?: string;
  resourceSummary?: string;
  referenceCandidates?: LearningReferenceCandidate[];
  userPreferences?: string;
  mode?: LearningMode;
}

export interface PlanStepGenerationResult {
  mode: LearningMode;
  moduleTitle: string;
  planSteps: PlanStepNodeDraft[];
  metadata: AiExecutionMetadata;
}
