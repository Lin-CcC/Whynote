import {
  buildStructureMapPresentationModel,
  getStructureMapNodeLabel,
  type StructureMapAnswerGroupNode,
  type StructureMapManualSummaryGroupNode,
  type StructureMapQuestionBlockNode,
  type StructureMapScaffoldSummaryNode,
} from '../../nodeDomain';
import type { NodeTree } from '../../nodeDomain';

type StructureMapViewProps = {
  currentModuleId: string;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

export default function StructureMapView({
  currentModuleId,
  onSelectNode,
  selectedNodeId,
  tree,
}: StructureMapViewProps) {
  const model = buildStructureMapPresentationModel(tree, currentModuleId);

  return (
    <div
      className="workspace-structureMapShell"
      data-testid="workspace-structure-map-shell"
    >
      {model.sections.map((section) => {
        const stepNode = section.planStep;
        const stepTitle = getStructureMapNodeLabel(tree, stepNode, '步骤');

        return (
          <section
            className="workspace-structureMapSection"
            data-testid={`structure-map-section-${stepNode.id}`}
            key={stepNode.id}
          >
            <header className="workspace-structureMapSectionHeader">
              <div className="workspace-structureMapSectionMeta">
                <span className="workspace-nodeType">步骤</span>
                <span
                  className="workspace-planStepStatusBadge"
                  data-status={stepNode.status}
                >
                  {getPlanStepStatusLabel(stepNode.status)}
                </span>
              </div>
              <button
                className="workspace-structureMapSectionTitle"
                data-active={selectedNodeId === stepNode.id}
                onClick={() => onSelectNode(stepNode.id)}
                type="button"
              >
                {stepTitle}
              </button>
            </header>
            <div className="workspace-structureMapSectionBody">
              {section.scaffoldSummaries.length > 0 ? (
                <div className="workspace-structureMapScaffoldRail">
                  {section.scaffoldSummaries.map((scaffoldSummary) => (
                    <ScaffoldSummaryNode
                      key={scaffoldSummary.node.id}
                      node={scaffoldSummary}
                      onSelectNode={onSelectNode}
                      selectedNodeId={selectedNodeId}
                      tree={tree}
                    />
                  ))}
                </div>
              ) : null}
              <div className="workspace-structureMapQuestionList">
                {section.questionBlocks.map((questionBlock) => (
                  <QuestionBlockNode
                    key={questionBlock.question.id}
                    node={questionBlock}
                    onSelectNode={onSelectNode}
                    selectedNodeId={selectedNodeId}
                    tree={tree}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type StructureMapNodeProps = {
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

function QuestionBlockNode({
  node,
  onSelectNode,
  selectedNodeId,
  tree,
}: StructureMapNodeProps & {
  node: StructureMapQuestionBlockNode;
}) {
  const questionTitle = getStructureMapNodeLabel(tree, node.question, '问题');

  return (
    <div
      className="workspace-structureMapQuestionNode"
      data-testid={`structure-map-question-${node.question.id}`}
    >
      <button
        className="workspace-structureMapPrimaryNode"
        data-active={selectedNodeId === node.question.id}
        onClick={() => onSelectNode(node.question.id)}
        type="button"
      >
        <span className="workspace-structureMapNodeLabel">问题</span>
        <span className="workspace-structureMapNodeTitle">{questionTitle}</span>
        {node.referencePresence.hasReferences ? (
          <span className="workspace-structureMapNodeMeta">
            资料 {node.referencePresence.count}
          </span>
        ) : null}
      </button>
      {node.supportingItems.length > 0 ? (
        <div className="workspace-structureMapSupportingList">
          {node.supportingItems.map((supportingItem) =>
            supportingItem.kind === 'answer-group' ? (
              <AnswerGroupNode
                group={supportingItem.group}
                key={supportingItem.group.node.id}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNodeId}
                tree={tree}
              />
            ) : (
              <ManualSummaryGroupNode
                group={supportingItem.group}
                key={supportingItem.group.node.id}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNodeId}
                tree={tree}
              />
            ),
          )}
        </div>
      ) : null}
      {node.followUpQuestions.length > 0 ? (
        <div
          className="workspace-structureMapFollowUpBranch"
          data-testid={`structure-map-follow-up-branch-${node.question.id}`}
        >
          <div className="workspace-structureMapFollowUpLabel">追问</div>
          <div className="workspace-structureMapQuestionList">
            {node.followUpQuestions.map((followUpQuestion) => (
              <QuestionBlockNode
                key={followUpQuestion.question.id}
                node={followUpQuestion}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNodeId}
                tree={tree}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnswerGroupNode({
  group,
  onSelectNode,
  selectedNodeId,
  tree,
}: StructureMapNodeProps & {
  group: StructureMapAnswerGroupNode;
}) {
  const resultCount =
    group.historicalClosureNodeIds.length +
    (group.latestEvaluationNodeId ? 1 : 0) +
    (group.explanationNodeId ? 1 : 0);

  return (
    <button
      className="workspace-structureMapSupportingNode"
      data-active={selectedNodeId === group.node.id}
      data-current-answer={group.isCurrentAnswer}
      data-testid={`structure-map-answer-group-${group.node.id}`}
      onClick={() => onSelectNode(group.node.id)}
      type="button"
    >
      <span className="workspace-structureMapNodeLabel">
        {group.isCurrentAnswer ? '当前回答' : '回答'}
      </span>
      <span className="workspace-structureMapNodeTitle">
        {getStructureMapNodeLabel(tree, group.node, '回答')}
      </span>
      <div className="workspace-structureMapSupportingMeta">
        {group.referencePresence.hasReferences ? (
          <span className="workspace-structureMapNodeMeta">
            资料 {group.referencePresence.count}
          </span>
        ) : null}
        {resultCount > 0 ? (
          <span className="workspace-structureMapNodeMeta">结果 {resultCount}</span>
        ) : null}
      </div>
    </button>
  );
}

function ManualSummaryGroupNode({
  group,
  onSelectNode,
  selectedNodeId,
  tree,
}: StructureMapNodeProps & {
  group: StructureMapManualSummaryGroupNode;
}) {
  const checkCount =
    group.historicalCheckNodeIds.length + (group.latestCheckNodeId ? 1 : 0);

  return (
    <button
      className="workspace-structureMapSupportingNode"
      data-active={selectedNodeId === group.node.id}
      data-testid={`structure-map-summary-group-${group.node.id}`}
      onClick={() => onSelectNode(group.node.id)}
      type="button"
    >
      <span className="workspace-structureMapNodeLabel">手写总结</span>
      <span className="workspace-structureMapNodeTitle">
        {getStructureMapNodeLabel(tree, group.node, '总结')}
      </span>
      <div className="workspace-structureMapSupportingMeta">
        {group.referencePresence.hasReferences ? (
          <span className="workspace-structureMapNodeMeta">
            资料 {group.referencePresence.count}
          </span>
        ) : null}
        {checkCount > 0 ? (
          <span className="workspace-structureMapNodeMeta">检查 {checkCount}</span>
        ) : null}
      </div>
    </button>
  );
}

function ScaffoldSummaryNode({
  node,
  onSelectNode,
  selectedNodeId,
  tree,
}: StructureMapNodeProps & {
  node: StructureMapScaffoldSummaryNode;
}) {
  return (
    <button
      className="workspace-structureMapSupportingNode workspace-structureMapSupportingNode-scaffold"
      data-active={selectedNodeId === node.node.id}
      data-testid={`structure-map-scaffold-${node.node.id}`}
      onClick={() => onSelectNode(node.node.id)}
      type="button"
    >
      <span className="workspace-structureMapNodeLabel">铺垫</span>
      <span className="workspace-structureMapNodeTitle">
        {getStructureMapNodeLabel(tree, node.node, '铺垫')}
      </span>
      {node.referencePresence.hasReferences ? (
        <span className="workspace-structureMapNodeMeta">
          资料 {node.referencePresence.count}
        </span>
      ) : null}
    </button>
  );
}

function getPlanStepStatusLabel(status: 'todo' | 'doing' | 'done') {
  switch (status) {
    case 'todo':
      return '待开始';
    case 'doing':
      return '进行中';
    case 'done':
      return '已完成';
  }
}
