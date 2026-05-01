# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期决策进入 [DEV_NOTE.md](DEV_NOTE.md)，中长期演进进入 [TODO.md](TODO.md)。

## 当前工作面

- 当前工作树：`codex/v11-export-expanded-view`
- 当前短期目标：已完成 V1.1 第一轮“折叠感知导出”，给现有导出链补上 `仅当前展开内容`，并把作用范围收敛在 `current-module / theme`。

## 当前短期任务

- 本轮执行项已清空，等待后续合并与主线回归。

## 本轮明确不做

- 不做主视图折叠 UI 本身，只消费 `UiPreferences.values.workspaceViews[workspaceId]`
- 不重写 `currentAnswerId` / `source*` 契约
- 不扩到思维导图、资料系统重构、导出系统重做或新的学习链逻辑
- 当前工作树：`codex/node-action-completeness`
- 当前短期目标：审查主视图节点动作覆盖面，拆开 AI / 手动追问与总结动作，让 active question block 内的完整动作在子节点选中时仍保持可达，并为工程壳补上可靠的 Delete 删除快捷键。

## 当前短期任务

- 审查 `question / answer / judgment / 答案解析 / 手写总结 / 总结检查结果` 等主视图可选内容节点的动作矩阵，收口“继续编辑 / 生成追问 / 插入追问 / 生成总结 / 插入总结 / 删除”的一致性。
- 把 `生成追问 / 生成总结` 与 `插入追问 / 插入总结` 明确拆开，避免 `插入总结` 继续承担 AI 生成语义。
- 让 active question block 内的 block 级动作不再依赖重新点回 question 本体；选中 answer、judgment、答案解析、手写总结或总结检查结果时，完整动作仍可达。
- 补最小必要的追问来源语义，让从具体内容节点发起的 follow-up question 在后续 direct answer 时还能恢复对应上下文。
- 为工程壳补 `Delete` 快捷键，并加上“焦点不在 input / textarea / select / contenteditable 时才触发”的安全保护。
- 补回归测试，覆盖 active block 动作可达性、AI / 手动动作语义拆分、内容节点追问 / 总结覆盖、空 current answer draft 下动作不丢，以及 Delete 快捷键不误删文本。

## 本轮明确不做

- 不扩到思维导图、资料系统重构、导出系统重做、provider、完整文档式编辑器重构或新的节点类型
- 不重写已有 `question block` / `currentAnswerId` / 显式 source 配对 / 可见性标识的整套底层系统，只补这一轮动作补全所需的最小语义
- 不做与本轮节点动作收口无关的主视图大重排或额外产品化 redesign
