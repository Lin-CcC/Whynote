# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/v13-structure-map-integration`
- 当前短期目标：完成 V1.3 结构地图第一阶段三棵主树合并后的联调、冲突收口、全量回归与最终文档更新

## 当前短期任务

- 合并 `v13-structure-map-shell`、`v13-structure-map-dnd`、`v13-structure-map-sync`，统一结构地图壳层、投影粒度、拖动权限与主视图联动契约
- 收口 `workspaceEditor/**/*`、`nodeDomain/domain/*` 与 `workspaceRuntime/**/*` 的冲突与风格漂移，确保地图展示、拖动写回、视图切换、定位与持久化能一起成立
- 完成最终自动化基线：`pnpm test`、`pnpm run typecheck`、`pnpm run build`
- 当前 integration 已收口完成；若继续推进，只跟进主树合并后的 review feedback，不再额外扩 scope

## 本轮明确不做

- 不扩展新的产品功能，不新增 runtime 路径，不再改资料系统、导出系统、provider 或思维导图
- 不改既有学习树数据结构，不新增节点类型；V1.3 只处理结构地图显示层、拖动写回层和主视图联动层的整合
- 不重写 V1.2 文档式主视图、question block / body / history / plan-step 折叠模型，只保证它们在结构地图接入后不回归
