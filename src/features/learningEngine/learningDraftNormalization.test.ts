import { describe, expect, it } from 'vitest';

import { parseJsonObject } from './services/learningDraftNormalization';

describe('parseJsonObject', () => {
  it('parses JSON wrapped in a code fence', () => {
    expect(
      parseJsonObject(`\`\`\`json
{"value":"ok","nested":{"count":1}}
\`\`\``),
    ).toEqual({
      value: 'ok',
      nested: {
        count: 1,
      },
    });
  });

  it('parses the first complete JSON object when short explanation text surrounds it', () => {
    expect(
      parseJsonObject(`下面是最终结果：
{"value":"ok","nested":{"count":1}}
请按这个对象继续处理。`),
    ).toEqual({
      value: 'ok',
      nested: {
        count: 1,
      },
    });
  });

  it('reports when no JSON object can be found at all', () => {
    expect(() =>
      parseJsonObject('Service temporarily unavailable, please retry later.'),
    ).toThrow('AI 返回的内容里没有可解析的 JSON 对象。');
  });

  it('reports when the response looks like JSON but is truncated', () => {
    expect(() => parseJsonObject('结果如下：\n{"value":"ok"')).toThrow(
      'AI 返回的内容看起来像 JSON，但对象不完整或已被截断。',
    );
  });

  it('rejects a parseable non-object root as a contract mismatch', () => {
    expect(() => parseJsonObject('["ok"]')).toThrow(
      'AI 返回的 JSON 能解析，但根节点不是对象，和当前任务约定不符。',
    );
  });
});
