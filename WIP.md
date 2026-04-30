# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期决策进入 [DEV_NOTE.md](DEV_NOTE.md)，中长期演进进入 [TODO.md](TODO.md)。

## 当前工作面

- 当前工作树：`codex/question-block-order-fix`
- 当前短期目标：修复 `question block` 主视图里 `answer / judgment / 答案解析 / 手写 summary / 总结检查结果 / follow-up question` 的链条顺序割裂，只改主视图分组与排序逻辑，不扩展到思维导图、导出、资料系统重构、AI provider、完整阅读态/编辑态系统或新节点类型。

## 当前短期任务

- 修复 question block 内 `answer / closure / follow-up` 被拆开的排序问题。
- 收紧 `currentAnswerId` 的职责边界：只决定当前工作 answer 与视觉强调，不再驱动主视图跨组重排。
- 把历史结果收回各自 answer / summary 组内折叠，替代全局“旧回答 / 历史结果”割裂区。
- 补多 answer、多 closure、summary-check、follow-up 与折叠回归测试。

## 本轮明确不做

- 不做思维导图、导出模式或资料系统重构
- 不重写 `currentAnswerId`、显式 `sourceId + sourceUpdatedAt`、过期判定或 block 激活语义
- 不引入新的学习节点类型，不重做 judgment / hint / 答案解析 入口
