import { expect, test } from 'vitest';

import { buildResourceDraftFromLocalFile } from './resourceLocalFileService';

test('builds a resource draft from markdown files', async () => {
  const file = new File(
    [
      '# React 渲染笔记\n\n',
      '先梳理渲染边界，再决定局部状态应该放在哪里。\n\n',
      '- 避免把所有状态抬到根层\n',
      '- 关注实际变化路径\n',
    ],
    'rendering-notes.md',
    {
      type: 'text/markdown',
    },
  );

  await expect(buildResourceDraftFromLocalFile(file)).resolves.toEqual({
    content:
      '先梳理渲染边界，再决定局部状态应该放在哪里。 避免把所有状态抬到根层 关注实际变化路径',
    sourceUri: '本地文件：rendering-notes.md',
    title: 'React 渲染笔记',
  });
});

test('builds a resource draft from txt files and falls back to the first line as title', async () => {
  const file = new File(
    [
      '状态快照记录\n',
      '\n',
      '每次渲染都会形成独立的闭包快照。\n',
      '如果在旧闭包里读值，就会看到旧状态。\n',
    ],
    'state-snapshot.txt',
    {
      type: 'text/plain',
    },
  );

  await expect(buildResourceDraftFromLocalFile(file)).resolves.toEqual({
    content: '每次渲染都会形成独立的闭包快照。 如果在旧闭包里读值，就会看到旧状态。',
    sourceUri: '本地文件：state-snapshot.txt',
    title: '状态快照记录',
  });
});

test('rejects unsupported file types', async () => {
  const file = new File(['%PDF-1.5'], 'book.pdf', {
    type: 'application/pdf',
  });

  await expect(buildResourceDraftFromLocalFile(file)).rejects.toThrow(
    '当前只支持导入 .txt / .md 文件。PDF / DOCX 暂不在这版范围内。',
  );
});
