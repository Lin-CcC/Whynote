# Whynote V1.1 Worktree Plan

本文档用于拆分 V1.1 第一轮的并行工作树。

这一轮只实现：

- 问题链条编辑器
- 当前回答语义
- 显式 `sourceId + sourceUpdatedAt` 配对
- 主视图 block 级动作与折叠
- 折叠感知导出

这一轮明确不做：

- 思维导图 / 拖拽编排 / 图形画布视图
- 主视图与导图双表面同步
- `judgment / hint / 查看答案解析` 的主视图重做
- 完整只读 / 编辑双模式
- 快捷键体系 / 命令面板
- 资料区深嵌主视图
- AI 结构整理、重排、压缩等强协同编辑动作

## 并行拆分原则

- 主规格以 [docs/v1.1-question-chain-editor.md](./v1.1-question-chain-editor.md) 为准。
- 三棵工作树可以并行推进，但要尽量遵守写入边界，减少冲突。
- 明确共享契约：
  - `QuestionNode.currentAnswerId`
  - `SummaryNode.sourceAnswerId / sourceAnswerUpdatedAt`
  - `JudgmentNode.sourceAnswerId / sourceAnswerUpdatedAt / sourceSummaryId / sourceSummaryUpdatedAt`
  - `UiPreferences.values.workspaceViews[workspaceId]`
- 推荐合并顺序：
  1. `codex/v11-current-answer-semantics`
  2. `codex/v11-question-block-editor`
  3. `codex/v11-export-expanded-view`

## Worktree 1：当前回答语义与显式配对

- 分支名建议：`codex/v11-current-answer-semantics`
- 目标：
  - 落地 `currentAnswerId`
  - 落地 `sourceId + sourceUpdatedAt`
  - 修正 runtime 以“当前回答”为主路径锚点
  - 增加过期判定与级联清理
- 主要写入范围：
  - `src/features/nodeDomain/domain/*`
  - `src/features/learningEngine/*`
  - `src/features/workspaceRuntime/services/*`
  - 与上述逻辑直接相关的测试
- 不负责：
  - question block 主视图 UI
  - 折叠 UI
  - 导出模式 UI

可直接复制的指令：

