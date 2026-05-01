# DEV_NOTE

本文档只记录长期有效的产品与架构决策，不记录阶段性任务流水。所有短期执行事项放在 [WIP.md](WIP.md)。

## 2026-04-26 决策基线

### 1. 产品形态：Web 优先

- 首版优先验证浏览器内学习体验
- 不把桌面壳作为 MVP 必需项
- 如未来确认长期高频个人使用，再评估 Tauri 或其他桌面封装

### 2. 目标人群：个人自用优先

- 产品最初服务个人学习流程
- 不以公开商用或团队协作为首版目标
- 所有首版权衡都优先保证学习链路与结构编辑体验

### 3. 技术基线

- React + Vite + TypeScript
- Node.js >= 24
- pnpm
- Vitest

当前仓库文档先行，后续代码与脚本命名、目录结构应与这套基线保持一致。

### 4. 节点统一，但必须语义分型

Whynote 保持“万物皆节点”的产品哲学，但系统层不能只有普通节点，必须显式区分类型。

首版节点类型：

- `theme-root`
- `module`
- `plan-step`
- `question`
- `answer`
- `summary`
- `judgment`
- `resource`
- `resource-fragment`

### 5. 根层语义

- `theme-root` 的直接子级只允许 `module` 和 `resource`
- 普通内容节点通过“提升一级”到达根节点直接子级时，自动获得 `module` 语义
- 该转换保留原有子树、标签、引用与排序

### 6. 模块生成策略

模块由系统先生成，再由用户轻量修正，不把“自定义模块数量”作为首版重入口。

学习模式基线：

- `快速`：2-3 个模块，每个 2-3 个步骤
- `标准`：3-5 个模块，每个 3-5 个步骤
- `深度`：4-7 个模块，每个 4-6 个步骤

默认模式为 `标准`。

### 7. 学习计划进入节点树

- `plan-step` 是正式节点，不是独立面板
- 学习内容默认挂在当前步骤下
- `plan-step` 编辑时可见
- 导出时默认隐藏步骤标题，但保留其子内容并并入模块正文
- 用户可显式选择导出完整学习路径

### 8. 复合问题自动拆分

- 用户输入复合问题后默认自动拆分
- 原句保留为父 `question`
- 子问题显式生成且可编辑
- 排序优先按理解依赖，低置信度时退回原句顺序
- 结构可由用户通过拖拽和升降级覆盖

### 9. 步骤完成状态

- `plan-step` 的完成状态以用户手动确认为准
- 系统可给出“建议完成”提示
- 系统不自动将步骤置为完成

### 10. 资料区全局化

- 资料源统一放在根节点下的全局资料区
- `resource` 承接资料标题、概况、来源信息与后续正文基础
- 模块与学习内容通过引用连接资料，不复制原文
- `resource-fragment` 作为稳定引用锚点按需生成

优先触发场景：

- 用户主动摘录
- 系统生成引用定位
- 搜索命中后需要固定片段引用

### 11. 搜索作用域

- 默认作用域是当前模块
- 搜索无结果时不自动扩大全主题
- 用户主动切换后，才进入全主题或资料区搜索

### 12. 标签策略

- 所有节点都允许打标签
- 首版内建标签至少包括：
  - `重要`
  - `未理解`
  - `待验证`
  - `待整理`
- 导出按标签筛选时，应保留命中节点及必要祖先路径

### 13. 存储分工

- `IndexedDB`：工作区、模块、节点树、资料元数据、资料正文基础、引用关系、标签状态
- `localStorage`：设置项、最近打开状态、界面偏好

不要把结构化学习数据放进 `localStorage`。

### 14. AI 接入策略

- 首版采用用户自填 OpenAI-compatible 配置
- 应用内至少支持：
  - `base URL`
  - `API key`
  - `model`
- 当前配置体验采用“两层模型”：
  - 内置 OpenAI-compatible 厂商模板
  - 本地用户预设
- 模板层与预设层继续保持分工：
  - 模板只提供厂商默认壳子与推荐 model，不保存用户密钥
  - 预设保存用户自己的本地配置实例，用于后续直接切换
