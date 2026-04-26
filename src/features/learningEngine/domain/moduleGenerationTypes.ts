import type { PlanStepStatus } from '../../nodeDomain';

import type { AiExecutionMetadata } from './aiTypes';
import type { LearningMode } from './learningMode';

export interface PlanStepNodeDraft {
  type: 'plan-step';
  title: string;
  content: string;
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
  userPreferences?: string;
  mode?: LearningMode;
}

export interface ModuleGenerationResult {
  mode: LearningMode;
  modules: ModuleNodeDraft[];
  metadata: AiExecutionMetadata;
}
