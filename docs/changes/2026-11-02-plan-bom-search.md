# 编辑生产计划 BOM 搜索

- 日期：2026-11-02；基线 081c57d；分支 master。
- 需求：编辑生产计划中移除计划产品显示，原位置改为按物料名称、图号、规格筛选 BOM 的搜索框。
- 允许修改：`web/src/demo/PlanDetails.vue` 的搜索入口、`web/src/demo/PlanMaterialsTable.vue` 的显示筛选及分页、`web/src/demo/round2-production-ui.test.ts` 的回归测试、本记录。
- 保留前轮工单备注改动、已有 `.gitignore` 和资料；不修改生产计划数据、保存规则、依赖及其他页面。

## 计划

1. 在原计划产品位置增加可清空搜索框，将关键词传入 BOM 表格。
2. 仅过滤展示行，搜索变化回到第一页并重置虚拟表滚动；数量编辑和保存使用完整 BOM。
3. 验证名称、图号、规格、无结果、清空与隐藏行输入保留。

## 实际改动与验证

- `PlanDetails.vue:27`、`:160`、`:203`：+4/-2，新增搜索词及输入框，传递给 BOM 表格。
- `PlanMaterialsTable.vue:8`、`:16`、`:31`、`:131`：+11/-4，仅过滤展示行，关键词变化回到第一页并重建虚拟表滚动状态；保存仍使用完整 BOM。
- `round2-production-ui.test.ts:44`：+23/-0，新增名称、图号、规格匹配、无结果、清空、隐藏行数量保留及完整保存测试。
- 针对性测试 6 条通过；全量 `vitest run src/demo`，27 个文件、160 条通过。
- `vue-tsc --noEmit -p tsconfig.demo.json` 通过；`vite build --config vite.demo.config.ts` 通过，仅既有依赖注释及大包提示。
- 直接执行已有 `node_modules/.bin/*.cmd`，未更新依赖。未进行实际浏览器视觉检查。
- `git diff --check` 通过；逐段检查及 `git diff --stat` 确认本轮仅涉及允许文件，其余为前轮和已有改动。

## 回滚

仅还原本轮搜索入口及显示过滤，保留先前改动和用户数据。
