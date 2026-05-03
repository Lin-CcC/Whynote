import { useEffect, useRef } from 'react';

import SectionCard from '../../../ui/SectionCard';
import type { NodeTree, ResourceMetadataRecord } from '../../nodeDomain';
import type { ResourceGroup } from '../resourceSearchExportTypes';
import { countReferencesToNode } from '../services/resourceDeleteService';
import { getResourceProvenanceSummary } from '../utils/resourceMetadataPresentation';

type ResourceLibraryPanelProps = {
  onRequestDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  resourceGroups: ResourceGroup[];
  resourceMetadataByNodeId: Record<string, ResourceMetadataRecord>;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function ResourceLibraryPanel({
  onRequestDeleteNode,
  onSelectNode,
  resourceGroups,
  resourceMetadataByNodeId,
  selectedNodeId,
  tree,
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
    <SectionCard className="resources-toolCard resources-toolCard-resources">
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
          {resourceGroups.map((group) => {
            const resourceMetadata = resourceMetadataByNodeId[group.resourceNode.id];

            return (
              <article
                className="resources-libraryGroup"
                key={group.resourceNode.id}
              >
                <button
                  aria-label={`定位资料 ${group.resourceNode.title}`}
                  className="resources-libraryItem"
                  data-selected={selectedNodeId === group.resourceNode.id}
                  onClick={() => onSelectNode(group.resourceNode.id)}
                  ref={(element) =>
                    registerItemElement(group.resourceNode.id, element)
                  }
                  type="button"
                >
                  <span className="resources-libraryType">资料</span>
                  <strong className="resources-libraryTitle">
                    {group.resourceNode.title}
                  </strong>
                  <span className="resources-librarySummary">
                    {group.sourceSummary}
                  </span>
                  <span className="resources-libraryMeta">
                    {getResourceProvenanceSummary(resourceMetadata)}
                  </span>
                  <span className="resources-libraryMeta">
                    {group.referenceCount > 0
                      ? `被引用 ${String(group.referenceCount)} 次`
                      : '尚未被学习节点引用'}
                  </span>
                  <span className="resources-libraryMeta">
                    {group.fragmentNodes.length > 0
                      ? `含 ${String(group.fragmentNodes.length)} 条摘录`
                      : '当前还没有摘录'}
                  </span>
                </button>
                <div className="resources-libraryActionRow">
                  <button
                    aria-label={`删除资料 ${group.resourceNode.title}`}
                    className="resources-inlineButton"
                    onClick={() => onRequestDeleteNode(group.resourceNode.id)}
                    type="button"
                  >
                    删除资料
                  </button>
                </div>
                {group.fragmentNodes.length > 0 ? (
                  <div className="resources-fragmentList">
                    {group.fragmentNodes.map((fragmentNode) => {
                      const referenceCount = countReferencesToNode(tree, fragmentNode.id);

                      return (
                        <div
                          className="resources-libraryEntry"
                          key={fragmentNode.id}
                        >
                          <button
                            aria-label={`定位摘录 ${fragmentNode.title}`}
                            className="resources-libraryItem resources-libraryItem-fragment"
                            data-selected={selectedNodeId === fragmentNode.id}
                            onClick={() => onSelectNode(fragmentNode.id)}
                            ref={(element) =>
                              registerItemElement(fragmentNode.id, element)
                            }
                            type="button"
                          >
                            <span className="resources-libraryType">摘录</span>
                            <strong className="resources-libraryTitle">
                              {fragmentNode.title}
                            </strong>
                            <span className="resources-librarySummary">
                              {fragmentNode.excerpt ||
                                fragmentNode.content ||
                                '暂无摘录正文'}
                            </span>
                            <span className="resources-libraryMeta">
                              {fragmentNode.locator
                                ? `定位：${fragmentNode.locator}`
                                : '未记录定位信息'}
                            </span>
                            <span className="resources-libraryMeta">
                              {referenceCount > 0
                                ? `被引用 ${String(referenceCount)} 次`
                                : '尚未被学习节点引用'}
                            </span>
                          </button>
                          <div className="resources-libraryActionRow">
                            <button
                              aria-label={`删除摘录 ${fragmentNode.title}`}
                              className="resources-inlineButton"
                              onClick={() => onRequestDeleteNode(fragmentNode.id)}
                              type="button"
                            >
                              删除摘录
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
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
