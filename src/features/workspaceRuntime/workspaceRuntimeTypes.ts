import type {
  AiConfig,
  AiProviderClient,
  CompletionSuggestionResult,
  LearningMode,
} from '../learningEngine';
import type {
  LocalPreferenceStorage,
  StructuredDataStorage,
} from '../nodeDomain';
import type { WorkspaceSnapshot } from '../nodeDomain';

export interface WorkspaceRuntimeDependencies {
  structuredDataStorage: StructuredDataStorage;
  localPreferenceStorage: LocalPreferenceStorage;
  createProviderClient?: (config: AiConfig) => AiProviderClient;
  defaultLearningMode?: LearningMode;
}

export interface WorkspaceRuntimeSelectionState {
  currentModuleId: string | null;
  selectedNodeId: string | null;
}

export interface WorkspaceInitializationResult {
  snapshot: WorkspaceSnapshot;
  initialModuleId: string | null;
  initialSelectedNodeId: string | null;
}

export interface WorkspaceMutationResult {
  snapshot?: WorkspaceSnapshot;
  nextModuleId?: string | null;
  nextSelectedNodeId?: string | null;
  message?: string;
  completionSuggestion?: CompletionSuggestionResult;
}

export interface WorkspaceRuntimeStatusState {
  isInitializing: boolean;
  loadError: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  isAiRunning: boolean;
  activeAiActionLabel: string | null;
  aiError: string | null;
  runtimeMessage: string | null;
  completionSuggestion: CompletionSuggestionResult | null;
}
