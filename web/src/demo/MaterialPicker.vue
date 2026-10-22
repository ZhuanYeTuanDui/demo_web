<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import { computed, ref, watch } from "vue";
import { Search } from "@element-plus/icons-vue";
import { state } from "./store";
import { categories, categoryName, materialCategory } from "./material-profile";
import { materialIsActive, type Material } from "./model";

const props = defineProps<{ excludedIds: string[] }>();
const emit = defineEmits<{ confirm: [ids: string[]]; cancel: [] }>();
const keyword = ref("");
const category = ref("");
const page = ref(1);
const selection = ref<Material[]>([]);
const excluded = computed(() => new Set(props.excludedIds));
const filtered = computed(() => state.value.materials.filter((m) => {
  const query = keyword.value.trim().toLowerCase();
  return materialIsActive(m) && (!category.value || materialCategory(m) === category.value) &&
    `${m.id} ${m.name} ${m.spec} ${m.details?.drawingNo || ""} ${m.details?.brand || ""}`.toLowerCase().includes(query);
}));
const paged = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10));
watch([keyword, category], () => { page.value = 1; });
const selectable = (m: Material) => !excluded.value.has(m.id);
</script>

<template>
  <el-dialog :model-value="true" title="选择物料" width="min(1080px, 94vw)" top="5vh" append-to-body
    :close-on-click-modal="false" @close="emit('cancel')">
    <div class="filter-bar material-picker-filters">
      <label>关键词<el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="品号、品名、图号、规格或品牌" /></label>
      <label>物料分类<el-select v-model="category" clearable placeholder="全部分类">
        <el-option v-for="c in categories" :key="c.id" :value="c.id" :label="c.name" />
      </el-select></label>
    </div>
    <p class="muted">支持跨页多选，表头复选框选择当前页；已添加的物料无需重复选择。</p>
    <el-table :data="paged" row-key="id" stripe max-height="360" empty-text="暂无匹配物料"
      @selection-change="(rows: Material[]) => selection = rows">
      <el-table-column type="selection" width="48" :reserve-selection="true" :selectable="selectable" />
      <el-table-column label="品号 / 品名" min-width="200"><template #default="{ row }">
        <div>{{ row.name }}</div><span class="cell-sub code">{{ row.id }}</span>
      </template></el-table-column>
      <el-table-column label="图号 / 规格" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.details?.drawingNo || row.spec || '—' }}</template></el-table-column>
      <el-table-column label="分类" width="110"><template #default="{ row }">{{ categoryName(materialCategory(row)) }}</template></el-table-column>
      <el-table-column prop="unit" label="单位" width="75" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag v-if="excluded.has(row.id)" type="info">已添加</el-tag></template></el-table-column>
    </el-table>
    <div class="pagination">
      <span role="status">已选 {{ selection.length }} 种物料</span>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="10" layout="total, prev, pager, next" />
    </div>
    <template #footer>
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :disabled="!selection.length" @click="emit('confirm', selection.filter(m => state.materials.some(item => item.id === m.id && materialIsActive(item))).map(m => m.id))">添加选中物料（{{ selection.length }}）</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.material-picker-filters { padding: 0; flex-wrap: wrap; }
.material-picker-filters label:first-child { flex: 1; min-width: 220px; }
</style>
