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
  onChangeSelectedNodeType: (
    nodeType: 'question' | 'answer' | 'summary' | 'judgment',
  ) => void;
  onChildInsertTypeChange: (nodeType: EditorInsertTypeOption['value']) => void;
  onDeleteNode: () => void;
  onInsertChildNode: () => void;
  onInsertSiblingNode: () => void;
  onLiftNode: () => void;
  onLowerNode: () => void;
  onRunLearningAction: (actionId: LearningActionId) => void;
  onSiblingInsertTypeChange: (nodeType: EditorInsertTypeOption['value']) => void;
  selectedChildInsertType: string | null;
  selectedNodeTitle: string | null;
  selectedNodeType: string | null;
  selectedNodeTypeSwitchOptions: (
    'question' | 'answer' | 'summary' | 'judgment'
  )[];
  selectedSiblingInsertType: string | null;
  siblingInsertOptions: EditorInsertTypeOption[];
};

const TYPE_SWITCH_OPTIONS = [
  { label: '问题', value: 'question' },
  { label: '回答', value: 'answer' },
  { label: '总结', value: 'summary' },
  { label: '判断', value: 'judgment' },
] as const;

export default function StructureActionBar({
  actionAvailability,
  childInsertOptions,
  interactionLockReason,
  isInteractionLocked,
  learningActions,
  onChangeSelectedNodeType,
  onChildInsertTypeChange,
  onDeleteNode,
  onInsertChildNode,
  onInsertSiblingNode,
  onLiftNode,
  onLowerNode,
  onRunLearningAction,
  onSiblingInsertTypeChange,
  selectedChildInsertType,
  selectedNodeTitle,
  selectedNodeType,
  selectedNodeTypeSwitchOptions,
  selectedSiblingInsertType,
  siblingInsertOptions,
}: StructureActionBarProps) {
  const currentNodeContextText =
    isInteractionLocked && interactionLockReason
      ? interactionLockReason
      : selectedNodeTitle
        ? `当前节点：${selectedNodeTitle}`
        : '先从结构视图或主编辑区选中一个节点。';
  const allowedContentLabel =
    childInsertOptions.map((option) => option.label).join('、') || '无';
  const canSwitchNodeType = selectedNodeType !== null;

  return (
    <section className="workspace-section">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">学习动作</p>
          <h2 className="workspace-sectionTitle">先做当前这一步学习</h2>
        </div>
      </div>
      <p
        className="workspace-helpText workspace-sidebarStableText"
        title={currentNodeContextText}
      >
        {currentNodeContextText}
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
          当前节点没有直接学习动作。需要微调结构时，再使用下面的结构辅助区。
        </p>
      )}
      <div
        className="workspace-secondaryActionSection"
        data-testid="advanced-structure-actions"
      >
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">结构辅助</p>
            <h3 className="workspace-subsectionTitle">需要时再精调树结构</h3>
          </div>
        </div>
        <dl className="workspace-inspectorList">
          <div>
            <dt>当前可接内容</dt>
            <dd className="workspace-inspectorClamp" title={allowedContentLabel}>
              {allowedContentLabel}
            </dd>
          </div>
        </dl>
        <p className="workspace-helpText">
          这里只保留插入、提升、降低、删除和安全类型切换，作为学习动作之外的结构微调入口。
        </p>
        <div className="workspace-tagSection">
          <p className="workspace-kicker">节点类型</p>
          <p className="workspace-tagMeta">
            {canSwitchNodeType
              ? '只开放叶子节点的安全切换，只会在当前父节点允许的类型之间切换。'
              : '先选中一个节点，再使用安全类型切换。'}
          </p>
          <div className="workspace-typeSwitchList">
            {TYPE_SWITCH_OPTIONS.map((option) => {
              const isCurrentType = selectedNodeType === option.value;
              const isAllowed = selectedNodeTypeSwitchOptions.includes(option.value);

              return (
                <button
                  aria-label={
                    isCurrentType ? `当前类型：${option.label}` : `切换为${option.label}`
                  }
                  aria-pressed={isCurrentType}
                  className="workspace-typeSwitchButton"
                  data-active={isCurrentType}
                  disabled={!canSwitchNodeType || !isAllowed || isInteractionLocked}
                  key={option.value}
                  onClick={() => onChangeSelectedNodeType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
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
