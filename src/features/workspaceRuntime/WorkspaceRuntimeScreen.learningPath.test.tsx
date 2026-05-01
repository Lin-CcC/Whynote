import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

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
import { findNodeByDisplayTitle } from './workspaceRuntimeTestUtils';
import type { WorkspaceRuntimeDependencies } from './workspaceRuntimeTypes';

const openedStorages: StructuredDataStorage[] = [];

afterEach(async () => {
  window.localStorage.clear();

  while (openedStorages.length > 0) {
    const storage = openedStorages.pop();

    if (storage) {
      await storage.close();
    }
  }
});

test('plans a minimal learning path that lands as plan-step plus introduction and question nodes in runtime UI', async () => {
  const dependencies = createTestDependencies({
    providerClient: createMockProviderClient({
      'plan-step-generation': {
        planSteps: [
          {
            title: '先搭建最小概念框架',
            content: '先确认这一模块要解决什么。',
            introductions: [
              {
                title: '铺垫：先知道为什么要学这个问题',
                content: '先把这个 step 的目标和前置概念讲清楚。',
              },
            ],
            questions: [
              {
                title: '这个模块的核心问题是什么？',
                content: '围绕关键问题继续学习。',
              },
            ],
          },
        ],
      },
    }),
  });

  render(<WorkspaceRuntimeScreen dependencies={dependencies} />);

  expect(
    await screen.findByRole('button', { name: '为当前模块规划学习路径' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '为当前模块规划学习路径' }));

  expect(await screen.findByLabelText('先搭建最小概念框架 标题')).toBeInTheDocument();
  const introductionNode = await findNodeByDisplayTitle('先知道为什么要学这个问题');
  expect(
    await screen.findByLabelText('这个模块的核心问题是什么？ 标题'),
  ).toBeInTheDocument();
  expect(introductionNode).toHaveTextContent(
    /先把这个 step 的目标和前置概念讲清楚/u,
  );
  expect(introductionNode).toHaveTextContent(
    '这一小步先把“先搭建最小概念框架”说清楚',
  );
  expect(introductionNode).not.toHaveTextContent(
    /接下来会围绕|理解地图/u,
  );
  expect(await screen.findAllByText('铺垫')).not.toHaveLength(0);
});

function createTestDependencies(options?: {
  providerClient?: AiProviderClient;
}): WorkspaceRuntimeDependencies {
  const storage = createIndexedDbStorage({
    databaseName: `whynote-runtime-learning-path-${crypto.randomUUID()}`,
  });

  openedStorages.push(storage);

  return {
    structuredDataStorage: storage,
    localPreferenceStorage: createLocalStorageStore({
      prefix: `whynote-runtime-learning-path-${crypto.randomUUID()}`,
      storage: window.localStorage,
    }),
    createProviderClient(config: AiConfig) {
      return options?.providerClient ?? createMockProviderClient({}, config);
    },
    defaultLearningMode: 'standard',
  };
}

function createMockProviderClient(
  payloadByTaskName: Record<string, unknown>,
  _config?: AiConfig,
): AiProviderClient {
  return {
    async generateObject<T>(
      request: AiProviderObjectRequest<T>,
    ): Promise<AiProviderObjectResponse<T>> {
      const payload = payloadByTaskName[request.taskName] ?? {
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
