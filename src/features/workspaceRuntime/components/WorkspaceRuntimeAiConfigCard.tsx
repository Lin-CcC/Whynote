import type { ChangeEvent } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { AiConfig } from '../../learningEngine';
import {
  AI_CONFIG_TEMPLATES,
  getAiConfigTemplateById,
  type AiConfigPreset,
} from '../services/aiConfigPresets';

type WorkspaceRuntimeAiConfigCardProps = {
  aiConfig: AiConfig;
  aiPresetDraftName: string;
  aiPresets: AiConfigPreset[];
  aiSelectedPresetId: string | null;
  aiSelectedTemplateId: string;
  onAiConfigChange: (patch: Partial<AiConfig>) => void;
  onAiPresetChange: (presetId: string | null) => void;
  onAiPresetDraftNameChange: (name: string) => void;
  onAiTemplateChange: (templateId: string) => void;
  onSaveAiConfig: () => void;
  onSaveAiPreset: () => void;
};

export default function WorkspaceRuntimeAiConfigCard({
  aiConfig,
  aiPresetDraftName,
  aiPresets,
  aiSelectedPresetId,
  aiSelectedTemplateId,
  onAiConfigChange,
  onAiPresetChange,
  onAiPresetDraftNameChange,
  onAiTemplateChange,
  onSaveAiConfig,
  onSaveAiPreset,
}: WorkspaceRuntimeAiConfigCardProps) {
  const selectedTemplate = getAiConfigTemplateById(aiSelectedTemplateId);

  function handleTemplateChange(event: ChangeEvent<HTMLSelectElement>) {
    onAiTemplateChange(event.target.value);
  }

  function handlePresetChange(event: ChangeEvent<HTMLSelectElement>) {
    onAiPresetChange(event.target.value || null);
  }

  function handlePresetDraftNameChange(event: ChangeEvent<HTMLInputElement>) {
    onAiPresetDraftNameChange(event.target.value);
  }

  function handleBaseUrlChange(event: ChangeEvent<HTMLInputElement>) {
    onAiConfigChange({
      baseUrl: event.target.value,
    });
  }

  function handleApiKeyChange(event: ChangeEvent<HTMLInputElement>) {
    onAiConfigChange({
      apiKey: event.target.value,
    });
  }

  function handleModelChange(event: ChangeEvent<HTMLInputElement>) {
    onAiConfigChange({
      model: event.target.value,
    });
  }

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">AI 配置</p>
          <h2 className="workspace-sectionTitle">模板 + 本地预设</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        当前仍只服务 OpenAI-compatible 配置体验。模板只提供厂商默认壳子，预设才保存你的本地实例和密钥。
      </p>
      <div className="workspace-runtimeForm">
        <label className="workspace-runtimeField">
          <span>厂商模板</span>
          <select
            name="ai-template"
            onChange={handleTemplateChange}
            value={aiSelectedTemplateId}
          >
            {AI_CONFIG_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <p className="workspace-helpText">{selectedTemplate.helpText}</p>
        <label className="workspace-runtimeField">
          <span>本地预设</span>
          <select
            name="ai-preset"
            onChange={handlePresetChange}
            value={aiSelectedPresetId ?? ''}
          >
            <option value="">当前配置（未保存为预设）</option>
            {aiPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="workspace-runtimeField">
          <span>预设名称</span>
          <input
            name="ai-preset-name"
            onChange={handlePresetDraftNameChange}
            placeholder="例如：我的 Gemini"
            type="text"
            value={aiPresetDraftName}
          />
        </label>
        <label className="workspace-runtimeField">
          <span>Base URL</span>
          <input
            name="ai-base-url"
            onChange={handleBaseUrlChange}
            type="text"
            value={aiConfig.baseUrl}
          />
        </label>
        <label className="workspace-runtimeField">
          <span>API Key</span>
          <input
            name="ai-api-key"
            onChange={handleApiKeyChange}
            type="password"
            value={aiConfig.apiKey}
          />
        </label>
        <label className="workspace-runtimeField">
          <span>Model</span>
          <input
            name="ai-model"
            onChange={handleModelChange}
            type="text"
            value={aiConfig.model}
          />
        </label>
        {selectedTemplate.modelSuggestions.length > 0 ? (
          <p className="workspace-helpText">
            推荐 Model：{selectedTemplate.modelSuggestions.join(' / ')}
          </p>
        ) : (
          <p className="workspace-helpText">
            自定义模板不会推断 model；请按你的 OpenAI-compatible 接口实际能力填写。
          </p>
        )}
      </div>
      <div className="workspace-actionGrid">
        <button onClick={onSaveAiConfig} type="button">
          保存当前配置
        </button>
        <button
          disabled={!aiPresetDraftName.trim()}
          onClick={onSaveAiPreset}
          type="button"
        >
          {aiSelectedPresetId ? '覆盖当前预设' : '保存为新预设'}
        </button>
      </div>
    </SectionCard>
  );
}
