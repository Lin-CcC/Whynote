import SectionCard from '../../../ui/SectionCard';
import {
  getAllowedChildTypes,
  getNodeOrThrow,
  resolveBuiltinTags,
  type NodeTree,
} from '../../nodeDomain';
import {
  getDisplayLabelForNode,
  getNodePath,
  getNodeTypeLabel,
} from '../utils/treeSelectors';

type SelectedNodeInspectorProps = {
  currentModuleId: string | null;
  isInteractionLocked: boolean;
  onToggleSelectedNodeTag: (tagId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
  workspaceTitle: string;
};

export default function SelectedNodeInspector({
  currentModuleId,
  isInteractionLocked,
  onToggleSelectedNodeTag,
  selectedNodeId,
  tree,
  workspaceTitle,
}: SelectedNodeInspectorProps) {
  const selectedNode =
    selectedNodeId && tree.nodes[selectedNodeId]
      ? getNodeOrThrow(tree, selectedNodeId)
      : null;
  const currentModule =
    currentModuleId && tree.nodes[currentModuleId]
      ? getNodeOrThrow(tree, currentModuleId)
      : null;
  const selectedNodePath = selectedNode ? getNodePath(tree, selectedNode.id) : [];
  const selectedTagNames = selectedNode
    ? selectedNode.tagIds
        .map((tagId) => tree.tags[tagId]?.name)
        .filter((tagName): tagName is string => Boolean(tagName))
        .sort((leftTag, rightTag) => leftTag.localeCompare(rightTag, 'zh-Hans-CN'))
    : [];
  const builtinTags = resolveBuiltinTags(tree);

  return (
    <>
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">编辑上下文</p>
            <h2 className="workspace-sectionTitle">当前焦点</h2>
          </div>
        </div>
        <dl className="workspace-inspectorList">
          <div>
            <dt>主题</dt>
            <dd>{workspaceTitle}</dd>
          </div>
          <div>
            <dt>模块</dt>
            <dd>{currentModule?.title ?? '未选中模块'}</dd>
          </div>
          <div>
            <dt>节点</dt>
              <dd>
                {selectedNode
                  ? `${getDisplayLabelForNode(tree, selectedNode)} · ${selectedNode.title}`
                  : '未选中节点'}
              </dd>
          </div>
          <div>
            <dt>路径</dt>
            <dd>
              {selectedNodePath.length > 0
                ? selectedNodePath.map((node) => node.title).join(' / ')
                : '暂无'}
            </dd>
          </div>
          <div>
            <dt>允许的子节点</dt>
            <dd>
              {selectedNode
                ? getAllowedChildTypes(selectedNode.type)
                    .map((nodeType) => getNodeTypeLabel(nodeType))
                    .join('、') || '无'
                : '暂无'}
            </dd>
          </div>
          <div>
            <dt>标签</dt>
            <dd>{selectedTagNames.length > 0 ? selectedTagNames.join('、') : '暂无'}</dd>
          </div>
        </dl>
        <div className="workspace-tagSection">
          <p className="workspace-kicker">节点标签</p>
          <p className="workspace-tagMeta">
            {selectedNode
              ? '给当前选中节点快速挂载或移除内建标签。'
              : '先选中一个节点，再挂载内建标签。'}
          </p>
          <div className="workspace-tagList">
            {builtinTags.map((tag) => {
              const isActive = selectedNode?.tagIds.includes(tag.id) ?? false;

              return (
                <button
                  aria-pressed={isActive}
                  className="workspace-tagButton"
                  data-active={isActive}
                  disabled={!selectedNode || isInteractionLocked}
                  key={tag.id}
                  onClick={() => onToggleSelectedNodeTag(tag.id)}
                  type="button"
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">范围说明</p>
            <h2 className="workspace-sectionTitle">当前边界</h2>
          </div>
        </div>
        <p className="workspace-helpText">
          当前界面已覆盖文本主视图、结构视图、全局资料区、搜索、定位、标签筛选和基础导出；
          仍不扩展云同步、PDF / DOC、完整资料对照阅读区和新的 AI 能力。
        </p>
      </SectionCard>
    </>
  );
}
