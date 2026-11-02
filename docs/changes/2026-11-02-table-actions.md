# 操作列四按钮及短名称

- 日期 2026-11-02；分支 master；保留本会话之前所有改动及用户资料。
- 需求：扩大操作列，直接显示四个操作；超两字显示前两字，悬停显示完整名称。
- 允许修改：`web/src/demo/FaTableActions.vue` 直接按钮数量和展示；使用该组件的 WorkOrders、Issues、Production、Shipments、Procurement、Purchases、Receipts、Materials、FinishedInbounds、Drafts 的列表操作列宽度；公共组件测试及相关受影响测试；本记录。
- 计划：统一操作列 240px，直接展示前四个，其他进入更多；完整名称保留在 title 和 aria-label，菜单显示全称；不修改动作或业务逻辑。
- 明确不动：表单内移除按钮列、库存算法、审核、保存和依赖，无关格式及原有改动。

## 实际改动与验证

- `FaTableActions.vue`：前四项直接显示，第五项起进入更多；直接按钮按 Unicode 字符截取前两字，title 和 aria-label 使用完整名称，原 disabled、danger 及点击动作保持。
- 十个使用公共操作组件的业务列表操作列均为 240px；未修改表单内移除按钮列。
- 新增 `FaTableActions.test.ts` 两条测试，验证四按钮、截字、完整提示、禁用及点击行为、第五项折叠且菜单全称。
- 调整 `production-flow-ui.test.ts`、`round2-production-ui.test.ts` 按完整 aria-label 查找截字按钮，保持原业务断言；属于展示变化引起的必要测试接入。
- 全量测试 29 个文件、164 条通过，类型检查通过；构建通过，仅既有依赖注释和大包提示。命令直接使用已有 `node_modules/.bin/*.cmd`，未更新依赖。
- 本轮未进行浏览器视觉验证。差异检查保留前轮改动及已有 `.gitignore`，只修改允许范围。

## 回滚

仅还原本次公共组件展示及列表宽度，不覆盖前轮改动。
