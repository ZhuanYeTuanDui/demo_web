# 新增工单弹窗移除产品选择控件

## 基本信息

| 项 | 值 |
| --- | --- |
| 日期 | 2026-10-26 |
| 分支 | `kt` |
| 基线提交 | `e51e93d` |
| 需求 | 新增工单弹窗中不再提供产品选择，其他功能与代码行保持不变 |

## 允许修改

- `web/src/demo/WorkOrders.vue`：仅删除“新增工单”弹窗里的 `<el-form-item label="产品">` 代码块

## 明确不动

- `WorkOrders.vue` 其他模板、脚本、样式
- `form.product` 默认值 `FG001`
- `products` 计算属性
- 其他页面、模型、测试、依赖
- 空格、缩进、换行、注释

## 计划改动

1. 删除新增工单弹窗中的产品选择控件。
2. 保留 `form.product` 默认值，创建逻辑不变。

## 实际改动

```diff
-        <el-form-item label="产品" required
-          ><el-select v-model="form.product" filterable
-            ><el-option
-              v-for="p in products"
-              :key="p.id"
-              :label="p.name"
-              :value="p.id" /></el-select
-        ></el-form-item>
```

改动规模：

```text
1 file changed, 8 deletions(-)
```

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm type-check` | 通过 |
| `pnpm test:demo --testTimeout=15000` | 23 个测试文件、132 个用例通过 |
| 页面运行 | `http://127.0.0.1:5173/` 返回 200 |

## 未改动确认

- 新增工单的其他字段、校验和创建逻辑未改。
- 新工单仍使用默认产品 `FG001`。
- `products` 计算属性保留，未删除。
- 其他文件无代码改动。

## 回滚

恢复被删除的 `<el-form-item label="产品" required>` 代码块。
