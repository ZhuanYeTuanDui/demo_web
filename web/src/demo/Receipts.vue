<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { state, material, warehouseName, commit } from "./store";
import { receive, type Purchase } from "./model";
import FaManagementList from "./FaManagementList.vue";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref(""),
  page = ref(1),
  pageSize = ref(50),
  creating = ref(false),
  orderId = ref(""),
  warehouse = ref(""),
  detail = ref("");
const saving = ref(false);
const quantities = ref<Record<string, number>>({});
const orders = computed(() =>
  state.value.purchases.filter(
    (p) => !p.mergedInto && p.status === "已审核" && p.receiptStatus !== "全部收货"
  )
);
const order = computed(() => orders.value.find((p) => p.id === orderId.value));
const rows = computed(() => order.value?.lines.filter((l) => l.received < l.qty) || []);
const filtered = computed(() =>
  state.value.receipts.filter((r) =>
    `${r.id}${r.purchase}${r.lines.map((l) => material(l.material)?.name).join("")}`.includes(
      keyword.value
    )
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.receipts.find((r) => r.id === detail.value));
watch([keyword, pageSize], () => (page.value = 1));
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.min(page.value, Math.max(1, Math.ceil(n / pageSize.value))))
);
watch(
  orderId,
  () => (quantities.value = Object.fromEntries(rows.value.map((l) => [l.id, l.qty - l.received])))
);
function open(p?: Purchase) {
  orderId.value = p?.id || "";
  warehouse.value = state.value.warehouses.find((w) => w.available && !w.inactive)?.id || "";
  creating.value = true;
  quantities.value = Object.fromEntries(rows.value.map((l) => [l.id, l.qty - l.received]));
}
const initial = sessionStorage.getItem("wsn-selected-purchase");
sessionStorage.removeItem("wsn-selected-purchase");
if (initial) open(orders.value.find((p) => p.id === initial));
async function save() {
  if (saving.value) return;
  const receiptLines = rows.value
    .map((l) => ({ lineId: l.id, qty: quantities.value[l.id] || 0 }))
    .filter((l) => l.qty > 0);
  if (!receiptLines.length) {
    commit(() => {
      throw new Error("请至少填写一项本次收货数量");
    });
    return;
  }
  saving.value = true;
  try {
    await ElMessageBox.confirm(
      "确认后立即生成收货单和入库记录、增加库存，收货单不可修改。",
      "确认收货入库",
      { type: "warning", confirmButtonText: "确认收货", cancelButtonText: "返回检查" }
    );
  } catch {
    saving.value = false;
    return;
  }
  if (
    commit((s) => {
      receive(s, orderId.value, warehouse.value, receiptLines);
    }, "收货已生效，已生成入库单和入库记录")
  )
    creating.value = false;
  saving.value = false;
}
</script>
<template>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      page = 1;
    "
    ><template #filters
      ><el-form-item label="关键词"
        ><el-input
          v-model="keyword"
          clearable
          placeholder="收货单、采购单或物料" /></el-form-item></template
    ><template #toolbar
      ><el-button type="primary" @click="open()">新增收货单</el-button
      ><el-button @click="emit('navigate', 'orders')">采购单</el-button></template
    >
    <el-table :data="paged" stripe empty-text="暂无收货记录"
      ><el-table-column label="收货单号 / 日期" min-width="240"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">{{ row.id }}</el-button>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      ><el-table-column prop="purchase" label="来源采购单" min-width="220" /><el-table-column
        label="入库仓库"
        min-width="150"
        ><template #default="{ row }">{{ warehouseName(row.warehouse) }}</template></el-table-column
      ><el-table-column label="收货物料" min-width="200"
        ><template #default="{ row }">{{
          row.lines.map((l: { material: string }) => material(l.material)?.name).join("、")
        }}</template></el-table-column
      ><el-table-column label="状态" width="100"
        ><template #default><el-tag type="success">已生效</el-tag></template></el-table-column
      ><el-table-column label="操作" width="100"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">详情</el-button></template
        ></el-table-column
      ></el-table
    >
    <div class="pagination">
      <span>共 {{ filtered.length }} 条</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filtered.length"
        layout="sizes, prev, pager, next"
      /></div
  ></FaManagementList>
  <el-dialog
    v-model="creating"
    title="新增收货单"
    width="min(1000px,94vw)"
    :close-on-click-modal="false"
    ><el-form label-position="top"
      ><el-form-item label="采购单（仅已审核且未收齐）" required
        ><el-select v-model="orderId" filterable placeholder="选择采购单"
          ><el-option
            v-for="p in orders"
            :key="p.id"
            :value="p.id"
            :label="`${p.id} / ${p.supplier} / ${p.receiptStatus}`" /></el-select></el-form-item
      ><el-form-item label="入库仓库" required
        ><el-select v-model="warehouse"
          ><el-option
            v-for="w in state.warehouses.filter((w) => w.available && !w.inactive)"
            :key="w.id"
            :label="w.name"
            :value="w.id" /></el-select></el-form-item
    ></el-form>
    <el-table :data="rows" max-height="360" empty-text="请先选择采购单"
      ><el-table-column label="物料" min-width="180"
        ><template #default="{ row }"
          >{{ material(row.material)?.name }}
          <div class="cell-sub">{{ row.material }}</div></template
        ></el-table-column
      ><el-table-column prop="qty" label="采购量" width="90" /><el-table-column
        prop="received"
        label="已收量"
        width="90" /><el-table-column label="剩余应收" width="100"
        ><template #default="{ row }">{{ row.qty - row.received }}</template></el-table-column
      ><el-table-column label="本次收货量" width="185"
        ><template #default="{ row }"
          ><el-input-number
            v-model="quantities[row.id]"
            :min="0"
            :max="row.qty - row.received"
            :precision="0" /></template></el-table-column
    ></el-table>
    <p class="muted">本次不收货的物料填 0；确认即生效，创建后不可修改。</p>
    <template #footer
      ><el-button @click="creating = false">取消</el-button
      ><el-button type="primary" :disabled="!order || !warehouse" :loading="saving" @click="save"
        >确认收货并入库</el-button
      ></template
    ></el-dialog
  >
  <el-drawer
    :model-value="!!selected"
    title="收货单详情"
    size="min(850px,95vw)"
    @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="收货单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="采购单">{{ selected.purchase }}</el-descriptions-item
        ><el-descriptions-item label="关联入库单">{{
          state.inbounds
            .filter((i) => i.receipt === selected?.id)
            .map((i) => i.id)
            .join("、") || "—"
        }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="入库仓库">{{
          warehouseName(selected.warehouse)
        }}</el-descriptions-item
        ><el-descriptions-item label="状态">已生效，不可修改</el-descriptions-item></el-descriptions
      ><el-table :data="selected.lines"
        ><el-table-column label="物料"
          ><template #default="{ row }">{{
            material(row.material)?.name
          }}</template></el-table-column
        ><el-table-column prop="qty" label="本次入库数量" /><el-table-column label="单位"
          ><template #default="{ row }">{{
            material(row.material)?.unit
          }}</template></el-table-column
        ></el-table
      >
      <p class="muted">
        对应库存变更及入库记录已同时生效，可在出入库记录中按来源采购单追溯。
      </p></template
    ></el-drawer
  >
</template>
