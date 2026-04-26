# Whynote Worktree Plan

本文档定义 Whynote 当前阶段的工作树拆分方式。主工作树不承担常规功能开发，只负责评审、合并、冲突协调和文档基线维护。

## 总原则

- 主工作树只做集成与评审，不承担常规功能实现
- 先完成工程基建，再拆第二阶段功能工作树
- 每棵工作树都应只在自己的职责边界内改动代码
- 跨边界改动应先合回主树，再由其他工作树继续衔接

## 主工作树

- 路径：当前仓库
- 分支：`main`
- 职责：
  - 审查代码
  - 合并分支
  - 解决冲突
  - 维护 `README.md`、`docs/PRD.md`、`DEV_NOTE.md`、`WIP.md`、`TODO.md`
  - 决定公共边界与目录结构调整是否接受

## 第一阶段

### 1. `codex/bootstrap-app-shell`

- 类型：基建工作树
- 目标：把当前文档基线落成一个可承载并行开发的前端工程骨架
- 允许改动：
  - 项目初始化文件
  - `package.json`
  - Vite / TypeScript / Vitest 配置
  - 基础目录结构
  - 最小应用壳层
  - 基础脚本与构建命令
- 不负责：
  - 复杂业务节点逻辑
  - AI 编排
  - 导出
  - 搜索
  - 资料引用

### 第一阶段完成条件

- React + Vite + TypeScript 初始化完成
- Vitest、类型检查、构建脚本可运行
- 基础目录骨架可供后续工作树并行接入
- 最小页面壳层可启动

## 第二阶段

第一阶段合回 `main` 后，再创建以下 4 棵功能工作树。

### 2. `codex/node-domain-storage`

- 目标：
  - 节点类型系统
  - 树结构约束
  - `提升一级 / 降低一级`
  - 根层自动转 `module`
  - 标签、引用关系、排序规则
  - `IndexedDB` / `localStorage` 存储封装
- 优先测试：
  - 纯逻辑
  - 树变换
  - 存储恢复

### 3. `codex/learning-engine`

- 目标：
  - OpenAI-compatible provider 抽象
  - 模块生成模式：`快速 / 标准 / 深度`
  - `plan-step` 生成
  - 复合问题自动拆分
  - 子问题依赖排序
  - `plan-step` 的“建议完成”逻辑
- 优先测试：
  - 学习结构生成
  - 拆分与排序
  - 步骤状态建议

### 4. `codex/workspace-editor`

- 目标：
  - 文本主视图
  - 结构视图
  - 模块切换
  - 节点展开 / 折叠
  - 拖拽重排
  - `提升一级 / 降低一级` 交互
  - 自动拆分结果的显式展示与即时编辑
- 优先测试：
  - 视图同步
  - 结构编辑
  - 模块语义转换

### 5. `codex/resources-search-export`

- 目标：
  - 全局资料区
  - `resource` / `resource-fragment` 展示与引用入口
  - 搜索作用域切换
  - 定位栏
  - 标签筛选
  - `Markdown / TXT` 导出
  - `plan-step` 导出默认隐藏但可显式包含
- 优先测试：
  - 搜索与定位
  - 资料引用
  - 导出结果

## 推荐顺序

1. 创建并完成 `codex/bootstrap-app-shell`
2. 合回 `main`
3. 再创建第二阶段 4 棵功能工作树
4. 主工作树只做评审、合并和边界控制

## 备注

如果第二阶段人手或上下文不足，可把 `codex/resources-search-export` 暂时并入 `codex/workspace-editor`，先以 3 棵功能工作树推进。
