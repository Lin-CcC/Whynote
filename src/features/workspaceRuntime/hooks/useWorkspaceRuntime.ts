import { useEffect, useRef, useState } from 'react';

import type { AiConfig } from '../../learningEngine';
import type { ResourceMetadataRecord, WorkspaceSnapshot } from '../../nodeDomain';
import type { ResourceImportDraft } from '../../resourcesSearchExport/services/resourceIngestTypes';
import type { WorkspaceEditorLearningActionRequest } from '../../workspaceEditor/workspaceEditorTypes';
import {
  doesAiConfigMatchPreset,
  findAiConfigPresetById,
  getAiConfigTemplateById,
  getDefaultAiPresetName,
  upsertAiConfigPreset,
  type AiConfigPreset,
  type StoredAiConfigPreferences,
} from '../services/aiConfigPresets';
import type { QuestionAnswerEvaluationTarget } from '../services/learningRuntimeContext';
import { createWorkspaceRuntimeService } from '../services/workspaceRuntimeService';
import type {
  WorkspaceRuntimeDependencies,
  WorkspaceMutationResult,
  WorkspaceRuntimeSelectionState,
  WorkspaceRuntimeStatusState,
} from '../workspaceRuntimeTypes';

interface WorkspaceRuntimeState extends WorkspaceRuntimeStatusState {
  aiConfig: AiConfig;
  aiPresetDraftName: string;
  aiPresets: AiConfigPreset[];
  aiSelectedPresetId: string | null;
  aiSelectedTemplateId: string;
  editorSessionKey: number;
  initialModuleId: string | null;
  initialSelectedNodeId: string | null;
  resourceMetadataRecords: ResourceMetadataRecord[];
  snapshot: WorkspaceSnapshot | null;
}

type PendingSaveState = {
  selection: WorkspaceRuntimeSelectionState;
  snapshot: WorkspaceSnapshot;
};

const AUTO_SAVE_DEBOUNCE_MS = 400;
const MIN_SAVING_STATUS_MS = 300;

