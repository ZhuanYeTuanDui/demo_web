# FaManagementList

标准业务列表页外壳，视觉和交互以设备管理页为基准，统一提供：

- 搜索表单及查询、重置按钮；
- 新增和批量删除工具栏；
- 多选表格、加载状态和空状态；
- `10 / 20 / 50 / 100` 分页；
- 搜索显隐、刷新、表格密度、全屏、列设置和表格外观设置；
- 桌面端和移动端布局。

组件只负责列表通用行为。页面继续负责请求、查询模型、删除确认、权限判断、业务表格列和新增/编辑弹窗。行内操作继续使用 `FaTableActions`。

```vue
<template>
  <FaManagementList
    v-model:page="query.page_no"
    v-model:page-size="query.page_size"
    :rows="rows"
    :total="total"
    :loading="loading"
    :show-create="canCreate"
    :show-batch-delete="canDelete"
    empty-text="暂无设备"
    @search="load"
    @reset="resetQuery"
    @create="openCreate"
    @batch-delete="removeRows"
    @page-change="load"
    @refresh="load"
  >
    <template #filters>
      <ElFormItem label="设备编号">
        <ElInput v-model.trim="query.code" clearable @keyup.enter="load" />
      </ElFormItem>
    </template>

    <ElTableColumn prop="code" label="设备编号" min-width="150" />
    <ElTableColumn label="操作" width="160" fixed="right" align="center">
      <template #default="{ row }">
        <FaTableActions :actions="rowActions(row)" />
      </template>
    </ElTableColumn>
  </FaManagementList>
</template>
```

## 约定

- `rows` 中每一行必须能通过 `row-key` 得到稳定的字符串或数字 ID，默认字段为 `id`。
- `reset` 事件中由页面清空查询条件并重新请求；组件会先将页码重置为 1。
- `batch-delete` 只通知页面选中的 ID 和行；页面必须显示业务确认弹窗并调用删除接口。
- 权限由页面通过 `show-create`、`show-batch-delete` 控制，不能只依赖按钮隐藏，后端仍需校验。
- 右侧工具栏复用 `FaTableHeader`。使用配置化列时通过 `v-model:columns` 传入 `ColumnOption[]`，即可启用列显隐和排序；使用插槽列时组件会自动隐藏无效的列设置按钮。
- `refresh` 事件由页面重新请求当前分页；搜索图标由组件直接控制筛选区显隐。
- 已迁移设备管理（含 `DeviceDataPage` 子页）、菜谱分类/菜系/授权、食材列表/分类、订单列表、国内/海外客户、VIP 等级的主列表。微信支付配置为表单页，保留独立表单布局。
- 配置化列表可使用同目录 `useManagementColumns`，让列标题随语言或业务配置更新，同时保留用户的列顺序和显隐选择。
- 设备运营分析使用本组件展示统计列表；现有接口返回完整结果，由页面进行前端分页，详情仍使用原抽屉。
- 非标准页面（树表、主从布局、流程画布等）可使用更底层组件，但应复用公共主题与分页规则，并在代码中说明原因。
