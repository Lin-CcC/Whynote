# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/plan-step-collapsed-summary`
- 当前短期目标：收紧 `plan-step` 折叠态 UI，用紧凑摘要头替代长说明块，同时保持现有步骤折叠语义不变

## 当前短期任务

- 收紧 `plan-step` 折叠态：默认只保留步骤标签、步骤标题、当前状态、轻量折叠摘要和 `展开步骤`
- 去掉折叠态下的长说明块：不再继续显示系统判断长句、正文折叠提示、编辑态说明和子内容
- 保持 `collapsedPlanStepIds`、本地持久化、外部导航自动展开与内部 block/body/history 状态恢复逻辑不变
- 补回归测试，覆盖紧凑摘要头、长提示隐藏、展开恢复与 remount 后的折叠态表现

## 本轮明确不做

- 不扩展到思维导图、资料系统重构、导出系统重做、provider、完整文档式编辑器重构或新的节点类型
- 不改 `plan-step` 折叠语义、本地 view state 结构或外部导航链路
- 不重写已有 question block / body / history 折叠系统，只收紧 `plan-step` 折叠后的摘要头呈现
- 不做新的阅读态或额外的大型交互 redesign，不把这轮扩展到完整文档式编辑器改造
