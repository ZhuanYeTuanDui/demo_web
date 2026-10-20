<template>
  <div
    class="catering-page fa-management-list"
    :class="[fullscreenClass, { 'is-embedded': embedded }]"
  >
    <div v-show="showSearchBar" class="g-card filter-bar">
      <ElForm inline class="fa-management-list__query" @submit.prevent="submitSearch">
        <slot name="filters" :search="submitSearch" :reset="resetSearch" />
        <ElFormItem class="fa-management-list__query-actions">
          <ElButton type="primary" :icon="Search" :loading="loading" @click="submitSearch">
            {{ searchLabel }}
          </ElButton>
          <ElButton :icon="RefreshLeft" :disabled="loading" @click="resetSearch">
            {{ resetLabel }}
          </ElButton>
        </ElFormItem>
      </ElForm>
    </div>

    <div class="g-card table-card">
      <FaTableHeader
        v-if="showTableToolbar"
        v-model:columns="columns"
        v-model:show-search-bar="showSearchBar"
        :full-class="fullscreenClass"
        :layout="effectiveToolbarLayout"
        :loading="loading"
        @refresh="refreshTable"
      >
        <template #left>
          <div class="toolbar-actions">
            <slot
              name="toolbar-actions"
              :selected-ids="selectedIds"
              :selected-rows="selectedRows"
              :clear-selection="clearSelection"
            >
              <ElButton
                v-if="showCreate"
                type="primary"
                plain
                :icon="Plus"
                :loading="createLoading"
                @click="$emit('create')"
              >
                {{ createLabel }}
              </ElButton>
              <ElButton
                v-if="showBatchDelete"
                type="danger"
                plain
                :icon="Delete"
                :loading="deleteLoading"
                :disabled="selectedIds.length === 0 || loading"
                @click="emitBatchDelete"
              >
                {{ selectedIds.length ? `${deleteLabel} (${selectedIds.length})` : deleteLabel }}
              </ElButton>
            </slot>
          </div>
        </template>
        <template #right>
          <slot name="table-toolbar-right" />
        </template>
      </FaTableHeader>

      <slot
        name="content"
        :rows="rows"
        :selected-rows="selectedRows"
        :clear-selection="clearSelection"
        :table-size="tableSize"
        :stripe="isZebra"
        :border="isBorder"
        :highlight-current-row="highlightCurrentRow"
        :header-cell-style="headerCellStyle"
      >
        <ElTable
          ref="tableRef"
          v-bind="tableProps"
          v-loading="loading"
          :data="rows"
          :row-key="rowKey"
          :size="tableSize"
          :stripe="isZebra"
          :border="isBorder"
          :highlight-current-row="highlightCurrentRow"
          :header-cell-style="headerCellStyle"
          style="width: 100%"
          @selection-change="handleSelectionChange"
        >
          <ElTableColumn v-if="showSelection" type="selection" width="52" align="center" />
          <ElTableColumn
            v-for="column in visibleColumns"
            :key="column.prop || column.type"
            v-bind="columnProps(column)"
          >
            <template v-if="column.useSlot && (column.slotName || column.prop)" #default="scope">
              <slot :name="column.slotName || column.prop" v-bind="scope" />
            </template>
          </ElTableColumn>
          <slot :selected-rows="selectedRows" />
          <template #empty>
            <slot name="empty"><ElEmpty :description="emptyText" /></slot>
          </template>
        </ElTable>
      </slot>

      <div v-if="showPagination" class="pager">
        <ElPagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="pageSizes"
          :layout="paginationLayout"
          background
          :disabled="loading"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
import type { TableInstance } from "element-plus";
import { Delete, Plus, RefreshLeft, Search } from "@element-plus/icons-vue";
import { storeToRefs } from "pinia";
import { useTableStore } from "@/store/modules/table.store";
import type { ColumnOption } from "@/types/component";
import FaTableHeader from "@/components/tables/fa-table-header/index.vue";

defineOptions({ name: "FaManagementList" });

export type ManagementRow = Record<string, unknown>;
export type ManagementRowKey = string | ((row: ManagementRow) => string);

