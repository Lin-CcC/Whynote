import type { ChangeEvent } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { AiConfig } from '../../learningEngine';

type WorkspaceRuntimeAiConfigCardProps = {
  aiConfig: AiConfig;
  onAiConfigChange: (patch: Partial<AiConfig>) => void;
  onSaveAiConfig: () => void;
};

export default function WorkspaceRuntimeAiConfigCard({
  aiConfig,
  onAiConfigChange,
  onSaveAiConfig,
}: WorkspaceRuntimeAiConfigCardProps) {
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
          <h2 className="workspace-sectionTitle">最小可运行配置</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        首版不做完整设置页，只在本地保存 OpenAI-compatible 三项配置。
      </p>
      <div className="workspace-runtimeForm">
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
      </div>
      <div className="workspace-actionGrid">
        <button onClick={onSaveAiConfig} type="button">
          保存 AI 配置
        </button>
      </div>
    </SectionCard>
  );
}
