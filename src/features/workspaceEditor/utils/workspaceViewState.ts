import type { PreferenceValue, UiPreferences } from '../../nodeDomain';
import type { WorkspaceViewState } from '../workspaceEditorTypes';

export const DEFAULT_WORKSPACE_VIEW_STATE: WorkspaceViewState = {
  collapsedPlanStepIds: [],
  collapsedQuestionBlockIds: [],
  collapsedNodeBodyIds: [],
  expandedHistorySectionIds: [],
};

export function readWorkspaceViewState(
  preferences: UiPreferences | null | undefined,
  workspaceId: string | null | undefined,
) {
  if (!workspaceId) {
    return DEFAULT_WORKSPACE_VIEW_STATE;
  }

  const workspaceViews = preferences?.values.workspaceViews;

  if (!workspaceViews || typeof workspaceViews !== 'object' || Array.isArray(workspaceViews)) {
    return DEFAULT_WORKSPACE_VIEW_STATE;
  }

  return normalizeWorkspaceViewState(
    (workspaceViews as Record<string, unknown>)[workspaceId],
  );
}

export function normalizeWorkspaceViewState(value: unknown): WorkspaceViewState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_WORKSPACE_VIEW_STATE;
  }

  const source = value as Record<string, unknown>;

  return {
    collapsedPlanStepIds: normalizeStringArray(source.collapsedPlanStepIds),
    collapsedQuestionBlockIds: normalizeStringArray(
      source.collapsedQuestionBlockIds,
    ),
    collapsedNodeBodyIds: normalizeStringArray(source.collapsedNodeBodyIds),
    expandedHistorySectionIds: normalizeStringArray(
      source.expandedHistorySectionIds,
    ),
  };
}

export function writeWorkspaceViewState(
  preferences: UiPreferences | null | undefined,
  workspaceId: string,
  workspaceViewState: WorkspaceViewState,
): UiPreferences {
  const previousWorkspaceViews = preferences?.values.workspaceViews;
  const nextWorkspaceViews: Record<string, PreferenceValue> = {
    ...(previousWorkspaceViews &&
    typeof previousWorkspaceViews === 'object' &&
    !Array.isArray(previousWorkspaceViews)
      ? (previousWorkspaceViews as Record<string, PreferenceValue>)
      : {}),
    [workspaceId]: workspaceViewState as unknown as PreferenceValue,
  };

  return {
    updatedAt: new Date().toISOString(),
    values: {
      ...(preferences?.values ?? {}),
      workspaceViews: nextWorkspaceViews,
    },
  };
}

export function getAnswerHistorySectionId(answerNodeId: string) {
  return `answer:${answerNodeId}:history`;
}

export function getSummaryHistorySectionId(summaryNodeId: string) {
  return `summary:${summaryNodeId}:history`;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}
