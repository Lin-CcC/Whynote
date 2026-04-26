import type { NodeTree } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import {
  getChildNodes,
  getNodeEmphasis,
  getNodeTypeLabel,
} from '../utils/treeSelectors';

type StructureTreeItemProps = {
  expandedNodeIds: Set<string>;
  isInteractionLocked: boolean;
  nodeId: string;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function StructureTreeItem({
  expandedNodeIds,
  isInteractionLocked,
  nodeId,
  onSelectNode,
  onToggleNode,
  selectedNodeId,
  tree,
}: StructureTreeItemProps) {
  const node = getNodeOrThrow(tree, nodeId);
  const childNodes = getChildNodes(tree, node.id);
  const isExpanded = expandedNodeIds.has(node.id);
  const isSelected = node.id === selectedNodeId;
  const nodeEmphasis = getNodeEmphasis(node);

  return (
    <li className="workspace-treeItem">
      <div
        className="workspace-treeRow"
        data-emphasis={nodeEmphasis}
        data-selected={isSelected}
      >
        {childNodes.length > 0 ? (
          <button
            aria-label={`${isExpanded ? '折叠' : '展开'} ${node.title}`}
            className="workspace-treeToggle"
            disabled={isInteractionLocked}
            onClick={() => onToggleNode(node.id)}
            type="button"
          >
            {isExpanded ? '−' : '+'}
          </button>
        ) : (
          <span aria-hidden="true" className="workspace-treeSpacer" />
        )}
        <button
          aria-current={isSelected ? 'true' : undefined}
          className="workspace-treeButton"
          disabled={isInteractionLocked}
          onClick={() => onSelectNode(node.id)}
          type="button"
        >
          <span className="workspace-treeType">{getNodeTypeLabel(node.type)}</span>
          <span className="workspace-treeText">{node.title}</span>
        </button>
      </div>
      {childNodes.length > 0 && isExpanded ? (
        <ul className="workspace-treeChildren">
          {childNodes.map((childNode) => (
            <StructureTreeItem
              expandedNodeIds={expandedNodeIds}
              isInteractionLocked={isInteractionLocked}
              key={childNode.id}
              nodeId={childNode.id}
              onSelectNode={onSelectNode}
              onToggleNode={onToggleNode}
              selectedNodeId={selectedNodeId}
              tree={tree}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
