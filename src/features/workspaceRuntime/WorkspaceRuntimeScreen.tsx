import { useState } from 'react';

import AppLayout from '../../ui/AppLayout';
import SectionCard from '../../ui/SectionCard';
import WorkspaceEditor from '../workspaceEditor/WorkspaceEditor';
import type {
  WorkspaceEditorRenderContext,
  WorkspaceEditorSelectionState,
} from '../workspaceEditor/workspaceEditorTypes';
import ResourcesSearchExportPanel from '../resourcesSearchExport/ResourcesSearchExportPanel';
import WorkspaceRuntimeActionCard from './components/WorkspaceRuntimeActionCard';
import WorkspaceRuntimeAiConfigCard from './components/WorkspaceRuntimeAiConfigCard';
import WorkspaceRuntimeStatusCard from './components/WorkspaceRuntimeStatusCard';
import { useWorkspaceRuntime } from './hooks/useWorkspaceRuntime';
import { createDefaultWorkspaceRuntimeDependencies } from './services/createDefaultWorkspaceRuntimeDependencies';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

type WorkspaceRuntimeScreenProps = {
  dependencies?: WorkspaceRuntimeDependencies;
};

export default function WorkspaceRuntimeScreen({
  dependencies,
}: WorkspaceRuntimeScreenProps) {
  const [resolvedDependencies] = useState(
    () => dependencies ?? createDefaultWorkspaceRuntimeDependencies(),
  );
  const [activeResourceNodeId, setActiveResourceNodeId] = useState<string | null>(
    null,
  );
  const runtime = useWorkspaceRuntime(resolvedDependencies);
  const resourceMetadataByNodeId = Object.fromEntries(
    runtime.resourceMetadataRecords.map((record) => [record.nodeId, record]),
  );
  const interactionLockReason = runtime.isAiRunning
    ? `${runtime.activeAiActionLabel ?? 'AI 正在运行'}，编辑已临时锁定，避免工作区快照被旧结果覆盖。`
    : null;

  if (runtime.isInitializing || runtime.loadError || !runtime.snapshot) {
    return (
      <AppLayout
        leftPanel={
          <SectionCard>
            <p className="section-label">运行时集成</p>
            <h2 className="section-title">
              {runtime.isInitializing ? '正在初始化工作区' : '工作区暂不可用'}
            </h2>
            <p className="section-description">
              {runtime.loadError ?? '正在从 IndexedDB 读取工作区，并准备最小可用数据。'}
            </p>
          </SectionCard>
        }
        mainPanel={
          <SectionCard>
            <p className="section-label">当前状态</p>
            <h2 className="section-title">
              {runtime.isInitializing ? '请稍候' : '需要人工处理'}
            </h2>
            <p className="section-description">
              {runtime.isInitializing
                ? '加载完成后会直接进入真实工作区，不再使用 demo snapshot。'
                : '请先处理加载错误，再继续编辑或触发 AI 动作。'}
            </p>
            {runtime.loadError ? (
              <button onClick={runtime.retryInitialization} type="button">
                重新加载工作区
              </button>
            ) : null}
          </SectionCard>
        }
        rightPanel={
          <SectionCard>
            <p className="section-label">范围说明</p>
            <h2 className="section-title">当前工作树目标</h2>
            <p className="section-description">
              只负责把真实工作区、持久化和 learning-engine 闭环接起来，不扩展新产品功能。
            </p>
          </SectionCard>
        }
      />
    );
  }

  return (
    <WorkspaceEditor
      initialModuleId={runtime.initialModuleId ?? undefined}
      initialSelectedNodeId={runtime.initialSelectedNodeId ?? undefined}
      initialSnapshot={runtime.snapshot}
      interactionLockReason={interactionLockReason}
      isInteractionLocked={runtime.isAiRunning}
      key={`${runtime.snapshot.workspace.id}:${String(runtime.editorSessionKey)}`}
      onSelectionChange={handleEditorSelectionChange}
      onSnapshotChange={runtime.handleSnapshotChange}
      renderLeftPanelExtra={renderLeftPanelExtra}
      renderRightPanelExtra={renderRightPanelExtra}
    />
  );

  function renderLeftPanelExtra(context: WorkspaceEditorRenderContext) {
    return (
      <WorkspaceRuntimeActionCard
        currentModule={context.currentModule}
        isAiRunning={runtime.isAiRunning}
        onCreateModule={context.createModule}
        onGeneratePlanSteps={(moduleNodeId) => {
          void runtime.runPlanStepGeneration(moduleNodeId);
        }}
        onSplitQuestion={(questionNodeId) => {
          void runtime.runQuestionSplit(questionNodeId);
        }}
        onSuggestCompletion={(planStepNodeId) => {
          void runtime.runCompletionSuggestion(planStepNodeId);
        }}
        selectedNode={context.selectedNode}
      />
    );
  }

  function renderRightPanelExtra(context: WorkspaceEditorRenderContext) {
    return (
      <>
        <ResourcesSearchExportPanel
          activeResourceNodeId={activeResourceNodeId}
          currentModuleId={context.currentModuleId}
          onApplyTreeChange={context.applyTreeChange}
          onClearResourceFocus={() => {
            setActiveResourceNodeId(null);
          }}
          onFocusResourceNode={setActiveResourceNodeId}
          onResolveResourceSummary={runtime.resolveResourceSummary}
          onSelectEditorNode={(nodeId) => {
            setActiveResourceNodeId(null);
            context.selectNode(nodeId);
          }}
          onUpsertResourceMetadata={runtime.upsertResourceMetadata}
          resourceMetadataByNodeId={resourceMetadataByNodeId}
          selectedEditorNodeId={context.selectedNodeId}
          tree={context.tree}
          workspaceId={runtime.snapshot!.workspace.id}
          workspaceTitle={context.workspaceTitle}
        />
        <WorkspaceRuntimeStatusCard
          activeAiActionLabel={runtime.activeAiActionLabel}
          aiError={runtime.aiError}
          completionSuggestion={runtime.completionSuggestion}
          isAiRunning={runtime.isAiRunning}
          isInitializing={runtime.isInitializing}
          loadError={runtime.loadError}
          runtimeMessage={runtime.runtimeMessage}
          saveError={runtime.saveError}
          saveStatus={runtime.saveStatus}
        />
        <WorkspaceRuntimeAiConfigCard
          aiConfig={runtime.aiConfig}
          onAiConfigChange={runtime.handleAiConfigChange}
          onSaveAiConfig={runtime.saveAiConfig}
        />
      </>
    );
  }

  function handleEditorSelectionChange(
    selection: WorkspaceEditorSelectionState,
  ) {
    setActiveResourceNodeId(null);
    runtime.handleSelectionChange(selection);
  }
}
