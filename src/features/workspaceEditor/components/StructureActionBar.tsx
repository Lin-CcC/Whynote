import type { EditorActionAvailability } from '../workspaceEditorTypes';

type StructureActionBarProps = {
  actionAvailability: EditorActionAvailability;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onDeleteNode: () => void;
  onInsertChildNode: () => void;
  onInsertSiblingNode: () => void;
  onLiftNode: () => void;
  onLowerNode: () => void;
  selectedNodeTitle: string | null;
};

export default function StructureActionBar({
  actionAvailability,
  interactionLockReason,
  isInteractionLocked,
  onDeleteNode,
  onInsertChildNode,
  onInsertSiblingNode,
  onLiftNode,
  onLowerNode,
  selectedNodeTitle,
}: StructureActionBarProps) {
  return (
    <section className="workspace-section">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">结构编辑</p>
          <h2 className="workspace-sectionTitle">节点操作入口</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        {isInteractionLocked && interactionLockReason
          ? interactionLockReason
          : selectedNodeTitle
            ? `当前节点：${selectedNodeTitle}`
            : '先从结构视图或文本主视图中选中一个节点。'}
      </p>
      <div className="workspace-actionGrid">
        <button
          disabled={!actionAvailability.canInsertChild}
          onClick={onInsertChildNode}
          type="button"
        >
          插入子节点
        </button>
        <button
          disabled={!actionAvailability.canInsertSibling}
          onClick={onInsertSiblingNode}
          type="button"
        >
          插入同级
        </button>
        <button
          disabled={!actionAvailability.canLift}
          onClick={onLiftNode}
          type="button"
        >
          提升一级
        </button>
        <button
          disabled={!actionAvailability.canLower}
          onClick={onLowerNode}
          type="button"
        >
          降低一级
        </button>
        <button
          disabled={!actionAvailability.canDelete}
          onClick={onDeleteNode}
          type="button"
        >
          删除节点
        </button>
      </div>
    </section>
  );
}
