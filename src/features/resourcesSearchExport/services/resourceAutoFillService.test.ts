import { expect, test, vi } from 'vitest';

import { autoFillResourceDraftFromUrl } from './resourceAutoFillService';

test('extracts title and summary from html metadata', async () => {
  const fetchFn = vi.fn().mockResolvedValue({
    ok: true,
    async text() {
      return `
        <html>
          <head>
            <title>会被 og:title 覆盖</title>
            <meta property="og:title" content="React 渲染局部性" />
            <meta
              name="description"
              content="解释如何通过局部状态与边界拆分减少无关重渲染。"
            />
          </head>
          <body>
            <p>这段正文不该成为首选摘要。</p>
          </body>
        </html>
      `;
    },
  });

  await expect(
    autoFillResourceDraftFromUrl({
      fetchFn,
      sourceUrl: 'https://example.com/react-locality',
    }),
  ).resolves.toEqual({
    content: '解释如何通过局部状态与边界拆分减少无关重渲染。',
    ingest: {
      bodyFormat: 'plain-text',
      bodyText: '这段正文不该成为首选摘要。',
      canonicalSource: 'https://example.com/react-locality',
      importMethod: 'url',
      ingestStatus: 'ready',
      mimeType: 'text/html',
      summarySource: 'url-meta',
      titleSource: 'url-meta',
    },
    sourceUri: 'https://example.com/react-locality',
    title: 'React 渲染局部性',
  });
});

test('falls back to body paragraphs when no summary metadata exists', async () => {
  const fetchFn = vi.fn().mockResolvedValue({
    ok: true,
    async text() {
      return `
        <html>
          <head>
            <title>状态快照说明</title>
          </head>
          <body>
            <main>
              <p>Hooks 会在每次渲染里捕获对应时刻的状态快照，用于解释闭包读取到的值。</p>
              <p>理解这个机制之后，更容易定位“为什么日志还是旧值”这类问题。</p>
            </main>
          </body>
        </html>
      `;
    },
  });

  await expect(
    autoFillResourceDraftFromUrl({
      fetchFn,
      sourceUrl: 'https://example.com/state-snapshots',
    }),
  ).resolves.toEqual({
    content:
      'Hooks 会在每次渲染里捕获对应时刻的状态快照，用于解释闭包读取到的值。 理解这个机制之后，更容易定位“为什么日志还是旧值”这类问题。',
    ingest: {
      bodyFormat: 'plain-text',
      bodyText:
        'Hooks 会在每次渲染里捕获对应时刻的状态快照，用于解释闭包读取到的值。\n\n理解这个机制之后，更容易定位“为什么日志还是旧值”这类问题。',
      canonicalSource: 'https://example.com/state-snapshots',
      importMethod: 'url',
      ingestStatus: 'ready',
      mimeType: 'text/html',
      summarySource: 'url-body',
      titleSource: 'url-document-title',
    },
    sourceUri: 'https://example.com/state-snapshots',
    title: '状态快照说明',
  });
});

test('returns a readable fallback error when the page cannot be fetched', async () => {
  const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

  await expect(
    autoFillResourceDraftFromUrl({
      fetchFn,
      sourceUrl: 'https://example.com/blocked',
    }),
  ).rejects.toThrow(
    '受限自动填充未完成：这是浏览器内的受限能力，很多第三方网页会因 CORS 或站点访问策略而无法直接读取。这不代表链接本身无效；请继续手动填写标题和资料概况。原因：Failed to fetch',
  );
});

test('rejects invalid urls before requesting the network', async () => {
  const fetchFn = vi.fn();

  await expect(
    autoFillResourceDraftFromUrl({
      fetchFn,
      sourceUrl: 'not-a-url',
    }),
  ).rejects.toThrow('请输入合法的 http(s) URL。');

  expect(fetchFn).not.toHaveBeenCalled();
});
