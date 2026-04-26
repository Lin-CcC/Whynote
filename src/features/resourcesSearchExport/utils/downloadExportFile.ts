import type { ExportFileDescriptor } from '../resourceSearchExportTypes';

export function downloadExportFile(descriptor: ExportFileDescriptor) {
  const blob = new Blob([descriptor.content], {
    type: `${descriptor.mimeType};charset=utf-8`,
  });
  const objectUrl = URL.createObjectURL(blob);
  const linkElement = document.createElement('a');

  linkElement.href = objectUrl;
  linkElement.download = descriptor.fileName;
  document.body.appendChild(linkElement);
  linkElement.click();
  linkElement.remove();
  URL.revokeObjectURL(objectUrl);
}
