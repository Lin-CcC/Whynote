import { useEffect, useRef } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { ResourceGroup } from '../resourceSearchExportTypes';

type ResourceLibraryPanelProps = {
  onSelectNode: (nodeId: string) => void;
  resourceGroups: ResourceGroup[];
  selectedNodeId: string | null;
};

export default function ResourceLibraryPanel({
  onSelectNode,
  resourceGroups,
  selectedNodeId,
}: ResourceLibraryPanelProps) {
  const itemElementMapRef = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const selectedElement = itemElementMapRef.current.get(selectedNodeId);

    selectedElement?.focus();
  }, [selectedNodeId]);

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">全局资料区</p>
          <h2 className="workspace-sectionTitle">资料与摘录</h2>
        </div>
        <span className="workspace-counter">{resourceGroups.length} 份资料</span>
      </div>
      {resourceGroups.length === 0 ? (
        <p className="workspace-helpText">
          当前工作区还没有 `resource`。导入资料后，这里会承接资料与摘录节点。
        </p>
      ) : (
        <div className="resources-libraryList">
          {resourceGroups.map((group) => (
            <article className="resources-libraryGroup" key={group.resourceNode.id}>
              <button
                aria-label={`定位资料 ${group.resourceNode.title}`}
                className="resources-libraryItem"
                data-selected={selectedNodeId === group.resourceNode.id}
                onClick={() => onSelectNode(group.resourceNode.id)}
                ref={(element) => registerItemElement(group.resourceNode.id, element)}
                type="button"
              >
                <span className="resources-libraryType">资料</span>
                <strong className="resources-libraryTitle">{group.resourceNode.title}</strong>
                <span className="resources-librarySummary">{group.sourceSummary}</span>
                <span className="resources-libraryMeta">
                  {group.referenceCount > 0
                    ? `被引用 ${String(group.referenceCount)} 次`
                    : '尚未被节点引用'}
                </span>
              </button>
              {group.fragmentNodes.length > 0 ? (
                <div className="resources-fragmentList">
                  {group.fragmentNodes.map((fragmentNode) => (
                    <button
                      aria-label={`定位摘录 ${fragmentNode.title}`}
                      className="resources-libraryItem resources-libraryItem-fragment"
                      data-selected={selectedNodeId === fragmentNode.id}
                      key={fragmentNode.id}
                      onClick={() => onSelectNode(fragmentNode.id)}
                      ref={(element) => registerItemElement(fragmentNode.id, element)}
                      type="button"
                    >
                      <span className="resources-libraryType">摘录</span>
                      <strong className="resources-libraryTitle">{fragmentNode.title}</strong>
                      <span className="resources-librarySummary">
                        {fragmentNode.excerpt || fragmentNode.content || '暂无摘录正文'}
                      </span>
                      <span className="resources-libraryMeta">
                        {fragmentNode.locator ? `定位：${fragmentNode.locator}` : '未记录定位信息'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );

  function registerItemElement(
    nodeId: string,
    element: HTMLButtonElement | null,
  ) {
    if (!element) {
      itemElementMapRef.current.delete(nodeId);
      return;
    }

    itemElementMapRef.current.set(nodeId, element);
  }
}
