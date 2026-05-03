import type { PreferenceValue, UiPreferences } from '../../nodeDomain';
import type {
  StructureMapFocusTarget,
  WorkspaceViewState,
} from '../workspaceEditorTypes';

const WORKSPACE_VIEW_LAYOUT_VERSION = 2;

export const DEFAULT_WORKSPACE_VIEW_STATE: WorkspaceViewState = {
  collapsedPlanStepIds: [],
  collapsedQuestionBlockIds: [],
  collapsedNodeBodyIds: [],
  collapsedStructureMapStepIds: [],
  collapsedStructureMapClusterIds: [],
  collapsedStructureMapFollowUpIds: [],
  expandedHistorySectionIds: [],
  focusMode: false,
  leftRailMode: 'collapsed',
  mainViewMode: 'document',
  rightRailMode: 'collapsed',
  structureMapFocusTarget: null,
  tagVisibilityMode: 'hover',
  toolPanel: 'resources',
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
  const hasCurrentLayoutPreference =
    source.layoutVersion === WORKSPACE_VIEW_LAYOUT_VERSION;

  return {
    collapsedPlanStepIds: normalizeStringArray(source.collapsedPlanStepIds),
    collapsedQuestionBlockIds: normalizeStringArray(
      source.collapsedQuestionBlockIds,
    ),
    collapsedNodeBodyIds: normalizeStringArray(source.collapsedNodeBodyIds),
    collapsedStructureMapStepIds: normalizeStringArray(
      source.collapsedStructureMapStepIds,
    ),
    collapsedStructureMapClusterIds: normalizeStringArray(
      source.collapsedStructureMapClusterIds,
    ),
    collapsedStructureMapFollowUpIds: normalizeStringArray(
      source.collapsedStructureMapFollowUpIds,
    ),
    expandedHistorySectionIds: normalizeStringArray(
      source.expandedHistorySectionIds,
    ),
    focusMode: source.focusMode === true,
    leftRailMode:
      source.leftRailMode === 'expanded' && hasCurrentLayoutPreference
        ? 'expanded'
        : 'collapsed',
    mainViewMode:
      source.mainViewMode === 'structure-map' ? 'structure-map' : 'document',
    rightRailMode:
      source.rightRailMode === 'expanded' ? 'expanded' : 'collapsed',
    structureMapFocusTarget: normalizeStructureMapFocusTarget(
      source.structureMapFocusTarget,
    ),
    tagVisibilityMode:
      source.tagVisibilityMode === 'always' ? 'always' : 'hover',
    toolPanel: normalizeToolPanelId(source.toolPanel),
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
    [workspaceId]: {
      ...(workspaceViewState as unknown as Record<string, PreferenceValue>),
      layoutVersion: WORKSPACE_VIEW_LAYOUT_VERSION,
    },
  };

  return {
    updatedAt: new Date().toISOString(),
    values: {
      ...(preferences?.values ?? {}),
      workspaceViews: nextWorkspaceViews,
    },
  };
}

function normalizeToolPanelId(value: unknown): WorkspaceViewState['toolPanel'] {
  switch (value) {
    case 'references':
    case 'export':
    case 'ai':
    case 'settings':
      return value;
    default:
      return 'resources';
  }
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

function normalizeStructureMapFocusTarget(
  value: unknown,
): StructureMapFocusTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    (source.kind !== 'plan-step' && source.kind !== 'question-cluster') ||
    typeof source.nodeId !== 'string'
  ) {
    return null;
  }

  return {
    kind: source.kind,
    nodeId: source.nodeId,
  };
}
