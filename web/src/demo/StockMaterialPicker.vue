<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import ElDialog from "./CachedDialog.vue";
import { state, warehouseName } from "./store";
import { stockKey } from "./model";
import { categories, categoryName, materialCategory } from "./material-profile";

const props = defineProps<{ warehouse: string; excludedIds: string[] }>();
const emit = defineEmits<{ confirm: [ids: string[]]; cancel: [] }>();
const filters = reactive({ id: "", name: "", spec: "", drawing: "", brand: "", category: "" });
const selected = ref<string[]>([]);
const page = ref(1);
const stockRows = computed(() => state.value.materials
  .map((item) => ({ ...item, stock: state.value.stocks[stockKey(props.warehouse, item.id)] || 0 }))
  .filter((item) => item.stock > 0));
const contains = (value: unknown, query: string) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
const filtered = computed(() => stockRows.value.filter((item) =>
  contains(item.id, filters.id) && contains(item.name, filters.name) && contains(item.spec, filters.spec) &&
  contains(item.details?.drawingNo, filters.drawing) && contains(item.details?.brand, filters.brand) &&
  (!filters.category || materialCategory(item) === filters.category)));
const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20));
watch(filters, () => { page.value = 1; });
function toggle(id: string, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter((value) => value !== id);
}
function confirm() {
  // 确认时重新核对库存与已添加行，取消和筛选均不修改父表单。
  emit("confirm", stockRows.value.filter((item) => selected.value.includes(item.id) && !props.excludedIds.includes(item.id)).map((item) => item.id));
}
</script>

<template>
  <el-dialog :model-value="true" class="stock-material-picker" title="选择库存物料" width="min(1080px, 94vw)" top="5vh" append-to-body
    :close-on-click-modal="false" @close="emit('cancel')">
    <el-form label-position="top" @submit.prevent>
      <div class="stock-picker-filters">
        <el-form-item label="品号"><el-input v-model="filters.id" placeholder="筛选品号" clearable /></el-form-item>
        <el-form-item label="品名"><el-input v-model="filters.name" placeholder="筛选品名" clearable /></el-form-item>
        <el-form-item label="规格型号"><el-input v-model="filters.spec" placeholder="筛选规格型号" clearable /></el-form-item>
        <el-form-item label="图号"><el-input v-model="filters.drawing" placeholder="筛选图号" clearable /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="filters.brand" placeholder="筛选品牌" clearable /></el-form-item>
        <el-form-item label="物料分类"><el-select v-model="filters.category" clearable placeholder="全部分类">
          <el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" />
        </el-select></el-form-item>
      </div>
      <div class="panel-heading compact"><span class="muted">{{ warehouseName(warehouse) }} · 仅显示有库存的物料，支持跨筛选和分页多选。</span>
        <el-button @click="Object.assign(filters, { id: '', name: '', spec: '', drawing: '', brand: '', category: '' })">重置筛选</el-button></div>
    </el-form>
    <el-table :data="paged" row-key="id" max-height="360" stripe empty-text="暂无匹配的库存物料">
      <el-table-column label="选择" width="65"><template #default="{ row }"><el-checkbox
        :model-value="selected.includes(row.id) || excludedIds.includes(row.id)" :disabled="excludedIds.includes(row.id)"
        :aria-label="`选择库存物料 ${row.id}`" @change="(checked: string | number | boolean) => toggle(row.id, !!checked)" /></template></el-table-column>
      <el-table-column prop="id" label="品号" min-width="120" />
      <el-table-column prop="name" label="品名" min-width="180" />
      <el-table-column prop="spec" label="规格型号" min-width="180" />
      <el-table-column label="图号" min-width="140"><template #default="{ row }">{{ row.details?.drawingNo || '—' }}</template></el-table-column>
      <el-table-column label="品牌" min-width="120"><template #default="{ row }">{{ row.details?.brand || '—' }}</template></el-table-column>
      <el-table-column label="分类" min-width="110"><template #default="{ row }">{{ categoryName(materialCategory(row)) }}</template></el-table-column>
      <el-table-column prop="stock" label="当前库存" width="110" align="right" />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag v-if="excludedIds.includes(row.id)" type="info">已添加</el-tag></template></el-table-column>
    </el-table>
    <div class="pagination"><span role="status">已选 {{ selected.length }} 种物料</span>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20" layout="total, prev, pager, next" /></div>
    <template #footer><el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">添加选中物料（{{ selected.length }}）</el-button></template>
  </el-dialog>
</template>

<style scoped>
:global(.stock-material-picker .el-dialog__body) { max-height: calc(90vh - 150px); overflow-y: auto; }
.stock-picker-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
@media (max-width: 700px) { .stock-picker-filters { grid-template-columns: 1fr; } }
</style>