- “当前配置（未保存）”与“已保存预设”必须严格区分：
  - 只有当当前配置与某个预设完全一致，且用户显式选中它时，界面才显示为该预设
  - 手动修改 `base URL / API key / model`、切换模板或删除当前选中预设后，界面都应回到“当前配置（未保存）”语义
- 删除预设不影响当前运行配置，只影响后续切换入口：
  - 删除普通预设时，当前字段值保持不变
  - 删除当前选中预设时，当前字段值同样保持不变，但 UI 必须解除该预设的选中态并回到未保存语义
- 首版不采用远端模板仓库，不做云同步预设
- 原因：
  - 当前配置面仍然极简，主要目标是先解决用户需要自己搜索 base URL 的问题
  - 当前底层仍只有单一 OpenAI-compatible 请求通道，模板层必须和现有请求层保持一致
  - 本地预设已经足够覆盖个人使用场景，不需要提前把配置扩成完整设置中心
  - 这样既能为后续 provider 扩展留空间，也不会在首版提前复杂化
- 界面层不要直接散落模型调用，后续要保留切到后端代理的空间

### 15. 资源自动处理走独立 ingest pipeline

- `resource` / `resource-fragment` 继续作为对用户可见的正式节点，不为了导入阶段临时状态新增更多树节点类型
- 导入动作先创建 `resource` 壳节点，再由 ingest pipeline 异步补齐标题、概况、来源信息、正文基础与候选 fragment
- 自动处理结果必须可重试、可回退，且尊重用户手动覆盖；用户改写后的标题 / 概况不能被后台重跑静默覆盖
- 当前已有 `resourceMetadata` 投影是优先扩展点，可承接 `importMethod / ingestStatus / canonicalSource / contentHash / titleSource / summarySource` 等轻量状态
- 大体量正文、解析中间结果与索引不要直接塞进节点树或 `localStorage`；如需要持久化，优先走 `IndexedDB` 的独立 resource body / index record

### 16. URL 导入与本地上传分开处理

- URL 导入重点是来源规范化与网页抽取：保存用户输入 URL，尝试补 canonical URL、站点信息、页面标题与可读正文
- 在当前 Web 优先形态下，URL 抽取要接受浏览器直连、站点可访问性与 CORS 的现实限制；抽取失败时保留 `resource` 壳并退回手动补录，而不是阻塞资料创建
- 本地上传首版优先 `txt / md`，因为可直接读取正文并建立稳定的正文基础；标题可来自文件名或首级标题，概况可来自正文摘要
- `PDF / DOCX` 进入后续层，不要为了首版 ingest 方案先把解析链路做复杂

### 17. fragment 去重与复用策略

- `resource-fragment` 不新增并列节点类型；系统生成、用户补录、候选片段的差异优先放在 metadata / provenance 层
- 学习运行时在创建新 fragment 之前，必须先在同一 `resource` 下尝试按定位信息、规范化 excerpt 和相似文本复用现有 fragment
- 如果只能确定“引用了这份资料”，但无法稳定定位片段，就退回 `resource` 级引用，不要伪造 fragment 精度
- fragment 的稳定身份优先由 `sourceResourceId + locator/anchor + normalized excerpt hash` 组合确定，便于去重与回跳
- 手动补录 fragment 也应走同一去重规则，避免用户一键补出多个语义重复的摘录节点

### 18. 资料自动处理与学习运行流的边界

- ingest pipeline 负责导入、解析、摘要、候选 fragment 生成与资源级索引，不负责 `module / question / answer` 的直接编排
- learning runtime 只消费已经就绪的 `resource` 摘要、正文基础和 fragment 索引，并在需要时调用“引用解析”服务创建或复用 fragment
- `answer` 已与 `question / summary / judgment` 一样允许引用资料；后续扩展继续复用同一套引用图、fragment 复用和 resource 回退规则
- editor / runtime UI 不应直接内嵌文件解析或网页抓取逻辑，避免资料处理时序与学习交互耦合
- 当某份资料尚未处理完成时，学习流仍可先引用 `resource` 级信息继续工作；fragment 级精确引用是增强，而不是阻塞条件

### 19. 学习闭环实现的知识基线

