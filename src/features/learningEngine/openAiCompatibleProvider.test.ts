import { describe, expect, it } from 'vitest';

import { createOpenAiCompatibleProviderClient } from './adapters';
import { buildOpenAiCompatibleRequest } from '../../services/apiOpenAiCompatible';

describe('openAiCompatibleProvider', () => {
  it('assembles chat completion request payload from AI config', () => {
    const request = buildOpenAiCompatibleRequest({
      config: {
        baseUrl: 'https://api.example.com/v1/',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      messages: [
        {
          role: 'system',
          content: '只输出 JSON',
        },
        {
          role: 'user',
          content: '返回一个对象',
        },
      ],
      responseFormat: 'json_object',
    });
    const headers = request.init.headers as Record<string, string>;

    expect(request.url).toBe('https://api.example.com/v1/chat/completions');
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(request.body.model).toBe('gpt-test');
    expect(request.body.response_format).toEqual({
      type: 'json_object',
    });
  });

  it('adapts an OpenAI-compatible response to the provider contract', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;

      return new Response(
        JSON.stringify({
          model: 'gpt-test',
          choices: [
            {
              message: {
                content: '{"value":"ok"}',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    };
    const provider = createOpenAiCompatibleProviderClient(
      {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
        providerLabel: 'My Provider',
      },
      {
        fetchFn,
      },
    );

    const result = await provider.generateObject({
      taskName: 'demo',
      messages: [
        {
          role: 'user',
          content: '返回 JSON',
        },
      ],
      parse(rawText) {
        return JSON.parse(rawText) as {
          value: string;
        };
      },
    });

    expect(capturedUrl).toBe('https://api.example.com/v1/chat/completions');
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
    expect(result.content).toEqual({
      value: 'ok',
    });
    expect(result.providerLabel).toBe('My Provider');
    expect(result.model).toBe('gpt-test');
  });
});
