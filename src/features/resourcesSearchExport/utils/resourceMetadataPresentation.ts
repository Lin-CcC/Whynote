import type {
  ResourceImportMethod,
  ResourceMetadataRecord,
} from '../../nodeDomain';

export function getResourceImportMethodLabel(
  importMethod: ResourceImportMethod | null | undefined,
) {
  switch (importMethod) {
    case 'url':
      return '链接导入';
    case 'local-file':
      return '单文件导入';
    case 'batch':
      return '多文件导入';
    case 'folder':
      return '文件夹导入';
    case 'manual':
      return '手动录入';
    default:
      return '未记录';
  }
}

export function getResourceSourcePathLabel(
  resourceMetadata: ResourceMetadataRecord | null | undefined,
) {
  if (!resourceMetadata) {
    return '未记录';
  }

  return (
    resourceMetadata.sourceRelativePath ??
    resourceMetadata.originalFileName ??
    resourceMetadata.sourceUri ??
    '未记录'
  );
}

export function getResourceProvenanceSummary(
  resourceMetadata: ResourceMetadataRecord | null | undefined,
) {
  if (!resourceMetadata) {
    return '未记录来源元信息';
  }

  const importMethodLabel = getResourceImportMethodLabel(
    resourceMetadata.importMethod,
  );
  const sourcePathLabel = getResourceSourcePathLabel(resourceMetadata);

  if (importMethodLabel === '未记录') {
    return sourcePathLabel;
  }

  if (sourcePathLabel === '未记录') {
    return importMethodLabel;
  }

  return `${importMethodLabel} · ${sourcePathLabel}`;
}
