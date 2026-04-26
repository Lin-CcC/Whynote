import type { AiExecutionMetadata } from './aiTypes';

export type SubQuestionOrderingStrategy = 'dependency' | 'original';

export interface CompoundQuestionSplitInput {
  question: string;
  moduleTitle?: string;
  planStepTitle?: string;
  resourceSummary?: string;
}

export interface ChildQuestionDraft {
  type: 'question';
  title: string;
  content: string;
  originalIndex: number;
  dependsOnIndices: number[];
  dependencyConfidence: number;
}

export interface CompoundQuestionSplitResult {
  parentQuestion: {
    type: 'question';
    title: string;
    content: string;
  };
  childQuestions: ChildQuestionDraft[];
  orderingStrategy: SubQuestionOrderingStrategy;
  fallbackReason?: string;
  metadata: AiExecutionMetadata;
}