学习闭环不是单点功能，而是“结构化生成 + 运行时编排 + 状态推导 + 持久化恢复”的组合问题。后续继续迭代 `learning-loop-closure` 时，至少要掌握下面这些编程知识与实现原则：

- 结构化 AI 输出合同：不要把模型输出当自然语言段落直接消费，而要把它当成受约束的 JSON 草案处理。`prompt` 层要明确字段、节点角色、最小内容要求和允许的引用形态；实现上要接受模型会漏字段、改字段名、给空内容，因此必须有 `parse -> normalize -> fallback` 链路，而不是只做一次 `JSON.parse`。
- 归一化与弱输出修复：模型输出质量不稳定时，不能把“生成质量”完全外包给模型。代码里要有规范化器负责做别名兼容、默认值补齐、标题去重、最小内容扩写、坏输出兜底。这本质上是数据清洗和容错编程，不是单纯文案润色。
- 树结构语义推导：当前阶段 `铺垫` 继续复用 `summary` 节点落树，但业务语义并不等于回答后的 `summary`。这类差异需要通过共享语义 helper 从树位置和父子关系推导，避免 editor、runtime、搜索、导出各自写一套判断逻辑而漂移。
- 状态机与派生状态：`plan-step` 的 `todo / doing / done` 不是静态字段，而是由学习证据派生出的运行时状态。实现时要区分“观察性 evidence”和“真正驱动状态迁移的 evidence”，避免把骨架丰富度误判成学习进展。这类问题本质上属于有限状态机和派生数据建模。
- 事件驱动的运行时编排：用户提交 `answer` 后，系统还要串起 `judgment`、`summary`、可选 `follow-up question`、选中项推进与状态刷新。这里依赖的是一条明确的副作用流水线：输入动作、AI 调用、节点插入、引用挂接、状态重算、UI 焦点更新，任何一步混入视图层都容易导致时序错乱。
- 引用图与可回退精度：资料参与教学时，不只是“挂一个链接”，而是维护 `resource` / `resource-fragment` 与学习节点之间的引用图。实现上要支持精度退化：能稳定定位就用 `fragment`，定位不稳就退回 `resource`。这要求开发者理解稳定标识、去重策略和持久化恢复，而不是把引用当一次性 UI 装饰。
- Provider 适配与错误分层：AI 失败不等于“模型不会答”。适配层要区分 HTTP 失败、返回体非 JSON、JSON 结构不合约、内容质量不足这几类错误，并分别给出可诊断反馈。否则 runtime 很容易把服务故障误报成生成质量问题。
- 回归测试设计：这条链路的关键风险不是类型错误，而是语义退化。测试不能只覆盖 happy path，还要覆盖一句话铺垫、空泛问题、纯问题拆分误推进状态、question-only citation 误判进展、回答不足时追问缺失等坏例。建议同时保留 unit test 和 runtime integration test：前者固定 normalize / 状态规则，后者固定真实交互路径。
- 质量控制面优先级：如果目标是稳定产品内生成质量，首选控制面永远是 `prompt + normalization/validator + runtime assembly + tests`。团队侧 `skill` 可以沉淀协作规范和 review rubric，但它不是产品 runtime 的主约束来源，不能替代代码路径里的硬规则。

### 20. 资源删除策略

- `resource` 和 `resource-fragment` 都允许删除；即使已经存在引用，也不应直接禁止，必须先展示影响确认。
- 删除 `resource` 时继续复用现有 `deleteNode(...)`，由它负责删除 fragment 子树并清理相关 references，不再单独重写树删除逻辑。
- 删除资料只会移除资料节点、摘录节点和对应资料引用，不会删除学习节点本身；学习节点只是失去对应资料依据。

### 21. 工程壳层交互基线

- 文本主视图继续使用“点击卡片选中、点击输入框编辑”的轻量交互，不扩成完整只读 / 编辑双模式。
- 节点编辑态只允许由该节点自己的 `input / textarea / select` 驱动；祖先卡片不能因为子孙输入框获得焦点而一起进入“编辑中”状态。
- 输入期间允许侧栏上下文和保存状态继续刷新，但这些区域不应参与主编辑视图的滚动锚点，避免编辑时出现窗口回跳。
- runtime 壳层每种语境只保留一个明显主动作；其余动作降级为辅助动作，避免左侧动作卡和正文内联动作同时抢主路径。
- 运行状态区只承担两件事：系统现在忙不忙、最近一条动作结果是什么；不要把长教学说明继续堆进状态卡。

