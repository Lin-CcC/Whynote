import {
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
} from 'react';

import SectionCard from '../../../ui/SectionCard';
import {
  getNodeOrThrow,
  type NodeReference,
  type NodeTree,
  type ResourceFragmentNode,
  type ResourceNode,
  type TreeNode,
} from '../../nodeDomain';
import { isLearningCitationSourceNode } from '../services/resourceCitationService';
import {
  formatNodeLabel,
  getNodePathLabel,
  getNodeSourceSummary,
} from '../utils/resourceTreeUtils';

type LearningCitationPanelProps = {
  onFocusResourceNode: (nodeId: string) => void;
  selectedEditorNodeId: string | null;
  tree: NodeTree;
};

type ResourceCitationTargetNode = ResourceNode | ResourceFragmentNode;

type CitationPresentation = {
  excerpt: string | null;
  locator: string | null;
  reference: NodeReference;
  sourceSummary: string | null;
  sourceTitle: string;
  targetNode: ResourceCitationTargetNode;
  whyText: string;
};

type CitationFocusGroup = {
  citations: CitationPresentation[];
  focusText: string;
};

export default function LearningCitationPanel({
  onFocusResourceNode,
  selectedEditorNodeId,
  tree,
}: LearningCitationPanelProps) {
  const [expandedReferenceIds, setExpandedReferenceIds] = useState<string[]>([]);
  const selectedNode =
    selectedEditorNodeId && tree.nodes[selectedEditorNodeId]
      ? getNodeOrThrow(tree, selectedEditorNodeId)
      : null;
  const citations = useMemo(
    () => (selectedNode ? collectCitationPresentations(tree, selectedNode) : []),
    [selectedNode, tree],
  );
  const teachingCitationGroups = useMemo(
    () => buildTeachingCitationGroups(citations),
    [citations],
  );
  const supplementalCitations = citations.filter(
    (citation) => !isTeachingCitationPresentation(citation),
  );

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
          先在模块编辑区选中一个 `question / answer / summary / judgment`
          节点，再查看它正在使用哪些资料依据。
        </p>
      ) : !isLearningCitationSourceNode(selectedNode) ? (
        <>
          <p className="workspace-helpText">
            当前焦点是 {formatNodeLabel(tree, selectedNode)}。学习运行时的资料引用入口当前只对
            `question / answer / summary / judgment` 开放。
          </p>
          <p className="workspace-helpText">
            切到具体学习节点后，这里会回答两件事：当前哪一句解释在引用资料，以及它具体依据资料里的哪一部分。
          </p>
        </>
      ) : (
        <>
          <p className="workspace-helpText">
            当前焦点：{formatNodeLabel(tree, selectedNode)}
          </p>
          {citations.length === 0 ? (
            <p className="workspace-helpText">
              当前学习节点还没有资料引用。可以先在资料区定位到 resource 或 fragment，再在下方资料焦点里建立引用。
            </p>
          ) : (
            <>
              {teachingCitationGroups.length > 0 ? (
                <div className="resources-citationSection">
                  <div className="resources-citationSectionHeader">
                    <h3 className="workspace-splitTitle">解释片段对应的资料依据</h3>
                    <span className="resources-citationCounter">
                      {teachingCitationGroups.length} 段解释
                    </span>
                  </div>
                  <p className="workspace-helpText">
                    这里只显示确实承担定义、机制说明、判断支撑或例子来源作用的引用，不会把所有句子都强行挂成参考文献。
                  </p>
                  <div className="resources-citationBlockList">
                    {teachingCitationGroups.map((group) => (
                      <section
                        className="resources-citationBlock"
                        key={buildTeachingGroupKey(group)}
                      >
                        <div className="resources-citationBlockHeader">
                          <span className="resources-citationLabel">当前解释片段</span>
                          <span className="resources-citationCounter">
                            {group.citations.length} 条依据
                          </span>
                        </div>
                        <p className="resources-citationFocusText">
                          {group.focusText}
                        </p>
                        <div className="resources-citationEvidenceList">
                          {group.citations.map((citation) => {
                            const isExpanded = expandedReferenceIds.includes(
                              citation.reference.id,
                            );

                            return (
                              <article
                                className="resources-citationEvidence"
                                key={citation.reference.id}
                              >
                                <div className="resources-citationEvidenceHeader">
                                  <div className="resources-citationEvidenceMeta">
                                    <span className="resources-citationLabel">
                                      {getCitationPurposeLabel(
                                        citation.reference.purpose,
                                      )}
                                    </span>
                                    <strong className="resources-libraryTitle">
                                      {citation.sourceTitle}
                                    </strong>
                                  </div>
                                  <div className="resources-citationEvidenceActions">
                                    <button
                                      className="resources-inlineButton"
                                      onClick={() =>
                                        toggleReferenceExpansion(
                                          citation.reference.id,
                                          setExpandedReferenceIds,
                                        )
                                      }
                                      type="button"
                                    >
                                      {isExpanded ? '收起依据' : '展开依据'}
                                    </button>
                                    <button
                                      className="resources-inlineButton"
                                      onClick={() =>
                                        onFocusResourceNode(citation.targetNode.id)
                                      }
                                      type="button"
                                    >
                                      {citation.targetNode.type === 'resource-fragment'
                                        ? '定位到摘录'
                                        : '定位到资料'}
                                    </button>
                                  </div>
                                </div>
                                <p className="resources-citationWhyText">
                                  {citation.whyText}
                                </p>
                                {isExpanded ? (
                                  <dl className="resources-citationDetailList">
                                    <div>
                                      <dt>资料标题</dt>
                                      <dd>{citation.sourceTitle}</dd>
                                    </div>
                                    <div>
                                      <dt>引用片段</dt>
                                      <dd>
                                        {citation.excerpt ??
                                          '当前只有资料级锚点，尚未保存更细的原文片段。'}
                                      </dd>
                                    </div>
                                    {citation.locator ? (
                                      <div>
                                        <dt>定位</dt>
                                        <dd>{citation.locator}</dd>
                                      </div>
                                    ) : null}
                                    <div>
                                      <dt>为什么引用这段</dt>
                                      <dd>{citation.whyText}</dd>
                                    </div>
                                    <div>
                                      <dt>回跳路径</dt>
                                      <dd>{getNodePathLabel(tree, citation.targetNode.id)}</dd>
                                    </div>
                                  </dl>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}

              {supplementalCitations.length > 0 ? (
                <div className="resources-citationSection">
                  <div className="resources-citationSectionHeader">
                    <h3 className="workspace-splitTitle">补充来源</h3>
                    <span className="resources-citationCounter">
                      {supplementalCitations.length} 条
                    </span>
                  </div>
                  <p className="workspace-helpText">
                    这些引用要么还没标到具体解释片段上，要么还缺少稳定的资料锚点，所以只保留为补充来源，不会默认升格成教学引用块。
                  </p>
                  <ul className="resources-referenceList">
                    {supplementalCitations.map((citation) => (
                      <li className="resources-referenceItem" key={citation.reference.id}>
                        <div className="resources-referenceHeader">
                          <span className="resources-libraryType">
                            {citation.targetNode.type === 'resource-fragment'
                              ? '摘录引用'
                              : '资料级引用'}
                          </span>
                          <button
                            className="resources-inlineButton"
                            onClick={() => onFocusResourceNode(citation.targetNode.id)}
                            type="button"
                          >
                            {citation.targetNode.type === 'resource-fragment'
                              ? '定位到摘录'
                              : '定位到资料'}
                          </button>
                        </div>
                        <strong className="resources-libraryTitle">
                          {citation.sourceTitle}
                        </strong>
                        <span className="resources-libraryMeta">
                          {getNodePathLabel(tree, citation.targetNode.id)}
                        </span>
                        <span className="resources-librarySummary">
                          {citation.excerpt ?? '暂无可展示的片段'}
                        </span>
                        <span className="resources-libraryMeta">
                          {citation.sourceSummary ?? '未记录来源信息'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

function collectCitationPresentations(tree: NodeTree, node: TreeNode) {
  return node.referenceIds.flatMap((referenceId) => {
    const reference = tree.references[referenceId];

    if (!reference) {
      return [];
    }

    const targetNode = tree.nodes[reference.targetNodeId];

    if (
      !targetNode ||
      (targetNode.type !== 'resource' && targetNode.type !== 'resource-fragment')
    ) {
      return [];
    }

    return [
      {
        excerpt: resolveCitationExcerpt(targetNode, reference),
        locator: resolveCitationLocator(targetNode, reference),
        reference,
        sourceSummary: getNodeSourceSummary(tree, targetNode),
        sourceTitle: resolveCitationSourceTitle(tree, targetNode),
        targetNode,
        whyText: buildCitationWhyText(reference),
      } satisfies CitationPresentation,
    ];
  });
}

function buildTeachingCitationGroups(citations: CitationPresentation[]) {
  const groupedCitations = new Map<string, CitationFocusGroup>();

  for (const citation of citations) {
    if (!isTeachingCitationPresentation(citation)) {
      continue;
    }

    const normalizedFocusText = normalizeMatchText(citation.reference.focusText);

    if (!normalizedFocusText || !citation.reference.focusText) {
      continue;
    }

    const existingGroup = groupedCitations.get(normalizedFocusText);

    if (existingGroup) {
      existingGroup.citations.push(citation);
      continue;
    }

    groupedCitations.set(normalizedFocusText, {
      citations: [citation],
      focusText: citation.reference.focusText,
    });
  }

  return [...groupedCitations.values()];
}

function buildTeachingGroupKey(group: CitationFocusGroup) {
  return [
    normalizeMatchText(group.focusText),
    ...group.citations.map((citation) => citation.reference.id),
  ].join('::');
}

function resolveCitationSourceTitle(
  tree: NodeTree,
  targetNode: ResourceCitationTargetNode,
) {
  if (targetNode.type === 'resource') {
    return targetNode.title;
  }

  const sourceNode = tree.nodes[targetNode.sourceResourceId];

  return sourceNode?.type === 'resource' ? sourceNode.title : targetNode.title;
}

function resolveCitationExcerpt(
  targetNode: ResourceCitationTargetNode,
  reference: NodeReference,
) {
  if (targetNode.type === 'resource-fragment') {
    return targetNode.excerpt || reference.sourceExcerpt || null;
  }

  return reference.sourceExcerpt || null;
}

function resolveCitationLocator(
  targetNode: ResourceCitationTargetNode,
  reference: NodeReference,
) {
  if (targetNode.type === 'resource-fragment') {
    return targetNode.locator ?? reference.sourceLocator ?? null;
  }

  return reference.sourceLocator ?? null;
}

function buildCitationWhyText(reference: NodeReference) {
  if (reference.note?.trim()) {
    return reference.note.trim();
  }

  switch (reference.purpose) {
    case 'definition':
      return '这里在定义概念，展开后你应该看到这个说法具体依据资料里的哪一段。';
    case 'mechanism':
      return '这里在说明机制，展开后你可以直接对照资料里的原文或代码理解为什么会这样。';
    case 'behavior':
      return '这里在解释行为结果，展开后你可以核对资料里对规则或代码行为的依据。';
    case 'example':
      return '这里在说明这个例子借自资料里的哪一段，展开后可以直接查看原例子。';
    case 'judgment':
      return '这里在支撑当前判断，展开后可以看到这个判断具体依赖资料的哪一部分。';
    case 'background':
      return '这里在补背景说明，展开后可以快速补齐理解当前解释所需的上下文。';
    default:
      return '展开后可以查看这段解释所依据的资料片段。';
  }
}

function getCitationPurposeLabel(purpose: NodeReference['purpose']) {
  switch (purpose) {
    case 'definition':
      return '概念定义';
    case 'mechanism':
      return '机制说明';
    case 'behavior':
      return '行为解释';
    case 'example':
      return '例子来源';
    case 'judgment':
      return '支撑判断';
    case 'background':
      return '补背景说明';
    default:
      return '资料依据';
  }
}

function isTeachingCitationPresentation(citation: CitationPresentation) {
  return Boolean(
    normalizeMatchText(citation.reference.focusText) &&
      hasStableCitationAnchor(citation),
  );
}

function hasStableCitationAnchor(citation: CitationPresentation) {
  if (citation.targetNode.type === 'resource-fragment') {
    return true;
  }

  return Boolean(
    normalizeMatchText(citation.reference.sourceExcerpt) ||
      normalizeMatchText(citation.reference.sourceLocator),
  );
}

function toggleReferenceExpansion(
  referenceId: string,
  setExpandedReferenceIds: Dispatch<SetStateAction<string[]>>,
) {
  setExpandedReferenceIds((currentIds) =>
    currentIds.includes(referenceId)
      ? currentIds.filter((currentId) => currentId !== referenceId)
      : [...currentIds, referenceId],
  );
}

function normalizeMatchText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();

  return normalizedValue ? normalizedValue : null;
}