const props = defineProps({
  rows: { type: Array as PropType<ManagementRow[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  rowKey: { type: [String, Function] as PropType<ManagementRowKey>, default: "id" },
  tableProps: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  toolbarLayout: {
    type: String,
    default: "search,refresh,size,fullscreen,columns,settings",
  },
  showTableToolbar: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false },
  pageSizes: { type: Array as PropType<number[]>, default: () => [10, 20, 50, 100] },
  paginationLayout: { type: String, default: "total, sizes, prev, pager, next" },
  showPagination: { type: Boolean, default: true },
  showSelection: { type: Boolean, default: true },
  showCreate: { type: Boolean, default: true },
  showBatchDelete: { type: Boolean, default: true },
  createLoading: { type: Boolean, default: false },
  deleteLoading: { type: Boolean, default: false },
  searchLabel: { type: String, default: "查询" },
  resetLabel: { type: String, default: "重置" },
  createLabel: { type: String, default: "新增" },
  deleteLabel: { type: String, default: "批量删除" },
  emptyText: { type: String, default: "暂无数据" },
});

const emit = defineEmits<{
  search: [pagination: { page: number; pageSize: number }];
  reset: [];
  create: [];
  batchDelete: [ids: Array<string | number>, rows: ManagementRow[]];
  selectionChange: [rows: ManagementRow[]];
  pageChange: [pagination: { page: number; pageSize: number }];
  refresh: [pagination: { page: number; pageSize: number }];
}>();

const page = defineModel<number>("page", { default: 1 });
const pageSize = defineModel<number>("pageSize", { default: 10 });
const columns = defineModel<ColumnOption[]>("columns", { default: () => [] });
const fullscreenClass = `fa-management-list-fullscreen-${Math.random().toString(36).slice(2, 9)}`;
const tableRef = ref<TableInstance>();
const selectedRows = ref<ManagementRow[]>([]);
const showSearchBar = ref(true);
const tableStore = useTableStore();
const { tableSize, isZebra, isBorder, isHeaderBackground, highlightCurrentRow } =
  storeToRefs(tableStore);
const effectiveToolbarLayout = computed(() =>
  columns.value.length
    ? props.toolbarLayout
    : props.toolbarLayout
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "columns")
        .join(",")
);
const visibleColumns = computed(() =>
  columns.value.filter((column) => column.visible !== false && column.checked !== false)
);
const headerCellStyle = computed(() => ({
  background: isHeaderBackground.value ? "var(--el-fill-color-lighter)" : undefined,
}));

const selectedIds = computed(() =>
  selectedRows.value
    .map((row) => resolveRowKey(row))
    .filter((value): value is string | number => value !== undefined && value !== null)
);

function resolveRowKey(row: ManagementRow) {
  if (typeof props.rowKey === "function") return props.rowKey(row);
  return row[props.rowKey] as string | number | undefined;
}

function handleSelectionChange(rows: ManagementRow[]) {
  selectedRows.value = rows;
  emit("selectionChange", rows);
}

function clearSelection() {
  tableRef.value?.clearSelection();
  selectedRows.value = [];
}

function submitSearch() {
  page.value = 1;
  clearSelection();
  emit("search", { page: page.value, pageSize: pageSize.value });
}

function resetSearch() {
  page.value = 1;
  clearSelection();
  emit("reset");
}

function emitBatchDelete() {
  if (!selectedIds.value.length) return;
  emit("batchDelete", [...selectedIds.value], [...selectedRows.value]);
}

function refreshTable() {
  clearSelection();
  emit("refresh", { page: page.value, pageSize: pageSize.value });
}

function columnProps(column: ColumnOption) {
  const result = { ...column };
  delete result.visible;
  delete result.checked;
  delete result.disabled;
  delete result.useSlot;
  delete result.slotName;
  delete result.useHeaderSlot;
  delete result.headerSlotName;
  return result;
}

function handleCurrentChange() {
  clearSelection();
  emit("pageChange", { page: page.value, pageSize: pageSize.value });
}

function handleSizeChange() {
  page.value = 1;
  clearSelection();
  emit("pageChange", { page: page.value, pageSize: pageSize.value });
}

watch(
  () => props.total,
  (total) => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize.value));
    if (page.value > lastPage) {
      page.value = lastPage;
      emit("pageChange", { page: page.value, pageSize: pageSize.value });
    }
  }
);

defineExpose({ clearSelection, selectedIds, selectedRows, tableRef, showSearchBar });
</script>

<style scoped lang="scss">
.fa-management-list {
  display: grid;
  gap: 16px;
}

.fa-management-list.is-embedded {
  max-width: none;
  padding: 0;
}

.fa-management-list__query {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  min-width: 0;
}

.fa-management-list__query :deep(.el-form-item) {
  margin: 0;
}

.toolbar-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
}

.table-card :deep([id^="fa-table-header-"]) {
  padding: 4px 0 12px;
}

@media (width <= 768px) {
  .fa-management-list__query {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .fa-management-list__query :deep(.el-form-item),
  .fa-management-list__query :deep(.el-input),
  .fa-management-list__query :deep(.el-select),
  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }
}
</style>