### 22. question 语境的 direct answer 语义

- `插入回答` 继续只表示“我自己补一条 answer 节点”，保留为手动编辑入口，不再兼任 AI 自动起答语义。
- `直接回答当前问题` 只存在于 runtime 的 `question` 语境里，表示“让 AI 先生成一版普通 answer 草稿”，生成后直接接回现有 answer-revision 闭环。
- hand-authored question 与 system-generated question 统一按节点语义工作：只要当前选中节点是 `question` 且还没有可评估 `answer`，就走同一条 direct answer 入口，不按来源分叉。

### 23. 手动 insert-summary 的默认 placement 语义

- 手动 `insert-summary` 默认落在当前 `question` 闭环链条尾部，也就是该 `question` 子节点列表的最后，而不是插到前面的 `answer / judgment / summary` 中间。
- 这条规则只约束手动插入的 `summary`；系统生成的 answer closure 仍按既有闭环装配顺序落位。
- `summary` 继续复用同一节点类型，通过 `summaryKind` 区分 `manual / scaffold / answer-closure`，避免为了 placement 或 runtime 语义再扩节点类型。

### 24. 插入回答 / 直接回答当前问题 / 检查这个总结 的分工

- `插入回答` 只负责手动补一个普通 `answer` 节点，不承担 AI 起草语义。
- `直接回答当前问题` 只在 runtime 的 `question` 语境里出现，表示让 AI 先生成一版普通 `answer`，随后继续接回 answer evaluation 主链。
- `检查这个总结` 只针对手写 `summary` 的理解质量，返回“说对了什么 / 还缺什么 / 哪些地方可能理解偏了 / 下一步先补哪层”，不自动生成 follow-up question，也不误走普通 answer closure。
- summary check 的结果继续复用 `judgment` 节点承载，但 runtime 必须按独立语义处理，不能把它当成普通 answer evaluation judgment。

### 25. 节点类型切换的安全边界

- 只允许对无子节点的叶子学习节点做轻量切换，首版仅覆盖 `question / answer / summary / judgment`。
- 切换前必须通过当前父节点约束校验；不合法类型只能禁用，不做强转。
- 切换时保留标题、正文、引用、标签和顺序；只重写节点 type 与必要的语义标记，不做复杂子树变形。
- `summary` / `judgment` 切换后要补齐 `summaryKind` / `judgmentKind`，保证后续 runtime 判断不靠脆弱位置猜测。

### 26. 侧栏动态文案的稳态约束

- 左右侧栏里会随着输入实时刷新的上下文文案，不能靠自然增高或提示块反复出现 / 消失来传递状态；否则会把下方卡片一起顶动，制造明显侧栏抖动。
- `StructureActionBar`、`SelectedNodeInspector`、学习节点引用上下文和运行状态卡这类高频刷新块，默认使用固定文本槽位、clamp 或局部可滚动明细承接长标题 / 长路径 / 长状态文案，不改变卡片 box model。
- inspector 已单独展示 `主题` 时，`路径` 不再重复带一遍 theme-root 标题；侧栏上下文优先展示必要信息，而不是堆重复路径。

### 27. question 闭环的当前回答、显式配对与结果失效规则

