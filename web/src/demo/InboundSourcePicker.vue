<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ElDialog from "./CachedDialog.vue";
import { state, material } from "./store";
import { receiptRemaining } from "./model";

export interface InboundSourceLine {
  key: string;
  purchase: string;
  supplier: string;
  lineId: string;
  material: string;
  qty: number;
}
const props = defineProps<{ supplier: string; excludedKeys: string[] }>();
const emit = defineEmits<{ confirm: [lines: InboundSourceLine[]]; cancel: [] }>();
const keyword = ref("");
const page = ref(1);
const selected = ref<string[]>([]);
const allRows = computed<InboundSourceLine[]>(() => {
  const supplier = props.supplier.trim().toLowerCase();
  if (!supplier) return [];
  return state.value.purchases
    .filter((order) => order.status === "已审核" && !order.mergedInto &&
      order.supplier.toLowerCase().includes(supplier))
    .flatMap((order) => receiptRemaining(state.value, order.id)
      .filter((line) => line.qty > 0)
      .map((line) => ({ ...line, purchase: order.id, supplier: order.supplier,
        key: JSON.stringify([order.id, line.lineId]) })));
});
const filtered = computed(() => allRows.value.filter((row) =>
  `${row.purchase} ${row.supplier} ${row.material} ${material(row.material)?.name} ${material(row.material)?.spec}`
    .toLowerCase().includes(keyword.value.trim().toLowerCase())));
const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20));
watch(keyword, () => { page.value = 1; });
function toggle(key: string, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, key])] : selected.value.filter((id) => id !== key);
}
function confirm() {
  emit("confirm", allRows.value.filter((row) => selected.value.includes(row.key) && !props.excludedKeys.includes(row.key)));
}
</script>

<template>
  <el-dialog :model-value="true" title="入库取采购单" width="min(1080px, 94vw)" top="5vh"
    append-to-body :close-on-click-modal="false" @close="emit('cancel')">
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="搜索采购物料"><el-input v-model="keyword" clearable placeholder="采购单号、供应商、品号、品名或规格" /></el-form-item>
    </el-form>
    <p class="muted">供应商包含“{{ supplier.trim() }}”的已审核采购单；可跨单勾选，数量已扣除已入库及待收货占用。</p>
    <el-table :data="paged" row-key="key" max-height="420" stripe empty-text="暂无匹配且可入库的采购物料">
      <el-table-column label="选择" width="65"><template #default="{ row }">
        <el-checkbox :model-value="selected.includes(row.key) || excludedKeys.includes(row.key)"
          :disabled="excludedKeys.includes(row.key)" :aria-label="`选择采购物料 ${row.purchase} ${row.lineId}`"
          @change="(checked: string | number | boolean) => toggle(row.key, !!checked)" />
      </template></el-table-column>
      <el-table-column label="品号 / 品名 / 规格" min-width="260"><template #default="{ row }">
        {{ material(row.material)?.name || row.material }}<div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || "—" }}</div>
      </template></el-table-column>
      <el-table-column prop="purchase" label="采购单号" min-width="200" />
      <el-table-column prop="supplier" label="供应商" min-width="180" />
      <el-table-column prop="qty" label="可入库数量" width="120" align="right" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag v-if="excludedKeys.includes(row.key)" type="info">已添加</el-tag></template></el-table-column>
    </el-table>
    <div class="pagination"><span role="status">已选 {{ selected.length }} 条物料</span>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20" layout="total, prev, pager, next" />
    </div>
    <template #footer><el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">确认取单（{{ selected.length }}）</el-button></template>
  </el-dialog>
</template>
