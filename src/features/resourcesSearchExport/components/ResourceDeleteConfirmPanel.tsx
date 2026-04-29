import type { ResourceDeleteImpactSummary } from '../services/resourceDeleteService';

type ResourceDeleteConfirmPanelProps = {
  impact: ResourceDeleteImpactSummary;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ResourceDeleteConfirmPanel({
  impact,
  onCancel,
  onConfirm,
}: ResourceDeleteConfirmPanelProps) {
  return (
    <div
      aria-label={getDeleteConfirmationHeading(impact)}
      className="resources-deleteConfirmCard"
      role="alertdialog"
    >
      <h4 className="workspace-splitTitle">{getDeleteConfirmationHeading(impact)}</h4>
      <p className="workspace-helpText">{getDeleteConfirmationDescription(impact)}</p>
      <dl className="resources-deleteImpactList">
        {renderImpactRows(impact)}
      </dl>
      <p className="workspace-helpText">
        {getDeleteConfirmationConsequence(impact)}
      </p>
      <div className="resources-entryActionRow">
        <button className="resources-entryButton" onClick={onConfirm} type="button">
          {getDeleteConfirmationButtonLabel(impact)}
        </button>
        <button className="resources-inlineButton" onClick={onCancel} type="button">
          取消
        </button>
      </div>
    </div>
  );
}

function renderImpactRows(impact: ResourceDeleteImpactSummary) {
  if (impact.nodeType === 'resource-fragment') {
    return (
      <div>
        <dt>当前引用</dt>
        <dd>{formatCountLabel(impact.referenceCount, '条引用')}</dd>
      </div>
    );
  }

  return (
    <>
      <div>
        <dt>资料自身引用</dt>
        <dd>{formatCountLabel(impact.directReferenceCount, '条引用')}</dd>
      </div>
      <div>
        <dt>摘录数量</dt>
        <dd>{formatCountLabel(impact.fragmentCount, '条摘录')}</dd>
      </div>
      <div>
        <dt>摘录引用</dt>
        <dd>{formatCountLabel(impact.fragmentReferenceCount, '条引用')}</dd>
      </div>
      <div>
        <dt>总计移除引用</dt>
        <dd>{formatCountLabel(impact.totalReferenceCount, '条引用')}</dd>
      </div>
    </>
  );
}

function getDeleteConfirmationHeading(impact: ResourceDeleteImpactSummary) {
  return impact.nodeType === 'resource'
    ? `确认删除资料《${impact.nodeTitle}》？`
    : `确认删除摘录《${impact.nodeTitle}》？`;
}

function getDeleteConfirmationDescription(impact: ResourceDeleteImpactSummary) {
  if (impact.nodeType === 'resource-fragment') {
    const parentLabel = impact.parentResourceTitle
      ? `它当前挂在资料《${impact.parentResourceTitle}》下面。`
      : '它当前缺少稳定父资料记录。';

    return `将删除这条摘录。${parentLabel}`;
  }

  return '将删除这份资料，并同时处理它下面的摘录与相关资料引用。';
}

function getDeleteConfirmationConsequence(impact: ResourceDeleteImpactSummary) {
  if (impact.nodeType === 'resource-fragment') {
    return `删除后会一起移除对应的 ${formatCountLabel(
      impact.referenceCount,
      '条资料引用',
    )}，但不会删除那些学习节点本身。`;
  }

  return `删除后会同时删除其下所有摘录，并一并移除 ${formatCountLabel(
    impact.totalReferenceCount,
    '条相关资料引用',
  )}。学习节点本身不会被删除，但这些节点会失去对应资料依据。`;
}

function getDeleteConfirmationButtonLabel(impact: ResourceDeleteImpactSummary) {
  return impact.nodeType === 'resource' ? '确认删除资料' : '确认删除摘录';
}

function formatCountLabel(count: number, unitLabel: string) {
  return `${String(count)} ${unitLabel}`;
}
