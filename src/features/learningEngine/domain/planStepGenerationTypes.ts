import type { AiExecutionMetadata } from './aiTypes';
import type { LearningMode } from './learningMode';
import type { PlanStepNodeDraft } from './moduleGenerationTypes';

export interface PlanStepGenerationInput {
  topic: string;
  moduleTitle: string;
  moduleSummary?: string;
  resourceSummary?: string;
  userPreferences?: string;
  mode?: LearningMode;
}

export interface PlanStepGenerationResult {
  mode: LearningMode;
  moduleTitle: string;
  planSteps: PlanStepNodeDraft[];
  metadata: AiExecutionMetadata;
}
