import { createOpenAiCompatibleProviderClient } from '../../learningEngine';
import {
  createIndexedDbStorage,
  createLocalStorageStore,
} from '../../nodeDomain';
import type { WorkspaceRuntimeDependencies } from '../workspaceRuntimeTypes';

export function createDefaultWorkspaceRuntimeDependencies(): WorkspaceRuntimeDependencies {
  return {
    structuredDataStorage: createIndexedDbStorage(),
    localPreferenceStorage: createLocalStorageStore(),
    createProviderClient: createOpenAiCompatibleProviderClient,
    defaultLearningMode: 'standard',
  };
}
