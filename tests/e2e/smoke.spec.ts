import { expect, test, type Page } from '@playwright/test';

import {
  createSmokeWorkspaceSnapshot,
  openApp,
  seedWorkspace,
  smokeWorkspaceSelection,
} from './support/workspaceSeed';

test('opens the app and initializes a minimal workspace on first visit', async ({
  page,
}) => {
  await openApp(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Whynote' }),
  ).toBeVisible();
  await expect(getCurrentModuleTitleInput(page)).toHaveValue('默认模块');
  await expect(
    page.getByRole('heading', { level: 2, name: '文本主视图' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '当前焦点' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '资料与摘录' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '搜索与定位' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '搜索命中' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Markdown / TXT' }),
  ).toBeVisible();
  await expect(page.getByLabel('搜索关键词')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出内容' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '工作区暂不可用' }),
  ).toHaveCount(0);
});

test('keeps a small visible workspace edit after refresh', async ({ page }) => {
  await openApp(page);

  const updatedModuleTitle = 'Smoke 持久化模块';

  await getCurrentModuleTitleInput(page).fill(updatedModuleTitle);
  await expect(page.getByText('已保存')).toBeVisible();

  await page.reload();

  await expect(getCurrentModuleTitleInput(page)).toHaveValue(updatedModuleTitle);
  await expect(
    page.getByRole('heading', { level: 2, name: '当前学习模块' }),
  ).toBeVisible();
});

test('switches modules in a preloaded workspace and keeps support panels rendered', async ({
  page,
}) => {
  await openApp(page);
  await seedWorkspace(
    page,
    createSmokeWorkspaceSnapshot(),
    smokeWorkspaceSelection,
  );

  await expect(getCurrentModuleTitleInput(page)).toHaveValue('渲染基础');
  await expect(
    page.getByRole('heading', { level: 2, name: '渲染基础' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('为什么状态更新会触发重渲染？ 标题'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '定位资料 React 渲染文档' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '定位摘录 渲染与提交摘录' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /副作用切换/ }).click();

  await expect(getCurrentModuleTitleInput(page)).toHaveValue('副作用切换');
  await expect(
    page.getByRole('heading', { level: 2, name: '副作用切换' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('什么时候需要同步副作用？ 标题'),
  ).toBeVisible();
  await expect(
    page.getByLabel('为什么状态更新会触发重渲染？ 标题'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: '资料与摘录' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '搜索与定位' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '搜索命中' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Markdown / TXT' }),
  ).toBeVisible();
});

function getCurrentModuleTitleInput(page: Page) {
  return page.locator('.app-panel-main .workspace-nodeTitleInput').first();
}
