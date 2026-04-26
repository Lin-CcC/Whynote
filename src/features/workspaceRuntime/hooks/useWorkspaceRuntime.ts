import { useEffect, useRef, useState } from 'react';

import type { AiConfig } from '../../learningEngine';
import type { WorkspaceSnapshot } from '../../nodeDomain';
import { createWorkspaceRuntimeService } from '../services/workspaceRuntimeService';
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
  snapshot: WorkspaceSnapshot | null;
}

type PendingSaveState = {
  selection: WorkspaceRuntimeSelectionState;
  snapshot: WorkspaceSnapshot;
};

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

  useEffect(() => {
    void initializeWorkspace();
  }, []);

  function handleSnapshotChange(snapshot: WorkspaceSnapshot) {
    snapshotRef.current = snapshot;
    setState((previousState) => ({
      ...previousState,
      snapshot,
    }));
    queueSave(snapshot, selectionRef.current);
  }

  function handleSelectionChange(selection: WorkspaceRuntimeSelectionState) {
    selectionRef.current = selection;

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

  async function runPlanStepGeneration(moduleNodeId: string) {
    await runAiAction('正在生成 plan-step', async (snapshot) =>
      runtimeService.generatePlanSteps(snapshot, moduleNodeId, state.aiConfig),
    );
  }

  async function runQuestionSplit(questionNodeId: string) {
    await runAiAction('正在拆分复合问题', async (snapshot) =>
      runtimeService.splitQuestion(snapshot, questionNodeId, state.aiConfig),
    );
  }

  async function runCompletionSuggestion(planStepNodeId: string) {
    await runAiAction('正在评估步骤完成信号', async (snapshot) =>
      runtimeService.suggestPlanStepCompletion(snapshot, planStepNodeId),
    );
  }

  return {
    ...state,
    handleAiConfigChange,
    handleSelectionChange,
    handleSnapshotChange,
    retryInitialization: initializeWorkspace,
    runCompletionSuggestion,
    runPlanStepGeneration,
    runQuestionSplit,
    saveAiConfig,
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
        editorSessionKey: previousState.editorSessionKey + 1,
        initialModuleId: result.initialModuleId,
        initialSelectedNodeId: result.initialSelectedNodeId,
        isInitializing: false,
        loadError: null,
        runtimeMessage: null,
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

    if (isSavingRef.current) {
      return;
    }

    void flushPendingSave();
  }

  async function flushPendingSave() {
    while (pendingSaveRef.current) {
      const nextSave = pendingSaveRef.current;

      pendingSaveRef.current = null;
      isSavingRef.current = true;
      setState((previousState) => ({
        ...previousState,
        saveError: null,
        saveStatus: 'saving',
      }));

      try {
        await runtimeService.saveWorkspace(
          nextSave.snapshot,
          nextSave.selection,
        );
        setState((previousState) => ({
          ...previousState,
          saveError: null,
          saveStatus: 'saved',
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
      }
    }
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
        aiError:
          error instanceof Error ? error.message : 'AI 动作执行失败。',
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
