# WIP

本文档只记录当前阶段中短期事项。已稳定的长期决策进入 [DEV_NOTE.md](DEV_NOTE.md)，中长期演进进入 [TODO.md](TODO.md)。

## 当前阶段

文档基线完成后，进入“信息架构细化、资源导入机制设计与原型验证”阶段。

## 当前短期目标

- [x] 资源区删除主路径
- [x] 删除影响确认
- [x] 删除后焦点恢复

## 已完成

- [x] 明确首批文档集
- [x] 锁定个人 Web MVP 范围
- [x] 明确统一节点模型与节点类型
- [x] 确定学习计划进入节点树
- [x] 确定资料区全局化与按需切片
- [x] 确定复合问题自动拆分与根层模块语义

## 当前待做

- [x] 初始化 React + Vite + TypeScript + Vitest 工程壳层
- [x] 实现 `learningEngine` 的领域类型、OpenAI-compatible AI 抽象与节点树装配器
- [x] 实现模块生成、`plan-step` 生成、复合问题拆分与子问题排序
- [x] 实现 `plan-step` “建议完成”纯逻辑与对应测试
- [ ] 画出首版页面信息架构
- [ ] 明确文本主视图、结构视图、资料区、定位栏之间的布局关系
- [ ] 补一版低保真交互稿，验证搜索、拖拽、节点升降级是否顺手
- [ ] 把节点类型与引用关系翻译成实际数据结构草案
- [ ] 选定文本编辑器方案
- [ ] 选定结构视图 / 树编辑实现方案
- [ ] 选定本地存储封装方案
- [ ] 设计导出转换器的最小规则

## 当前工作树：`codex/workspace-editor`

- [x] 接入编辑器壳层与三栏布局
- [x] 建立当前主题 / 模块 / 选中节点 / 展开状态的最小视图模型
- [x] 实现模块切换与结构视图同步
- [x] 实现文本主视图的基础节点展示与轻量编辑承接位
- [x] 接入结构操作入口：插入子节点、插入同级、删除、提升一级、降低一级
- [x] 为复合问题拆分结果提供显式展示与编辑承接区
- [x] 补齐 `workspace-editor` 组件与交互测试

## 当前工作树：`codex/workspace-runtime-integration`

- [x] 用真实工作区数据替换 editor demo snapshot
- [x] 接入 IndexedDB 工作区加载、保存与恢复
- [x] 提供最小初始工作区创建逻辑
- [x] 接入 learning-engine 的最小运行时闭环
- [x] 补齐运行时状态与错误状态反馈
- [x] 补齐 workspace runtime 集成测试

## 当前工作树：`codex/playwright-smoke`

- [x] 接入 Playwright 依赖、配置与统一命令
- [x] 建立本地可运行的浏览器级 smoke 测试
- [x] 覆盖首次打开、最小初始化、刷新持久化、模块切换与资料/搜索/导出面板渲染
- [x] 更新最小必要测试文档

## 当前工作树：`codex/resource-ingest-lite`

- [x] 梳理现有 `resource` / `resource-fragment` 创建入口与复用边界
- [x] 实现 URL 自动填充标题与资料概况，失败时保留手动回退
- [x] 按复审意见收口为“浏览器受限自动填充”，修正文案与失败反馈
- [x] 支持最小本地上传，优先 `.txt` / `.md`
- [x] 确保导入后的 `resource` 继续进入资料区、搜索、定位与导出链路
- [x] 补齐资源入口自动化与回归测试

## 当前工作树：`codex/batch-resource-import`

- [x] 将本地资料入口升级为 `.txt` / `.md` 多文件批量导入
- [x] 保持每个导入文件创建独立 `resource`，继续复用现有资料区、搜索、定位、导出与持久化链路
- [x] 为文件夹导入补一条受限首版路径：仅在浏览器稳定返回目录相对路径时执行，否则明确回退到多文件导入
- [x] 为批量导入补齐预览、过滤、跳过反馈与结果汇总
- [x] 为导入后的 `resource` 保留原文件名、相对路径、导入方式与批次标识等来源信息
- [x] 补齐多文件导入、过滤跳过、来源持久化与现有资料链路不回归的测试

## 当前工作树：`codex/resource-ingest-automation`

- [x] 基于现有 `resource` 入口、资料区、搜索、定位、导出链路梳理现状
- [x] 明确 `resource` / `resource-fragment` 的正式定义与主流程
- [x] 明确 URL 录入、本地 `txt / md` 上传、手动资料卡三类入口的 MVP 路径
- [x] 明确自动摘要、自动摘录、学习期自动引用的分层方案
- [x] 明确“手动新建摘录”降级为补充入口
- [ ] 切出首批实现：URL 自动补标题 / 概况、`txt / md` 正文基础、手动 fragment 入口降级
- [ ] 明确资源正文基础与 ingest 状态的存储草案
- [x] 定义学习运行时的 fragment 复用 / 新建引用接口
- [x] 补齐 `answer` 作为资料引用源的领域约束

## 当前工作树：`codex/learning-loop-closure`

- [ ] 把资源标题 / 概况升级为 AI 摘要主路径，并保留规则 / 手动 fallback 与来源标记
- [ ] 让 runtime 读取并使用 resource ingest metadata，而不是只写不读
- [x] 把“为当前模块生成 plan-step”升级成最小学习路径，并真正落到现有节点树
- [x] 用现有节点模型表达铺垫知识，优先收敛到 step 下的 question 草案
- [x] 收紧学习计划与回答评估合同，让铺垫 / 主问题 / 追问 / judgment / summary 的职责边界进入 prompt、normalization 与测试
- [x] 打通学习节点到 resource / fragment 的最小引用闭环，支持 answer 引用
- [x] 明确 fragment 复用优先、无法稳定定位时退回 resource 级引用
- [x] 实现 plan-step 状态自动流转，并保留可解释依据与手动覆盖优先级
- [x] 补齐 runtime / storage / service / UI 测试，并回归 typecheck、build

