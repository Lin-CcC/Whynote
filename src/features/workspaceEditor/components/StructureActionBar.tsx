import type {
  EditorActionAvailability,
  EditorInsertTypeOption,
  LearningActionId,
  LearningActionOption,
} from '../workspaceEditorTypes';

type StructureActionBarProps = {
  actionAvailability: EditorActionAvailability;
  childInsertOptions: EditorInsertTypeOption[];
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  learningActions: LearningActionOption[];
  onChildInsertTypeChange: (nodeType: EditorInsertTypeOption['value']) => void;
  onDeleteNode: () => void;
  onInsertChildNode: () => void;
  onInsertSiblingNode: () => void;
  onLiftNode: () => void;
  onLowerNode: () => void;
  onRunLearningAction: (actionId: LearningActionId) => void;
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
  learningActions,
  onChildInsertTypeChange,
  onDeleteNode,
  onInsertChildNode,
  onInsertSiblingNode,
  onLiftNode,
  onLowerNode,
  onRunLearningAction,
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
          <p className="workspace-kicker">学习动作</p>
          <h2 className="workspace-sectionTitle">先做当前这一步学习</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        {isInteractionLocked && interactionLockReason
          ? interactionLockReason
          : selectedNodeTitle
            ? `当前节点：${selectedNodeTitle}`
            : '先从结构视图或文本主视图中选中一个节点。'}
      </p>
      {learningActions.length > 0 ? (
        <div className="workspace-learningActionGrid" data-testid="learning-action-grid">
          {learningActions.map((action) => (
            <div className="workspace-learningAction" key={action.id}>
              <button
                disabled={isInteractionLocked}
                onClick={() => {
                  onRunLearningAction(action.id);
                }}
                type="button"
              >
                {action.label}
              </button>
              <p className="workspace-actionHint">{action.hint}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="workspace-helpText">
          当前节点没有直接学习动作。需要细调树结构时，可使用下方高级结构操作。
        </p>
      )}
      <div
        className="workspace-secondaryActionSection"
        data-testid="advanced-structure-actions"
      >
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">高级结构操作</p>
            <h3 className="workspace-subsectionTitle">需要时再精调树结构</h3>
          </div>
        </div>
        <p className="workspace-helpText">
          这里保留子节点 / 同级、升降级和删除，供你在学习动作之外做精细重排。
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
      </div>
    </section>
  );
}