- `question` 的运行时默认锚点是 `currentAnswerId`，不是“最新 answer”，也不是“当前选中的 answer”。
- `currentAnswerId` 指向的 `answer` 即使正文为空，也视为当前草稿；只有删除、移走或切成非 `answer` 时才失效。
- 新生成的 direct answer、手动 `insert-answer` 生成的 answer，以及叶子节点切成 `answer` 的结果，都会自动晋升为 `currentAnswerId`；编辑旧 answer 不会自动升格。
- `currentAnswerId` 失效后的回退顺序固定为：先找树顺序上更靠前且最近的 surviving answer；没有再找更靠后的第一条 surviving answer；仍没有才清空。
- `answer-closure` 的 `summary / judgment` 必须显式记录 `sourceAnswerId + sourceAnswerUpdatedAt`；`summary-check` 的 `judgment` 必须显式记录 `sourceSummaryId + sourceSummaryUpdatedAt`，若存在明确 answer 上下文，建议同时记录 answer source。
- runtime 在匹配旧闭环结果时，优先使用显式 `source...Id`；只有旧数据缺失这些字段时，才允许退回 legacy heuristic。
- 当源节点当前 `updatedAt` 晚于结果节点记录的 `source...UpdatedAt` 时，该结果进入“过期但保留”状态，供 runtime / 主视图提示“建议重新评估 / 重新检查”。
- 当 answer 被删除或切成非 `answer` 时，所有 `sourceAnswerId` 指向它的 answer-closure `summary / judgment` 一律级联删除；当手写 `summary` 被删除或切成非手写总结语义时，所有 `sourceSummaryId` 指向它的 `summary-check judgment` 一律级联删除，不保留孤儿结果节点。

### 28. question block 主视图是显示层重组，不是新节点类型

- `question block` 只存在于主视图显示与交互层；底层树仍然只有 `question / answer / summary / judgment` 等真实节点，follow-up question 继续作为真实子节点存在。
- 主视图允许围绕当前激活 `question` 做显示重组，但不改写底层树顺序；重组目标是还原真实学习链，而不是制造“当前回答区 / 旧回答区 / 全局历史结果区”这种跨组搬运。
- `currentAnswerId` 只决定当前工作 answer、runtime 主路径、节点强调与“当前结果”归属，不再决定 question block 内 answer group 的前后顺序。
- 每条 `answer` 必须与它自己的 `judgment / 答案解析` 就近显示；每条手写 `summary` 必须与它自己的 `summary-check judgment` 就近显示；不要把旧 answer 的 closure 结果挤到后续 answer 或 follow-up 下面。
- `answer-closure summary` 必须显示为 `答案解析`，手写 `summary` 必须显示为 `总结`，`summary-check judgment` 必须显示为 `总结检查结果`；不要再把这三类内容混到一个“总结”语义里。
- block 级动作只挂在当前激活 block：`直接回答当前问题`、`插入回答`、`插入追问`、`插入总结`。`answer` 与手写 `summary` 的继续修改、评估、设为当前回答、检查总结等动作继续留在对应节点卡片上。
- 左侧 `WorkspaceRuntimeActionCard` 保留为“状态概览 + 下一步建议 + 冗余入口”，不再和主视图 question block 一起争夺问答总结链的主操作路径。

### 29. question block 折叠状态属于 workspace 级本地视图状态

- `question block` 整体折叠、`answer / judgment / summary` 正文折叠、组内历史区折叠，统一存入 workspace 级本地视图状态。
- 这类折叠状态只属于当前 workspace 的本地视图偏好，不写入 snapshot，不参与结构树持久化，也不能复用 `StructureTree.expandedNodeIds`。
- 默认语义要区分“默认展开”和“默认收起”：block 与正文用 `collapsed...Ids` 表达，历史区用 `expandedHistorySectionIds` 表达，避免把默认收起的历史区误持久化成“已折叠”。
- 历史折叠必须收回各自 answer / summary 组内；不要再维护一个把旧回答本体和旧 closure 结果拆开的全局历史区。
- 来自结构树、搜索或 runtime 入口的外部选中必须反向驱动主视图自动展开：如果目标节点位于折叠 block、折叠正文或折叠历史区内，主视图需要自动把对应区域展开到可见，而不是要求用户先手工找回入口。

### 30. 工程壳手工验收必须显式展示关键 runtime 语义

- 只要某条 runtime 语义会影响手工验收结论，就不能只停留在数据层或 action 文案里；工程壳主视图必须给出最低限度、稳定、可直视的状态标识。
- `question` 语境下必须显式看得出哪条 `answer` 是当前回答。最低要求是：
  - 当前 `answer` 卡片有明确 `当前回答` 标识。
  - question 自身能看见 `当前回答：...` 的关系提示。
  - 非当前回答至少要能区分成 `旧回答`。
