# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/universal-node-actions`
- 当前短期目标：补齐学习节点通用动作模型，让 `answer / judgment / 答案解析 / 手写总结 / scaffold summary` 都能在主视图里继续追问、总结、修改和删除，而不必频繁退回 `question`

## 当前短期任务

- 统一“有具体内容的学习节点”的通用推进动作：`生成追问 / 插入追问 / 生成总结 / 插入总结 / 继续修改 / 删除`
- 保留节点专属动作：`question / answer / judgment / answer-closure summary / manual summary / scaffold summary` 各自继续保留已有专属入口
- 明确拆开 AI 与手动动作语义：`生成追问/总结` 走 AI 草稿，`插入追问/总结` 只插空节点
- 恢复具体内容节点发起追问后的来源上下文，优先使用 live content，节点不存在时才退回快照
- 收紧主视图动作展示分层，避免把 question block 与节点卡片堆成同权重按钮墙
- 复用现有删除逻辑，保证按钮删除与 `Delete` 快捷键继续对齐
- 补回归测试，覆盖动作可达性、AI/手动分流、来源上下文恢复、节点专属动作保留与删除安全性

## 本轮明确不做

- 不扩展到思维导图、资料系统重构、导出系统重做、provider、完整文档式编辑器重构或新的节点类型
- 不重写已有 question block / currentAnswerId / 导出 / 可见性 / 排序 的整套底层系统，只补这轮动作模型缺口
- 不做额外的大型交互 redesign，只做足够清晰的动作分层与可达性收口
