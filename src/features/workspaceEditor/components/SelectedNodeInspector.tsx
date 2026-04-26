import SectionCard from '../../../ui/SectionCard';
import type { NodeTree } from '../../nodeDomain';
import { getAllowedChildTypes, getNodeOrThrow } from '../../nodeDomain';
import {
  getNodePath,
  getNodeTypeLabel,
} from '../utils/treeSelectors';

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
                ? `${getNodeTypeLabel(selectedNode.type)} · ${selectedNode.title}`
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
        </dl>
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
