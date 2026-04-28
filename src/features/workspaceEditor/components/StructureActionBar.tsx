import type {
  EditorActionAvailability,
  EditorInsertTypeOption,
} from '../workspaceEditorTypes';

type StructureActionBarProps = {
  actionAvailability: EditorActionAvailability;
  childInsertOptions: EditorInsertTypeOption[];
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onChildInsertTypeChange: (nodeType: EditorInsertTypeOption['value']) => void;
  onDeleteNode: () => void;
  onInsertChildNode: () => void;
  onInsertSiblingNode: () => void;
  onLiftNode: () => void;
  onLowerNode: () => void;
  onSiblingInsertTypeChange: (nodeType: EditorInsertTypeOption['value']) => void;
  selectedChildInsertType: string | null;
  selectedSiblingInsertType: string | null;
  selectedNodeTitle: string | null;
  siblingInsertOptions: EditorInsertTypeOption[];
};

export default function StructureActionBar({
  actionAvailability,
  childInsertOptions,
  interactionLockReason,
  isInteractionLocked,
  onChildInsertTypeChange,
  onDeleteNode,
  onInsertChildNode,
  onInsertSiblingNode,
  onLiftNode,
  onLowerNode,
  onSiblingInsertTypeChange,
  selectedChildInsertType,
  selectedSiblingInsertType,
  selectedNodeTitle,
  siblingInsertOptions,
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
        <div className="workspace-actionField">
          <label className="workspace-actionLabel" htmlFor="workspace-insert-child-type">
            子节点类型
          </label>
          <select
            aria-label="子节点类型"
            className="workspace-actionSelect"
            disabled={!actionAvailability.canInsertChild || childInsertOptions.length === 0}
            id="workspace-insert-child-type"
            onChange={(event) =>
              onChildInsertTypeChange(
                event.target.value as EditorInsertTypeOption['value'],
              )
            }
            value={selectedChildInsertType ?? ''}
          >
            {childInsertOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            disabled={!actionAvailability.canInsertChild}
            onClick={onInsertChildNode}
            type="button"
          >
            插入子节点
          </button>
        </div>
        <div className="workspace-actionField">
          <label className="workspace-actionLabel" htmlFor="workspace-insert-sibling-type">
            同级节点类型
          </label>
          <select
            aria-label="同级节点类型"
            className="workspace-actionSelect"
            disabled={!actionAvailability.canInsertSibling || siblingInsertOptions.length === 0}
            id="workspace-insert-sibling-type"
            onChange={(event) =>
              onSiblingInsertTypeChange(
                event.target.value as EditorInsertTypeOption['value'],
              )
            }
            value={selectedSiblingInsertType ?? ''}
          >
            {siblingInsertOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            disabled={!actionAvailability.canInsertSibling}
            onClick={onInsertSiblingNode}
            type="button"
          >
            插入同级
          </button>
        </div>
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
