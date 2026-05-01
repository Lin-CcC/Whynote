import type { TreeNode } from '../../nodeDomain';
import type { NodeSemanticBadge } from '../utils/nodeSemanticVisibility';
import { getNodeSemanticVisibility } from '../utils/nodeSemanticVisibility';
import {
  getDisplayLabelForNode,
  getNodeDisplayName,
} from '../utils/treeSelectors';

type CollapsedLearningNodeSummaryProps = {
  badges: NodeSemanticBadge[];
  hint: string;
  isInteractionLocked: boolean;
  label: string;
  onExpand: () => void;
  relationNote?: string | null;
  title: string;
};

export type CollapsedLearningNodeSummaryModel = Omit<
  CollapsedLearningNodeSummaryProps,
  'isInteractionLocked' | 'onExpand'
>;

export function buildCollapsedLearningNodeSummaryModel(
  tree: Parameters<typeof getNodeSemanticVisibility>[0],
  node: TreeNode,
): CollapsedLearningNodeSummaryModel {
  const label = getDisplayLabelForNode(tree, node);
  const semanticVisibility = getNodeSemanticVisibility(tree, node);

  return {
    badges: semanticVisibility.badges,
    hint: getCollapsedHint(label, semanticVisibility.badges),
    label,
    relationNote: semanticVisibility.compactRelationNote,
    title: getNodeDisplayName(tree, node),
  };
}

export default function CollapsedLearningNodeSummary({
  badges,
  hint,
  isInteractionLocked,
  label,
  onExpand,
  relationNote,
  title,
}: CollapsedLearningNodeSummaryProps) {
  return (
    <div className="workspace-contentNodeCollapsedSummary">
      <div className="workspace-contentNodeCollapsedInfo">
        <div className="workspace-contentNodeCollapsedMeta">
          <span className="workspace-nodeType">{label}</span>
          {badges.map((badge) => (
            <span
              className="workspace-semanticBadge"
              data-badge-tone={badge.tone}
              key={badge.key}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <h3 className="workspace-contentNodeCollapsedTitle">{title}</h3>
        <p className="workspace-contentNodeCollapsedHint">{hint}</p>
        {relationNote ? (
          <p className="workspace-contentNodeCollapsedRelation">{relationNote}</p>
        ) : null}
      </div>
      <button
        className="workspace-nodeBodyToggle"
        disabled={isInteractionLocked}
        onClick={(event) => {
          event.stopPropagation();
          onExpand();
        }}
        type="button"
      >
        展开正文
      </button>
    </div>
  );
}

function getCollapsedHint(label: string, badges: NodeSemanticBadge[]) {
  if (badges.some((badge) => badge.key === 'current-answer')) {
    return `当前${label}已折叠`;
  }

  if (badges.some((badge) => badge.key === 'history-answer')) {
    return `旧${label}已折叠`;
  }

  if (badges.some((badge) => badge.key === 'current-result')) {
    return `当前${label}已折叠`;
  }

  if (badges.some((badge) => badge.key === 'history-result')) {
    return `历史${label}已折叠`;
  }

  return `${label}已折叠`;
}
