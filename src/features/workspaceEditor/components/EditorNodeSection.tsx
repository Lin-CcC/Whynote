import { Fragment } from 'react';

import { getNodeOrThrow, type TreeNode } from '../../nodeDomain';
import { getChildNodes } from '../utils/treeSelectors';
import EditableNodeCard from './EditableNodeCard';
import type { MainViewNodeProps } from './mainViewTypes';
import QuestionBlockSection from './QuestionBlockSection';

export default function EditorNodeSection(props: MainViewNodeProps) {
  const { depth, nodeId, tree } = props;
  const node = getNodeOrThrow(tree, nodeId);

  if (node.type === 'question') {
    return (
      <QuestionBlockSection
        {...props}
        renderChildNode={(childNodeId, childDepth) => (
          <EditorNodeSection
            {...props}
            depth={childDepth}
            key={childNodeId}
            nodeId={childNodeId}
          />
        )}
      />
    );
  }

  const childNodes = getChildNodes(tree, node.id);
  const firstChildQuestionNodeId =
    childNodes.find((childNode) => childNode.type === 'question')?.id ?? null;
  const questionChildCount = childNodes.filter(
    (childNode) => childNode.type === 'question',
  ).length;
  const inlineActions = props.renderNodeInlineActions?.({
    isSelected: node.id === props.selectedNodeId,
    node,
    selectNode: props.onSelectNode,
    tree,
  });
  const bodyCollapsed =
    supportsNodeBodyCollapse(node) &&
    props.workspaceViewState.collapsedNodeBodyIds.includes(node.id);

  function toggleNodeBodyCollapsed() {
    props.onWorkspaceViewStateChange({
      ...props.workspaceViewState,
      collapsedNodeBodyIds: toggleId(
        props.workspaceViewState.collapsedNodeBodyIds,
        node.id,
      ),
    });
  }

  return (
    <EditableNodeCard
      actions={inlineActions}
      bodyCollapsed={bodyCollapsed}
      depth={depth}
      isInteractionLocked={props.isInteractionLocked}
      nodeId={node.id}
      onSelectNode={props.onSelectNode}
      onToggleBodyCollapsed={
        supportsNodeBodyCollapse(node) ? toggleNodeBodyCollapsed : undefined
      }
      onUpdateNode={props.onUpdateNode}
      registerNodeElement={props.registerNodeElement}
      selectedNodeId={props.selectedNodeId}
      tree={tree}
    >
      {childNodes.map((childNode) => (
        <Fragment key={childNode.id}>
          {childNode.id === firstChildQuestionNodeId && questionChildCount > 0 ? (
            <div className="workspace-splitHint">
              <div className="workspace-splitHeader">
                <div>
                  <p className="workspace-kicker">问题分区</p>
                  <h3 className="workspace-splitTitle">下面进入 question block 主视图</h3>
                </div>
                <span className="workspace-counter">{questionChildCount} 个问题块</span>
              </div>
              <p className="workspace-helpText">
                question、当前回答、旧回答和追问会在主视图区按 block 重新组织显示，但底层树顺序保持不变。
              </p>
            </div>
          ) : null}
          <EditorNodeSection
            {...props}
            depth={depth + 1}
            nodeId={childNode.id}
          />
        </Fragment>
      ))}
    </EditableNodeCard>
  );
}

function supportsNodeBodyCollapse(node: TreeNode) {
  return (
    node.type === 'answer' ||
    node.type === 'judgment' ||
    node.type === 'summary'
  );
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}
