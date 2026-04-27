import type { ResourceMetadataRecord, ResourceNode } from '../../nodeDomain';
import type { ResourceImportDraft } from './resourceIngestTypes';

interface CreateResourceMetadataRecordOptions {
  draft: ResourceImportDraft | null;
  resourceNode: ResourceNode;
  submittedContent: string;
  submittedSourceUri: string;
  submittedTitle: string;
  workspaceId: string;
}

export function createResourceMetadataRecord({
  draft,
  resourceNode,
  submittedContent,
  submittedSourceUri,
  submittedTitle,
  workspaceId,
}: CreateResourceMetadataRecordOptions): ResourceMetadataRecord {
  const normalizedSourceUri = normalizeOptionalText(submittedSourceUri);
  const normalizedContent = normalizeOptionalText(submittedContent);
  const importedAt = new Date().toISOString();

  if (!draft) {
    const normalizedUrl = tryNormalizeHttpUrl(normalizedSourceUri);

    return {
      id: resourceNode.id,
      workspaceId,
      nodeId: resourceNode.id,
      nodeType: 'resource',
      title: resourceNode.title,
      sourceUri: normalizedSourceUri ?? undefined,
      mimeType: resourceNode.mimeType,
      importMethod: normalizedUrl ? 'url' : 'manual',
      ingestStatus: normalizedUrl ? 'partial' : 'manual',
      titleSource: 'user',
      summarySource: 'user',
      canonicalSource: normalizedUrl ?? undefined,
      importedAt,
      updatedAt: resourceNode.updatedAt,
    };
  }

  const sourceChanged = normalizeOptionalText(draft.sourceUri) !== normalizedSourceUri;
  const shouldDropUrlBody =
    draft.ingest.importMethod === 'url' && sourceChanged;
  const shouldKeepAutoTitleSource = !shouldDropUrlBody && submittedTitle === draft.title;
  const shouldKeepAutoSummarySource =
    !shouldDropUrlBody &&
    normalizedContent === normalizeOptionalText(draft.content);

  return {
    id: resourceNode.id,
    workspaceId,
    nodeId: resourceNode.id,
    nodeType: 'resource',
    title: resourceNode.title,
    sourceUri: normalizedSourceUri ?? undefined,
    mimeType: resourceNode.mimeType ?? draft.ingest.mimeType,
    importMethod: draft.ingest.importMethod,
    ingestStatus: shouldDropUrlBody ? 'partial' : draft.ingest.ingestStatus,
    titleSource: shouldKeepAutoTitleSource ? draft.ingest.titleSource : 'user',
    summarySource: shouldKeepAutoSummarySource
      ? draft.ingest.summarySource
      : 'user',
    canonicalSource: shouldDropUrlBody
      ? tryNormalizeHttpUrl(normalizedSourceUri) ?? undefined
      : draft.ingest.canonicalSource,
    bodyText: shouldDropUrlBody ? undefined : draft.ingest.bodyText,
    bodyFormat: shouldDropUrlBody ? undefined : draft.ingest.bodyFormat,
    importedAt,
    updatedAt: resourceNode.updatedAt,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function tryNormalizeHttpUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
