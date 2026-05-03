import type { UiPreferences } from '../../nodeDomain';
import type { WorkspaceViewState } from '../../workspaceEditor/workspaceEditorTypes';

export function readCompleteWorkspaceViewStateForExport(
  preferences: UiPreferences | null | undefined,
  workspaceId: string | null | undefined,
): WorkspaceViewState | null {
  if (!workspaceId) {
    return null;
  }

  const workspaceViews = preferences?.values.workspaceViews;

  if (!isRecord(workspaceViews)) {
    return null;
  }

  const workspaceViewValue = workspaceViews[workspaceId];

  if (!isRecord(workspaceViewValue)) {
    return null;
  }

  const collapsedQuestionBlockIds = readRequiredStringArray(
    workspaceViewValue.collapsedQuestionBlockIds,
  );
  const collapsedPlanStepIds = readRequiredStringArray(
    workspaceViewValue.collapsedPlanStepIds,
  );
  const collapsedNodeBodyIds = readRequiredStringArray(
    workspaceViewValue.collapsedNodeBodyIds,
  );
  const expandedHistorySectionIds = readRequiredStringArray(
    workspaceViewValue.expandedHistorySectionIds,
  );

  if (
    !collapsedPlanStepIds ||
    !collapsedQuestionBlockIds ||
    !collapsedNodeBodyIds ||
    !expandedHistorySectionIds
  ) {
    return null;
  }

  return {
    collapsedPlanStepIds,
    collapsedNodeBodyIds,
    collapsedQuestionBlockIds,
    collapsedStructureMapClusterIds: [],
    collapsedStructureMapFollowUpIds: [],
    collapsedStructureMapStepIds: [],
    expandedHistorySectionIds,
    focusMode: false,
    leftRailMode: 'expanded',
    mainViewMode: 'document',
    rightRailMode: 'collapsed',
    structureMapFocusTarget: null,
    tagVisibilityMode: 'hover',
    toolPanel: 'resources',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredStringArray(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null;
  }

  return [...new Set(value)];
}
