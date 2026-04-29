import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import type {
  AiConfig,
  AiProviderClient,
  AiProviderObjectRequest,
  AiProviderObjectResponse,
} from '../learningEngine';
import {
  createIndexedDbStorage,
  createLocalStorageStore,
  type StructuredDataStorage,
} from '../nodeDomain';
import WorkspaceRuntimeScreen from './WorkspaceRuntimeScreen';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('applies the Gemini template and restores a saved preset after remount', async () => {
  const dependencies = createTestDependencies();
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  createGeminiPreset('我的 Gemini');

  expect(
    await screen.findByRole('button', { name: '覆盖当前预设' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      '当前会覆盖已选中的本地预设内容，不会改名。要改名或删除，请到下方“已保存预设”。',
    ),
  ).toBeInTheDocument();

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByRole('heading', { name: '当前学习模块' });
  expect(screen.getByLabelText('Base URL')).toHaveValue(
    'https://generativelanguage.googleapis.com/v1beta/openai',
  );
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('gemini-key');
  expect(screen.getByLabelText('Model')).toHaveValue('gemini-2.5-flash');
  expect(getCurrentConfigSelect().selectedOptions[0]?.text).toBe('我的 Gemini');
  expect(screen.getByLabelText('新预设名称')).toHaveValue('我的 Gemini');
  expect(screen.getByLabelText('新预设名称')).toBeDisabled();
});

test('explains why preset saving is disabled until a preset name is provided', async () => {
  const dependencies = createTestDependencies();

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: '',
    },
  });

  expect(screen.getByRole('button', { name: '保存为新预设' })).toBeDisabled();
  expect(screen.getByText('要保存为预设，先填一个新预设名称。')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: '临时预设',
    },
  });

  expect(screen.getByRole('button', { name: '保存为新预设' })).toBeEnabled();
  expect(
    screen.getByText('当前会把这组三项配置保存成新的本地预设。'),
  ).toBeInTheDocument();
});

