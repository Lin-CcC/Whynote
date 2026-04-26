# Whynote 基建工作树最小工程壳层设计

## 1. 背景

当前仓库处于文档基线阶段，尚未初始化前端工程。本工作树只负责工程初始化与最小应用壳层，不实现复杂业务逻辑，不改写既有产品模型与 PRD 边界。

已确认的基线：

- 个人 Web MVP
- React + Vite + TypeScript
- Node.js >= 24
- pnpm
- Vitest

## 2. 目标

本工作树交付以下能力：

1. 初始化 React + Vite + TypeScript 工程
2. 配置 Vitest、typecheck、build、基础脚本
3. 建立可供后续并行开发的目录骨架
4. 建立最小应用壳层，让页面能启动
5. 保持实现克制，不做复杂业务功能

## 3. 非目标

本工作树明确不做以下内容：

- 不实现节点类型系统
- 不实现学习计划生成
- 不实现 AI provider
- 不实现搜索、导出、资料区、引用系统
- 不实现复杂拖拽、结构编辑、模块业务
- 不改写 PRD 的产品边界
- 不发散做视觉设计，只做最小壳层和布局占位

## 4. 方案选择

本次采用单页壳层方案，而不是预先引入路由。

原因：

- 当前需求只要求工程启动与最小壳层，不需要页面切换
- 少一层公共依赖和抽象，降低后续工作树耦合
- 不提前固化页面与路由边界，后续功能树可按真实需求接入

当前不引入：

- `react-router`
- 状态管理库
- UI 组件库
- 数据请求库
- AI SDK

## 5. 工程选型

核心技术栈保持既定基线不变，仅补足最小依赖：

- 运行时：`react`、`react-dom`
- 构建：`vite`、`@vitejs/plugin-react-swc`
- 类型：`typescript`
- 测试：`vitest`、`jsdom`
- 组件测试：`@testing-library/react`、`@testing-library/jest-dom`

当前不额外引入路径别名、全局状态方案、格式化或 lint 规则，避免在基建工作树内提前拍板过多公共约定。

## 6. 目录结构

初始化后的最小目录结构如下：

```text
src/
├─ assets/
├─ features/
│  └─ workspace/
├─ hooks/
├─ pages/
│  └─ HomePage.tsx
├─ services/
├─ test/
│  └─ setupTests.ts
├─ ui/
│  ├─ AppLayout.tsx
│  ├─ AppShellPlaceholder.tsx
│  └─ SectionCard.tsx
├─ utils/
├─ App.tsx
├─ main.tsx
├─ index.css
└─ vite-env.d.ts
```

补充说明：

- `features/`、`services/`、`hooks/`、`utils/` 先建立稳定挂载点，不提前塞入业务实现
- `features/workspace/` 仅作为后续功能树接入主工作区能力的预留位置
- 当前不建立 `atoms/`，待主树明确是否采用 Jotai/Recoil 后再补

## 7. 壳层组件边界

组件只拆到最小必要层级：

- `App.tsx`
  - 仅挂载 `HomePage`
- `pages/HomePage.tsx`
  - 仅负责页面级组装
- `ui/AppLayout.tsx`
  - 负责顶部、左侧、中间、右侧的整体布局
- `ui/AppShellPlaceholder.tsx`
  - 负责最小占位文案
- `ui/SectionCard.tsx`
  - 负责复用的薄展示块

边界要求：

- `pages/` 只组装，不沉淀业务逻辑
- `ui/` 只放通用展示组件
- `features/` 留给后续真实业务模块
- `services/` 留给后续统一的网络/存储/Provider 接口实现

## 8. 占位文案策略

页面只展示最小壳层，不伪装成业务已实现：

- 顶部：`Whynote`
  - 副文案：`个人 Web MVP · 工程壳层`
- 左侧：`结构视图占位`
  - 说明：后续接入节点树、重排、定位相关能力
- 中间：`文本主视图占位`
  - 说明：后续接入主题输入、学习内容编辑、问答与总结区域
- 右侧：`资料区占位`
  - 说明：后续接入资料源、引用、切片与搜索辅助能力

## 9. 配置与脚本

本工作树应补齐以下配置文件：

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `vitest.config.ts`
- `index.html`

至少提供以下脚本：

- `pnpm run dev`
- `pnpm run build`
- `pnpm run preview`
- `pnpm run test`
- `pnpm run test:watch`
- `pnpm run coverage`
- `pnpm run typecheck`

约束：

- `build` 需同时覆盖 TypeScript 校验与 Vite 构建
- `test` 使用 `vitest run`
- `coverage` 只接通命令，不在本工作树内强制覆盖率阈值

## 10. 测试基线

本工作树只建立工程初始化级测试，不提前实现 PRD 中的业务模型测试。

测试范围：

1. 应用可正常渲染最小壳层
2. 顶部标题与三区域占位可见
3. `vitest` 基础设施可正常运行
4. `typecheck` 与 `build` 可通过

明确留给后续功能树的测试：

- 节点模型与结构约束
- 存储与恢复逻辑
- AI 编排与规则测试
- 搜索、导出、引用、树编辑等业务交互测试

## 11. 交付时必须带回的内容

向主树汇报时，至少包含以下 5 项：

1. 改了哪些关键文件
2. 当前目录结构
3. 运行了哪些命令
4. 哪些命令通过了
5. 还有哪些需要主树拍板的边界问题

## 12. 需要主树后续拍板的边界问题

本工作树不擅自拍板，但应在交付时明确指出：

1. 是否启用路径别名，例如 `@/`
2. 是否需要建立 `src/atoms/`，以及是否采用 Jotai/Recoil
3. `src/features/` 的一级分包口径如何统一
4. 是否从早期开始设置 `coverage` 阈值

## 13. 验收标准

完成后应满足：

- 能启动一个可运行的 Vite 应用
- `pnpm run dev` 可用
- `pnpm run build` 可用
- `pnpm run test` 可用
- `pnpm run typecheck` 可用
- 页面具备顶部标题、主内容区占位、侧栏占位
- 实现克制，不包含复杂业务功能
