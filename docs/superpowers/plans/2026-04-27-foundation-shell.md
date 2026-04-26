# Whynote Foundation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化 Whynote 的 React + Vite + TypeScript + Vitest 工程，并交付一个可运行、可测试、可构建的最小应用壳层。

**Architecture:** 保持单页壳层，不引入路由和业务能力。先用测试定义最小可见壳层，再补齐 Vite、TypeScript、Vitest 与基础样式，最终通过 `build / test / coverage / typecheck` 验证工程完整性。

**Tech Stack:** React, Vite, TypeScript, Vitest, Testing Library, jsdom, pnpm

---

### Task 1: 修正 spec 与对齐执行文档

**Files:**
- Modify: `docs/superpowers/specs/2026-04-27-whynote-foundation-shell-design.md`
- Create: `docs/superpowers/plans/2026-04-27-foundation-shell.md`
- Modify: `WIP.md`

- [ ] **Step 1: 修正 spec 中的依赖口径与目录边界**

将第 5 节改为“最小核心依赖 + 为满足 typecheck/build/coverage 所允许补充的工程依赖”，显式允许：

```text
@types/react
@types/react-dom
@types/node
@vitest/coverage-v8
```

并删除 `features/workspace/` 的目录与语义预设，只保留 `src/features/` 作为空挂载点。

- [ ] **Step 2: 写入实现计划文档**

创建当前计划文件，覆盖：

```text
工程配置
最小测试
应用壳层
验证命令
```

- [ ] **Step 3: 对齐 WIP**

在 `WIP.md` 中保留“初始化 React + Vite + TypeScript + Vitest 工程壳层”这一当前任务，不添加超出本工作树职责的新事项。

- [ ] **Step 4: 运行文档检查**

Run: `Select-String -Path "docs/superpowers/specs/2026-04-27-whynote-foundation-shell-design.md","docs/superpowers/plans/2026-04-27-foundation-shell.md" -Pattern "TODO|TBD|implement later|待补|稍后"`

Expected: 无匹配输出。

### Task 2: 先写 failing test，定义最小壳层行为

**Files:**
- Create: `src/App.test.tsx`
- Create: `src/test/setupTests.ts`

- [ ] **Step 1: 写最小渲染测试**

```tsx
import { render, screen } from '@testing-library/react';

import App from './App';

test('renders the minimal app shell placeholders', () => {
  render(<App />);

  expect(screen.getByRole('banner', { name: /whynote/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '结构视图占位' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '文本主视图占位' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '资料区占位' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试，验证当前失败**

Run: `pnpm run test -- src/App.test.tsx`

Expected: FAIL，原因是工程文件或 `App` 尚不存在。

- [ ] **Step 3: 准备 Testing Library 环境**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: 暂不修复测试，进入最小实现**

保持失败状态，直到 Task 4 完成最小生产代码。

### Task 3: 建立工程配置与依赖

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: 写入最小 package.json**

```json
{
  "name": "whynote",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run:

```bash
pnpm add react react-dom
pnpm add -D vite @vitejs/plugin-react-swc typescript vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom @types/node @vitest/coverage-v8
```

Expected: 依赖安装完成并生成 `pnpm-lock.yaml`。

- [ ] **Step 3: 写入 TypeScript / Vite / Vitest 配置**

配置要求：

```text
tsconfig 使用 app/node 分拆
vite 使用 react-swc 插件
vitest 使用 jsdom + setupFiles
coverage provider 使用 v8
```

- [ ] **Step 4: 运行测试，确认仍然因 App 未实现而失败**

Run: `pnpm run test -- src/App.test.tsx`

Expected: FAIL，原因收敛为应用代码缺失或断言目标未渲染。

### Task 4: 实现最小应用壳层

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/ui/AppLayout.tsx`
- Create: `src/ui/AppShellPlaceholder.tsx`
- Create: `src/ui/SectionCard.tsx`
- Create: `src/index.css`
- Create: `src/features/.gitkeep`
- Create: `src/hooks/.gitkeep`
- Create: `src/services/.gitkeep`
- Create: `src/utils/.gitkeep`
- Create: `src/assets/.gitkeep`

- [ ] **Step 1: 实现最小组件树**

组件职责：

```text
App.tsx -> HomePage
HomePage.tsx -> AppLayout + AppShellPlaceholder
AppLayout.tsx -> banner + 三栏布局
AppShellPlaceholder.tsx -> 三个占位区块
SectionCard.tsx -> 复用的区块容器
```

- [ ] **Step 2: 写最小样式**

样式要求：

```text
能稳定显示顶部、左侧、中间、右侧
桌面端为三栏
窄屏下自动纵向堆叠
不做复杂视觉设计
```

- [ ] **Step 3: 运行测试，验证转绿**

Run: `pnpm run test -- src/App.test.tsx`

Expected: PASS，断言 4 个占位目标全部可见。

- [ ] **Step 4: 运行完整测试**

Run: `pnpm run test`

Expected: PASS，0 failures。

### Task 5: 更新 README 启动方式并做完整验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 补最小启动说明**

只更新与工程初始化直接相关的信息：

```text
安装依赖
开发启动
构建
测试
类型检查
```

- [ ] **Step 2: 运行类型检查**

Run: `pnpm run typecheck`

Expected: PASS，exit code 0。

- [ ] **Step 3: 运行构建**

Run: `pnpm run build`

Expected: PASS，产出 `dist/`。

- [ ] **Step 4: 运行 coverage**

Run: `pnpm run coverage`

Expected: PASS，coverage 报告生成，无阈值失败。

- [ ] **Step 5: 汇总交付信息**

交付时必须包含：

```text
分支名
commit hash
关键改动文件
当前目录结构
执行过的验证命令及结果
需要主树拍板的问题
```
