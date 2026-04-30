# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期决策进入 [DEV_NOTE.md](DEV_NOTE.md)，中长期演进进入 [TODO.md](TODO.md)。

## 当前工作面

- 当前工作树：`codex/v11-question-block-editor`
- 当前短期目标：完成 V1.1 第一轮的 question block 主视图、block 级动作、当前回答 / 旧回答分区、显示语义拆分、折叠 UI 与 workspace 级本地视图状态，不扩展到导出模式、思维导图、资料区深嵌或新节点类型。

## 当前短期任务

- 当前执行项已完成；question block 主视图编辑流、折叠状态持久化、自动展开回流、左侧 runtime action card 降级与回归测试已落地，等待下一轮回归或反馈。

## 本轮明确不做

- 不做导出模式、思维导图、资料区深嵌或新的学习节点类型
- 不重做 `currentAnswerId`、`sourceId`、过期判定与级联清理语义
- 不把左侧 runtime action card 重新抬回问答总结链主操作面
