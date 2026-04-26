import SectionCard from '../../../ui/SectionCard';
import { type NodeTree, type TreeNode } from '../../nodeDomain';
import {
  getNodePathLabel,
  getNodeSourceSummary,
} from '../utils/resourceTreeUtils';

type ResourceFocusPanelProps = {
  activeResourceNodeId: string | null;
  currentModuleTitle: string | null;
  onClearResourceFocus?: () => void;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
};

export default function ResourceFocusPanel({
  activeResourceNodeId,
  currentModuleTitle,
  onClearResourceFocus,
  selectedEditorNodeId,
  tree,
}: ResourceFocusPanelProps) {
  if (
    !activeResourceNodeId ||
    !tree.nodes[activeResourceNodeId] ||
    (tree.nodes[activeResourceNodeId]?.type !== 'resource' &&
      tree.nodes[activeResourceNodeId]?.type !== 'resource-fragment')
  ) {
    return null;
  }

  const resourceNode = tree.nodes[activeResourceNodeId];
  const editorNode =
    selectedEditorNodeId && tree.nodes[selectedEditorNodeId]
      ? tree.nodes[selectedEditorNodeId]
      : null;

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">资料定位</p>
          <h2 className="workspace-sectionTitle">当前资料焦点</h2>
        </div>
        {onClearResourceFocus ? (
          <button
            className="resources-inlineButton"
            onClick={onClearResourceFocus}
            type="button"
          >
            返回模块编辑焦点
          </button>
        ) : null}
      </div>
      <p className="workspace-helpText">
        资料定位走独立通道，不会覆盖当前模块内 editor 选区。
      </p>
      <dl className="resources-focusList">
        <div>
          <dt>节点</dt>
          <dd>{formatNodeLabel(resourceNode)}</dd>
        </div>
        <div>
          <dt>路径</dt>
          <dd>{getNodePathLabel(tree, resourceNode.id)}</dd>
        </div>
        <div>
          <dt>来源摘要</dt>
          <dd>{getNodeSourceSummary(tree, resourceNode) ?? '未提供来源信息'}</dd>
        </div>
        {resourceNode.type === 'resource-fragment' ? (
          <>
            <div>
              <dt>摘录正文</dt>
              <dd>{resourceNode.excerpt || '暂无摘录正文'}</dd>
            </div>
            <div>
              <dt>定位信息</dt>
              <dd>{resourceNode.locator ?? '未记录定位信息'}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt>资料摘要</dt>
            <dd>{resourceNode.content || '暂无资料摘要'}</dd>
          </div>
        )}
        <div>
          <dt>当前模块</dt>
          <dd>{currentModuleTitle ?? '未选中模块'}</dd>
        </div>
        <div>
          <dt>模块内编辑焦点</dt>
          <dd>{editorNode ? formatNodeLabel(editorNode) : '当前没有模块内焦点'}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

function formatNodeLabel(node: TreeNode) {
  switch (node.type) {
    case 'resource':
      return `资料 · ${node.title}`;
    case 'resource-fragment':
      return `摘录 · ${node.title}`;
    case 'module':
      return `模块 · ${node.title}`;
    case 'plan-step':
      return `步骤 · ${node.title}`;
    case 'question':
      return `问题 · ${node.title}`;
    case 'answer':
      return `回答 · ${node.title}`;
    case 'summary':
      return `总结 · ${node.title}`;
    case 'judgment':
      return `判断 · ${node.title}`;
    case 'theme-root':
      return `主题 · ${node.title}`;
  }
}
