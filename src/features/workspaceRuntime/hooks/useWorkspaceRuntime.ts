import { useEffect, useRef, useState } from 'react';

import type { AiConfig } from '../../learningEngine';
import type { ResourceMetadataRecord, WorkspaceSnapshot } from '../../nodeDomain';
import type { ResourceImportDraft } from '../../resourcesSearchExport/services/resourceIngestTypes';
import type { WorkspaceEditorLearningActionRequest } from '../../workspaceEditor/workspaceEditorTypes';
import { createWorkspaceRuntimeService } from '../services/workspaceRuntimeService';
import type { QuestionAnswerEvaluationTarget } from '../services/learningRuntimeContext';
import type {
  WorkspaceRuntimeDependencies,
  WorkspaceMutationResult,
  WorkspaceRuntimeSelectionState,
  WorkspaceRuntimeStatusState,
} from '../workspaceRuntimeTypes';

interface WorkspaceRuntimeState extends WorkspaceRuntimeStatusState {
  aiConfig: AiConfig;
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
  const [state, setState] = useState<WorkspaceRuntimeState>(() => ({
    aiConfig: runtimeService.loadAiConfig(),
    aiError: null,
    activeAiActionLabel: null,
    completionSuggestion: null,
    editorSessionKey: 0,
    initialModuleId: null,
    initialSelectedNodeId: null,
    isAiRunning: false,
    isInitializing: true,
    loadError: null,
    runtimeMessage: null,
    resourceMetadataRecords: [],
    saveError: null,
    saveStatus: 'idle',
    snapshot: null,
  }));
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
    setState((previousState) => ({
      ...previousState,
      aiConfig: {
        ...previousState.aiConfig,
        ...patch,
      },
    }));
  }

  function saveAiConfig() {
    runtimeService.saveAiConfig(state.aiConfig);
    setState((previousState) => ({
      ...previousState,
      runtimeMessage: 'AI 配置已保存到本地设置。',
    }));
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

  return {
    ...state,
    handleAiConfigChange,
    handleSelectionChange,
    handleSnapshotChange,
    retryInitialization: initializeWorkspace,
    resolveResourceSummary,
    runLearningAction,
    runCompletionSuggestion,
    runPlanStepGeneration,
    runQuestionEvaluation,
    runQuestionSplit,
    saveAiConfig,
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
