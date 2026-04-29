import { type ChangeEvent, useEffect, useState } from 'react';

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
  onDeleteAiPreset: (presetId: string) => void;
  onOverwriteAiPreset: (presetId: string) => void;
  onRenameAiPreset: (presetId: string, nextName: string) => void;
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
  onDeleteAiPreset,
  onOverwriteAiPreset,
  onRenameAiPreset,
  onSaveAiConfig,
  onSaveAiPreset,
}: WorkspaceRuntimeAiConfigCardProps) {
  const selectedTemplate = getAiConfigTemplateById(aiSelectedTemplateId);
  const selectedPreset =
    aiPresets.find((preset) => preset.id === aiSelectedPresetId) ?? null;
  const canCreatePreset = Boolean(aiPresetDraftName.trim());
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameDraftName, setRenameDraftName] = useState('');

  useEffect(() => {
    if (!renamingPresetId) {
      return;
    }

    const renamingPresetExists = aiPresets.some(
      (preset) => preset.id === renamingPresetId,
    );

    if (!renamingPresetExists) {
      setRenamingPresetId(null);
      setRenameDraftName('');
    }
  }, [aiPresets, renamingPresetId]);

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

  function handleRenameStart(preset: AiConfigPreset) {
    setRenamingPresetId(preset.id);
    setRenameDraftName(preset.name);
  }

  function handleRenameDraftNameChange(event: ChangeEvent<HTMLInputElement>) {
    setRenameDraftName(event.target.value);
  }

  function handleRenameCancel() {
    setRenamingPresetId(null);
    setRenameDraftName('');
  }

  function handleRenameSave(preset: AiConfigPreset) {
    const normalizedName = renameDraftName.trim();

    if (!normalizedName || normalizedName === preset.name) {
      return;
    }

    onRenameAiPreset(preset.id, normalizedName);
    handleRenameCancel();
  }

  function handleDeletePreset(preset: AiConfigPreset) {
    const shouldDelete = window.confirm(
      getPresetDeleteConfirmationText(preset.name),
    );

    if (!shouldDelete) {
      return;
    }

    onDeleteAiPreset(preset.id);

    if (renamingPresetId === preset.id) {
      handleRenameCancel();
    }
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
          <span>当前配置</span>
          <select
            name="ai-preset"
            onChange={handlePresetChange}
            value={aiSelectedPresetId ?? ''}
          >
            <option value="">当前配置（未保存）</option>
            {aiPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <p className="workspace-helpText">
          {selectedPreset
            ? `当前配置正在使用已保存预设「${selectedPreset.name}」。修改 Base URL / API Key / Model 或切换模板后，会回到“当前配置（未保存）”。`
            : '当前字段值只是当前配置，暂未绑定到任何已保存预设。'}
        </p>
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
        <label className="workspace-runtimeField">
          <span>新预设名称</span>
          <input
            disabled={Boolean(selectedPreset)}
            name="ai-preset-name"
            onChange={handlePresetDraftNameChange}
            placeholder="例如：我的 Gemini"
            type="text"
            value={aiPresetDraftName}
          />
        </label>
        <p className="workspace-helpText">
          {selectedPreset
            ? '当前正在使用已保存预设；如需另存为新预设，先切回“当前配置（未保存）”。'
            : '只在保存为新预设时使用。'}
        </p>
      </div>
      <div className="workspace-actionGrid">
        <button className="workspace-primaryAction" onClick={onSaveAiConfig} type="button">
          保存当前配置
        </button>
        <button
          disabled={!selectedPreset && !canCreatePreset}
          onClick={onSaveAiPreset}
          type="button"
        >
          {selectedPreset ? '覆盖当前预设' : '保存为新预设'}
        </button>
      </div>
      <p className="workspace-actionHint">
        {selectedPreset
          ? '当前会覆盖已选中的本地预设内容，不会改名。要改名或删除，请到下方“已保存预设”。'
          : !canCreatePreset
            ? '要保存为预设，先填一个新预设名称。'
            : '当前会把这组三项配置保存成新的本地预设。'}
      </p>
      <div className="workspace-secondaryActionSection">
        <div className="workspace-sectionHeader">
          <div>
            <h3 className="workspace-subsectionTitle">已保存预设</h3>
            <p className="workspace-helpText">
              删除只移除后续切换入口，不会改动当前正在运行的 Base URL / API Key / Model。
            </p>
          </div>
        </div>
        {aiPresets.length === 0 ? (
          <p className="workspace-helpText">
            还没有已保存预设。先把当前配置保存为新预设。
          </p>
        ) : (
          <div className="workspace-presetList">
            {aiPresets.map((preset) => {
              const isSelectedPreset = selectedPreset?.id === preset.id;
              const isRenamingPreset = renamingPresetId === preset.id;
              const canRenamePreset =
                Boolean(renameDraftName.trim()) &&
                renameDraftName.trim() !== preset.name;

              return (
                <div className="workspace-presetItem" key={preset.id}>
                  {isRenamingPreset ? (
                    <div className="workspace-presetRename">
                      <label className="workspace-runtimeField">
                        <span>重命名预设</span>
                        <input
                          aria-label={`重命名预设：${preset.name}`}
                          onChange={handleRenameDraftNameChange}
                          type="text"
                          value={renameDraftName}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="workspace-presetSummary">
                      <div className="workspace-presetTitleRow">
                        <p className="workspace-presetName">{preset.name}</p>
                        {isSelectedPreset ? (
                          <span className="workspace-presetBadge">当前配置</span>
                        ) : null}
                      </div>
                      <p className="workspace-helpText">
                        模板：{getAiConfigTemplateById(preset.templateId).label}
                        {' · '}
                        Model：{preset.model || '未填写'}
                      </p>
                    </div>
                  )}
                  <div className="workspace-presetActions">
                    {isRenamingPreset ? (
                      <>
                        <button
                          className="workspace-inlineAction"
                          disabled={!canRenamePreset}
                          onClick={() => {
                            handleRenameSave(preset);
                          }}
                          type="button"
                        >
                          保存名称
                        </button>
                        <button
                          className="workspace-inlineAction"
                          onClick={handleRenameCancel}
                          type="button"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label={`切换到预设：${preset.name}`}
                          className="workspace-inlineAction"
                          disabled={isSelectedPreset}
                          onClick={() => {
                            onAiPresetChange(preset.id);
                          }}
                          type="button"
                        >
                          {isSelectedPreset ? '使用中' : '使用'}
                        </button>
                        <button
                          aria-label={`用当前配置覆盖预设：${preset.name}`}
                          className="workspace-inlineAction"
                          onClick={() => {
                            onOverwriteAiPreset(preset.id);
                          }}
                          type="button"
                        >
                          {isSelectedPreset ? '覆盖当前预设' : '用当前配置覆盖'}
                        </button>
                        <button
                          aria-label={`重命名预设：${preset.name}`}
                          className="workspace-inlineAction"
                          onClick={() => {
                            handleRenameStart(preset);
                          }}
                          type="button"
                        >
                          重命名
                        </button>
                        <button
                          aria-label={`删除预设：${preset.name}`}
                          className="workspace-inlineAction"
                          onClick={() => {
                            handleDeletePreset(preset);
                          }}
                          type="button"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function getPresetDeleteConfirmationText(presetName: string) {
  return [
    `是否删除本地预设「${presetName}」？`,
    '删除后不会影响当前正在运行的配置值，只是以后不能再从列表里直接切回这个预设。',
    '如果它正被当前配置使用，界面会回到“当前配置（未保存）”。',
  ].join('\n');
}
