import type { NodeTree } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import StructureTreeItem from './StructureTreeItem';

type StructureTreeProps = {
  currentModuleId: string | null;
  expandedNodeIds: Set<string>;
  isInteractionLocked: boolean;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function StructureTree({
  currentModuleId,
  expandedNodeIds,
  isInteractionLocked,
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
            <h2 className="workspace-sectionTitle">当前模块为空</h2>
          </div>
        </div>
        <p className="workspace-helpText">还没有可展示的模块节点。</p>
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
