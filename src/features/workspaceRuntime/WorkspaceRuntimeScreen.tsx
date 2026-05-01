import { useState } from 'react';

import AppLayout from '../../ui/AppLayout';
import SectionCard from '../../ui/SectionCard';
import { findNearestQuestionNodeId, getModuleScopeId, getNodeOrThrow } from '../nodeDomain';
import ResourcesSearchExportPanel from '../resourcesSearchExport/ResourcesSearchExportPanel';
import WorkspaceEditor from '../workspaceEditor/WorkspaceEditor';
import { resolveLearningActionPlacement } from '../workspaceEditor/utils/learningActions';
import {
  readWorkspaceViewState,
  writeWorkspaceViewState,
} from '../workspaceEditor/utils/workspaceViewState';
import type {
  LearningActionId,
  WorkspaceEditorLearningActionRequest,
  WorkspaceEditorNodeRenderContext,
  WorkspaceEditorRenderContext,
  WorkspaceEditorSelectionState,
} from '../workspaceEditor/workspaceEditorTypes';
import WorkspaceRuntimeActionCard from './components/WorkspaceRuntimeActionCard';
import WorkspaceRuntimeAiConfigCard from './components/WorkspaceRuntimeAiConfigCard';
import WorkspaceRuntimeJudgmentActions from './components/WorkspaceRuntimeJudgmentActions';
import WorkspaceRuntimeStatusCard from './components/WorkspaceRuntimeStatusCard';
import { useWorkspaceRuntime } from './hooks/useWorkspaceRuntime';
import { createDefaultWorkspaceRuntimeDependencies } from './services/createDefaultWorkspaceRuntimeDependencies';
import {
  countQuestionFollowUpNodes,
  getJudgmentInlineActionContext,
  getLatestQuestionAnswerExplanationNodeId,
  getLatestQuestionAnswerNodeId,
  resolveQuestionAnswerEvaluationTarget,
  resolveSummaryCheckJudgmentContext,
  resolveSummaryEvaluationTarget,
} from './services/learningRuntimeContext';
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
  const [uiPreferences, setUiPreferences] = useState(() =>
    resolvedDependencies.localPreferenceStorage.loadUiPreferences(),
  );
  const [activeResourceNodeId, setActiveResourceNodeId] = useState<string | null>(
    null,
  );
  const [activeJudgmentHintNodeId, setActiveJudgmentHintNodeId] = useState<
    string | null
  >(null);
  const runtime = useWorkspaceRuntime(resolvedDependencies);
  const workspaceViewState = readWorkspaceViewState(
    uiPreferences,
    runtime.snapshot?.workspace.id ?? null,
  );
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
              {runtime.isInitializing ? '正在初始化工作区' : '工作区暂时不可用'}
            </h2>
            <p className="section-description">
              {runtime.loadError ??
                '正在从 IndexedDB 读取工作区，并准备最小可用数据。'}
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
              这里只负责把真实工作区、持久化和 learning engine 闭环接起来，不扩展新的产品能力。
            </p>
          </SectionCard>
        }
      />
    );
  }

  const workspaceSnapshot = runtime.snapshot;

  return (
    <WorkspaceEditor
      initialModuleId={runtime.initialModuleId ?? undefined}
      initialSelectedNodeId={runtime.initialSelectedNodeId ?? undefined}
      initialSnapshot={workspaceSnapshot}
      interactionLockReason={interactionLockReason}
      isInteractionLocked={runtime.isAiRunning}
      key={`${workspaceSnapshot.workspace.id}:${String(runtime.editorSessionKey)}`}
      onDirectAnswerQuestion={handleDirectAnswerQuestion}
      onEvaluateAnswer={(questionNodeId, answerNodeId) => {
        void runtime.runQuestionEvaluation({
          answerNodeId,
          questionNodeId,
        });
      }}
      onEvaluateSummary={(summaryNodeId) => {
        void runtime.runSummaryEvaluation(summaryNodeId);
      }}
      onGenerateFollowUpQuestion={handleGenerateFollowUpQuestion}
      onGenerateSummary={handleGenerateSummary}
      onLearningActionRequest={(request) => {
        if (!canRunAiLearningAction(request.actionId)) {
          return false;
        }

        void runtime.runLearningAction(request);
        return true;
      }}
      onSelectionChange={handleEditorSelectionChange}
      onSnapshotChange={runtime.handleSnapshotChange}
      onWorkspaceViewStateChange={handleWorkspaceViewStateChange}
      renderLeftPanelExtra={renderLeftPanelExtra}
      renderNodeInlineActions={renderNodeInlineActions}
      renderRightPanelExtra={renderRightPanelExtra}
      workspaceViewState={workspaceViewState}
    />
  );

  function renderLeftPanelExtra(context: WorkspaceEditorRenderContext) {
    const evaluationTarget = resolveQuestionAnswerEvaluationTarget(
      context.tree,
      context.selectedNode?.id ?? null,
    );
    const summaryEvaluationTarget = resolveSummaryEvaluationTarget(
      context.tree,
      context.selectedNode?.id ?? null,
    );
    const summaryCheckJudgmentContext = resolveSummaryCheckJudgmentContext(
      context.tree,
      context.selectedNode?.id ?? null,
    );
    const directAnswerRequest = resolveDirectAnswerRequest(
      context,
      evaluationTarget,
    );
    const currentQuestionAnswerNodeId =
      context.selectedNode?.type === 'question'
        ? getLatestQuestionAnswerNodeId(context.tree, context.selectedNode.id)
        : null;
    const answerExplanationNodeId = evaluationTarget
      ? getLatestQuestionAnswerExplanationNodeId(
          context.tree,
          evaluationTarget.questionNodeId,
          evaluationTarget.answerNodeId,
        )
      : null;
    const answerFollowUpCount = evaluationTarget
      ? countQuestionFollowUpNodes(context.tree, evaluationTarget.questionNodeId)
      : 0;

    return (
      <WorkspaceRuntimeActionCard
        answerExplanationNodeId={answerExplanationNodeId}
        answerFollowUpCount={answerFollowUpCount}
        canDirectAnswerCurrentQuestion={
          directAnswerRequest !== null && !runtime.isAiRunning
        }
        currentModule={context.currentModule}
        currentQuestionAnswerNodeId={currentQuestionAnswerNodeId}
        evaluationTarget={evaluationTarget}
        hasDirectAnswerCurrentQuestion={directAnswerRequest !== null}
        isAiRunning={runtime.isAiRunning}
        onCreateModule={context.createModule}
        onDirectAnswerCurrentQuestion={() => {
          if (!directAnswerRequest) {
            return;
          }

          void runtime.runQuestionDirectAnswer(directAnswerRequest);
        }}
        onEvaluateQuestionAnswer={(target) => {
          void runtime.runQuestionEvaluation(target);
        }}
        onEvaluateSummary={(target) => {
          void runtime.runSummaryEvaluation(target.summaryNodeId);
        }}
        onGeneratePlanSteps={(moduleNodeId) => {
          void runtime.runPlanStepGeneration(moduleNodeId);
        }}
        onInsertAnswer={() => {
          context.runLearningAction('insert-answer');
        }}
        onSelectNode={context.selectNode}
        onSplitQuestion={(questionNodeId) => {
          void runtime.runQuestionSplit(questionNodeId);
        }}
        onSuggestCompletion={(planStepNodeId) => {
          void runtime.runCompletionSuggestion(planStepNodeId);
        }}
        selectedNode={context.selectedNode}
        summaryCheckJudgmentContext={summaryCheckJudgmentContext}
        summaryEvaluationTarget={summaryEvaluationTarget}
      />
    );
  }

  function renderNodeInlineActions(context: WorkspaceEditorNodeRenderContext) {
    if (context.node.type !== 'judgment' || !context.isSelected) {
      return null;
    }

    const actionContext = getJudgmentInlineActionContext(
      context.tree,
      context.node.id,
    );

    if (!actionContext) {
      return null;
    }

    const hasPersistedHint = Boolean(context.node.hint?.trim());

    return (
      <WorkspaceRuntimeJudgmentActions
        answerNodeId={actionContext.answerNodeId}
        hint={actionContext.hint}
        isBusy={runtime.isAiRunning}
        isHintVisible={activeJudgmentHintNodeId === context.node.id}
        judgmentNodeId={context.node.id}
        onReturnToAnswer={() => {
          if (!actionContext.answerNodeId) {
            return;
          }

          setActiveJudgmentHintNodeId(null);
          context.selectNode(actionContext.answerNodeId);
        }}
        onToggleHint={() => {
          void handleJudgmentHintToggle(context.node.id, hasPersistedHint);
        }}
        onViewSummary={() => {
          if (!actionContext.summaryNodeId) {
            return;
          }

          setActiveJudgmentHintNodeId(null);
          context.selectNode(actionContext.summaryNodeId);
        }}
        summaryNodeId={actionContext.summaryNodeId}
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
          uiPreferences={uiPreferences}
          workspaceId={workspaceSnapshot.workspace.id}
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
          aiPresetDraftName={runtime.aiPresetDraftName}
          aiPresets={runtime.aiPresets}
          aiSelectedPresetId={runtime.aiSelectedPresetId}
          aiSelectedTemplateId={runtime.aiSelectedTemplateId}
          onDeleteAiPreset={runtime.deleteAiPreset}
          onAiConfigChange={runtime.handleAiConfigChange}
          onAiPresetChange={runtime.handleAiPresetChange}
          onAiPresetDraftNameChange={runtime.handleAiPresetDraftNameChange}
          onAiTemplateChange={runtime.handleAiTemplateChange}
          onOverwriteAiPreset={runtime.overwriteAiPreset}
          onRenameAiPreset={runtime.renameAiPreset}
          onSaveAiConfig={runtime.saveAiConfig}
          onSaveAiPreset={runtime.saveAiPreset}
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

  function handleWorkspaceViewStateChange(state: typeof workspaceViewState) {
    const workspaceId = runtime.snapshot?.workspace.id;

    if (!workspaceId) {
      return;
    }

    const nextPreferences = writeWorkspaceViewState(
      uiPreferences,
      workspaceId,
      state,
    );

    setUiPreferences(nextPreferences);
    resolvedDependencies.localPreferenceStorage.saveUiPreferences(nextPreferences);
  }

  function handleDirectAnswerQuestion(questionNodeId: string) {
    const directAnswerRequest = resolveDirectAnswerRequestForQuestion(
      runtime.snapshot?.tree ?? null,
      runtime.initialModuleId,
      questionNodeId,
    );

    if (!directAnswerRequest) {
      return;
    }

    void runtime.runQuestionDirectAnswer(directAnswerRequest);
  }

  function handleGenerateFollowUpQuestion(sourceNodeId: string) {
    if (runtime.isAiRunning) {
      return;
    }

    const request = resolveFollowUpQuestionDraftRequest(
      runtime.snapshot?.tree ?? null,
      runtime.initialModuleId,
      sourceNodeId,
    );

    if (!request) {
      return;
    }

    void runtime.runLearningAction(request);
  }

  function handleGenerateSummary(sourceNodeId: string) {
    if (runtime.isAiRunning) {
      return;
    }

    const request = resolveQuestionBlockSummaryDraftRequest(
      runtime.snapshot?.tree ?? null,
      runtime.initialModuleId,
      sourceNodeId,
    );

    if (!request) {
      return;
    }

    void runtime.runLearningAction(request);
  }

  async function handleJudgmentHintToggle(
    judgmentNodeId: string,
    hasPersistedHint: boolean,
  ) {
    if (runtime.isAiRunning) {
      return;
    }

    if (hasPersistedHint) {
      setActiveJudgmentHintNodeId((previousNodeId) =>
        previousNodeId === judgmentNodeId ? null : judgmentNodeId,
      );
      return;
    }

    const didGenerateHint = await runtime.runJudgmentHintGeneration(judgmentNodeId);

    if (didGenerateHint) {
      setActiveJudgmentHintNodeId(judgmentNodeId);
    }
  }
}

function canRunAiLearningAction(actionId: LearningActionId) {
  switch (actionId) {
    case 'insert-scaffold':
    case 'rephrase-scaffold':
    case 'simplify-scaffold':
    case 'add-example':
    case 'insert-judgment':
      return true;
    default:
      return false;
  }
}

function resolveDirectAnswerRequest(
  context: WorkspaceEditorRenderContext,
  evaluationTarget: ReturnType<typeof resolveQuestionAnswerEvaluationTarget>,
): WorkspaceEditorLearningActionRequest | null {
  if (context.selectedNode?.type !== 'question' || evaluationTarget !== null) {
    return null;
  }

  return resolveDirectAnswerRequestForQuestion(
    context.tree,
    context.currentModuleId,
    context.selectedNode.id,
  );
}

function resolveDirectAnswerRequestForQuestion(
  tree: WorkspaceEditorRenderContext['tree'] | null,
  currentModuleId: string | null,
  questionNodeId: string | null,
): WorkspaceEditorLearningActionRequest | null {
  if (!tree || !questionNodeId || tree.nodes[questionNodeId]?.type !== 'question') {
    return null;
  }

  const placement = resolveLearningActionPlacement(
    tree,
    questionNodeId,
    'insert-answer',
  );

  if (!placement) {
    return null;
  }

  return {
    actionId: 'insert-answer',
    currentModuleId: getModuleScopeId(tree, questionNodeId) ?? currentModuleId,
    placement,
    selectedNodeId: questionNodeId,
    tree,
  };
}

function resolveFollowUpQuestionDraftRequest(
  tree: WorkspaceEditorRenderContext['tree'] | null,
  currentModuleId: string | null,
  sourceNodeId: string | null,
): WorkspaceEditorLearningActionRequest | null {
  if (!tree || !sourceNodeId || !tree.nodes[sourceNodeId]) {
    return null;
  }

  const questionNodeId = findNearestQuestionNodeId(tree, sourceNodeId);

  if (!questionNodeId) {
    const placement = resolveLearningActionPlacement(tree, sourceNodeId, 'insert-question');

    if (!placement) {
      return null;
    }

    return {
      actionId: 'insert-question',
      currentModuleId: getModuleScopeId(tree, sourceNodeId) ?? currentModuleId,
      placement: {
        ...placement,
        title: '新追问',
      },
      selectedNodeId: sourceNodeId,
      tree,
    };
  }

  const questionNode = getNodeOrThrow(tree, questionNodeId);

  if (questionNode.type !== 'question') {
    return null;
  }

  return {
    actionId: 'insert-question',
    currentModuleId: getModuleScopeId(tree, sourceNodeId) ?? currentModuleId,
    placement: {
      insertIndex: questionNode.childIds.length,
      nodeType: 'question',
      parentNodeId: questionNode.id,
      title: '新追问',
    },
    selectedNodeId: sourceNodeId,
    tree,
  };
}

function resolveQuestionBlockSummaryDraftRequest(
  tree: WorkspaceEditorRenderContext['tree'] | null,
  currentModuleId: string | null,
  sourceNodeId: string | null,
): WorkspaceEditorLearningActionRequest | null {
  if (!tree || !sourceNodeId || !tree.nodes[sourceNodeId]) {
    return null;
  }

  const placement = resolveLearningActionPlacement(tree, sourceNodeId, 'insert-summary');

  if (!placement) {
    return null;
  }

  return {
    actionId: 'insert-summary',
    currentModuleId: getModuleScopeId(tree, sourceNodeId) ?? currentModuleId,
    placement,
    selectedNodeId: sourceNodeId,
    tree,
  };
}
