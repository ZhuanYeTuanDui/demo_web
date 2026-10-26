# 移除工单列表与详情的产品显示

## 基本信息

| 项 | 值 |
| --- | --- |
| 日期 | 2026-10-26 |
| 分支 | `kt` |
| 基线提交 | `fb0b5b9` |
| 需求 | Demo 版本中，新增工单已不再选择产品；工单列表和工单详情也移除产品显示，底层 `product` 数据保留 |

## 允许修改

- `web/src/demo/WorkOrders.vue`
  - 工单列表的“产品”列
  - 工单详情的“产品”描述项

## 明确不动

- `WorkOrder.product` 数据字段
- 新增工单的创建逻辑和默认产品
- 关联生产计划表格中的“产品”列（属于计划，不属于工单）
- 其他页面、模型、测试、样式、依赖
- 空格、缩进、换行、注释

## 计划改动

1. 删除工单列表的“产品”列。
2. 删除工单详情基本信息中的“产品”项。
3. 保留底层数据，不影响计划、发货和已有工单。

## 实际改动

```diff
-      <el-table-column label="产品" min-width="200"
-        ><template #default="{ row }">{{
-          material(row.product)?.name || row.product
-        }}</template></el-table-column
-      >
```

```diff
-        ><el-descriptions-item label="产品">{{
-          material(selected.product)?.name || selected.product
-        }}</el-descriptions-item
```

## 验证

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过 |
| `pnpm type-check` | 通过 |
| `pnpm test:demo --testTimeout=15000` | 23 个测试文件、132 个用例通过 |
| 页面运行 | `http://127.0.0.1:5173/` 返回 200 |
| 浏览器 DOM 验证 | 工单页面中“产品”文本数量为 0 |

## 未改动确认

- `WorkOrder.product` 仍保留，已有工单和发货兜底逻辑不变。
- 关联生产计划表格中的“产品”列保留。
- 新增工单弹窗不再有产品选择控件（上一提交已完成）。

## 回滚

恢复工单列表“产品”列和详情“产品”描述项。
