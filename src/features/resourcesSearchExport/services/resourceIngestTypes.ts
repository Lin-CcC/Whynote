import type {
  ResourceBodyFormat,
  ResourceImportMethod,
  ResourceIngestStatus,
  ResourceSummarySource,
  ResourceTitleSource,
} from '../../nodeDomain';

export interface ResourceIngestMetadataDraft {
  bodyFormat?: ResourceBodyFormat;
  bodyText?: string;
  canonicalSource?: string;
  importMethod: ResourceImportMethod;
  importBatchId?: string;
  ingestStatus: ResourceIngestStatus;
  mimeType?: string;
  originalFileName?: string;
  sourceRelativePath?: string;
  summarySource: ResourceSummarySource;
  titleSource: ResourceTitleSource;
}

export interface ResourceImportDraft {
  content: string;
  ingest: ResourceIngestMetadataDraft;
  sourceUri: string;
  title: string;
}
