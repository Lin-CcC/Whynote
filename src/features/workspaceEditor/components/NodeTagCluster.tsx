import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getNodeOrThrow,
  resolveBuiltinTags,
  type NodeTree,
} from '../../nodeDomain';
import {
  getEditorTagColor,
  getEditorTagName,
} from './editorTagPresentation';

type NodeTagClusterProps = {
  isInteractionLocked: boolean;
  isVisible: boolean;
  nodeId: string;
  onActivateTagRail: (tagId: string) => void;
  onToggleTag: (nodeId: string, tagId: string) => void;
  tree: NodeTree;
};

export default function NodeTagCluster({
  isInteractionLocked,
  isVisible,
  nodeId,
  onActivateTagRail,
  onToggleTag,
  tree,
}: NodeTagClusterProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const node = getNodeOrThrow(tree, nodeId);
  const builtinTags = resolveBuiltinTags(tree);
  const activeTags = useMemo(
    () =>
      node.tagIds
        .map((tagId, index) => ({
          color: getEditorTagColor(tree, tagId, index),
          id: tagId,
          name: getEditorTagName(tree, tagId),
        }))
        .sort((leftTag, rightTag) =>
          leftTag.name.localeCompare(rightTag.name, 'zh-Hans-CN'),
        ),
    [node.tagIds, tree],
  );
  const showInlineAddEntry = isVisible && !isInteractionLocked;

  useEffect(() => {
    setIsPopoverOpen(false);
  }, [nodeId]);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        clusterRef.current &&
        event.target instanceof Node &&
        !clusterRef.current.contains(event.target)
      ) {
        setIsPopoverOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isPopoverOpen]);

  if (activeTags.length === 0 && !showInlineAddEntry) {
    return null;
  }

  return (
    <div className="workspace-nodeTagCluster" ref={clusterRef}>
      {activeTags.map((tag, index) => (
        <button
          aria-label={`标签 ${tag.name}`}
          className="workspace-nodeTagChip"
          data-editor-tag-kind={tag.name}
          data-testid={`editor-tag-chip-${nodeId}-${tag.id}`}
          key={tag.id}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onActivateTagRail(tag.id);
          }}
          style={
            {
              '--tag-accent': tag.color,
              '--tag-index': String(index),
            } as CSSProperties
          }
          title={`双击查看“${tag.name}”分布`}
          type="button"
        >
          {tag.name}
        </button>
      ))}
      {showInlineAddEntry ? (
        <div className="workspace-nodeTagEntry">
          <button
            aria-expanded={isPopoverOpen}
            aria-label="添加标签"
            className="workspace-nodeTagAddButton"
            data-editor-tag-entry="inline-add"
            data-testid={`editor-tag-entry-${nodeId}`}
            onClick={(event) => {
              event.stopPropagation();
              setIsPopoverOpen((previousState) => !previousState);
            }}
            type="button"
          >
            +
          </button>
          {isPopoverOpen ? (
            <div
              className="workspace-nodeTagPopover"
              data-testid={`editor-tag-popover-${nodeId}`}
              role="dialog"
            >
              <p className="workspace-nodeTagPopoverTitle">添加标签</p>
              <p className="workspace-nodeTagPopoverHint">
                选择标签种类，单击后立即附加到当前节点。
              </p>
              <div className="workspace-nodeTagPopoverList">
                {builtinTags.map((tag, index) => {
                  const isActive = node.tagIds.includes(tag.id);

                  return (
                    <button
                      aria-pressed={isActive}
                      className="workspace-nodeTagPopoverButton"
                      data-active={isActive}
                      key={tag.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsPopoverOpen(false);
                        onToggleTag(node.id, tag.id);
                      }}
                      style={
                        {
                          '--tag-accent': getEditorTagColor(tree, tag.id, index),
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span className="workspace-nodeTagPopoverSwatch" />
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