test('switches between saved presets and keeps the provider chain working', async () => {
  const providerCapture = createCapturingProviderClient();
  const dependencies = createTestDependencies({
    providerClient: providerCapture.providerClient,
    onCreateProviderClient: providerCapture.pushConfig,
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);
  await screen.findByRole('heading', { name: '当前学习模块' });

  createGeminiPreset('我的 Gemini');
  switchToUnsavedCurrentConfig();
  createCustomPreset('测试 Key');

  const currentConfigSelect = getCurrentConfigSelect();
  const geminiPresetId =
    findOptionValueByText(currentConfigSelect, '我的 Gemini') ?? '';
  const customPresetId =
    findOptionValueByText(currentConfigSelect, '测试 Key') ?? '';

  fireEvent.change(currentConfigSelect, {
    target: {
      value: geminiPresetId,
    },
  });

  await waitFor(() => {
    expect(screen.getByLabelText('Base URL')).toHaveValue(
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
  });
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('gemini-key');
  expect(screen.getByLabelText('Model')).toHaveValue('gemini-2.5-flash');

  fireEvent.change(currentConfigSelect, {
    target: {
      value: customPresetId,
    },
  });

  await waitFor(() => {
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://example.com/v1');
  });
  expect(screen.getByLabelText(/API Key/i)).toHaveValue('custom-key');
  expect(screen.getByLabelText('Model')).toHaveValue('custom-model');

  fireEvent.change(currentConfigSelect, {
    target: {
      value: geminiPresetId,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存当前配置' }));
  fireEvent.click(screen.getByRole('button', { name: '为当前模块规划学习路径' }));

  expect(await screen.findByDisplayValue('AI 规划步骤')).toBeInTheDocument();
  expect(providerCapture.configs.at(-1)).toEqual({
    apiKey: 'gemini-key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
  });
});

test('detaches the selected preset after manual edits or template switches', async () => {
  const dependencies = createTestDependencies();
  const firstRender = render(
    <WorkspaceRuntimeScreen dependencies={dependencies} />,
  );

  await screen.findByRole('heading', { name: '当前学习模块' });

  createGeminiPreset('我的 Gemini');

  fireEvent.change(screen.getByLabelText('Model'), {
    target: {
      value: 'gemini-2.5-pro',
    },
  });

  expect(getCurrentConfigSelect()).toHaveValue('');
  expect(screen.getByRole('button', { name: '保存为新预设' })).toBeInTheDocument();
  expect(
    screen.getByText('当前配置已脱离预设：我的 Gemini。现为未保存状态。'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '保存当前配置' }));

  firstRender.unmount();
  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  await screen.findByRole('heading', { name: '当前学习模块' });
  expect(getCurrentConfigSelect()).toHaveValue('');
  expect(screen.getByLabelText('Model')).toHaveValue('gemini-2.5-pro');

  const geminiPresetId =
    findOptionValueByText(getCurrentConfigSelect(), '我的 Gemini') ?? '';

  fireEvent.change(getCurrentConfigSelect(), {
    target: {
      value: geminiPresetId,
    },
  });
  fireEvent.change(screen.getByLabelText('厂商模板'), {
    target: {
      value: 'custom-openai-compatible',
    },
  });

  expect(getCurrentConfigSelect()).toHaveValue('');
  expect(screen.getByLabelText('Base URL')).toHaveValue('');
  expect(screen.getByLabelText('Model')).toHaveValue('');
  expect(
    screen.getByText('已切换到模板：自定义 OpenAI-compatible。当前配置已回到未保存状态。'),
  ).toBeInTheDocument();
});

function createTestDependencies(options?: {
  onCreateProviderClient?: (config: AiConfig) => void;
  providerClient?: AiProviderClient;
}): WorkspaceRuntimeDependencies {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-ai-config-${crypto.randomUUID()}`,
  });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-ai-config-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      options?.onCreateProviderClient?.(config);
      return options?.providerClient ?? createMockProviderClient(config);
    },
    defaultLearningMode: 'standard',
  };
}

function createMockProviderClient(_config?: AiConfig): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = {
        planSteps: [],
      };
      const rawText = JSON.stringify(payload);

      return {
        taskName: request.taskName,
        content: request.parse(rawText) as T,
        model: 'mock-model',
        providerLabel: 'mock-provider',
        rawText,
      };
    },
  };
}

function createCapturingProviderClient() {
  const configs: AiConfig[] = [];

  return {
    configs,
    providerClient: {
      async generateObject<T>(
        request: AiProviderObjectRequest<T>,
      ): Promise<AiProviderObjectResponse<T>> {
        const payload = {
          planSteps: [
            {
              title: 'AI 规划步骤',
              content: '验证模板配置不会破坏现有 provider 主链。',
              introductions: [],
              questions: [],
            },
          ],
        };
        const rawText = JSON.stringify(payload);

        return {
          taskName: request.taskName,
          content: request.parse(rawText) as T,
          model: 'mock-model',
          providerLabel: 'mock-provider',
          rawText,
        };
      },
    } satisfies AiProviderClient,
    pushConfig(config: AiConfig) {
      configs.push(config);
    },
  };
}

function getCurrentConfigSelect() {
  return screen.getByLabelText('当前配置') as HTMLSelectElement;
}

function switchToUnsavedCurrentConfig() {
  fireEvent.change(getCurrentConfigSelect(), {
    target: {
      value: '',
    },
  });
}

function createGeminiPreset(name: string) {
  fireEvent.change(screen.getByLabelText('厂商模板'), {
    target: {
      value: 'gemini-openai-compatible',
    },
  });
  fireEvent.change(screen.getByLabelText(/API Key/i), {
    target: {
      value: 'gemini-key',
    },
  });
  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: name,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存为新预设' }));
}

function createCustomPreset(name: string) {
  fireEvent.change(screen.getByLabelText('厂商模板'), {
    target: {
      value: 'custom-openai-compatible',
    },
  });
  fireEvent.change(screen.getByLabelText('Base URL'), {
    target: {
      value: 'https://example.com/v1',
    },
  });
  fireEvent.change(screen.getByLabelText(/API Key/i), {
    target: {
      value: 'custom-key',
    },
  });
  fireEvent.change(screen.getByLabelText('Model'), {
    target: {
      value: 'custom-model',
    },
  });
  fireEvent.change(screen.getByLabelText('新预设名称'), {
    target: {
      value: name,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存为新预设' }));
}

function findOptionValueByText(
  select: HTMLSelectElement,
  optionLabel: string,
) {
  return (
    [...select.options].find((option) => option.text === optionLabel)?.value ??
    null
  );
}