```text
你现在负责 Whynote 的 `codex/v11-current-answer-semantics` 工作树，只做 V1.1 第一轮里的“当前回答语义 + 显式 source 配对 + 过期判定 + 级联清理”，不扩展到主视图 block UI、折叠 UI、导出模式、思维导图或资料系统重构。

开始前请先阅读并遵守：
- D:/Computer/Project/VibeCoding/Whynote/agent-instructions
- D:/Computer/Project/VibeCoding/Whynote/README.md
- D:/Computer/Project/VibeCoding/Whynote/DEV_NOTE.md
- D:/Computer/Project/VibeCoding/Whynote/WIP.md
- D:/Computer/Project/VibeCoding/Whynote/TESTING.md
- D:/Computer/Project/VibeCoding/Whynote/docs/v1.1-question-chain-editor.md
- D:/Computer/Project/VibeCoding/Whynote/docs/WORKTREE_PLAN.md

说明：
- 这一棵树只负责“数据契约、runtime 语义、学习结果配对与过期/清理规则”。
- 不要顺手做主视图 question block UI，不要做折叠，不要做导出。

你要统一解决这些问题：

1. `QuestionNode` 需要新增 `currentAnswerId?: string`
2. `SummaryNode` / `JudgmentNode` 需要新增显式 `sourceId + sourceUpdatedAt` 配对字段
3. runtime 默认要围绕“当前回答”工作，而不是围绕“最新 answer”或“当前选中的 answer”
4. 修改当前回答 / 总结后，旧结果要保留但标记为过期
5. 删除或改类型导致源节点失效时，配对结果要级联删除
6. 旧数据需要兼容：缺失新字段时仍可用 legacy heuristic 兜底

请落地下面这些正式规则：

一、`currentAnswerId`
- `QuestionNode` 新增 `currentAnswerId?: string`
- direct answer 生成新 answer 时自动写入
- 手动 `insert-answer` 生成新 answer 时自动写入
- 叶子学习节点切换成 `answer` 时自动写入
- 编辑旧 answer 不会自动升格成当前回答
- `currentAnswerId` 指向的 answer 即使正文为空，也视为“已有当前草稿”
- 当前回答失效时：
  1. 优先回退到树顺序上更靠前的最近一条 surviving answer
  2. 没有则回退到更靠后的第一条 surviving answer
  3. 仍没有则清空 `currentAnswerId`
- 旧工作区首次进入 V1.1 时，如果没有 `currentAnswerId`，默认取“最新有内容 answer”

二、显式配对字段
- `SummaryNode` 新增：
  - `sourceAnswerId?: string`
  - `sourceAnswerUpdatedAt?: string`
  - 仅对 `answer-closure` summary 使用
- `JudgmentNode` 新增：
  - `sourceAnswerId?: string`
  - `sourceAnswerUpdatedAt?: string`
  - `sourceSummaryId?: string`
  - `sourceSummaryUpdatedAt?: string`
- 规则：
  - `answer-closure judgment` 必须写 `sourceAnswerId + sourceAnswerUpdatedAt`
  - `answer-closure summary` 必须写 `sourceAnswerId + sourceAnswerUpdatedAt`
  - `summary-check judgment` 必须写 `sourceSummaryId + sourceSummaryUpdatedAt`
  - 如果某次 summary-check 有明确 answer 上下文，建议一并写 `sourceAnswerId + sourceAnswerUpdatedAt`

三、runtime 语义
- runtime 默认围绕 `question.currentAnswerId` 工作
- 不默认围绕“最新 answer”
- 不默认围绕“当前选中的 answer”
- 旧 `answer-closure` judgment / summary 与当前回答的匹配，优先看 `sourceAnswerId`
- 旧 `summary-check` judgment 与当前手写 summary 的匹配，优先看 `sourceSummaryId`
- 只有缺失这些字段时，才允许 legacy heuristic 兜底

四、过期判定
- 若当前源节点 `updatedAt` 晚于结果节点记录的 `source...UpdatedAt`
- 则该 judgment / 答案解析 / 总结检查结果标记为“过期”
- 过期结果不删除，继续保留
- 但要能被主视图/runtime 明确识别为“建议重新评估/重新检查”

五、级联清理
- 当 answer 被删除，或被切成非 `answer` 类型时：
  - 所有 `sourceAnswerId` 指向它的 answer-closure judgment / summary 一起级联删除
- 当手写 summary 被删除，或被切成非手写总结语义时：
  - 所有 `sourceSummaryId` 指向它的 summary-check judgment 一起级联删除
- 不保留孤儿结果节点

建议重点文件：
- `src/features/nodeDomain/domain/nodeTypes.ts`
- `src/features/nodeDomain/domain/nodeSemantics.ts`
- `src/features/nodeDomain/domain/treeOperations.ts`
- `src/features/learningEngine/adapters/learningTreeAssembler.ts`
- `src/features/learningEngine/services/learningDraftNormalization.ts`
- `src/features/workspaceRuntime/services/learningRuntimeContext.ts`
- `src/features/workspaceRuntime/services/workspaceRuntimeService.ts`

测试要求至少覆盖：
1. `currentAnswerId` 的首次兼容默认值
2. 手动/AI 新 answer 自动晋升当前回答
3. 编辑旧 answer 不自动晋升
4. 删除/改类型导致当前回答失效时的 fallback
5. answer-closure judgment / summary 写入 `sourceAnswerId + sourceAnswerUpdatedAt`
6. summary-check judgment 写入 `sourceSummaryId + sourceSummaryUpdatedAt`
7. 修改当前 answer / summary 后旧结果标记过期
8. 删除 answer / summary 时配对结果级联删除
9. 缺失新字段的旧数据仍能通过 heuristic 兜底

文档更新要求：
- `WIP.md` 写入本棵树的短期目标，完成后清掉执行项
- 如形成长期有效规则，补到 `DEV_NOTE.md`
- 如新增手工验证步骤，补到 `TESTING.md`

完成后请回报：
1. 你最终加了哪些字段
2. `currentAnswerId` 的完整行为规则如何落地
3. 显式配对与过期判定如何实现
4. 级联清理如何实现
5. 你新增了哪些测试证明这条主线成立
```

