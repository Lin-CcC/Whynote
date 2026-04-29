import type { AiConfig } from '../../learningEngine';
import type { AppSettings, PreferenceValue } from '../../nodeDomain';

export interface AiConfigTemplate {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  modelSuggestions: string[];
  helpText: string;
}

export interface AiConfigPreset {
  id: string;
  name: string;
  templateId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  updatedAt: string;
}

export interface StoredAiConfigPreferences {
  config: AiConfig;
  presets: AiConfigPreset[];
  selectedPresetId: string | null;
  selectedTemplateId: string;
}

export const AI_CONFIG_TEMPLATES = [
  {
    id: 'gemini-openai-compatible',
    label: 'Gemini (OpenAI-compatible)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    modelSuggestions: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    helpText:
      '适用于当前 OpenAI-compatible 请求链路。只会帮你填入 Gemini 的兼容 base URL 和推荐 model，API Key 仍由你本地保存。',
  },
  {
    id: 'custom-openai-compatible',
    label: '自定义 OpenAI-compatible',
    baseUrl: '',
    defaultModel: '',
    modelSuggestions: [],
    helpText:
      '用于你已经知道 base URL 和 model 的 OpenAI-compatible 接口。当前不会扩展到非 OpenAI-compatible 协议。',
  },
] as const satisfies readonly AiConfigTemplate[];

export const AI_CONFIG_SETTINGS_KEYS = {
  apiKey: 'ai.apiKey',
  baseUrl: 'ai.baseUrl',
  model: 'ai.model',
  presets: 'ai.presets',
  selectedPresetId: 'ai.selectedPresetId',
  selectedTemplateId: 'ai.selectedTemplateId',
} as const;

export function getAiConfigTemplateById(templateId: string) {
  return (
    AI_CONFIG_TEMPLATES.find((template) => template.id === templateId) ??
    AI_CONFIG_TEMPLATES[AI_CONFIG_TEMPLATES.length - 1]
  );
}

export function getDefaultAiPresetName(templateId: string) {
  switch (templateId) {
    case 'gemini-openai-compatible':
      return '我的 Gemini';
    default:
      return '我的 OpenAI-compatible';
  }
}

export function inferAiTemplateId(config: Pick<AiConfig, 'baseUrl'>) {
  const normalizedBaseUrl = normalizeString(config.baseUrl).replace(/\/+$/u, '');

  if (!normalizedBaseUrl) {
    return 'custom-openai-compatible';
  }

  return (
    AI_CONFIG_TEMPLATES.find(
      (template) =>
        normalizeString(template.baseUrl).replace(/\/+$/u, '') === normalizedBaseUrl,
    )?.id ?? 'custom-openai-compatible'
  );
}

export function loadStoredAiConfigPreferences(
  settings: AppSettings | null,
): StoredAiConfigPreferences {
  const values = settings?.values ?? {};
  const presets = readAiConfigPresets(values[AI_CONFIG_SETTINGS_KEYS.presets]);
  const rawSelectedPresetId = readOptionalString(
    values[AI_CONFIG_SETTINGS_KEYS.selectedPresetId],
  );
  const matchedPreset = presets.find((preset) => preset.id === rawSelectedPresetId) ?? null;
  const config = {
    apiKey:
      readOptionalString(values[AI_CONFIG_SETTINGS_KEYS.apiKey]) ??
      matchedPreset?.apiKey ??
      '',
    baseUrl:
      readOptionalString(values[AI_CONFIG_SETTINGS_KEYS.baseUrl]) ??
      matchedPreset?.baseUrl ??
      '',
    model:
      readOptionalString(values[AI_CONFIG_SETTINGS_KEYS.model]) ??
      matchedPreset?.model ??
      '',
  } satisfies AiConfig;
  const selectedPreset = doesAiConfigMatchPreset(config, matchedPreset)
    ? matchedPreset
    : null;
  const selectedTemplateId = resolveStoredTemplateId(
    values[AI_CONFIG_SETTINGS_KEYS.selectedTemplateId],
    selectedPreset?.templateId,
    config,
  );

  return {
    config,
    presets,
    selectedPresetId: selectedPreset?.id ?? null,
    selectedTemplateId,
  };
}

export function saveStoredAiConfigPreferences(
  previousSettings: AppSettings | null,
  preferences: StoredAiConfigPreferences,
) {
  const serializedPresets = preferences.presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    templateId: preset.templateId,
    baseUrl: preset.baseUrl,
    apiKey: preset.apiKey,
    model: preset.model,
    updatedAt: preset.updatedAt,
  })) satisfies PreferenceValue[];

  return {
    values: {
      ...previousSettings?.values,
      [AI_CONFIG_SETTINGS_KEYS.apiKey]: preferences.config.apiKey,
      [AI_CONFIG_SETTINGS_KEYS.baseUrl]: preferences.config.baseUrl,
      [AI_CONFIG_SETTINGS_KEYS.model]: preferences.config.model,
      [AI_CONFIG_SETTINGS_KEYS.presets]: serializedPresets,
      [AI_CONFIG_SETTINGS_KEYS.selectedPresetId]: preferences.selectedPresetId,
      [AI_CONFIG_SETTINGS_KEYS.selectedTemplateId]: preferences.selectedTemplateId,
    } satisfies Record<string, PreferenceValue>,
    updatedAt: new Date().toISOString(),
  } satisfies AppSettings;
}

function resolveStoredTemplateId(
  storedTemplateId: unknown,
  selectedPresetTemplateId: string | undefined,
  config: Pick<AiConfig, 'baseUrl'>,
) {
  const normalizedStoredTemplateId = readOptionalString(storedTemplateId);

  if (normalizedStoredTemplateId) {
    return getAiConfigTemplateById(normalizedStoredTemplateId).id;
  }

  if (selectedPresetTemplateId) {
    return getAiConfigTemplateById(selectedPresetTemplateId).id;
  }

  return inferAiTemplateId(config);
}

function readAiConfigPresets(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const preset = readAiConfigPreset(entry);

    return preset ? [preset] : [];
  });
}

function readAiConfigPreset(value: unknown): AiConfigPreset | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readOptionalString(value.id);
  const name = readOptionalString(value.name);
  const templateId = readOptionalString(value.templateId);
  const baseUrl = readOptionalString(value.baseUrl);
  const apiKey = readOptionalString(value.apiKey);
  const model = readOptionalString(value.model);
  const updatedAt = readOptionalString(value.updatedAt);

  if (
    !id ||
    !name ||
    !templateId ||
    baseUrl === null ||
    apiKey === null ||
    model === null ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    name,
    templateId: getAiConfigTemplateById(templateId).id,
    baseUrl,
    apiKey,
    model,
    updatedAt,
  };
}

function doesAiConfigMatchPreset(
  config: Pick<AiConfig, 'apiKey' | 'baseUrl' | 'model'>,
  preset: AiConfigPreset | null,
) {
  if (!preset) {
    return false;
  }

  return (
    config.apiKey === preset.apiKey &&
    config.baseUrl === preset.baseUrl &&
    config.model === preset.model
  );
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function normalizeString(value: string) {
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
