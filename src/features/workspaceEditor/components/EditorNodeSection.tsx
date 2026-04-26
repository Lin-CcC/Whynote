import type { CSSProperties, ChangeEvent } from 'react';

import type { NodeTree, PlanStepStatus } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import {
  getChildNodes,
  getNodeEmphasis,
  getNodeInputPlaceholder,
  getNodeTypeLabel,
} from '../utils/treeSelectors';
import type { NodeContentPatch } from '../workspaceEditorTypes';

type EditorNodeSectionProps = {
  depth: number;
  nodeId: string;
  onSelectNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

const PLAN_STEP_STATUS_LABELS: Record<PlanStepStatus, string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
};

export default function EditorNodeSection({
  depth,
  nodeId,
  onSelectNode,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  tree,
}: EditorNodeSectionProps) {
  const node = getNodeOrThrow(tree, nodeId);
  const childNodes = getChildNodes(tree, node.id);
  const splitQuestionChildren =
    node.type === 'question'
      ? childNodes.filter((childNode) => childNode.type === 'question')
      : [];
  const regularChildren =
    node.type === 'question'
      ? childNodes.filter((childNode) => childNode.type !== 'question')
      : childNodes;
  const isSelected = node.id === selectedNodeId;

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    onUpdateNode(node.id, { title: event.target.value });
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onUpdateNode(node.id, { content: event.target.value });
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    onUpdateNode(node.id, { status: event.target.value as PlanStepStatus });
  }

  return (
    <section
      className="workspace-node"
      data-node-emphasis={getNodeEmphasis(node)}
      data-node-selected={isSelected}
      data-node-type={node.type}
      data-testid={`editor-node-${node.id}`}
      onClick={() => onSelectNode(node.id)}
      ref={(element) => registerNodeElement(node.id, element)}
      style={{ '--node-depth': depth } as CSSProperties}
      tabIndex={-1}
    >
      <div className="workspace-nodeHeader">
        <div className="workspace-nodeMeta">
          <span className="workspace-nodeType">{getNodeTypeLabel(node.type)}</span>
          {node.type === 'plan-step' ? (
            <select
              aria-label={`${node.title} 的步骤状态`}
              className="workspace-statusSelect"
              onChange={handleStatusChange}
              onClick={(event) => event.stopPropagation()}
              value={node.status}
            >
              {Object.entries(PLAN_STEP_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
          {isSelected ? <span className="workspace-selectedBadge">已聚焦</span> : null}
        </div>
        <p className="workspace-nodeHint">
          {node.type === 'plan-step'
            ? '正式步骤节点，视觉上弱于正文内容。'
            : '当前卡片承接基础文本编辑，后续可继续接富文本能力。'}
        </p>
      </div>
      <input
        aria-label={`${node.title || getNodeTypeLabel(node.type)} 标题`}
        className="workspace-nodeTitleInput"
        onChange={handleTitleChange}
        onClick={(event) => event.stopPropagation()}
        value={node.title}
      />
      <textarea
        aria-label={`${node.title || getNodeTypeLabel(node.type)} 内容`}
        className="workspace-nodeContentInput"
        onChange={handleContentChange}
        onClick={(event) => event.stopPropagation()}
        placeholder={getNodeInputPlaceholder(node.type, 'content')}
        rows={node.type === 'plan-step' ? 3 : 4}
        value={node.content}
      />
      {node.type === 'question' && splitQuestionChildren.length > 0 ? (
        <div className="workspace-splitResult">
          <div className="workspace-splitHeader">
            <div>
              <p className="workspace-kicker">自动拆分结果</p>
              <h3 className="workspace-splitTitle">父问题保留，子问题显式承接</h3>
            </div>
            <span className="workspace-counter">{splitQuestionChildren.length} 个子问题</span>
          </div>
          <p className="workspace-helpText">
            子问题可直接编辑；若需要继续升降级、插入或删除，先选中对应节点再用左侧结构操作入口。
          </p>
          <div className="workspace-splitChildren">
            {splitQuestionChildren.map((childNode) => (
              <EditorNodeSection
                depth={depth + 1}
                key={childNode.id}
                nodeId={childNode.id}
                onSelectNode={onSelectNode}
                onUpdateNode={onUpdateNode}
                registerNodeElement={registerNodeElement}
                selectedNodeId={selectedNodeId}
                tree={tree}
              />
            ))}
          </div>
        </div>
      ) : null}
      {regularChildren.length > 0 ? (
        <div className="workspace-nodeChildren">
          {regularChildren.map((childNode) => (
            <EditorNodeSection
              depth={depth + 1}
              key={childNode.id}
              nodeId={childNode.id}
              onSelectNode={onSelectNode}
              onUpdateNode={onUpdateNode}
              registerNodeElement={registerNodeElement}
              selectedNodeId={selectedNodeId}
              tree={tree}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
