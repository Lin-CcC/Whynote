import SectionCard from '../../../ui/SectionCard';
import type { SearchResult, SearchScope } from '../resourceSearchExportTypes';
import { getEmptyStateLabel, getScopeLabel } from '../utils/resourceTreeUtils';

type SearchLocatorPanelProps = {
  currentModuleTitle: string | null;
  hasActiveSearch: boolean;
  onSelectNode: (nodeId: string) => void;
  results: SearchResult[];
  scope: SearchScope;
  selectedNodeId: string | null;
};

export default function SearchLocatorPanel({
  currentModuleTitle,
  hasActiveSearch,
  onSelectNode,
  results,
  scope,
  selectedNodeId,
}: SearchLocatorPanelProps) {
  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">定位栏</p>
          <h2 className="workspace-sectionTitle">搜索命中</h2>
        </div>
        <span className="workspace-counter">{results.length} 个命中</span>
      </div>
      {!hasActiveSearch ? (
        <p className="workspace-helpText">
          输入关键词或选择标签后，会在当前作用域生成受控结果列表和相对位置标记。
        </p>
      ) : results.length === 0 ? (
        <p className="workspace-helpText">{getEmptyStateLabel(scope)}</p>
      ) : (
        <div className="resources-locatorLayout">
          <div className="resources-locatorRail" aria-label="相对位置标记">
            {results.map((result) => (
              <button
                aria-label={`跳转到 ${result.title}`}
                className="resources-locatorMarker"
                data-selected={selectedNodeId === result.nodeId}
                key={`marker-${result.nodeId}`}
                onClick={() => onSelectNode(result.nodeId)}
                style={{ top: `${String(result.locationRatio * 100)}%` }}
                type="button"
              />
            ))}
          </div>
          <ol className="resources-resultList">
            {results.map((result) => (
              <li key={result.nodeId}>
                <button
                  className="resources-resultButton"
                  data-selected={selectedNodeId === result.nodeId}
                  onClick={() => onSelectNode(result.nodeId)}
                  type="button"
                >
                  <div className="resources-resultHeader">
                    <span className="resources-resultType">
                      {getNodeTypeText(result.nodeType)}
                    </span>
                    <span className="resources-resultScope">
                      {getScopeLabel(scope, currentModuleTitle)}
                    </span>
                  </div>
                  <strong className="resources-resultTitle">{result.title}</strong>
                  <span className="resources-resultPath">{result.pathLabel}</span>
                  {result.sourceSummary ? (
                    <span className="resources-resultSnippet">{result.sourceSummary}</span>
                  ) : null}
                  {result.snippet ? (
                    <span className="resources-resultSnippet">{result.snippet}</span>
                  ) : null}
                  {result.tagNames.length > 0 ? (
                    <span className="resources-resultTags">
                      标签：{result.tagNames.join('、')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SectionCard>
  );
}

function getNodeTypeText(nodeType: SearchResult['nodeType']) {
  switch (nodeType) {
    case 'module':
      return '模块';
    case 'plan-step':
      return '步骤';
    case 'question':
      return '问题';
    case 'answer':
      return '回答';
    case 'summary':
      return '总结';
    case 'judgment':
      return '判断';
    case 'resource':
      return '资料';
    case 'resource-fragment':
      return '摘录';
    case 'theme-root':
      return '主题';
  }
}
