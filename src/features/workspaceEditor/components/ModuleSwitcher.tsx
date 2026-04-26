import type { ModuleNode } from '../../nodeDomain';

type ModuleSwitcherProps = {
  currentModuleId: string | null;
  modules: ModuleNode[];
  onSwitchModule: (moduleId: string) => void;
};

export default function ModuleSwitcher({
  currentModuleId,
  modules,
  onSwitchModule,
}: ModuleSwitcherProps) {
  return (
    <section className="workspace-section">
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">模块切换</p>
          <h2 className="workspace-sectionTitle">当前学习模块</h2>
        </div>
        <span className="workspace-counter">{modules.length} 个模块</span>
      </div>
      <div aria-label="学习模块列表" className="workspace-moduleList">
        {modules.map((moduleNode) => (
          <button
            aria-pressed={moduleNode.id === currentModuleId}
            className="workspace-moduleButton"
            data-active={moduleNode.id === currentModuleId}
            key={moduleNode.id}
            onClick={() => onSwitchModule(moduleNode.id)}
            type="button"
          >
            <span className="workspace-moduleName">{moduleNode.title}</span>
            <span className="workspace-moduleHint">{moduleNode.content}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
