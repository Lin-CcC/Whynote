# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期决策进入 [DEV_NOTE.md](DEV_NOTE.md)，中长期演进进入 [TODO.md](TODO.md)。

## 当前工作面

- 当前工作树：`codex/v11-testability-ui-audit`
- 当前短期目标：审查 current-answer 语义测试文档在工程壳 UI 上的可见性覆盖，补 `当前回答 / 已过期 / 当前结果 / 历史结果 / 配对对象` 的最小可见表达，让主树能直接通过工程壳验证这些语义。

## 当前短期任务

- 审查手工测试文档里的 current-answer / stale / 历史结果 / 级联清理条目，区分当前壳层是可直接验证、部分可验证还是不可验证。
- 在文本主视图与 inspector 上补最小必要状态：`当前回答`、`旧回答`、`当前结果`、`历史结果`、`已过期`、`配对回答 / 检查对象`。
- 调整 question 语境下空 current answer 草稿的动作提示，让壳层明确继续围绕当前草稿，而不是重新退回唯一 `直接回答当前问题` 主动作。
- 补回归测试，覆盖 direct answer / insert-answer / type-switch-to-answer 的 current-answer 标识、stale 标识、历史结果区分，以及删除 / 切型 / 跨题移动后的可见清理效果。

## 本轮明确不做

- 不重写 `currentAnswerId`、显式 source 配对或级联清理的底层语义规则
- 不做新的 question block 重布局、完整历史区折叠体系或产品化 UI redesign
- 不扩到思维导图、资料系统重构、导出重做、provider 或新的学习链逻辑
