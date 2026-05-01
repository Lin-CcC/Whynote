# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/unified-node-collapsed-summary`
- 当前短期目标：统一所有支持正文折叠的内容型学习节点折叠摘要态，让回答 / 判断 / 答案解析 / 总结 / 铺垫在收起正文后都进入同一种紧凑展示

## 当前短期任务

- 为所有已接入 `collapsedNodeBodyIds` 的内容节点建立统一紧凑摘要态：类型标签、标题、必要 badge、短提示、关系提示和 `展开正文`
- 收起正文后隐藏 textarea、长说明、重卡片式留白和编辑态说明，避免不同节点继续各走一套重结构
- 保持 `collapsedNodeBodyIds`、节点动作链、语义 badge 可见性、结构树 / 搜索 / runtime 自动展开逻辑不变
- 补回归测试，覆盖统一折叠摘要、空标题回退、展开恢复、关系提示与 runtime remount 后表现

## 本轮明确不做

- 不扩展到思维导图、资料系统重构、导出系统重做、provider、完整文档式编辑器重构或新的学习链逻辑
- 不改 `plan-step` 折叠语义、本地 view state 结构或外部导航链路；`plan-step` 和 `question block` 继续保留各自层级折叠
- 不重写已有 question block / body / history 折叠系统，只统一内容节点自己的正文折叠态
- 不做新的阅读态或额外的大型交互 redesign，不把这轮扩展到完整文档式编辑器改造
