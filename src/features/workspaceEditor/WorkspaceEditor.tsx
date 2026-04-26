import AppLayout from '../../ui/AppLayout';
import SectionCard from '../../ui/SectionCard';
import { useWorkspaceEditor } from './hooks/useWorkspaceEditor';
import type { WorkspaceEditorProps } from './workspaceEditorTypes';
import ModuleSwitcher from './components/ModuleSwitcher';
import SelectedNodeInspector from './components/SelectedNodeInspector';
import StructureActionBar from './components/StructureActionBar';
import StructureTree from './components/StructureTree';
import TextMainView from './components/TextMainView';
import './workspaceEditor.css';

export default function WorkspaceEditor(props: WorkspaceEditorProps) {
  const workspaceEditor = useWorkspaceEditor(props);
  const renderContext = {
    currentModule: workspaceEditor.currentModule,
    currentModuleId: workspaceEditor.currentModuleId,
    selectedNode: workspaceEditor.selectedNode,
    selectedNodeId: workspaceEditor.selectedNodeId,
    tree: workspaceEditor.tree,
  };

  return (
    <AppLayout
      leftPanel={
        <div className="workspace-panelStack">
          <SectionCard>
            <ModuleSwitcher
              currentModuleId={workspaceEditor.currentModuleId}
              modules={workspaceEditor.moduleNodes}
              onSwitchModule={workspaceEditor.switchModule}
            />
          </SectionCard>
          <SectionCard>
            <StructureTree
              currentModuleId={workspaceEditor.currentModuleId}
              expandedNodeIds={workspaceEditor.expandedNodeIds}
              onSelectNode={workspaceEditor.selectNode}
              onToggleNode={workspaceEditor.toggleNodeExpanded}
              selectedNodeId={workspaceEditor.selectedNodeId}
              tree={workspaceEditor.tree}
            />
          </SectionCard>
          <SectionCard>
            <StructureActionBar
              actionAvailability={workspaceEditor.actionAvailability}
              onDeleteNode={workspaceEditor.deleteSelection}
              onInsertChildNode={workspaceEditor.insertChildAtSelection}
              onInsertSiblingNode={workspaceEditor.insertSiblingAtSelection}
              onLiftNode={workspaceEditor.liftSelection}
              onLowerNode={workspaceEditor.lowerSelection}
              selectedNodeTitle={workspaceEditor.selectedNode?.title ?? null}
            />
            {workspaceEditor.operationError ? (
              <p className="workspace-errorText" role="alert">
                {workspaceEditor.operationError}
              </p>
            ) : null}
          </SectionCard>
          {props.renderLeftPanelExtra?.(renderContext)}
        </div>
      }
      mainPanel={
        <TextMainView
          currentModuleId={workspaceEditor.currentModuleId}
          onSelectNode={workspaceEditor.selectNode}
          onUpdateNode={workspaceEditor.updateNode}
          registerNodeElement={workspaceEditor.registerNodeElement}
          selectedNodeId={workspaceEditor.selectedNodeId}
          tree={workspaceEditor.tree}
        />
      }
      rightPanel={
        <div className="workspace-panelStack">
          {props.renderRightPanelExtra?.(renderContext)}
          <SelectedNodeInspector
            currentModuleId={workspaceEditor.currentModuleId}
            selectedNodeId={workspaceEditor.selectedNodeId}
            tree={workspaceEditor.tree}
            workspaceTitle={workspaceEditor.workspaceTitle}
          />
        </div>
      }
    />
  );
}
