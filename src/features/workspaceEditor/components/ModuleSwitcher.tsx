import type { ModuleNode } from '../../nodeDomain';

type ModuleSwitcherProps = {
  currentModuleId: string | null;
  isInteractionLocked: boolean;
  modules: ModuleNode[];
  onCreateModule: () => void;
  onSwitchModule: (moduleId: string) => void;
};

export default function ModuleSwitcher({
  currentModuleId,
  isInteractionLocked,
  modules,
  onCreateModule,
  onSwitchModule,
}: ModuleSwitcherProps) {
  return (
    <section className="workspace-section">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">模块切换</p>
          <h2 className="workspace-sectionTitle">当前学习模块</h2>
        </div>
        <div className="workspace-sectionActions">
          <span className="workspace-counter">{modules.length} 个模块</span>
          <button
            className="workspace-inlineAction"
            disabled={isInteractionLocked}
            onClick={onCreateModule}
            type="button"
          >
            新建模块
          </button>
        </div>
      </div>
      {modules.length === 0 ? (
        <div className="workspace-emptyState">
          <p className="workspace-helpText">
            当前主题下还没有学习模块。先手动创建首个模块，文本区和结构区就会恢复可编辑状态。
          </p>
        </div>
      ) : (
        <div aria-label="学习模块列表" className="workspace-moduleList">
          {modules.map((moduleNode) => (
            <button
              aria-pressed={moduleNode.id === currentModuleId}
              className="workspace-moduleButton"
              data-active={moduleNode.id === currentModuleId}
              disabled={isInteractionLocked}
              key={moduleNode.id}
              onClick={() => onSwitchModule(moduleNode.id)}
              type="button"
            >
              <span className="workspace-moduleName">{moduleNode.title}</span>
              <span className="workspace-moduleHint">{moduleNode.content}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
