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

  it('surfaces provider HTTP error details instead of falling through to JSON parse errors', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: 'The model is overloaded. Please try again later.',
            status: 'UNAVAILABLE',
          },
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    const provider = createOpenAiCompatibleProviderClient(
      {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      {
        fetchFn,
      },
    );

    await expect(
      provider.generateObject({
        taskName: 'demo',
        messages: [
          {
            role: 'user',
            content: '返回 JSON',
          },
        ],
        parse(rawText) {
          return JSON.parse(rawText) as { value: string };
        },
      }),
    ).rejects.toThrow(
      'AI 服务请求失败（503 Service Unavailable）：The model is overloaded. Please try again later.',
    );
  });

  it('rewrites quota-exceeded 429 errors into an actionable message', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            message:
              'You exceeded your current quota, please check your plan and billing details.',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    const provider = createOpenAiCompatibleProviderClient(
      {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      {
        fetchFn,
      },
    );

    await expect(
      provider.generateObject({
        taskName: 'demo',
        messages: [
          {
            role: 'user',
            content: '返回 JSON',
          },
        ],
        parse(rawText) {
          return JSON.parse(rawText) as { value: string };
        },
      }),
    ).rejects.toThrow(
      'AI 服务请求失败（429）：当前 AI 配额已用尽，请检查 provider 的 plan / billing，或切换到仍可用的模型与密钥。',
    );
  });

  it('includes a response snippet when the provider returns non-JSON task content', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          model: 'gpt-test',
          choices: [
            {
              message: {
                content: 'Service temporarily unavailable, please retry later.',
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
    const provider = createOpenAiCompatibleProviderClient(
      {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      {
        fetchFn,
      },
    );

    await expect(
      provider.generateObject({
        taskName: 'demo',
        messages: [
          {
            role: 'user',
            content: '返回 JSON',
          },
        ],
        parse(rawText) {
          return JSON.parse(rawText) as { value: string };
        },
      }),
    ).rejects.toThrow(
      '响应片段：Service temporarily unavailable, please retry later.',
    );
  });
});
