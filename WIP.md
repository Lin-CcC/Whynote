# WIP

本文档只记录当前短期执行面，不再堆历史工作流水。已稳定的长期规则进入 [DEV_NOTE.md](DEV_NOTE.md)。

## 当前工作面

- 当前工作树：`codex/v13-map-showcase`
- 当前短期目标：完成 V1.3 结构地图真实工作流闭环验证与演示级文档收尾，不再扩 scope

## 当前短期任务

- 基于真实 runtime + IndexedDB 工作区，选一条结构地图可讲述闭环，确认地图拖动后的文档顺序、折叠、`currentAnswerId`、source pairing 与 stale 都不回归
- 新增仓库内演示文档：[docs/v1.3-structure-map-showcase.md](docs/v1.3-structure-map-showcase.md)，沉淀 walkthrough、手工清单、已知边界与简历表述
- 更新 `DEV_NOTE.md`、`TESTING.md`，把“结构地图不只是测试通过，还要可演示验收”补成长期基线
- 跑完当前自动化基线：`pnpm test`、`pnpm run typecheck`、`pnpm run build`
- 这轮收尾完成后，结构地图阶段只跟进 review feedback 或新的主链回归，不再继续扩结构地图能力

## 本轮明确不做

- 不扩展新的产品功能，不新增 runtime 路径，不再改资料系统、导出系统、provider 或思维导图
- 不改既有学习树数据结构，不新增节点类型；V1.3 这轮只做结构地图显示层、拖动写回层和主视图联动层的真实验收与文档收尾
- 不重写 V1.2 文档式主视图、question block / body / history / plan-step 折叠模型，只保证它们在结构地图接入后不回归
