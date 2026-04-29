import { afterEach, describe, expect, it } from 'vitest';

import {
  createLocalStorageStore,
  type StructuredDataStorage,
} from '../../nodeDomain';
import { createWorkspaceRuntimeService } from './workspaceRuntimeService';

describe('workspaceRuntimeService AI config preferences', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('loads legacy bare AI settings without losing the current config', () => {
    const localPreferenceStorage = createLocalStorageStore({
      prefix: `whynote-ai-config-legacy-${crypto.randomUUID()}`,
      storage: window.localStorage,
    });

    localPreferenceStorage.saveSettings({
      values: {
        locale: 'zh-CN',
        'ai.apiKey': 'legacy-key',
        'ai.baseUrl':
          'https://generativelanguage.googleapis.com/v1beta/openai',
        'ai.model': 'gemini-2.5-flash',
      },
      updatedAt: '2026-04-29T00:00:00.000Z',
    });

    const service = createWorkspaceRuntimeService({
      structuredDataStorage: createUnusedStructuredDataStorage(),
      localPreferenceStorage,
      defaultLearningMode: 'standard',
    });

    expect(service.loadAiConfigPreferences()).toEqual({
      config: {
        apiKey: 'legacy-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
      },
      presets: [],
      selectedPresetId: null,
      selectedTemplateId: 'gemini-openai-compatible',
    });
  });

  it('saves presets and selection state while preserving other local preferences', () => {
    const localPreferenceStorage = createLocalStorageStore({
      prefix: `whynote-ai-config-presets-${crypto.randomUUID()}`,
      storage: window.localStorage,
    });

    localPreferenceStorage.saveSettings({
      values: {
        locale: 'zh-CN',
        autosave: true,
      },
      updatedAt: '2026-04-29T00:00:00.000Z',
    });

    const service = createWorkspaceRuntimeService({
      structuredDataStorage: createUnusedStructuredDataStorage(),
      localPreferenceStorage,
      defaultLearningMode: 'standard',
    });

    service.saveAiConfigPreferences({
      config: {
        apiKey: 'gemini-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
      },
      presets: [
        {
          id: 'preset-gemini',
          name: '我的 Gemini',
          templateId: 'gemini-openai-compatible',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'gemini-key',
          model: 'gemini-2.5-flash',
          updatedAt: '2026-04-29T01:00:00.000Z',
        },
      ],
      selectedPresetId: 'preset-gemini',
      selectedTemplateId: 'gemini-openai-compatible',
    });

    expect(localPreferenceStorage.loadSettings()).toEqual({
      values: {
        locale: 'zh-CN',
        autosave: true,
        'ai.apiKey': 'gemini-key',
        'ai.baseUrl':
          'https://generativelanguage.googleapis.com/v1beta/openai',
        'ai.model': 'gemini-2.5-flash',
        'ai.presets': [
          {
            id: 'preset-gemini',
            name: '我的 Gemini',
            templateId: 'gemini-openai-compatible',
            baseUrl:
              'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: 'gemini-key',
            model: 'gemini-2.5-flash',
            updatedAt: '2026-04-29T01:00:00.000Z',
          },
        ],
        'ai.selectedPresetId': 'preset-gemini',
        'ai.selectedTemplateId': 'gemini-openai-compatible',
      },
      updatedAt: expect.any(String),
    });
    expect(service.loadAiConfigPreferences()).toEqual({
      config: {
        apiKey: 'gemini-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
      },
      presets: [
        {
          id: 'preset-gemini',
          name: '我的 Gemini',
          templateId: 'gemini-openai-compatible',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'gemini-key',
          model: 'gemini-2.5-flash',
          updatedAt: '2026-04-29T01:00:00.000Z',
        },
      ],
      selectedPresetId: 'preset-gemini',
      selectedTemplateId: 'gemini-openai-compatible',
    });
  });

  it('drops a persisted preset selection when stored config no longer matches that preset', () => {
    const localPreferenceStorage = createLocalStorageStore({
      prefix: `whynote-ai-config-stale-preset-${crypto.randomUUID()}`,
      storage: window.localStorage,
    });

    localPreferenceStorage.saveSettings({
      values: {
        'ai.apiKey': 'custom-key',
        'ai.baseUrl': 'https://example.com/v1',
        'ai.model': 'custom-model',
        'ai.presets': [
          {
            id: 'preset-gemini',
            name: '我的 Gemini',
            templateId: 'gemini-openai-compatible',
            baseUrl:
              'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: 'gemini-key',
            model: 'gemini-2.5-flash',
            updatedAt: '2026-04-29T01:00:00.000Z',
          },
        ],
        'ai.selectedPresetId': 'preset-gemini',
        'ai.selectedTemplateId': 'custom-openai-compatible',
      },
      updatedAt: '2026-04-29T02:00:00.000Z',
    });

    const service = createWorkspaceRuntimeService({
      structuredDataStorage: createUnusedStructuredDataStorage(),
      localPreferenceStorage,
      defaultLearningMode: 'standard',
    });

    expect(service.loadAiConfigPreferences()).toEqual({
      config: {
        apiKey: 'custom-key',
        baseUrl: 'https://example.com/v1',
        model: 'custom-model',
      },
      presets: [
        {
          id: 'preset-gemini',
          name: '我的 Gemini',
          templateId: 'gemini-openai-compatible',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'gemini-key',
          model: 'gemini-2.5-flash',
          updatedAt: '2026-04-29T01:00:00.000Z',
        },
      ],
      selectedPresetId: null,
      selectedTemplateId: 'custom-openai-compatible',
    });
  });
});

function createUnusedStructuredDataStorage(): StructuredDataStorage {
  return {
    async close() {},
    async deleteWorkspace() {},
    async listResourceMetadata() {
      return [];
    },
    async listWorkspaces() {
      return [];
    },
    async loadWorkspace() {
      return null;
    },
    async saveWorkspace() {},
    async upsertResourceMetadata() {},
  };
}
