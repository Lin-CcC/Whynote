import AppLayout from '../../ui/AppLayout';
import SectionCard from '../../ui/SectionCard';
import { useWorkspaceEditor } from './hooks/useWorkspaceEditor';
import type { WorkspaceEditorProps } from './workspaceEditorTypes';
import ModuleSwitcher from './components/ModuleSwitcher';
import SelectedNodeInspector from './components/SelectedNodeInspector';
import StructureActionBar from './components/StructureActionBar';
import StructureTree from './components/StructureTree';
import TextMainView from './components/TextMainView';
import { DEFAULT_WORKSPACE_VIEW_STATE } from './utils/workspaceViewState';
import './workspaceEditor.css';

export default function WorkspaceEditor(props: WorkspaceEditorProps) {
  const workspaceEditor = useWorkspaceEditor(props);
  const workspaceViewState =
    props.workspaceViewState ?? DEFAULT_WORKSPACE_VIEW_STATE;
  const handleWorkspaceViewStateChange =
    props.onWorkspaceViewStateChange ?? (() => {});
  const renderContext = {
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

  return (
    <AppLayout
      leftPanel={
        <div className="workspace-panelStack">
          <SectionCard>
            <ModuleSwitcher
              currentModuleId={workspaceEditor.currentModuleId}
              isInteractionLocked={props.isInteractionLocked ?? false}
              modules={workspaceEditor.moduleNodes}
              onCreateModule={workspaceEditor.createModule}
              onSwitchModule={workspaceEditor.switchModule}
            />
          </SectionCard>
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
          {props.renderLeftPanelExtra?.(renderContext)}
          <SectionCard>
            <StructureActionBar
              actionAvailability={workspaceEditor.actionAvailability}
              childInsertOptions={workspaceEditor.childInsertOptions}
              interactionLockReason={props.interactionLockReason ?? null}
              isInteractionLocked={props.isInteractionLocked ?? false}
              learningActions={workspaceEditor.learningActions}
              onChildInsertTypeChange={workspaceEditor.setSelectedChildInsertType}
              onDeleteNode={workspaceEditor.deleteSelection}
              onInsertChildNode={workspaceEditor.insertChildAtSelection}
              onInsertSiblingNode={workspaceEditor.insertSiblingAtSelection}
              onLiftNode={workspaceEditor.liftSelection}
              onLowerNode={workspaceEditor.lowerSelection}
              onRunLearningAction={workspaceEditor.runLearningAction}
              onSiblingInsertTypeChange={workspaceEditor.setSelectedSiblingInsertType}
              selectedChildInsertType={workspaceEditor.selectedChildInsertType}
              selectedSiblingInsertType={workspaceEditor.selectedSiblingInsertType}
              selectedNodeTitle={workspaceEditor.selectedNode?.title ?? null}
              siblingInsertOptions={workspaceEditor.siblingInsertOptions}
            />
            {workspaceEditor.operationError ? (
              <p className="workspace-errorText" role="alert">
                {workspaceEditor.operationError}
              </p>
            ) : null}
          </SectionCard>
        </div>
      }
      mainPanel={
        <TextMainView
          currentModuleId={workspaceEditor.currentModuleId}
          interactionLockReason={props.interactionLockReason ?? null}
          isInteractionLocked={props.isInteractionLocked ?? false}
          onCreateModule={workspaceEditor.createModule}
          onDeleteNodeById={workspaceEditor.deleteNodeById}
          onDirectAnswerQuestion={props.onDirectAnswerQuestion}
          onEvaluateAnswer={props.onEvaluateAnswer}
          onEvaluateSummary={props.onEvaluateSummary}
          onGenerateFollowUpQuestion={props.onGenerateFollowUpQuestion}
          onGenerateSummary={props.onGenerateSummary}
          onDeleteNode={workspaceEditor.deleteSelection}
          onInsertAnswerForQuestion={workspaceEditor.insertAnswerForQuestion}
          onInsertFollowUpQuestion={workspaceEditor.insertFollowUpQuestion}
          onInsertSummaryForNode={workspaceEditor.insertSummaryForNode}
          onRunLearningAction={workspaceEditor.runLearningAction}
          onRunLearningActionForNode={workspaceEditor.runLearningActionForNode}
          onSelectNode={workspaceEditor.selectNode}
          onSetCurrentAnswer={workspaceEditor.setCurrentAnswer}
          onUpdateNode={workspaceEditor.updateNode}
          onWorkspaceViewStateChange={handleWorkspaceViewStateChange}
          renderNodeInlineActions={props.renderNodeInlineActions}
          registerNodeElement={workspaceEditor.registerNodeElement}
          selectedNodeId={workspaceEditor.selectedNodeId}
          tree={workspaceEditor.tree}
          workspaceViewState={workspaceViewState}
        />
      }
      rightPanel={
        <div className="workspace-panelStack">
          {props.renderRightPanelExtra?.(renderContext)}
          <SelectedNodeInspector
            currentModuleId={workspaceEditor.currentModuleId}
            isInteractionLocked={props.isInteractionLocked ?? false}
            onChangeSelectedNodeType={workspaceEditor.switchSelectedNodeType}
            onToggleSelectedNodeTag={workspaceEditor.toggleSelectedNodeTag}
            selectedNodeId={workspaceEditor.selectedNodeId}
            selectedNodeTypeSwitchOptions={
              workspaceEditor.selectedNodeTypeSwitchOptions
            }
            tree={workspaceEditor.tree}
            workspaceTitle={workspaceEditor.workspaceTitle}
          />
        </div>
      }
    />
  );
}