- 结果节点必须同时暴露“是否当前轮”和“是否过期”两套语义：
  - 当前轮结果显示 `当前结果`。
  - 非当前轮结果显示 `历史结果`。
  - 源内容已改但结果仍保留时，必须额外显示 `已过期`。
- 显式配对语义如果要支持删除 / 切型 / 跨题移动后的手工验收，主视图至少要能看见轻量关系提示，例如 `配对回答：...` 或 `检查对象：...`；否则主树无法确认被清理的到底是哪一组结果。

### 31. 导出默认保持完整语义，折叠感知只作为显式裁剪模式

- 现有导出默认继续是 `全部内容`，不能因为主视图折叠状态改变默认导出语义。
- `仅当前展开内容` 必须是显式模式，第一轮只作用于 `current-module / theme`；`filtered` 导出继续固定为完整语义。
- 折叠感知导出只读取 `UiPreferences.values.workspaceViews[workspaceId]`，不读取 `RecentWorkspaceState`。
- 只有拿到完整的 workspace view state（`collapsedQuestionBlockIds / collapsedNodeBodyIds / expandedHistorySectionIds` 三项都有效）时，才允许按折叠规则裁剪；缺失、损坏或不完整时必须安全回退到完整导出。
- 第一轮裁剪规则固定为：
  - 整个折叠的 `question block` 不导出
  - 折叠正文的 `answer / judgment / summary` 只导出标题与类型，不导正文、标签或附属引用内容
  - 未展开的 `历史评估 / 历史检查结果` 不导出
  - root 级资料树不因学习链条折叠而额外裁剪
### 32. active question block 的 block 级动作不依赖重新选中 question 本体

- active question block 继续按“当前选中节点向上追溯到最近的 `question`”确定；既然 active block 已经这么算，block 级动作面也必须跟着这个 active block 工作。
- 只要当前选中节点仍属于同一个 active question block，`插入回答 / 生成追问 / 插入追问 / 生成总结 / 插入总结` 等 block 级动作就不能消失，不允许要求用户重新点回 question 本体才能继续主编辑流。
- 对 `answer / judgment / 答案解析 / 手写总结 / 总结检查结果` 这类 question block 内的真实内容节点，主视图动作优先收口到同一套 block 级动作面；节点卡片只保留各自语义独有的继续编辑、评估、检查、设为当前回答等局部动作。

### 33. `生成追问 / 生成总结` 与 `插入追问 / 插入总结` 的语义分工

- `生成追问` / `生成总结` 明确属于 AI 动作：前者让 AI 基于当前上下文起一条新的 follow-up question，后者让 AI 围绕当前内容生成一条阶段性总结草稿。
- `插入追问` / `插入总结` 明确属于手动插入动作：只插入空节点，由用户自己写，不再隐含 AI 起草语义。
- `插入总结` 生成的永远是手写 `summary`，不能再借壳触发 AI，也不能和 `answer-closure summary`（答案解析）混成同一件事。
- 当用户是从某条具体内容节点上发起 `生成追问` 或 `插入追问` 时，系统要保留最小必要的来源上下文，保证后续 `直接回答当前问题` 时还能接住这条具体来源，而不是把追问当成脱离上文的新题。
- `生成总结` 作用在 question block 内的具体内容节点时，默认语义是“对当前这条内容做阶段性总结”，不是自动退回整棵 question tree，也不是默认等同于 answer-closure。

### 34. Delete 快捷键的安全触发条件

- 工程壳允许用 `Delete` 作为最低摩擦的删节点快捷键，但只能在“当前有选中节点卡片，且焦点不在 `input / textarea / select / contenteditable` 里”时触发。
- 如果焦点在文本编辑控件内，`Delete` 必须继续只处理文本删除，不得提升成结构删除动作。
- 快捷键删除继续复用现有删除入口与保护逻辑；这轮只补最小删除快捷键，不额外扩展成完整快捷键系统。

## 后续需要重新评估这些决策的触发条件

- 需要公开注册或公开商用
- 需要云同步与多设备共享
- 需要团队协作或权限控制
- 本地存储规模与浏览器限制开始影响体验
- 单纯树结构已无法表达关键跨模块关系
