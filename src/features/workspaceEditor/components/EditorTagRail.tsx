import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getNodeOrThrow, type NodeTree, type TreeNode } from '../../nodeDomain';
import { getDisplayTitleForNode } from '../utils/treeSelectors';
import {
  getEditorTagColor,
  getEditorTagName,
} from './editorTagPresentation';

type EditorTagRailProps = {
  currentModuleId: string;
  isCollapsed: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onToggleCollapsed: () => void;
  selectedNodeId: string | null;
  tagId: string;
  tree: NodeTree;
};

type TagMarker = {
  color: string;
  id: string;
  isCurrent: boolean;
  nodeId: string;
  offsetPercent: number;
  title: string;
};

export default function EditorTagRail({
  currentModuleId,
  isCollapsed,
  onClose,
  onSelectNode,
  onToggleCollapsed,
  selectedNodeId,
  tagId,
  tree,
}: EditorTagRailProps) {
  const [markers, setMarkers] = useState<TagMarker[]>([]);
  const tagName = getEditorTagName(tree, tagId);
  const taggedNodes = useMemo(
    () => collectTaggedNodesInModule(tree, currentModuleId, tagId),
    [currentModuleId, tagId, tree],
  );

  useEffect(() => {
    function measureMarkers() {
      const shellElement = document.querySelector<HTMLElement>(
        '[data-testid="workspace-document-shell"]',
      );

      if (!shellElement) {
        setMarkers([]);
        return;
      }

      const shellRect = shellElement.getBoundingClientRect();
      const shellHeight = shellRect.height || shellElement.offsetHeight || 1;
      const nextMarkers = taggedNodes
        .map((node, index) => {
          const nodeElement = document.querySelector<HTMLElement>(
            `[data-testid="editor-node-${node.id}"]`,
          );

          if (!nodeElement) {
            return null;
          }

          const nodeRect = nodeElement.getBoundingClientRect();
          const nodeCenter = nodeRect.top - shellRect.top + nodeRect.height / 2;

          return {
            color: getEditorTagColor(tree, tagId, index),
            id: `${tagId}-${node.id}`,
            isCurrent: isNodeWithinSubtree(tree, selectedNodeId, node.id),
            nodeId: node.id,
            offsetPercent: Math.min(
              100,
              Math.max(0, (nodeCenter / shellHeight) * 100),
            ),
            title: getDisplayTitleForNode(tree, node),
          } satisfies TagMarker;
        })
        .filter((marker): marker is TagMarker => marker !== null);

      setMarkers(nextMarkers);
    }

    const mainScrollElement = document.querySelector<HTMLElement>(
      '.workspace-workbenchMain',
    );
    const rafMeasure = () => {
      requestAnimationFrame(measureMarkers);
    };

    measureMarkers();
    window.addEventListener('resize', rafMeasure);
    mainScrollElement?.addEventListener('scroll', rafMeasure, { passive: true });

    return () => {
      window.removeEventListener('resize', rafMeasure);
      mainScrollElement?.removeEventListener('scroll', rafMeasure);
    };
  }, [selectedNodeId, tagId, taggedNodes, tree]);

  return (
    <aside
      className="workspace-editorTagRail"
      data-editor-tag-marker-shape="square"
      data-editor-tag-rail="true"
      data-editor-tag-rail-collapsed={isCollapsed ? 'true' : 'false'}
      data-editor-tag-rail-mode="single-tag"
    >
      <div className="workspace-editorTagRailHeader">
        <strong className="workspace-editorTagRailChip" title={tagName}>
          {tagName}
        </strong>
        <div className="workspace-editorTagRailActions">
          <button
            aria-label={isCollapsed ? '展开标签分布栏' : '收起标签分布栏'}
            className="workspace-editorTagRailButton"
            data-testid="editor-tag-rail-toggle"
            onClick={onToggleCollapsed}
            title={isCollapsed ? '展开标签分布栏' : '收起标签分布栏'}
            type="button"
          >
            {isCollapsed ? '+' : '−'}
          </button>
          <button
            aria-label="关闭标签分布栏"
            className="workspace-editorTagRailButton"
            data-testid="editor-tag-rail-close"
            onClick={onClose}
            title="关闭标签分布栏"
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      {!isCollapsed ? (
        <div className="workspace-editorTagRailTrack" data-testid="editor-tag-rail-track">
          {markers.map((marker) => (
            <button
              aria-label={`定位到 ${marker.title}`}
              className="workspace-editorTagMarker"
              data-current={marker.isCurrent}
              data-editor-tag-marker-kind={tagName}
              data-testid={`editor-tag-marker-${marker.nodeId}`}
              key={marker.id}
              onClick={() => {
                onSelectNode(marker.nodeId);
                const targetElement = document.querySelector<HTMLElement>(
                  `[data-testid="editor-node-${marker.nodeId}"]`,
                );

                if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                  targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }
              }}
              style={
                {
                  '--tag-accent': marker.color,
                  top: `${String(marker.offsetPercent)}%`,
                } as CSSProperties
              }
              title={marker.title}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function collectTaggedNodesInModule(
  tree: NodeTree,
  moduleNodeId: string,
  tagId: string,
) {
  const taggedNodes: TreeNode[] = [];
  const stack = [moduleNodeId];

  while (stack.length > 0) {
    const currentNodeId = stack.pop();

    if (!currentNodeId || !tree.nodes[currentNodeId]) {
      continue;
    }

    const currentNode = getNodeOrThrow(tree, currentNodeId);

    if (currentNode.tagIds.includes(tagId)) {
      taggedNodes.push(currentNode);
    }

    for (
      let childIndex = currentNode.childIds.length - 1;
      childIndex >= 0;
      childIndex -= 1
    ) {
      stack.push(currentNode.childIds[childIndex]);
    }
  }

  return taggedNodes;
}

function isNodeWithinSubtree(
  tree: NodeTree,
  selectedNodeId: string | null,
  ancestorNodeId: string,
) {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return false;
  }

  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, selectedNodeId);

  while (currentNode) {
    if (currentNode.id === ancestorNodeId) {
      return true;
    }

    currentNode =
      currentNode.parentId === null ? undefined : tree.nodes[currentNode.parentId];
  }

  return false;
}
