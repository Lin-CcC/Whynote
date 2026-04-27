import type { NodeTree } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import StructureTreeItem from './StructureTreeItem';

type StructureTreeProps = {
  currentModuleId: string | null;
  expandedNodeIds: Set<string>;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function StructureTree({
  currentModuleId,
  expandedNodeIds,
  isInteractionLocked,
  onCreateModule,
  onSelectNode,
  onToggleNode,
  selectedNodeId,
  tree,
}: StructureTreeProps) {
  if (!currentModuleId || !tree.nodes[currentModuleId]) {
    return (
      <section className="workspace-section">
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">结构视图</p>
            <h2 className="workspace-sectionTitle">还没有可展示的模块结构</h2>
          </div>
        </div>
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            模块被删空后，结构树会停在这里。先新建一个模块，再继续插入步骤、问题和回答。
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
      </section>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);

  return (
    <section className="workspace-section">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">结构视图</p>
          <h2 className="workspace-sectionTitle">{currentModule.title}</h2>
        </div>
        <span className="workspace-counter">{currentModule.childIds.length} 个直接子节点</span>
      </div>
      <p className="workspace-helpText">
        结构视图只负责定位与调整层级，不单独承担完整编辑流程。
      </p>
      <ul aria-label="当前模块结构" className="workspace-tree" role="tree">
        <StructureTreeItem
          expandedNodeIds={expandedNodeIds}
          isInteractionLocked={isInteractionLocked}
          nodeId={currentModuleId}
          onSelectNode={onSelectNode}
          onToggleNode={onToggleNode}
          selectedNodeId={selectedNodeId}
          tree={tree}
        />
      </ul>
    </section>
  );
}
