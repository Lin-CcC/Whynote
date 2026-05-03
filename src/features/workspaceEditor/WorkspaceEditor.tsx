import { Fragment, useMemo, useRef } from 'react';

import SectionCard from '../../ui/SectionCard';
import ModuleSwitcher from './components/ModuleSwitcher';
import SelectedNodeInspector from './components/SelectedNodeInspector';
import StructureActionBar from './components/StructureActionBar';
import StructureMapMainView from './components/StructureMapMainView';
import StructureTree from './components/StructureTree';
import TextMainView from './components/TextMainView';
import { useWorkspaceEditor } from './hooks/useWorkspaceEditor';
import { DEFAULT_WORKSPACE_VIEW_STATE } from './utils/workspaceViewState';
import type {
  WorkspaceEditorProps,
  WorkspaceEditorRenderContext,
  WorkspaceEditorToolPanel,
  WorkspaceRailMode,
} from './workspaceEditorTypes';
import './workspaceEditor.css';

export default function WorkspaceEditor(props: WorkspaceEditorProps) {
  const workspaceEditor = useWorkspaceEditor(props);
  const workspaceViewState =
    props.workspaceViewState ?? DEFAULT_WORKSPACE_VIEW_STATE;
  const handleWorkspaceViewStateChange =
    props.onWorkspaceViewStateChange ?? (() => {});
  const previousWorkbenchRailsRef = useRef<{
    left: WorkspaceRailMode;
    right: WorkspaceRailMode;
  } | null>(null);
  const renderContext: WorkspaceEditorRenderContext = {
    applyTreeChange: workspaceEditor.applyTreeChange,
    createModule: workspaceEditor.createModule,
    currentModule: workspaceEditor.currentModule,
    currentModuleId: workspaceEditor.currentModuleId,
    moveStructureMapNode: workspaceEditor.moveStructureMapNode,
    runLearningAction: workspaceEditor.runLearningAction,
    selectNode: workspaceEditor.selectNode,
    selectedNode: workspaceEditor.selectedNode,
    selectedNodeId: workspaceEditor.selectedNodeId,
    tree: workspaceEditor.tree,
    validateStructureMapMove: workspaceEditor.validateStructureMapMove,
    workspaceTitle: workspaceEditor.workspaceTitle,
  };
  const rightToolPanels = useMemo(
    () => resolveRightToolPanels(props, renderContext),
    [props, renderContext],
  );
  const currentModuleTitle =
    workspaceEditor.currentModule?.title ?? '未选择模块';
  const currentModeLabel =
    workspaceViewState.mainViewMode === 'structure-map' ? '结构地图' : '文档';
  const isLeftRailCollapsed = workspaceViewState.leftRailMode === 'collapsed';
  const isRightRailCollapsed = workspaceViewState.rightRailMode === 'collapsed';
  const activeToolPanel =
    rightToolPanels.find((panel) => panel.id === workspaceViewState.toolPanel) ??
    rightToolPanels[0] ??
    null;

  function updateWorkspaceViewState(
    updater: (state: typeof workspaceViewState) => typeof workspaceViewState,
  ) {
    handleWorkspaceViewStateChange(updater(workspaceViewState));
  }

  function setLeftRailMode(nextMode: WorkspaceRailMode) {
    updateWorkspaceViewState((state) => ({
      ...state,
      leftRailMode: nextMode,
    }));
  }

  function setRightRailMode(nextMode: WorkspaceRailMode) {
    updateWorkspaceViewState((state) => ({
      ...state,
      rightRailMode: nextMode,
    }));
  }

  function toggleFocusMode() {
    if (workspaceViewState.focusMode) {
      const restoredRails = previousWorkbenchRailsRef.current ?? {
        left: 'expanded',
        right: 'collapsed',
      };

      updateWorkspaceViewState((state) => ({
        ...state,
        focusMode: false,
        leftRailMode: restoredRails.left,
        rightRailMode: restoredRails.right,
      }));
      previousWorkbenchRailsRef.current = null;
      return;
    }

    previousWorkbenchRailsRef.current = {
      left: workspaceViewState.leftRailMode,
      right: workspaceViewState.rightRailMode,
    };

    updateWorkspaceViewState((state) => ({
      ...state,
      focusMode: true,
      leftRailMode: 'collapsed',
      rightRailMode: 'collapsed',
    }));
  }

  function toggleRightToolPanel(panelId: WorkspaceEditorToolPanel['id']) {
    updateWorkspaceViewState((state) => {
      const isSamePanel = state.toolPanel === panelId;
      const nextRightRailMode =
        isSamePanel && state.rightRailMode === 'expanded'
          ? 'collapsed'
          : 'expanded';

      return {
        ...state,
        rightRailMode: nextRightRailMode,
        toolPanel: panelId,
      };
    });
  }

  return (
    <div
      className="workspace-workbench"
      data-workspace-focus-mode={workspaceViewState.focusMode ? 'true' : 'false'}
      data-workspace-left-rail={workspaceViewState.leftRailMode}
      data-workspace-right-rail={workspaceViewState.rightRailMode}
      data-workspace-tool-panel={activeToolPanel?.id ?? 'settings'}
    >
      <header className="workspace-workbenchHeader">
        <div className="workspace-workbenchHeaderPrimary">
          <div className="workspace-workbenchBrandBlock">
            <span className="workspace-workbenchBrand">WhyNote</span>
            <span className="workspace-workbenchHeaderTitle">
              {workspaceEditor.workspaceTitle}
            </span>
          </div>
          <div className="workspace-workbenchContext">
            <span className="workspace-workbenchContextBadge">当前模块</span>
            <strong className="workspace-workbenchContextValue">
              {currentModuleTitle}
            </strong>
            <span className="workspace-workbenchContextDivider" />
            <span className="workspace-workbenchContextBadge">当前模式</span>
            <strong className="workspace-workbenchContextValue">
              {currentModeLabel}
            </strong>
          </div>
        </div>
        <div className="workspace-workbenchHeaderActions">
          <button
            className="workspace-workbenchHeaderButton"
            onClick={() =>
              setLeftRailMode(isLeftRailCollapsed ? 'expanded' : 'collapsed')
            }
            type="button"
          >
            {isLeftRailCollapsed ? '展开模块栏' : '收起模块栏'}
          </button>
          <button
            className="workspace-workbenchHeaderButton"
            onClick={() =>
              setRightRailMode(isRightRailCollapsed ? 'expanded' : 'collapsed')
            }
            type="button"
          >
            {isRightRailCollapsed ? '展开工具栏' : '收起工具栏'}
          </button>
          <button
            className="workspace-workbenchHeaderButton workspace-workbenchHeaderButton-accent"
            onClick={toggleFocusMode}
            type="button"
          >
            {workspaceViewState.focusMode ? '退出专注' : '进入专注'}
          </button>
        </div>
      </header>
      <div className="workspace-workbenchBody">
        <aside className="workspace-leftRail">
          <ModuleRailTrack
            currentModuleId={workspaceEditor.currentModuleId}
            isExpanded={!isLeftRailCollapsed}
            isInteractionLocked={props.isInteractionLocked ?? false}
            modules={workspaceEditor.moduleNodes}
            onCreateModule={workspaceEditor.createModule}
            onSwitchModule={workspaceEditor.switchModule}
            onToggle={() =>
              setLeftRailMode(isLeftRailCollapsed ? 'expanded' : 'collapsed')
            }
          />
          {!isLeftRailCollapsed ? (
            <div className="workspace-leftRailDrawer">
              <div className="workspace-leftRailContent">
                <SectionCard>
                  <ModuleSwitcher
                    currentModuleId={workspaceEditor.currentModuleId}
                    isInteractionLocked={props.isInteractionLocked ?? false}
                    modules={workspaceEditor.moduleNodes}
                    onCreateModule={workspaceEditor.createModule}
                    onSwitchModule={workspaceEditor.switchModule}
                  />
                </SectionCard>
                {props.renderLeftPanelExtra?.(renderContext)}
                <SectionCard>
                  <StructureTree
                    currentModuleId={workspaceEditor.currentModuleId}
                    expandedNodeIds={workspaceEditor.expandedNodeIds}
                    isInteractionLocked={props.isInteractionLocked ?? false}
                    onCreateModule={workspaceEditor.createModule}
                    onSelectNode={workspaceEditor.selectNode}
                    onToggleNode={workspaceEditor.toggleNodeExpanded}
                    selectedNodeId={workspaceEditor.selectedNodeId}
                    tree={workspaceEditor.tree}
                  />
                </SectionCard>
                <SectionCard>
                  <StructureActionBar
                    actionAvailability={workspaceEditor.actionAvailability}
                    childInsertOptions={workspaceEditor.childInsertOptions}
                    interactionLockReason={props.interactionLockReason ?? null}
                    isInteractionLocked={props.isInteractionLocked ?? false}
                    learningActions={workspaceEditor.learningActions}
                    onChangeSelectedNodeType={
                      workspaceEditor.switchSelectedNodeType
                    }
                    onChildInsertTypeChange={
                      workspaceEditor.setSelectedChildInsertType
                    }
                    onDeleteNode={workspaceEditor.deleteSelection}
                    onInsertChildNode={workspaceEditor.insertChildAtSelection}
                    onInsertSiblingNode={workspaceEditor.insertSiblingAtSelection}
                    onLiftNode={workspaceEditor.liftSelection}
                    onLowerNode={workspaceEditor.lowerSelection}
                    onRunLearningAction={workspaceEditor.runLearningAction}
                    onSiblingInsertTypeChange={
                      workspaceEditor.setSelectedSiblingInsertType
                    }
                    selectedChildInsertType={
                      workspaceEditor.selectedChildInsertType
                    }
                    selectedNodeTitle={workspaceEditor.selectedNode?.title ?? null}
                    selectedNodeType={workspaceEditor.selectedNode?.type ?? null}
                    selectedNodeTypeSwitchOptions={
                      workspaceEditor.selectedNodeTypeSwitchOptions
                    }
                    selectedSiblingInsertType={
                      workspaceEditor.selectedSiblingInsertType
                    }
                    siblingInsertOptions={workspaceEditor.siblingInsertOptions}
                  />
                  {workspaceEditor.operationError ? (
                    <p className="workspace-errorText" role="alert">
                      {workspaceEditor.operationError}
                    </p>
                  ) : null}
                </SectionCard>
              </div>
            </div>
          ) : null}
        </aside>
        <main className="workspace-workbenchMain">
          <div className="workspace-mainViewShell">
            <div className="workspace-mainViewContent">
              {workspaceViewState.mainViewMode === 'structure-map' ? (
                <StructureMapMainView
                  currentModuleId={workspaceEditor.currentModuleId}
                  isInteractionLocked={props.isInteractionLocked ?? false}
                  onCreateModule={workspaceEditor.createModule}
                  onDeleteStructureMapNode={workspaceEditor.deleteNodeById}
                  onInsertStructureMapChildNode={workspaceEditor.insertChildAtNode}
                  onInsertStructureMapSiblingNode={workspaceEditor.insertSiblingAtNode}
                  onMoveStructureMapNode={workspaceEditor.moveStructureMapNode}
                  onOpenDocumentNode={(nodeId) => {
                    updateWorkspaceViewState((state) => ({
                      ...state,
                      mainViewMode: 'document',
                    }));
                    workspaceEditor.selectNode(nodeId);
                  }}
                  onRenameStructureMapNode={(nodeId, title) => {
                    workspaceEditor.updateNode(nodeId, { title });
                  }}
                  onSelectStructureMapNode={workspaceEditor.selectNode}
                  onWorkspaceViewStateChange={handleWorkspaceViewStateChange}
                  selectedNodeId={workspaceEditor.selectedNodeId}
                  tree={workspaceEditor.tree}
                  validateStructureMapMove={workspaceEditor.validateStructureMapMove}
                  workspaceViewState={workspaceViewState}
                />
              ) : (
                <TextMainView
                  currentModuleId={workspaceEditor.currentModuleId}
                  interactionLockReason={props.interactionLockReason ?? null}
                  isInteractionLocked={props.isInteractionLocked ?? false}
                  showSemanticNotes={props.showSemanticNotes ?? false}
                  onCreateModule={workspaceEditor.createModule}
                  onDeleteNode={workspaceEditor.deleteSelection}
                  onDeleteNodeById={workspaceEditor.deleteNodeById}
                  onDirectAnswerQuestion={props.onDirectAnswerQuestion}
                  onEvaluateAnswer={props.onEvaluateAnswer}
                  onEvaluateSummary={props.onEvaluateSummary}
                  onGenerateFollowUpQuestion={props.onGenerateFollowUpQuestion}
                  onGenerateSummary={props.onGenerateSummary}
                  onInsertAnswerForQuestion={
                    workspaceEditor.insertAnswerForQuestion
                  }
                  onInsertFollowUpQuestion={
                    workspaceEditor.insertFollowUpQuestion
                  }
                  onInsertSummaryForNode={workspaceEditor.insertSummaryForNode}
                  onRunLearningAction={workspaceEditor.runLearningAction}
                  onRunLearningActionForNode={
                    workspaceEditor.runLearningActionForNode
                  }
                  onSelectNode={workspaceEditor.selectNode}
                  onSetCurrentAnswer={workspaceEditor.setCurrentAnswer}
                  onToggleNodeTag={workspaceEditor.toggleNodeTag}
                  onUpdateNode={workspaceEditor.updateNode}
                  onWorkspaceViewStateChange={handleWorkspaceViewStateChange}
                  registerNodeElement={workspaceEditor.registerNodeElement}
                  renderNodeInlineActions={props.renderNodeInlineActions}
                  renderNodeToolbarSections={props.renderNodeToolbarSections}
                  selectedNodeId={workspaceEditor.selectedNodeId}
                  tree={workspaceEditor.tree}
                  workspaceViewState={workspaceViewState}
                />
              )}
            </div>
            <div
              className="workspace-mainViewModeDock"
              data-structure-view-switch="floating-bottom-center"
              data-testid="workspace-main-view-switch"
            >
              <div className="workspace-mainViewModeBar">
                <button
                  aria-pressed={workspaceViewState.mainViewMode === 'document'}
                  className="workspace-mainViewModeButton"
                  data-active={workspaceViewState.mainViewMode === 'document'}
                  data-testid="workspace-main-view-tab-document"
                  onClick={() =>
                    updateWorkspaceViewState((state) => ({
                      ...state,
                      mainViewMode: 'document',
                    }))
                  }
                  type="button"
                >
                  文档
                </button>
                <button
                  aria-pressed={
                    workspaceViewState.mainViewMode === 'structure-map'
                  }
                  className="workspace-mainViewModeButton"
                  data-active={
                    workspaceViewState.mainViewMode === 'structure-map'
                  }
                  data-testid="workspace-main-view-tab-structure-map"
                  onClick={() =>
                    updateWorkspaceViewState((state) => ({
                      ...state,
                      mainViewMode: 'structure-map',
                    }))
                  }
                  type="button"
                >
                  结构地图
                </button>
              </div>
            </div>
          </div>
        </main>
        <aside className="workspace-rightRail">
          <div className="workspace-rightRailTrack">
            {rightToolPanels.map((panel) => {
              const isActive = activeToolPanel?.id === panel.id;

              return (
                <button
                  aria-label={panel.label}
                  aria-pressed={isActive && !isRightRailCollapsed}
                  className="workspace-toolRailButton"
                  data-active={isActive}
                  key={panel.id}
                  onClick={() => toggleRightToolPanel(panel.id)}
                  title={panel.label}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="workspace-toolRailButtonIcon"
                  >
                    <WorkspaceToolRailIcon icon={panel.icon ?? panel.id} />
                  </span>
                  <span className="workspace-toolRailButtonLabel">
                    {panel.label}
                  </span>
                  {panel.countLabel ? (
                    <span className="workspace-toolRailButtonCount">
                      {panel.countLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {activeToolPanel ? (
            <div className="workspace-rightRailDrawer">
              <div className="workspace-rightRailDrawerHeader">
                <div>
                  <p className="workspace-kicker">全局工具</p>
                  <h2 className="workspace-sectionTitle">
                    {activeToolPanel.label}
                  </h2>
                </div>
                <button
                  className="workspace-inlineAction"
                  onClick={() => setRightRailMode('collapsed')}
                  type="button"
                >
                  收起
                </button>
              </div>
              <div className="workspace-rightRailDrawerBody">
                {rightToolPanels.map((panel) => (
                  <div
                    className="workspace-rightRailPanel"
                    data-active={activeToolPanel.id === panel.id ? 'true' : 'false'}
                    key={panel.id}
                  >
                    {panel.content}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function resolveRightToolPanels(
  props: WorkspaceEditorProps,
  context: WorkspaceEditorRenderContext,
): WorkspaceEditorToolPanel[] {
  const panels = props.renderRightToolPanels?.(context);

  if (panels && panels.length > 0) {
    return panels;
  }

  return [
    {
      content: (
        <Fragment>
          {props.renderRightPanelExtra?.(context)}
          <SelectedNodeInspector
            currentModuleId={context.currentModuleId}
            selectedNodeId={context.selectedNodeId}
            tree={context.tree}
            workspaceTitle={context.workspaceTitle}
          />
        </Fragment>
      ),
      id: 'settings',
      icon: 'settings',
      label: '设置',
    },
  ];
}

type ModuleRailTrackProps = {
  currentModuleId: string | null;
  isExpanded: boolean;
  isInteractionLocked: boolean;
  modules: Array<{
    id: string;
    title: string;
  }>;
  onCreateModule: () => void;
  onSwitchModule: (moduleId: string) => void;
  onToggle: () => void;
};

function ModuleRailTrack({
  currentModuleId,
  isExpanded,
  isInteractionLocked,
  modules,
  onCreateModule,
  onSwitchModule,
  onToggle,
}: ModuleRailTrackProps) {
  return (
    <div
      className="workspace-moduleRailTrack"
      data-expanded={isExpanded ? 'true' : 'false'}
    >
      <button
        aria-label={isExpanded ? '切换模块轨为收起' : '切换模块轨为展开'}
        className="workspace-collapsedRailAction workspace-moduleRailToggle"
        onClick={onToggle}
        title={isExpanded ? '收起模块栏' : '展开模块栏'}
        type="button"
      >
        <span
          aria-hidden="true"
          className="workspace-moduleRailToggleIcon"
        >
          <ModuleRailIcon />
        </span>
      </button>
      <span className="workspace-collapsedRailCount">{modules.length}</span>
      {!isExpanded ? (
        <div className="workspace-collapsedModuleRailList">
          {modules.map((moduleNode, index) => (
            <button
              aria-label={moduleNode.title}
              aria-pressed={moduleNode.id === currentModuleId}
              className="workspace-collapsedModuleButton"
              data-active={moduleNode.id === currentModuleId}
              disabled={isInteractionLocked}
              key={moduleNode.id}
              onClick={() => onSwitchModule(moduleNode.id)}
              title={moduleNode.title}
              type="button"
            >
              {getModuleGlyph(moduleNode.title, index)}
            </button>
          ))}
        </div>
      ) : (
        <span aria-hidden="true" className="workspace-collapsedRailCurrent">
          {getModuleGlyph(
            modules.find((moduleNode) => moduleNode.id === currentModuleId)?.title ?? '',
            0,
          )}
        </span>
      )}
      <button
        aria-label="新建模块"
        className="workspace-collapsedRailAction workspace-moduleRailCreate"
        disabled={isInteractionLocked}
        onClick={onCreateModule}
        title="新建模块"
        type="button"
      >
        +
      </button>
    </div>
  );
}

function getModuleGlyph(title: string, index: number) {
  const trimmedTitle = title.trim();

  if (trimmedTitle.length > 0) {
    return trimmedTitle.slice(0, 1).toUpperCase();
  }

  return String(index + 1);
}

function WorkspaceToolRailIcon({
  icon,
}: {
  icon:
    | 'references'
    | 'resources'
    | 'export'
    | 'ai'
    | 'settings';
}) {
  switch (icon) {
    case 'references':
      return (
        <svg
          className="workspace-toolRailGlyph"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M8 7.5h8.5M8 12h8.5M8 16.5h5.5M6.75 4.75h10.5A1.75 1.75 0 0 1 19 6.5v11a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 17.5v-11A1.75 1.75 0 0 1 6.75 4.75Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      );
    case 'resources':
      return (
        <svg
          className="workspace-toolRailGlyph"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M5.5 7.25A1.75 1.75 0 0 1 7.25 5.5h3l1.2 1.4h5.3A1.75 1.75 0 0 1 18.5 8.65v7.85a1.75 1.75 0 0 1-1.75 1.75H7.25A1.75 1.75 0 0 1 5.5 16.5V7.25Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <path
            d="M5.75 9h12.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
      );
    case 'export':
      return (
        <svg
          className="workspace-toolRailGlyph"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 5.5v8.75m0 0 3.25-3.25M12 14.25 8.75 11M6.75 18.5h10.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <path
            d="M7 4.75h10A1.75 1.75 0 0 1 18.75 6.5v11A1.75 1.75 0 0 1 17 19.25H7A1.75 1.75 0 0 1 5.25 17.5v-11A1.75 1.75 0 0 1 7 4.75Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      );
    case 'ai':
      return (
        <svg
          className="workspace-toolRailGlyph"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M9 8.25 12 6l3 2.25v3.5L12 14l-3-2.25v-3.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <path
            d="M12 3.75v2.2m0 12.1v2.2m8.25-8.25h-2.2M5.95 12H3.75m14.09-5.84-1.56 1.55M7.72 16.28l-1.56 1.56m0-11.68 1.56 1.55m8.56 8.57 1.56 1.56"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg
          className="workspace-toolRailGlyph"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="m9.1 4.75.5 1.7a1 1 0 0 0 .95.72h2.9a1 1 0 0 0 .95-.72l.5-1.7m-7.3 14.5.5-1.7a1 1 0 0 1 .95-.72h2.9a1 1 0 0 1 .95.72l.5 1.7M4.75 9.1l1.7.5a1 1 0 0 1 .72.95v2.9a1 1 0 0 1-.72.95l-1.7.5m14.5-7.3-1.7.5a1 1 0 0 0-.72.95v2.9a1 1 0 0 0 .72.95l1.7.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="12"
            r="2.65"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      );
  }
}

function ModuleRailIcon() {
  return (
    <svg
      className="workspace-toolRailGlyph"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6.5 6.25h4.25v4.25H6.5V6.25Zm6.75 0h4.25v4.25h-4.25V6.25ZM6.5 13.5h4.25v4.25H6.5V13.5Zm6.75 0h4.25v4.25h-4.25V13.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