## 当前工作树：`codex/learning-automation-pass`

- [x] 把回答后的默认下一步收敛成明显主 CTA，并复用现有 question closure 自动推进 judgment / summary / follow-up
- [x] 为铺垫 / introduction 补上至少一组继续教学动作，生成新的讲解草稿而不是停在当前节点
- [x] 让插入铺垫 / 问题 / 总结 / 判断默认直接生成草稿，而不是落空节点
- [x] 用统一的 learning action draft prompt / runtime 规则承接上述动作，避免分散成多套编排
- [x] 补齐回答推进、铺垫补讲、插入即草稿的测试，并回归 typecheck / build

## 当前工作树：`codex/testing-ux-and-answer-closure`

- [x] 收紧 question closure 到 UI 的接线，保证首次评估后 judgment 与答案解析同时可见可跳转
- [x] 让手动插入的 question / summary / judgment 尽量复用同一套学习闭环语义，而不是按节点来源分流
- [x] 强化文本主视图节点卡片的点击即选中反馈，显式区分“选中”与“进入编辑”
- [x] 收口工程壳层 CTA 与主路径提示，让 answer / judgment / summary 三种语境都能直接看到下一步
- [x] 补齐首次评估、手动 question + answer、手动 summary 配对和点击选中的回归测试，并通过 typecheck / test / build

## 当前工作树：`codex/answer-feedback-and-shell-ux-fix`

- [x] 给工作区自动保存补 debounce，并让“保存中 -> 已保存”切换更稳，避免输入时频繁闪烁
- [x] 收紧 judgment 职责：明确“已答到什么 / 还缺哪 1-3 个关键点 / 为什么这些缺口关键”
- [x] 让 hint 成为围绕缺口的独立微型铺垫，而不是摘抄答案解析
- [x] 保证第一次评估后答案解析稳定存在，`查看答案解析` 在主路径和 judgment 卡片里都稳定可用
- [x] 收口工程壳层的测试交互提示，减少按钮灰掉却缺少解释的测试困惑
- [x] 补保存状态、judgment 缺口、hint 独立性、首次评估答案解析可用性的回归，并跑 typecheck / test / build

## 当前工作树：`codex/resource-citation-runtime`

- [x] 补齐 `answer` 作为合法资料引用源的领域约束
- [x] 在学习运行时接通 `question / answer / summary / judgment` 的资料引用显示与回跳
- [x] 引用解析先复用已有 fragment，无法稳定命中时退回 `resource` 级引用
- [x] 为后续自动 fragment 保留最小运行时解析接口，但当前不扩展为完整自动摘录系统
- [x] 补齐 `answer`、fragment 复用、resource 回退、刷新恢复与资料焦点链路测试

## 当前工作树：`codex/ai-config-presets`

- [x] 目标：把当前 AI 三项裸输入收成“内置 OpenAI-compatible 模板 + 本地用户预设 + 三项可编辑配置”
- [x] 范围边界：不做远端模板仓库、不做云同步、不做完整设置页、不做多协议 provider、不做高级参数面板
- [x] 交付：内置 Gemini 与自定义 OpenAI-compatible 模板，支持模板自动填充 Base URL / 推荐 Model
- [x] 交付：支持本地保存与切换预设，并与现有 `ai.baseUrl / ai.apiKey / ai.model` 本地存储完全兼容
- [x] 交付：补齐模板自动填充、预设保存切换、旧配置兼容、local preference 兼容、运行主链不回归测试
- [x] 交付：同步更新 README / DEV_NOTE / TODO，并补充 TESTING 手工验证步骤

## 下一阶段验证重点

### 结构编辑

- `提升一级 / 降低一级` 是否足够直观
- 节点提升到根层后自动转模块是否自然
- 自动拆分后的重排成本是否足够低

### 学习链路

- `module -> plan-step -> question` 的组织方式是否顺手
- `answer / summary / judgment` 作为独立节点是否真的比区块更好用
- “系统建议完成，但不自动完结”是否能保持节奏感

### 资料引用

- 全局资料区是否容易理解
- `resource-fragment` 的按需生成是否足够轻
- 对照学习与引用回跳是否需要单独的资料阅读区

### 资料导入与自动引用

- URL 抽取失败时的 fallback 是否不打断主流程
- `txt / md` 的正文基础是否足够支撑 fragment 复用与自动创建
- 引用时优先复用 fragment、无法精确定位时退回 `resource` 是否符合用户心智

## 当前风险

- 如果结构视图过重，可能压过文本学习主舞台
- 如果自动拆分质量不稳定，用户会频繁回退结构
- 如果模块与步骤粒度控制不好，首版容易变得过碎
- 如果引用关系展示不清，学习树和资料树会让人迷路
- 如果 URL 导入过度依赖浏览器直连抓取，CORS 与页面可访问性会让自动补全不稳定
- 如果把大段正文直接塞进节点树，工作区快照、搜索和导出会被污染

## 阶段退出条件

进入工程初始化前，至少完成以下事项：

- 页面信息架构确定
- 节点数据结构草案确定
- 资料导入与自动引用的最小实现边界确定
- 文本编辑与结构视图技术路线确定
- 本地存储方案确定
- 基础导出规则确定

## 当前状态补充

当前主线尚未完成完整学习闭环验证。

下一阶段主任务不是继续扩散零散功能，而是先确认并补齐：铺垫讲解、回答评估、资料参与教学、问题递进质量，以及与之对应的步骤状态规则。
