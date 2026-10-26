# 隐藏新增生产计划入口并添加变更控制 Skill

## 基本信息

| 项 | 值 |
| --- | --- |
| 日期 | 2026-10-26 |
| 分支 | `kt` |
| 基线提交 | `e51e93d` |
| 需求 | 先隐藏“生产计划”页的新增生产计划入口；为项目添加每次修改必须记录、且只改需求相关代码的 Skill |

## 允许修改

- `web/src/demo/Production.vue`：仅给“新增生产计划”按钮增加隐藏指令
- `docs/changes/TEMPLATE.md`：新增记录模板
- `docs/changes/2026-10-26-remove-workorder-product-selector.md`：补记上一需求
- `docs/changes/2026-10-26-hide-add-production-plan.md`：本记录

## 明确不动

- 生产计划列表、筛选、导入 Excel、计划详情、审核、领料、完工等逻辑
- “新增生产计划”弹窗本身及其脚本
- 其他页面、模型、样式、测试、依赖
- 除目标按钮外的空格、缩进、换行、注释

## 计划改动

1. 给“新增生产计划”按钮增加 `v-show="false"`，只隐藏入口，不删除功能代码。
2. 新增 `change-control` Skill，约束后续修改先写记录、只改需求相关代码。
3. 新增记录模板和本次/上次修改记录。

## 实际改动

`web/src/demo/Production.vue`：

```diff
-        <el-button type="primary" :icon="Plus" @click="openEditor()">新增生产计划</el-button>
+        <el-button v-show="false" type="primary" :icon="Plus" @click="openEditor()">新增生产计划</el-button>
```

新增文件：

```text
.agents/skills/change-control/SKILL.md
docs/changes/TEMPLATE.md
docs/changes/2026-10-26-remove-workorder-product-selector.md
docs/changes/2026-10-26-hide-add-production-plan.md
```

已跟踪文件统计：

```text
web/src/demo/Production.vue | 2 +-
web/src/demo/WorkOrders.vue | 8 --------
2 files changed, 1 insertion(+), 9 deletions(-)
```

`WorkOrders.vue` 的 8 行删除属于上一需求，本次未再改动。

## 验证

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过（退出码 0） |
| `git diff --stat` | `Production.vue` 1 行修改；`WorkOrders.vue` 8 行删除（上一需求） |
| `pnpm type-check` | 通过 |
| `pnpm test:demo --testTimeout=15000` | 23 个测试文件、132 个用例通过 |
| 页面运行 | `http://127.0.0.1:5173/` 返回 200 |
| 浏览器 DOM 验证 | `新增生产计划` 按钮渲染为 `style="display: none;"` |

## 未改动确认

- 只给一个按钮增加了 `v-show="false"`，没有删除按钮或弹窗代码。
- 生产计划其他功能未改。
- 新增文件均为 Skill 与变更记录，不涉及业务代码。
- 工作区原有的新增工单产品选择控件删除属于上一需求，本次未再改动。

## 回滚

- 移除按钮上的 `v-show="false"`。
- 删除新增的 Skill 和记录文件。
