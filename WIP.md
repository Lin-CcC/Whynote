# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/plan-step-folding`
- 当前短期目标：补齐 `plan-step` 的步骤级折叠，让主视图中的步骤卡片可以整体收起/展开，并接入 workspace 级本地 view state 与外部导航自动展开链路

## 当前短期任务

- 补 `plan-step` 步骤级折叠：保留步骤卡片头可见，收起步骤正文与整段子内容
- 把步骤折叠接入 workspace 级本地 view state，状态跨刷新恢复，但不写进 snapshot
- 打通外部导航自动展开：从结构树、搜索或 runtime 入口选中步骤内部节点时，主视图自动展开所属步骤及必要的 block/body/history
- 补回归测试，覆盖步骤折叠、持久化恢复、内部折叠状态保持、外部导航自动展开与非步骤节点回归

## 本轮明确不做

- 不扩展到思维导图、资料系统重构、导出系统重做、provider、完整文档式编辑器重构或新的节点类型
- 不重写已有 question block / body / history 折叠系统，只在其外层补 `plan-step` 折叠
- 不做新的阅读态或额外的大型交互 redesign，只把步骤层折叠补进当前主视图结构
