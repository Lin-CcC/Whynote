import SectionCard from '../../../ui/SectionCard';
import {
  getAllowedChildTypes,
  getNodeOrThrow,
  type NonRootNode,
  resolveBuiltinTags,
  type NodeTree,
} from '../../nodeDomain';
import {
  getDisplayLabelForNode,
  getDisplayTitleForNode,
  getNodePath,
  getNodeTypeLabel,
} from '../utils/treeSelectors';
import { getNodeSemanticVisibility } from '../utils/nodeSemanticVisibility';

type SelectedNodeInspectorProps = {
  currentModuleId: string | null;
  isInteractionLocked: boolean;
  onChangeSelectedNodeType: (
    nodeType: 'question' | 'answer' | 'summary' | 'judgment',
  ) => void;
  onToggleSelectedNodeTag: (tagId: string) => void;
  selectedNodeId: string | null;
  selectedNodeTypeSwitchOptions: (
    'question' | 'answer' | 'summary' | 'judgment'
  )[];
  tree: NodeTree;
  workspaceTitle: string;
};

export default function SelectedNodeInspector({
  currentModuleId,
  isInteractionLocked,
  onChangeSelectedNodeType,
  onToggleSelectedNodeTag,
  selectedNodeId,
  selectedNodeTypeSwitchOptions,
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
  const selectedNodePathSegments = selectedNodePath
    .filter((node) => node.type !== 'theme-root')
    .map((node) => getDisplayTitleForNode(tree, node));
  const selectedTagNames = selectedNode
    ? selectedNode.tagIds
        .map((tagId) => tree.tags[tagId]?.name)
        .filter((tagName): tagName is string => Boolean(tagName))
        .sort((leftTag, rightTag) => leftTag.localeCompare(rightTag, 'zh-Hans-CN'))
    : [];
  const builtinTags = resolveBuiltinTags(tree);
  const canSwitchSelectedNodeType =
    Boolean(selectedNode) && selectedNodeTypeSwitchOptions.length > 0;
  const currentModuleTitle = currentModule?.title ?? '未选中模块';
  const selectedNodeLabel = selectedNode
    ? `${getDisplayLabelForNode(tree, selectedNode)} · ${getDisplayTitleForNode(tree, selectedNode)}`
    : '未选中节点';
  const selectedNodePathLabel =
    selectedNodePathSegments.length > 0
      ? selectedNodePathSegments.join(' / ')
      : '暂无';
  const allowedChildTypesLabel = selectedNode
    ? getAllowedChildTypes(selectedNode.type)
        .map((nodeType) => getNodeTypeLabel(nodeType))
        .join('、') || '无'
    : '暂无';
  const selectedTagLabel =
    selectedTagNames.length > 0 ? selectedTagNames.join('、') : '暂无';
  const semanticVisibility = selectedNode
    ? getNodeSemanticVisibility(tree, selectedNode)
    : { badges: [], notes: [] };
  const selectedNodeSemanticLabel =
    semanticVisibility.badges.length > 0
      ? semanticVisibility.badges.map((badge) => badge.label).join('、')
      : '暂无';
  const selectedNodeSemanticNotesLabel =
    semanticVisibility.notes.length > 0
      ? semanticVisibility.notes.join('；')
      : '暂无';

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
            <dd className="workspace-inspectorClamp" title={workspaceTitle}>
              {workspaceTitle}
            </dd>
          </div>
          <div>
            <dt>模块</dt>
            <dd className="workspace-inspectorClamp" title={currentModuleTitle}>
              {currentModuleTitle}
            </dd>
          </div>
          <div>
            <dt>节点</dt>
            <dd className="workspace-inspectorClamp" title={selectedNodeLabel}>
              {selectedNodeLabel}
            </dd>
          </div>
          <div>
            <dt>路径</dt>
            <dd
              className="workspace-inspectorClamp"
              title={selectedNodePathLabel}
            >
              {selectedNodePathLabel}
            </dd>
          </div>
          <div>
            <dt>当前可接内容</dt>
            <dd className="workspace-inspectorClamp" title={allowedChildTypesLabel}>
              {allowedChildTypesLabel}
            </dd>
          </div>
          <div>
            <dt>标签</dt>
            <dd className="workspace-inspectorClamp" title={selectedTagLabel}>
              {selectedTagLabel}
            </dd>
          </div>
          <div>
            <dt>语义状态</dt>
            <dd
              className="workspace-inspectorClamp"
              title={selectedNodeSemanticLabel}
            >
              {selectedNodeSemanticLabel}
            </dd>
          </div>
          <div>
            <dt>语义关系</dt>
            <dd
              className="workspace-inspectorClamp"
              title={selectedNodeSemanticNotesLabel}
            >
              {selectedNodeSemanticNotesLabel}
            </dd>
          </div>
        </dl>
        <div className="workspace-tagSection">
          <p className="workspace-kicker">节点类型</p>
          <p className="workspace-tagMeta">
            {selectedNode
              ? canSwitchSelectedNodeType
                ? '这里只开放叶子节点的安全切换；只会在当前父节点允许的类型之间切。'
                : '当前节点暂不支持安全切换类型；只对无子树的 question / answer / summary / judgment 开放。'
              : '先选中一个节点，再切换它的类型。'}
          </p>
          <div className="workspace-typeSwitchList">
            {(
              ['question', 'answer', 'summary', 'judgment'] as const satisfies readonly NonRootNode['type'][]
            ).map((nodeType) => {
              const isCurrentType = selectedNode?.type === nodeType;
              const isAllowed = selectedNodeTypeSwitchOptions.includes(nodeType);
              const nodeTypeLabel = getNodeTypeLabel(nodeType);

              return (
                <button
                  aria-label={isCurrentType ? `当前类型：${nodeTypeLabel}` : `切换为${nodeTypeLabel}`}
                  aria-pressed={isCurrentType}
                  className="workspace-typeSwitchButton"
                  data-active={isCurrentType}
                  disabled={!selectedNode || !isAllowed || isInteractionLocked}
                  key={nodeType}
                  onClick={() => onChangeSelectedNodeType(nodeType)}
                  type="button"
                >
                  {nodeTypeLabel}
                </button>
              );
            })}
          </div>
        </div>
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
