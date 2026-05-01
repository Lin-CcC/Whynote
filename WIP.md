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