export function useWorkspaceRuntime(dependencies: WorkspaceRuntimeDependencies) {
  const [runtimeService] = useState(() =>
    createWorkspaceRuntimeService(dependencies),
  );
  const [state, setState] = useState<WorkspaceRuntimeState>(() => {
    const initialAiPreferences = runtimeService.loadAiConfigPreferences();

    return {
      aiConfig: initialAiPreferences.config,
      aiError: null,
      activeAiActionLabel: null,
      aiPresetDraftName: resolveAiPresetDraftName(initialAiPreferences),
      aiPresets: initialAiPreferences.presets,
      aiSelectedPresetId: initialAiPreferences.selectedPresetId,
      aiSelectedTemplateId: initialAiPreferences.selectedTemplateId,
      completionSuggestion: null,
      editorSessionKey: 0,
      initialModuleId: null,
      initialSelectedNodeId: null,
      isAiRunning: false,
      isInitializing: true,
      loadError: null,
      resourceMetadataRecords: [],
      runtimeMessage: null,
      saveError: null,
      saveStatus: 'idle',
      snapshot: null,
    };
  });
  const aiPreferencesRef = useRef<StoredAiConfigPreferences>({
    config: state.aiConfig,
    presets: state.aiPresets,
    selectedPresetId: state.aiSelectedPresetId,
    selectedTemplateId: state.aiSelectedTemplateId,
  });
  const snapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const selectionRef = useRef<WorkspaceRuntimeSelectionState>({
    currentModuleId: null,
    selectedNodeId: null,
  });
  const pendingSaveRef = useRef<PendingSaveState | null>(null);
  const isSavingRef = useRef(false);
  const saveDebounceTimerRef = useRef<number | null>(null);
  const saveStatusTimerRef = useRef<number | null>(null);
  const saveStatusStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    void initializeWorkspace();

    return () => {
      if (saveDebounceTimerRef.current !== null) {
        window.clearTimeout(saveDebounceTimerRef.current);
      }

      if (saveStatusTimerRef.current !== null) {
        window.clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, []);

  function handleSnapshotChange(snapshot: WorkspaceSnapshot) {
    if (state.isAiRunning) {
      return;
    }

    snapshotRef.current = snapshot;
    setState((previousState) => ({
      ...previousState,
      completionSuggestion: null,
      saveError: null,
      saveStatus: isSavingRef.current ? previousState.saveStatus : 'idle',
      snapshot,
    }));
    queueSave(snapshot, selectionRef.current);
  }

  function handleSelectionChange(selection: WorkspaceRuntimeSelectionState) {
    if (state.isAiRunning) {
      return;
    }

    const previousSelection = selectionRef.current;

    selectionRef.current = selection;

    if (hasSelectionChanged(previousSelection, selection)) {
      setState((previousState) => ({
        ...previousState,
        completionSuggestion: null,
      }));
    }

    if (snapshotRef.current) {
      runtimeService.rememberSelectionState(
        snapshotRef.current.workspace.id,
        selection,
      );
    }
  }

  function handleAiConfigChange(patch: Partial<AiConfig>) {
    const selectedPreset = findAiConfigPresetById(
      aiPreferencesRef.current.presets,
      aiPreferencesRef.current.selectedPresetId,
    );
    const nextConfig = {
      ...aiPreferencesRef.current.config,
      ...patch,
    } satisfies AiConfig;
    const shouldDetachPreset = shouldDetachSelectedPreset(
      aiPreferencesRef.current,
      nextConfig,
    );

    applyAiPreferences(
      {
        ...aiPreferencesRef.current,
        config: nextConfig,
        selectedPresetId: shouldDetachPreset
          ? null
          : aiPreferencesRef.current.selectedPresetId,
      },
      shouldDetachPreset && selectedPreset
        ? {
            runtimeMessage: `当前配置已脱离预设：${selectedPreset.name}。现为未保存状态。`,
          }
        : undefined,
    );
  }

  function handleAiTemplateChange(templateId: string) {
    const template = getAiConfigTemplateById(templateId);
    const wasPresetSelected = Boolean(aiPreferencesRef.current.selectedPresetId);
    const nextPreferences = {
      ...aiPreferencesRef.current,
      config: {
        ...aiPreferencesRef.current.config,
        baseUrl: template.baseUrl,
        model: template.defaultModel,
      },
      selectedPresetId: null,
      selectedTemplateId: template.id,
    } satisfies StoredAiConfigPreferences;

    applyAiPreferences(nextPreferences, {
      persist: true,
      presetDraftName:
        state.aiPresetDraftName.trim() || getDefaultAiPresetName(template.id),
      runtimeMessage: wasPresetSelected
        ? `已切换到模板：${template.label}。当前配置已回到未保存状态。`
        : `已切换到模板：${template.label}。`,
    });
  }

  function handleAiPresetChange(presetId: string | null) {
    if (!presetId) {
      applyAiPreferences(
        {
          ...aiPreferencesRef.current,
          selectedPresetId: null,
        },
        {
          persist: true,
          presetDraftName:
            state.aiPresetDraftName.trim() ||
            getDefaultAiPresetName(aiPreferencesRef.current.selectedTemplateId),
          runtimeMessage: '当前配置已切换为未保存状态。',
        },
      );
      return;
    }

    const selectedPreset = aiPreferencesRef.current.presets.find(
      (preset) => preset.id === presetId,
    );

    if (!selectedPreset) {
      return;
    }

    applyAiPreferences(
      {
        config: {
          apiKey: selectedPreset.apiKey,
          baseUrl: selectedPreset.baseUrl,
          model: selectedPreset.model,
        },
        presets: aiPreferencesRef.current.presets,
        selectedPresetId: selectedPreset.id,
        selectedTemplateId: selectedPreset.templateId,
      },
      {
        persist: true,
        presetDraftName: selectedPreset.name,
        runtimeMessage: `已切换到本地预设：${selectedPreset.name}。`,
      },
    );
  }

  function handleAiPresetDraftNameChange(name: string) {
    setState((previousState) => ({
      ...previousState,
      aiPresetDraftName: name,
    }));
  }

  function saveAiConfig() {
    runtimeService.saveAiConfigPreferences(aiPreferencesRef.current);
    setState((previousState) => ({
      ...previousState,
      runtimeMessage: 'AI 配置已保存到本地设置。',
    }));
  }

  function saveAiPreset() {
    const selectedPreset = findAiConfigPresetById(
      aiPreferencesRef.current.presets,
      aiPreferencesRef.current.selectedPresetId,
    );

    if (selectedPreset) {
      overwriteAiPreset(selectedPreset.id);
      return;
    }

    const presetName = state.aiPresetDraftName.trim();

    if (!presetName) {
      return;
    }

    const nextPreset = {
      id: crypto.randomUUID(),
      name: presetName,
      templateId: aiPreferencesRef.current.selectedTemplateId,
      baseUrl: aiPreferencesRef.current.config.baseUrl,
      apiKey: aiPreferencesRef.current.config.apiKey,
      model: aiPreferencesRef.current.config.model,
      updatedAt: new Date().toISOString(),
    } satisfies AiConfigPreset;
    const nextPresets = upsertAiConfigPreset(
      aiPreferencesRef.current.presets,
      nextPreset,
    );

    applyAiPreferences(
      {
        ...aiPreferencesRef.current,
        presets: nextPresets,
        selectedPresetId: nextPreset.id,
      },
      {
        persist: true,
        presetDraftName: presetName,
        runtimeMessage: `已保存本地预设：${presetName}。`,
      },
    );
  }

  function overwriteAiPreset(presetId: string) {
    const targetPreset = findAiConfigPresetById(
      aiPreferencesRef.current.presets,
      presetId,
    );

    if (!targetPreset) {
      return;
    }

    const nextPreset = {
      ...targetPreset,
      templateId: aiPreferencesRef.current.selectedTemplateId,
      baseUrl: aiPreferencesRef.current.config.baseUrl,
      apiKey: aiPreferencesRef.current.config.apiKey,
      model: aiPreferencesRef.current.config.model,
      updatedAt: new Date().toISOString(),
    } satisfies AiConfigPreset;
    const nextPresets = upsertAiConfigPreset(
      aiPreferencesRef.current.presets,
      nextPreset,
    );

    applyAiPreferences(
      {
        ...aiPreferencesRef.current,
        presets: nextPresets,
        selectedPresetId: nextPreset.id,
      },
      {
        persist: true,
        presetDraftName: nextPreset.name,
        runtimeMessage: `已覆盖本地预设：${nextPreset.name}。当前配置已对齐到该预设。`,
      },
    );
  }

  function renameAiPreset(presetId: string, nextName: string) {
    const targetPreset = findAiConfigPresetById(
      aiPreferencesRef.current.presets,
      presetId,
    );
    const normalizedName = nextName.trim();

    if (!targetPreset || !normalizedName || targetPreset.name === normalizedName) {
      return;
    }

    const renamedPreset = {
      ...targetPreset,
      name: normalizedName,
      updatedAt: new Date().toISOString(),
    } satisfies AiConfigPreset;
    const nextPresets = upsertAiConfigPreset(
      aiPreferencesRef.current.presets,
      renamedPreset,
    );

    applyAiPreferences(
      {
        ...aiPreferencesRef.current,
        presets: nextPresets,
      },
      {
        persist: true,
        presetDraftName:
          aiPreferencesRef.current.selectedPresetId === presetId
            ? normalizedName
            : undefined,
        runtimeMessage: `已重命名本地预设：${targetPreset.name} -> ${normalizedName}。`,
      },
    );
  }

  function deleteAiPreset(presetId: string) {
    const targetPreset = findAiConfigPresetById(
      aiPreferencesRef.current.presets,
      presetId,
    );

    if (!targetPreset) {
      return;
    }

    const isDeletingSelectedPreset =
      aiPreferencesRef.current.selectedPresetId === targetPreset.id;
    const nextPresets = aiPreferencesRef.current.presets.filter(
      (preset) => preset.id !== targetPreset.id,
    );

    applyAiPreferences(
      {
        ...aiPreferencesRef.current,
        presets: nextPresets,
        selectedPresetId: isDeletingSelectedPreset
          ? null
          : aiPreferencesRef.current.selectedPresetId,
      },
      {
        persist: true,
        runtimeMessage: isDeletingSelectedPreset
          ? `已删除本地预设：${targetPreset.name}。当前配置保持不变，已回到未保存状态。`
          : `已删除本地预设：${targetPreset.name}。当前配置保持不变。`,
      },
    );
  }

  async function upsertResourceMetadata(record: ResourceMetadataRecord) {
    await runtimeService.upsertResourceMetadata(record);
    setState((previousState) => ({
      ...previousState,
      resourceMetadataRecords: upsertResourceMetadataRecord(
        previousState.resourceMetadataRecords,
        record,
      ),
    }));
  }

  async function resolveResourceSummary(draft: ResourceImportDraft) {
    return runtimeService.resolveResourceSummary(draft, state.aiConfig);
  }

  async function runPlanStepGeneration(moduleNodeId: string) {
    await runAiAction('正在规划学习路径', async (snapshot) =>
      runtimeService.generatePlanSteps(
        snapshot,
        moduleNodeId,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );
  }

  async function runQuestionSplit(questionNodeId: string) {
    await runAiAction('正在拆分复合问题', async (snapshot) =>
      runtimeService.splitQuestion(snapshot, questionNodeId, state.aiConfig),
    );
  }

  async function runQuestionEvaluation(target: QuestionAnswerEvaluationTarget) {
    await runAiAction('正在重新评估当前回答', async (snapshot) =>
      runtimeService.evaluateQuestionAnswer(
        snapshot,
        target.questionNodeId,
        target.answerNodeId,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );
  }

  async function runJudgmentHintGeneration(judgmentNodeId: string) {
    await runAiAction('正在补一条思考提示', async (snapshot) =>
      runtimeService.generateJudgmentHint(
        snapshot,
        judgmentNodeId,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );

    const judgmentNode = snapshotRef.current?.tree.nodes[judgmentNodeId];

    return judgmentNode?.type === 'judgment' && Boolean(judgmentNode.hint?.trim());
  }

  async function runCompletionSuggestion(planStepNodeId: string) {
    await runAiAction('正在整理步骤完成依据', async (snapshot) =>
      runtimeService.suggestPlanStepCompletion(snapshot, planStepNodeId),
    );
  }

  async function runLearningAction(request: WorkspaceEditorLearningActionRequest) {
    await runAiAction(getLearningActionRuntimeLabel(request.actionId), async (snapshot) =>
      runtimeService.generateLearningActionDraft(
        snapshot,
        request,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );
  }

  async function runSummaryEvaluation(summaryNodeId: string) {
    await runAiAction('正在检查这段总结', async (snapshot) =>
      runtimeService.evaluateSummary(
        snapshot,
        summaryNodeId,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );
  }

  async function runQuestionDirectAnswer(
    request: WorkspaceEditorLearningActionRequest,
  ) {
    await runAiAction('正在直接回答当前问题', async (snapshot) =>
      runtimeService.generateLearningActionDraft(
        snapshot,
        request,
        state.aiConfig,
        state.resourceMetadataRecords,
      ),
    );
  }

  return {
    ...state,
    deleteAiPreset,
    handleAiConfigChange,
    handleAiPresetChange,
    handleAiPresetDraftNameChange,
    handleAiTemplateChange,
    handleSelectionChange,
    handleSnapshotChange,
    overwriteAiPreset,
    renameAiPreset,
    retryInitialization: initializeWorkspace,
    resolveResourceSummary,
    runLearningAction,
    runCompletionSuggestion,
    runJudgmentHintGeneration,
    runPlanStepGeneration,
    runQuestionDirectAnswer,
    runQuestionEvaluation,
    runSummaryEvaluation,
    runQuestionSplit,
    saveAiConfig,
    saveAiPreset,
    upsertResourceMetadata,
  };

  async function initializeWorkspace() {
    setState((previousState) => ({
      ...previousState,
      isInitializing: true,
      loadError: null,
    }));

    try {
      const result = await runtimeService.initializeWorkspace();

      snapshotRef.current = result.snapshot;
      selectionRef.current = {
        currentModuleId: result.initialModuleId,
        selectedNodeId: result.initialSelectedNodeId,
      };
      setState((previousState) => ({
        ...previousState,
        completionSuggestion: null,
        editorSessionKey: previousState.editorSessionKey + 1,
        initialModuleId: result.initialModuleId,
        initialSelectedNodeId: result.initialSelectedNodeId,
        isInitializing: false,
        loadError: null,
        resourceMetadataRecords: result.resourceMetadataRecords,
        runtimeMessage: null,
        saveError: null,
        saveStatus: 'saved',
        snapshot: result.snapshot,
      }));
    } catch (error) {
      setState((previousState) => ({
        ...previousState,
        isInitializing: false,
        loadError:
          error instanceof Error ? error.message : '工作区初始化失败。',
      }));
    }
  }

  function queueSave(
    snapshot: WorkspaceSnapshot,
    selection: WorkspaceRuntimeSelectionState,
  ) {
    pendingSaveRef.current = {
      selection,
      snapshot,
    };
    schedulePendingSave();
  }

  function schedulePendingSave() {
    if (saveDebounceTimerRef.current !== null) {
      window.clearTimeout(saveDebounceTimerRef.current);
    }

    saveDebounceTimerRef.current = window.setTimeout(() => {
      saveDebounceTimerRef.current = null;

      if (isSavingRef.current) {
        return;
      }

      void flushPendingSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  async function flushPendingSave() {
    if (isSavingRef.current || !pendingSaveRef.current) {
      return;
    }

    const nextSave = pendingSaveRef.current;

    pendingSaveRef.current = null;
    isSavingRef.current = true;
    saveStatusStartedAtRef.current = Date.now();
    setState((previousState) => ({
      ...previousState,
      saveError: null,
      saveStatus: 'saving',
    }));

    let didSaveSucceed = false;

    try {
      await runtimeService.saveWorkspace(
        nextSave.snapshot,
        nextSave.selection,
      );
      didSaveSucceed = true;
      await waitForMinimumSavingStatus();
      setState((previousState) => ({
        ...previousState,
        saveError: null,
        saveStatus: pendingSaveRef.current ? 'idle' : 'saved',
      }));
    } catch (error) {
      setState((previousState) => ({
        ...previousState,
        saveError:
          error instanceof Error
            ? error.message
            : '工作区保存失败，请稍后重试。',
        saveStatus: 'error',
      }));
    } finally {
      isSavingRef.current = false;
      saveStatusStartedAtRef.current = null;

      if (didSaveSucceed && pendingSaveRef.current) {
        schedulePendingSave();
      }
    }
  }

  async function waitForMinimumSavingStatus() {
    const startedAt = saveStatusStartedAtRef.current;

    if (!startedAt) {
      return;
    }

    const remainingMs = MIN_SAVING_STATUS_MS - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      saveStatusTimerRef.current = window.setTimeout(() => {
        saveStatusTimerRef.current = null;
        resolve();
      }, remainingMs);
    });
  }

  async function runAiAction(
    actionLabel: string,
    executor: (snapshot: WorkspaceSnapshot) => Promise<WorkspaceMutationResult>,
  ) {
    const snapshot = snapshotRef.current;

    if (!snapshot) {
      return;
    }

    setState((previousState) => ({
      ...previousState,
      activeAiActionLabel: actionLabel,
      aiError: null,
      completionSuggestion: null,
      isAiRunning: true,
      runtimeMessage: null,
    }));

    try {
      const result = await executor(snapshot);

      if (result.snapshot) {
        const nextSnapshot = result.snapshot;

        snapshotRef.current = nextSnapshot;
        selectionRef.current = {
          currentModuleId:
            result.nextModuleId ?? selectionRef.current.currentModuleId,
          selectedNodeId:
            result.nextSelectedNodeId ?? selectionRef.current.selectedNodeId,
        };
        setState((previousState) => ({
          ...previousState,
          editorSessionKey: previousState.editorSessionKey + 1,
          initialModuleId: selectionRef.current.currentModuleId,
          initialSelectedNodeId: selectionRef.current.selectedNodeId,
          runtimeMessage: result.message ?? null,
          snapshot: nextSnapshot,
        }));
        queueSave(nextSnapshot, selectionRef.current);
      }

      if (result.completionSuggestion) {
        setState((previousState) => ({
          ...previousState,
          completionSuggestion: result.completionSuggestion ?? null,
          runtimeMessage: result.message ?? null,
        }));
      }
    } catch (error) {
      setState((previousState) => ({
        ...previousState,
        aiError: error instanceof Error ? error.message : 'AI 动作执行失败。',
      }));
    } finally {
      setState((previousState) => ({
        ...previousState,
        activeAiActionLabel: null,
        isAiRunning: false,
      }));
    }
  }

  function applyAiPreferences(
    nextPreferences: StoredAiConfigPreferences,
    options?: {
      persist?: boolean;
      presetDraftName?: string;
      runtimeMessage?: string;
    },
  ) {
    aiPreferencesRef.current = nextPreferences;
    setState((previousState) => ({
      ...previousState,
      aiConfig: nextPreferences.config,
      aiPresets: nextPreferences.presets,
      aiSelectedPresetId: nextPreferences.selectedPresetId,
      aiSelectedTemplateId: nextPreferences.selectedTemplateId,
      ...(options?.presetDraftName !== undefined
        ? {
            aiPresetDraftName: options.presetDraftName,
          }
        : {}),
      ...(options?.runtimeMessage !== undefined
        ? {
            runtimeMessage: options.runtimeMessage,
          }
        : {}),
    }));

    if (options?.persist) {
      runtimeService.saveAiConfigPreferences(nextPreferences);
    }
  }
}

function getLearningActionRuntimeLabel(
  actionId: WorkspaceEditorLearningActionRequest['actionId'],
) {
  switch (actionId) {
    case 'insert-scaffold':
      return '正在补铺垫讲解';
    case 'rephrase-scaffold':
      return '正在换个说法解释';
    case 'simplify-scaffold':
      return '正在补更基础的讲解';
    case 'add-example':
      return '正在补一个例子';
    case 'insert-question':
      return '正在补问题草稿';
    case 'insert-summary':
      return '正在补总结草稿';
    case 'insert-judgment':
      return '正在补判断草稿';
    case 'insert-plan-step':
      return '正在补学习步骤';
    case 'insert-answer':
      return '正在补回答草稿';
    case 'insert-resource-fragment':
      return '正在补摘录草稿';
  }
}

function hasSelectionChanged(
  previousSelection: WorkspaceRuntimeSelectionState,
  nextSelection: WorkspaceRuntimeSelectionState,
) {
  return (
    previousSelection.currentModuleId !== nextSelection.currentModuleId ||
    previousSelection.selectedNodeId !== nextSelection.selectedNodeId
  );
}

function upsertResourceMetadataRecord(
  records: ResourceMetadataRecord[],
  nextRecord: ResourceMetadataRecord,
) {
  const nextRecords = [...records];
  const existingIndex = nextRecords.findIndex(
    (record) => record.id === nextRecord.id,
  );

  if (existingIndex === -1) {
    nextRecords.push(nextRecord);
    return nextRecords;
  }

  nextRecords[existingIndex] = nextRecord;
  return nextRecords;
}

function resolveAiPresetDraftName(preferences: StoredAiConfigPreferences) {
  const selectedPreset = findAiConfigPresetById(
    preferences.presets,
    preferences.selectedPresetId,
  );

  return selectedPreset?.name ?? getDefaultAiPresetName(preferences.selectedTemplateId);
}

function shouldDetachSelectedPreset(
  preferences: StoredAiConfigPreferences,
  nextConfig: AiConfig,
) {
  const selectedPreset = findAiConfigPresetById(
    preferences.presets,
    preferences.selectedPresetId,
  );

  if (!selectedPreset) {
    return false;
  }

  return !doesAiConfigMatchPreset(nextConfig, selectedPreset);
}