## Worktree 2：question block 主视图与折叠

- 分支名建议：`codex/v11-question-block-editor`
- 目标：
  - 在主视图引入 question block 编辑表面
  - 当前回答与旧回答分区展示
  - 手写总结 / 答案解析 / 总结检查结果显示语义分开
  - block 级动作与折叠落地
- 主要写入范围：
  - `src/features/workspaceEditor/**`
  - `src/features/workspaceRuntime/WorkspaceRuntimeScreen.tsx`
  - `src/features/workspaceRuntime/components/WorkspaceRuntimeActionCard.tsx`
  - 与主视图 block、折叠、显示语义直接相关的测试
- 不负责：
  - `currentAnswerId` / `source*` 字段设计
  - export 模式
  - mind map

可直接复制的指令：

```text
你现在负责 Whynote 的 `codex/v11-question-block-editor` 工作树，只做 V1.1 第一轮里的“question block 主视图 + block 级动作 + 当前回答/旧回答分区 + 折叠 UI”，不扩展到导出模式、思维导图、资料区深嵌或新的学习节点类型。

开始前请先阅读并遵守：
- D:/Computer/Project/VibeCoding/Whynote/agent-instructions
- D:/Computer/Project/VibeCoding/Whynote/README.md
- D:/Computer/Project/VibeCoding/Whynote/DEV_NOTE.md
- D:/Computer/Project/VibeCoding/Whynote/WIP.md
- D:/Computer/Project/VibeCoding/Whynote/TESTING.md
- D:/Computer/Project/VibeCoding/Whynote/docs/v1.1-question-chain-editor.md
- D:/Computer/Project/VibeCoding/Whynote/docs/WORKTREE_PLAN.md

说明：
- 这棵树只负责主视图 block 组织、动作表面、显示语义、折叠与本地视图状态。
- `currentAnswerId`、`sourceId`、过期判定、级联清理属于另一棵树；这里按既定契约消费，不重做语义设计。

你要统一解决这些问题：

1. 主视图需要从“独立节点列表”提升成“question block 编辑表面”
2. 当前回答与旧回答要明确分区，旧回答默认进入历史折叠区
3. `答案解析 / 总结 / 总结检查结果` 要在显示层彻底分开
4. `question` 相关动作要有 block 级入口，不能继续硬塞进单节点 inline 机制
5. 折叠要支持 block、正文区、历史区，并保存在 workspace 级本地视图状态里
6. 从结构树/搜索/运行时入口选中折叠块内节点时，主视图要自动展开对应 block
7. 左侧 `WorkspaceRuntimeActionCard` 要降为辅助概览，不再抢主路径

请落地这些正式规则：

一、question block
- `question block` 是显示/交互组织，不是新节点类型
- follow-up question 仍是真实子节点
- 主视图允许为 block 做显示层重组：
  - 当前回答及其最新 judgment / 答案解析作为主内容区
  - 旧回答及其历史结果进入历史折叠区
  - 底层树顺序不变
- 当前激活 block 的判定规则：
  - 由当前选中节点向上追溯到最近的 question 决定
  - 选中 `question / answer / judgment / 答案解析 / 手写总结 / 总结检查结果` 中任一节点，都应激活同一个 block

二、block 级动作与节点级动作
- `question block` 级动作只在当前激活 block 上显示：
  - `直接回答当前问题`
  - `插入回答`
  - `插入追问`
  - `插入总结`
- `answer` 节点级动作：
  - `重新评估当前回答`
  - `继续修改`
  - `设为当前回答`（仅对非当前回答显示）
- 手写 `summary` 节点级动作：
  - `检查这个总结`
  - `继续修改`
- 第一轮不要重做 `judgment / hint / 查看答案解析` 的主视图入口，继续复用现有 inline/runtime 入口

三、显示语义
- 不新增节点类型，但显示层必须明确区分：
  - answer-closure `summary` -> `答案解析`
  - manual `summary` -> `总结`
  - summary-check `judgment` -> `总结检查结果`
- 当前回答区默认展示：
  - 当前回答
  - 当前回答对应的最新 judgment / hint / 答案解析
- 旧回答区默认收起，按树里的真实顺序展示其余 answer
- 历史评估与历史总结检查也默认收起

四、折叠
- 支持的折叠粒度：
  - 整个 `question block`
  - `answer / judgment / summary` 正文内容区
  - `早期回答 / 历史评估 / 历史检查结果` 历史区
- 折叠状态存入 `UiPreferences.values.workspaceViews[workspaceId]`
- 不写进 snapshot
- 不复用也不污染左侧 `StructureTree.expandedNodeIds`
- 如果用户从结构树/搜索/运行时入口选中了折叠块内节点：
  - 主视图自动展开对应 block，使目标节点可见

五、左侧 runtime action card
- 保留
- 但角色改成：
  - 当前状态概览
  - 下一步建议
  - 冗余次级入口
- 不再把它作为问答总结链的主操作面

建议重点文件：
- `src/features/workspaceEditor/WorkspaceEditor.tsx`
- `src/features/workspaceEditor/components/TextMainView.tsx`
- `src/features/workspaceEditor/components/EditorNodeSection.tsx`
- `src/features/workspaceEditor/components/SelectedNodeInspector.tsx`
- `src/features/workspaceEditor/hooks/useWorkspaceEditor.ts`
- `src/features/workspaceEditor/workspaceEditor.css`
- `src/features/workspaceRuntime/WorkspaceRuntimeScreen.tsx`
- `src/features/workspaceRuntime/components/WorkspaceRuntimeActionCard.tsx`

测试要求至少覆盖：
1. 当前激活 block 的判定
2. `question block` 级动作只在当前激活 block 上显示
3. 当前回答与旧回答的分区展示
4. `设为当前回答` 的 UI 动作可达
5. `答案解析 / 总结 / 总结检查结果` 三类显示语义
6. block 折叠、正文折叠、历史区折叠
7. 折叠状态跨刷新恢复
8. 从结构树/搜索选中折叠块内节点时自动展开 block
9. 左侧 action card 降级后，主路径仍完整可达

文档更新要求：
- `WIP.md` 写入本棵树短期目标，完成后清掉执行项
- 如形成长期有效 UI / 交互规则，补到 `DEV_NOTE.md`
- 如新增手工验证步骤，补到 `TESTING.md`

完成后请回报：
1. 你如何组织了 question block
2. block 级动作与节点级动作分别放在哪里
3. 当前回答 / 旧回答 / 历史结果是如何展示的
4. 折叠状态如何存放与恢复
5. 你新增了哪些测试证明主视图编辑流已经成立
```

