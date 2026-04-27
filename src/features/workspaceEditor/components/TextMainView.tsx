import SectionCard from '../../../ui/SectionCard';
import { getNodeOrThrow, type NodeTree } from '../../nodeDomain';
import type { NodeContentPatch } from '../workspaceEditorTypes';
import { getNodeTypeLabel } from '../utils/treeSelectors';
import EditorNodeSection from './EditorNodeSection';

type TextMainViewProps = {
  currentModuleId: string | null;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
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
  onCreateModule,
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
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            当前没有模块可承接正文内容。先手动创建首个模块，再继续编辑真实节点。
          </p>
          <button
            className="workspace-inlineAction"
            disabled={isInteractionLocked}
            onClick={onCreateModule}
            type="button"
          >
            新建模块
          </button>
        </div>
      </SectionCard>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);
  const selectedNode =
    selectedNodeId && tree.nodes[selectedNodeId]
      ? getNodeOrThrow(tree, selectedNodeId)
      : null;

  return (
    <div className="workspace-mainPanel">
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">文本主视图</p>
            <h2 className="workspace-sectionTitle">文本主视图</h2>
            <p className="workspace-moduleTitle">{currentModule.title}</p>
          </div>
          <span className="workspace-counter">
            {currentModule.childIds.length} 个顶层节点
          </span>
        </div>
        <dl className="workspace-summaryList">
          <div>
            <dt>当前焦点</dt>
            <dd>
              {selectedNode
                ? `${getNodeTypeLabel(selectedNode.type)} · ${selectedNode.title}`
                : '未选中节点'}
            </dd>
          </div>
        </dl>
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
