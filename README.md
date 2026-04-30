# Whynote

Whynote 是一个面向提问式学习的节点化笔记系统。它把学习过程本身组织成一棵可编辑的结构树，让提问、回答、总结、判断和资料引用自然长成一份可整理、可导出的学习文档。

## 项目定位

- 不是通用思维导图工具
- 不是普通 AI 聊天记录器
- 是一个以文本学习为主舞台、以结构视图做重排与定位、以节点作为统一抽象的学习系统

## 核心价值

- 用苏格拉底式提问推动理解，而不是只堆答案
- 学习过程与笔记产出合一，减少在多个软件之间切换
- 所有内容都可落到节点树里，方便重排、引用、导出与复盘
- 允许系统自动结构化，但始终保留用户修改结构的主导权

## MVP 边界

首版聚焦个人 Web MVP，只验证最核心的学习闭环：

- 主题输入、资料导入、资料导入加用户问题三种入口
- 系统生成学习模块与学习计划步骤
- 在模块内围绕 `question / answer / summary / judgment` 展开学习
- 复合问题自动拆分为子问题，原句保留为父问题
- 结构视图中的树编辑、拖拽重排、提升一级 / 降低一级
- 全局资料区、资料引用与按需复用的资料切片
- URL 正文读取、单份资料导入与 `.txt / .md` 批量资料导入
- 搜索、定位、标签、基础导出

首版暂不包含：

- 自动联网检索资料
- 云同步、账号体系、多人协作
- `PDF / DOCX` 导入与导出
- 服务端抓取代理或面向公开商用的后端代理层
- 完整资料阅读器
- 通用自由画布式思维导图

## 技术基线

- 前端：React + Vite + TypeScript
- 运行环境：Node.js >= 24
- 包管理：pnpm
- 测试：Vitest
- 存储：IndexedDB + localStorage
- 导出：Markdown / TXT
- AI 接入：内置 OpenAI-compatible 模板 + 本地预设，当前仍走单一 OpenAI-compatible 请求链路
- 部署：静态前端优先，默认以 Vercel 为示例平台

## AI 配置

- 当前不做完整设置中心，只提供最小可运行的 OpenAI-compatible 配置卡
- 用户可以先选内置模板，再局部修改 `Base URL / API Key / Model`
- 用户可以把当前配置保存为本地预设，并在下次直接切换
- 模板层与预设层分开：
  - 模板只提供厂商默认壳子，不保存密钥
  - 预设保存用户自己的本地配置实例

当前内置模板：

- `Gemini (OpenAI-compatible)`
- `自定义 OpenAI-compatible`

Gemini 示例：

- Base URL：`https://generativelanguage.googleapis.com/v1beta/openai`
- Model：`gemini-2.5-flash`
- API Key：使用你自己的本地 Google AI / Gemini key

## 工程启动

```bash
pnpm install
pnpm run dev
```

常用验证命令：

```bash
pnpm run test
pnpm run coverage
pnpm run typecheck
pnpm run build
```

## 产品心智模型

Whynote 首版使用统一节点模型，但节点带有明确语义：

- `theme-root`：整个学习主题
- `module`：学习方向模块
- `plan-step`：模块内学习步骤
- `question`：问题
- `answer`：回答
- `summary`：总结
- `judgment`：判断 / 评估
- `resource`：资料源
- `resource-fragment`：资料切片 / 摘录

默认树结构如下：

```text
theme-root
├─ module
│  ├─ plan-step
│  │  ├─ question
│  │  │  ├─ question
│  │  │  ├─ answer
│  │  │  ├─ summary
│  │  │  └─ judgment
│  │  ├─ answer
│  │  ├─ summary
│  │  └─ judgment
│  └─ summary
└─ resource
   └─ resource-fragment
```

## 文档索引

- [docs/PRD.md](docs/PRD.md)：正式产品需求文档
- [docs/v1.1-question-chain-editor.md](docs/v1.1-question-chain-editor.md)：V1.1 第一轮问题链条编辑器规格
- [docs/WORKTREE_PLAN.md](docs/WORKTREE_PLAN.md)：V1.1 并行工作树拆分与派发指令
- [TESTING.md](TESTING.md)：测试基线与验证范围
- [DEPLOYMENT.md](DEPLOYMENT.md)：部署基线与平台示例
- [DEV_NOTE.md](DEV_NOTE.md)：长期有效的产品与架构决策
- [WIP.md](WIP.md)：当前阶段的中短期执行事项
- [TODO.md](TODO.md)：后续版本与长期能力清单

## 当前状态

- 已接通 `workspace runtime`：支持真实工作区初始化、自动保存、刷新恢复与运行状态反馈。
- 已形成最小学习闭环：模块规划、`plan-step`、`question / answer / judgment / 答案解析`、追问与步骤完成建议都已接入真实节点树。
- 已接通资料主路径：资料导入 / 引用、`.txt / .md` 批量导入、URL 正文读取 + AI 摘要主路径都可运行。
- 已提供 AI 配置模板与本地预设：当前内置 `Gemini (OpenAI-compatible)` 和 `自定义 OpenAI-compatible` 模板，并支持保存本地配置实例。
- 当前边界仍然明确：URL 导入依赖浏览器可直接读取网页；不支持 `PDF / DOCX`；不做服务端抓取代理；资料系统仍是轻量版本，不是完整资料阅读器。