## Worktree 3：折叠感知导出

- 分支名建议：`codex/v11-export-expanded-view`
- 目标：
  - 给现有导出链增加 `仅当前展开内容`
  - 读取 workspace 级本地视图状态中的折叠信息
  - 仅作用于 `current-module / theme`
- 主要写入范围：
  - `src/features/resourcesSearchExport/**`
  - 如有必要，增加读取 workspace view state 的轻量 helper
  - 与导出直接相关的测试
- 不负责：
  - 主视图折叠 UI 本身
  - `currentAnswerId` / `source*`
  - 思维导图

可直接复制的指令：

```text
你现在负责 Whynote 的 `codex/v11-export-expanded-view` 工作树，只做 V1.1 第一轮里的“折叠感知导出”，不扩展到主视图 block UI、当前回答语义、思维导图或资料系统重构。

开始前请先阅读并遵守：
- D:/Computer/Project/VibeCoding/Whynote/agent-instructions
- D:/Computer/Project/VibeCoding/Whynote/README.md
- D:/Computer/Project/VibeCoding/Whynote/DEV_NOTE.md
- D:/Computer/Project/VibeCoding/Whynote/WIP.md
- D:/Computer/Project/VibeCoding/Whynote/TESTING.md
- D:/Computer/Project/VibeCoding/Whynote/docs/v1.1-question-chain-editor.md
- D:/Computer/Project/VibeCoding/Whynote/docs/WORKTREE_PLAN.md

说明：
- 这棵树只负责给现有导出链增加“仅当前展开内容”。
- 不负责主视图折叠 UI；这里只消费另一棵树写入的 `UiPreferences.values.workspaceViews[workspaceId]` 折叠状态。

你要统一解决这些问题：

1. 导出默认仍应保持完整语义
2. 需要增加显式模式：`仅当前展开内容`
3. 第一轮折叠感知导出只对 `current-module / theme` 生效
4. `filtered` 导出不能被折叠语义污染
5. 被折叠的 block / 正文 / 历史区要按固定简单规则裁剪
6. 若缺失 workspace 视图状态，必须安全回退到完整导出

请落地这些正式规则：

一、导出模式
- 现有导出继续保留 `全部内容`
- 新增显式选项：`仅当前展开内容`
- 第一轮仅对：
  - `current-module`
  - `theme`
  生效
- `filtered` 导出维持完整导出语义，不接入折叠状态

二、读取折叠状态
- 从 `UiPreferences.values.workspaceViews[workspaceId]` 读取折叠状态
- 不要从 `RecentWorkspaceState` 读取
- 若没有视图状态，或状态不完整：
  - 安全回退到完整导出

三、展开内容导出规则
- 整个折叠的 `question block`：整块不导
- 折叠的节点正文：导出节点标题/类型，但不导正文
- 折叠的 `早期回答 / 历史评估 / 历史检查结果`：整段历史区不导
- 被省略正文的节点，其附属引用内容也不导
- 第一轮不额外裁剪 root 级资源树；折叠导出只作用于学习链条视图

四、范围边界
- 不做主视图折叠 UI
- 不做 `currentAnswerId` / `source*` 契约
- 不做 mind map / graph view
- 不做新的导出系统，只复用现有导出链

建议重点文件：
- `src/features/resourcesSearchExport/resourcesSearchExportTypes.ts`
- `src/features/resourcesSearchExport/components/ExportPanel.tsx`
- `src/features/resourcesSearchExport/hooks/useResourcesSearchExport.ts`
- `src/features/resourcesSearchExport/services/resourceExportService.ts`
- 如有必要，可新增一个读取 workspace view state 的轻量 helper

测试要求至少覆盖：
1. 默认导出仍是完整内容
2. `current-module` 在“仅当前展开内容”下按折叠规则省略内容
3. `theme` 在“仅当前展开内容”下按折叠规则省略内容
4. `filtered` 导出不受折叠状态影响
5. 缺失或损坏的 workspace view state 时安全回退到完整导出
6. 被折叠正文的节点只导出标题/类型，不导正文与附属引用
7. 整块折叠的 question block 在展开内容导出中完全省略

文档更新要求：
- `WIP.md` 写入本棵树短期目标，完成后清掉执行项
- 如形成长期有效导出规则，补到 `DEV_NOTE.md`
- 如新增手工验证步骤，补到 `TESTING.md`

完成后请回报：
1. 你如何给现有导出链增加了 `仅当前展开内容`
2. 你如何读取并解释 workspace 级折叠状态
3. `current-module / theme / filtered` 三类导出最终分别如何表现
4. 缺失视图状态时如何安全回退
5. 你新增了哪些测试证明折叠感知导出没有破坏现有导出主线
```

## 主仓职责

主仓 / 主工作树当前不直接实现这三部分功能，只负责：

- 维护规格文档
- 派发工作树
- 合并顺序控制
- 冲突协调
- 主线回归验证

## 合并建议

1. 先合 `codex/v11-current-answer-semantics`
2. 再合 `codex/v11-question-block-editor`
3. 最后合 `codex/v11-export-expanded-view`

这样可以让：

- UI 树先拿到稳定的 `currentAnswerId` / `source*` 契约
- 导出树最后对接已经落地的折叠视图状态
