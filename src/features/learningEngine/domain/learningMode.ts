export interface LearningModeLimits {
  moduleCount: {
    min: number;
    max: number;
    target: number;
  };
  planStepCount: {
    min: number;
    max: number;
    target: number;
  };
}

export const LEARNING_MODE_LIMITS = {
  quick: {
    moduleCount: {
      min: 2,
      max: 3,
      target: 2,
    },
    planStepCount: {
      min: 2,
      max: 3,
      target: 2,
    },
  },
  standard: {
    moduleCount: {
      min: 3,
      max: 5,
      target: 4,
    },
    planStepCount: {
      min: 3,
      max: 5,
      target: 4,
    },
  },
  deep: {
    moduleCount: {
      min: 4,
      max: 7,
      target: 5,
    },
    planStepCount: {
      min: 4,
      max: 6,
      target: 5,
    },
  },
} as const satisfies Record<string, LearningModeLimits>;

export type LearningMode = keyof typeof LEARNING_MODE_LIMITS;

export const DEFAULT_LEARNING_MODE: LearningMode = 'standard';

export function normalizeLearningMode(mode?: LearningMode): LearningMode {
  return mode ?? DEFAULT_LEARNING_MODE;
}

export function getLearningModeLimits(mode?: LearningMode): LearningModeLimits {
  return LEARNING_MODE_LIMITS[normalizeLearningMode(mode)];
}

export function getLearningModeLabel(mode?: LearningMode) {
  switch (normalizeLearningMode(mode)) {
    case 'quick':
      return '快速';
    case 'deep':
      return '深度';
    case 'standard':
    default:
      return '标准';
  }
}
