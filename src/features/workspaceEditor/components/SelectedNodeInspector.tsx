import SectionCard from '../../../ui/SectionCard';
import { getNodeOrThrow, type NodeTree } from '../../nodeDomain';
import {
  getDisplayLabelForNode,
  getDisplayTitleForNode,
  getNodePath,
} from '../utils/treeSelectors';
import { getNodeSemanticVisibility } from '../utils/nodeSemanticVisibility';

type SelectedNodeInspectorProps = {
  currentModuleId: string | null;
  selectedNodeId: string | null;
  tree: NodeTree;
  workspaceTitle: string;
};

export default function SelectedNodeInspector({
  currentModuleId,
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
  const selectedNodePathLabel =
    selectedNodePath
      .filter((node) => node.type !== 'theme-root')
      .map((node) => getDisplayTitleForNode(tree, node))
      .join(' / ') || '未选中';
  const selectedTagLabel =
    selectedNode?.tagIds
      .map((tagId) => tree.tags[tagId]?.name)
      .filter((tagName): tagName is string => Boolean(tagName))
      .sort((leftTag, rightTag) => leftTag.localeCompare(rightTag, 'zh-Hans-CN'))
      .join('、') || '无';
  const semanticVisibility = selectedNode
    ? getNodeSemanticVisibility(tree, selectedNode)
    : { badges: [], notes: [] };
  const semanticBadgeLabel =
    semanticVisibility.badges.map((badge) => badge.label).join('、') || '无';
  const semanticNoteLabel = semanticVisibility.notes.join('；') || '无';
  const selectedNodeLabel = selectedNode
    ? `${getDisplayLabelForNode(tree, selectedNode)} / ${getDisplayTitleForNode(tree, selectedNode)}`
    : '未选中';

  return (
    <>
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">工作台上下文</p>
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
            <dd
              className="workspace-inspectorClamp"
              title={currentModule?.title ?? '未选中'}
            >
              {currentModule?.title ?? '未选中'}
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
            <dt>标签</dt>
            <dd className="workspace-inspectorClamp" title={selectedTagLabel}>
              {selectedTagLabel}
            </dd>
          </div>
          <div>
            <dt>语义标记</dt>
            <dd
              className="workspace-inspectorClamp"
              title={semanticBadgeLabel}
            >
              {semanticBadgeLabel}
            </dd>
          </div>
          <div>
            <dt>语义关系</dt>
            <dd className="workspace-inspectorClamp" title={semanticNoteLabel}>
              {semanticNoteLabel}
            </dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard>
        <div className="workspace-sectionHeader">
          <div>
            <p className="workspace-kicker">侧栏边界</p>
            <h2 className="workspace-sectionTitle">工具只保留全局事项</h2>
          </div>
        </div>
        <p className="workspace-helpText">
          当前节点的标签入口、局部增强和标签分布视图已经搬回编辑区。右侧工具抽屉只保留资料、导出、AI 配置和全局设置。
        </p>
      </SectionCard>
    </>
  );
}
