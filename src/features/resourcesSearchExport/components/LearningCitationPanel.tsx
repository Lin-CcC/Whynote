import SectionCard from '../../../ui/SectionCard';
import type { NodeTree } from '../../nodeDomain';
import { getNodeOrThrow } from '../../nodeDomain';
import { isLearningCitationSourceNode } from '../services/resourceCitationService';
import {
  formatNodeLabel,
  getNodeSourceSummary,
  getNodePathLabel,
} from '../utils/resourceTreeUtils';

type LearningCitationPanelProps = {
  onFocusResourceNode: (nodeId: string) => void;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
};

export default function LearningCitationPanel({
  onFocusResourceNode,
  selectedEditorNodeId,
  tree,
}: LearningCitationPanelProps) {
  const selectedNode =
    selectedEditorNodeId && tree.nodes[selectedEditorNodeId]
      ? getNodeOrThrow(tree, selectedEditorNodeId)
      : null;

  return (
    <SectionCard>
      <div className="workspace-sectionHeader">
        <div>
          <p className="workspace-kicker">学习节点引用</p>
          <h2 className="workspace-sectionTitle">当前学习节点引用</h2>
        </div>
      </div>
      {!selectedNode ? (
        <p className="workspace-helpText">
          先在模块编辑区选中一个 `question / answer / summary / judgment` 节点，再查看或建立资料引用。
        </p>
      ) : !isLearningCitationSourceNode(selectedNode) ? (
        <>
          <p className="workspace-helpText">
            当前焦点是 {formatNodeLabel(selectedNode)}。学习运行时的资料引用入口当前只对
            `question / answer / summary / judgment` 开放。
          </p>
          <p className="workspace-helpText">
            切到具体学习节点后，这里会显示它已经引用的资料，并支持回跳到 resource 或 fragment。
          </p>
        </>
      ) : (
        <>
          <p className="workspace-helpText">
            当前焦点：{formatNodeLabel(selectedNode)}
          </p>
          {selectedNode.referenceIds.length === 0 ? (
            <p className="workspace-helpText">
              当前学习节点还没有资料引用。可先在资料区定位到 resource 或 fragment，再在下方资料焦点里建立引用。
            </p>
          ) : (
            <ul className="resources-referenceList">
              {selectedNode.referenceIds.flatMap((referenceId) => {
                const reference = tree.references[referenceId];

                if (!reference) {
                  return [];
                }

                const targetNode = tree.nodes[reference.targetNodeId];

                if (
                  !targetNode ||
                  (targetNode.type !== 'resource' &&
                    targetNode.type !== 'resource-fragment')
                ) {
                  return [];
                }

                return [
                  <li className="resources-referenceItem" key={reference.id}>
                    <div className="resources-referenceHeader">
                      <span className="resources-libraryType">
                        {targetNode.type === 'resource-fragment'
                          ? '摘录引用'
                          : '资料级引用'}
                      </span>
                      <button
                        className="resources-inlineButton"
                        onClick={() => onFocusResourceNode(targetNode.id)}
                        type="button"
                      >
                        {targetNode.type === 'resource-fragment'
                          ? '定位到摘录'
                          : '定位到资料'}
                      </button>
                    </div>
                    <strong className="resources-libraryTitle">
                      {targetNode.title}
                    </strong>
                    <span className="resources-libraryMeta">
                      {getNodePathLabel(tree, targetNode.id)}
                    </span>
                    <span className="resources-librarySummary">
                      {targetNode.type === 'resource-fragment'
                        ? targetNode.excerpt || '暂无摘录正文'
                        : targetNode.content || '暂无资料概况'}
                    </span>
                    <span className="resources-libraryMeta">
                      {getNodeSourceSummary(tree, targetNode) ?? '未记录来源信息'}
                    </span>
                  </li>,
                ];
              })}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  );
}
