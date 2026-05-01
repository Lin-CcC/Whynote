# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/v12-document-integration`
- 当前短期目标：完成 V1.2 文档式主视图三棵主树合并后的联调、冲突收口、全量回归与最终文档更新

## 当前短期任务

- 合并 `v12-document-shell`、`v12-document-editing`、`v12-document-toolbar`，并统一主视图结构、标题策略、轻工具栏入口与 follow-up 缩进表现
- 收口 `workspaceEditor/components/*`、`workspaceEditor.css` 与 runtime 对接测试里的契约漂移，确保文档流、连续编辑、轻工具栏能同时成立
- 完成最终自动化基线：`pnpm test`、`pnpm run typecheck`、`pnpm run build`
- 当前代码面已收口完成；若继续推进，只跟进主树合并后的 review feedback，不再额外扩 scope

## 本轮明确不做

- 不扩展新的产品功能，不新增 runtime 路径，不再改资料系统、导出系统、provider 或思维导图
- 不改既有学习树数据结构，不新增节点类型；V1.2 只处理主视图显示层、编辑层和工具栏层的整合
- 不重写 question block / body / history / plan-step 折叠模型，只保证它们在文档式主视图下不回归
