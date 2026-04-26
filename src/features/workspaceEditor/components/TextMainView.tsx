import SectionCard from '../../../ui/SectionCard';
import type { NodeTree } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import type { NodeContentPatch } from '../workspaceEditorTypes';
import EditorNodeSection from './EditorNodeSection';

type TextMainViewProps = {
  currentModuleId: string | null;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onSelectNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function TextMainView({
  currentModuleId,
  interactionLockReason,
  isInteractionLocked,
  onSelectNode,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  tree,
}: TextMainViewProps) {
  if (!currentModuleId || !tree.nodes[currentModuleId]) {
    return (
      <SectionCard>
        <p className="workspace-kicker">文本主视图</p>
        <h2 className="workspace-sectionTitle">还没有可编辑的模块</h2>
        <p className="workspace-helpText">模块切换会驱动文本区与结构区同步渲染。</p>
      </SectionCard>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);

  return (
    <div className="workspace-mainPanel">
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">文本主视图</p>
            <h2 className="workspace-sectionTitle">文本主视图</h2>
            <p className="workspace-helpText">{currentModule.title}</p>
          </div>
          <span className="workspace-counter">{currentModule.childIds.length} 个顶层节点</span>
        </div>
        <p className="workspace-helpText">
          文本区是主舞台。结构视图只负责帮助你切模块、定位节点和做层级调整。
        </p>
        {isInteractionLocked && interactionLockReason ? (
          <p className="workspace-lockText" role="status">
            {interactionLockReason}
          </p>
        ) : null}
      </SectionCard>
      <EditorNodeSection
        depth={0}
        isInteractionLocked={isInteractionLocked}
        nodeId={currentModule.id}
        onSelectNode={onSelectNode}
        onUpdateNode={onUpdateNode}
        registerNodeElement={registerNodeElement}
        selectedNodeId={selectedNodeId}
        tree={tree}
      />
    </div>
  );
}
