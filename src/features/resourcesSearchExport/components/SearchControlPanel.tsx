import SectionCard from '../../../ui/SectionCard';
import type {
  SearchScope,
  TagFilterOption,
} from '../resourceSearchExportTypes';

type SearchControlPanelProps = {
  availableTags: TagFilterOption[];
  currentModuleTitle: string | null;
  onQueryChange: (nextQuery: string) => void;
  onScopeChange: (nextScope: SearchScope) => void;
  onToggleTag: (tagId: string) => void;
  query: string;
  scope: SearchScope;
  selectedTagIds: string[];
};

const SEARCH_SCOPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: SearchScope;
}> = [
  {
    description: '默认只在当前模块里找，不自动扩大全主题。',
    label: '当前模块',
    value: 'current-module',
  },
  {
    description: '同时搜索模块树和资料树。',
    label: '全主题',
    value: 'theme',
  },
  {
    description: '只搜索全局资料区里的 resource 与 resource-fragment。',
    label: '资料区',
    value: 'resources',
  },
];

export default function SearchControlPanel({
  availableTags,
  currentModuleTitle,
  onQueryChange,
  onScopeChange,
  onToggleTag,
  query,
  scope,
  selectedTagIds,
}: SearchControlPanelProps) {
  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">搜索作用域</p>
          <h2 className="workspace-sectionTitle">搜索与定位</h2>
        </div>
      </div>
      <p className="workspace-helpText">
        {scope === 'current-module'
          ? `当前默认只搜模块：${currentModuleTitle ?? '未选中模块'}`
          : scope === 'theme'
            ? '当前在全主题内搜索，包含模块树和资料区。'
            : '当前只搜索全局资料区。'}
      </p>
      <label className="resources-panelField">
        <span className="resources-panelFieldLabel">关键词</span>
        <input
          aria-label="搜索关键词"
          className="resources-panelInput"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题、正文、摘录或来源摘要"
          value={query}
        />
      </label>
      <div className="resources-segmentedControl" role="tablist" aria-label="搜索范围">
        {SEARCH_SCOPE_OPTIONS.map((option) => (
          <button
            aria-label={`切换到${option.label}搜索`}
            aria-pressed={scope === option.value}
            className="resources-segmentButton"
            data-active={scope === option.value}
            key={option.value}
            onClick={() => onScopeChange(option.value)}
            type="button"
          >
            <span className="resources-segmentLabel">{option.label}</span>
            <span className="resources-segmentDescription">{option.description}</span>
          </button>
        ))}
      </div>
      <div className="resources-tagFilter">
        <div className="resources-tagHeader">
          <span className="resources-panelFieldLabel">标签筛选</span>
          {scope === 'resources' ? (
            <span className="resources-tagHint">资料区搜索首版不启用标签筛选。</span>
          ) : null}
        </div>
        {scope !== 'resources' && availableTags.length > 0 ? (
          <div className="resources-tagList">
            {availableTags.map((tag) => (
              <button
                aria-pressed={selectedTagIds.includes(tag.id)}
                className="resources-tagChip"
                data-active={selectedTagIds.includes(tag.id)}
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                type="button"
              >
                {tag.name}
                <span className="resources-tagCount">{tag.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="workspace-helpText">
            {scope === 'resources' ? '切回当前模块或全主题后，才能按现有节点标签筛选。' : '当前作用域还没有可用标签。'}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
