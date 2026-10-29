<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import InboundEditor from "./InboundEditor.vue";
import StockMaterialPicker from "./StockMaterialPicker.vue";
import FaManagementList from "./FaManagementList.vue";
import { computed, reactive, ref, watch } from "vue";
import { Search, Plus, Download, } from "@element-plus/icons-vue";
import { state, material, warehouseName, commit } from "./store";
import { stockKey, registerStockOutbound, id, type Line } from "./model";
import WarehouseDetails from "./WarehouseDetails.vue";

const props = defineProps<{ page: string; warehouseId?: string }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const warehouse = ref("");
const direction = ref("");
const currentPage = ref(1);
const pageSize = ref(10);
const dialog = ref(false);
const inboundDialog = ref(false);
const inboundEditor = ref<InstanceType<typeof InboundEditor>>();
const inboundDetail = ref("");
const selectedInbound = computed(() => state.value.inbounds.find((document) => document.id === inboundDetail.value));
function closeInbound(done: () => void) {
  void inboundEditor.value?.cancel().then(() => { if (!inboundDialog.value) done(); });
}
const warehouseDialog = ref(false);
const form = reactive({
  id: "",
  warehouse: "BZ01",
  lines: [] as Line[],
  reason: "",
});
const savingOutbound = ref(false);
const outboundError = ref("");
const stockPicker = ref(false);
function openOutbound() {
  Object.assign(form, { id: id("OUT"), warehouse: "BZ01", lines: [], reason: "" });
  outboundError.value = "";
  dialog.value = true;
}
function selectOutboundMaterials(ids: string[]) {
  const existing = new Set(form.lines.map((line) => line.material));
  form.lines.push(...ids.filter((material) => !existing.has(material)).map((material) => ({ material, qty: 1 })));
  stockPicker.value = false;
}
function removeOutboundMaterial(material: string) {
  form.lines = form.lines.filter((line) => line.material !== material);
}
watch(() => form.warehouse, () => { form.lines = []; stockPicker.value = false; });
const warehouseForm = reactive({ id: "", name: "", kind: "存货仓", available: true });
const rows = computed(() =>
  state.value.warehouses
    .flatMap((w) =>
      state.value.materials.map((m) => ({
        ...m,
        warehouse: w.id,
        warehouseName: w.name,
        available: w.available,
        qty: state.value.stocks[stockKey(w.id, m.id)] || 0,
      }))
    )
    .filter(
      (r) =>
        (!warehouse.value || r.warehouse === warehouse.value) &&
        `${r.id}${r.name}${r.spec}`.toLowerCase().includes(keyword.value.toLowerCase())
    )
);
const records = computed(() =>
  state.value.movements.filter(
    (r) =>
      (!warehouse.value || r.warehouse === warehouse.value) &&
      (!direction.value || r.type === direction.value) &&
      `${r.source}${r.reason}${r.id}${material(r.material)?.name}`
        .toLowerCase()
        .includes(keyword.value.toLowerCase())
  )
);
const list = computed(() => (props.page === "movements" ? records.value : rows.value));
const pagedRows = computed(() =>
  rows.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
);
const pagedRecords = computed(() =>
  records.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
);
watch([keyword, warehouse, direction, () => props.page], () => {
  currentPage.value = 1;
});
function clear() {
  keyword.value = "";
  warehouse.value = "";
  direction.value = "";
}
function saveMovement() {
  if (savingOutbound.value) return;
  outboundError.value = "";
  if (!form.reason.trim() || !form.lines.length) {
    outboundError.value = "请选择出库物料并填写出库原因";
    return;
  }
  savingOutbound.value = true;
  if (
    commit((s) => {
      registerStockOutbound(s, form);
    }, "出库记录已保存，库存已扣减")
  ) {
    dialog.value = false;
  }
  savingOutbound.value = false;
}
function saveWarehouse() {
  if (
    commit((s) => {
      if (!warehouseForm.id.trim() || !warehouseForm.name.trim())
        throw new Error("仓库编号和名称不能为空");
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(warehouseForm.id))
        throw new Error("编号请使用 1～20 位字母、数字、下划线或短横线");
      if (s.warehouses.some((w) => w.id === warehouseForm.id)) throw new Error("仓库编号已存在");
      s.warehouses.push({ ...warehouseForm, name: warehouseForm.name.trim() });
    }, "仓库已新增")
  ) {
    warehouseDialog.value = false;
    warehouseForm.id = "";
    warehouseForm.name = "";
  }
}
function exportCsv() {
  const data =
    props.page === "movements"
      ? [
          ["记录编号", "日期", "方向", "商品", "仓库", "数量", "来源"],
          ...records.value.map((r) => [
            r.id,
            r.date,
            r.type,
            material(r.material).name,
            warehouseName(r.warehouse),
            r.qty,
            r.source,
          ]),
        ]
      : [
          ["品号", "品名", "规格", "仓库", "库存数量", "单位"],
          ...rows.value.map((r) => [r.id, r.name, r.spec, r.warehouseName, r.qty, r.unit]),
        ];
  const csv = data
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = props.page === "movements" ? "物料出入库.csv" : "库存记录.csv";
  link.click();
  URL.revokeObjectURL(url);
}
watch(pageSize, () => {
  currentPage.value = 1;
});
// 本地数据减少或状态变化后，将分页约束在有效范围内。
watch(() => list.value.length, (total) => { currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(total / pageSize.value))); });
</script>

<template>
  <WarehouseDetails
    v-if="page === 'warehouses' && warehouseId"
    :key="warehouseId"
    :warehouse-id="warehouseId"
    @back="emit('navigate', 'warehouses')"
  />
  <template v-else>


    <FaManagementList class="panel" v-if="page === 'warehouses'">
      <template #toolbar
        ><div class="panel-heading">
          <el-button type="primary" :icon="Plus" @click="warehouseDialog = true"
            >新增仓库</el-button
          >
          <h2>仓库档案</h2>
          <span class="muted">{{ state.warehouses.length }} 个仓库</span>
        </div></template
      >
      <el-table :data="state.warehouses" stripe
        ><el-table-column label="仓库编号" min-width="130"
          ><template #default="{ row }"
            ><DataLink :href="`#warehouses/${row.id}`" @click="emit('navigate', `warehouses/${row.id}`)">{{
              row.id
            }}</DataLink></template
          ></el-table-column
        ><el-table-column label="仓库名称" min-width="180"
          ><template #default="{ row }"
            ><DataLink :href="`#warehouses/${row.id}`" @click="emit('navigate', `warehouses/${row.id}`)">{{
              row.name
            }}</DataLink></template
          ></el-table-column
        ><el-table-column prop="kind" label="仓库性质" min-width="120" /><el-table-column
          label="纳入可用量计算"
          min-width="180"
          ><template #default="{ row }"
            ><el-tag :type="row.available ? 'success' : 'info'" effect="light">{{
              row.available ? "参与计算" : "不参与计算"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column prop="phone" label="电话" min-width="145"
          ><template #default="{ row }">{{ row.phone || "—" }}</template></el-table-column
        ><el-table-column label="状态" min-width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.inactive ? 'info' : 'success'">{{
              row.inactive ? "已失效" : "正常使用"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" fixed="right" width="115"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="emit('navigate', `warehouses/${row.id}`)"
              >查看详情</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <div class="inline-note">
        点击仓库编号或名称查看完整档案。需求分析只使用正常且参与可用量计算的仓库。
      </div>
    </FaManagementList>
    <FaManagementList class="panel" v-else filterable @search="currentPage = 1" @reset="clear()">
      <template #filters>
        <el-form-item label="关键词"
          ><el-input
            v-model="keyword"
            :prefix-icon="Search"
            clearable
            :placeholder="
              page === 'movements' ? '商品、记录号或来源单号' : '品号、品名或规格'
            " /></el-form-item
        ><el-form-item label="仓库"
          ><el-select v-model="warehouse" placeholder="全部仓库" clearable
            ><el-option
              v-for="w in state.warehouses"
              :key="w.id"
              :label="w.name"
              :value="w.id" /></el-select></el-form-item
        ><el-form-item v-if="page === 'movements'" label="方向"
          ><el-select v-model="direction" clearable placeholder="全部方向"
            ><el-option label="入库" value="入库" /><el-option
              label="出库"
              value="出库" /></el-select
        ></el-form-item>
      </template>
      <template #toolbar
        ><div class="panel-heading">
          <el-button type="primary" :icon="Plus" @click="inboundDialog = true">登记入库</el-button>
          <el-button @click="openOutbound">登记出库</el-button>
          <h2 v-if="page !== 'movements'">
            分仓库存明细
            <span class="count-badge">{{ list.length }}</span>
          </h2>
          <el-button :icon="Download" @click="exportCsv">导出记录</el-button>
        </div></template
      >
      <el-table v-if="page === 'stock'" :data="pagedRows" stripe empty-text="暂无匹配的库存记录"
        ><el-table-column label="商品信息" min-width="230"
          ><template #default="{ row }"
            ><div class="cell-title">
              <DataLink :href="`#materials/${row.id}`" @click="emit('navigate', `materials/${row.id}`)">{{
                row.name
              }}</DataLink>
            </div>
            <span class="cell-sub">{{ row.id }} · {{ row.spec }}</span></template
          ></el-table-column
        ><el-table-column prop="warehouseName" label="所属仓库" min-width="150" /><el-table-column
          label="库存数量"
          min-width="120"
          align="right"
          ><template #default="{ row }"
            ><strong :class="row.qty === 0 ? 'muted' : 'numeric'">{{ row.qty }}</strong></template
          ></el-table-column
        ><el-table-column prop="unit" label="单位" width="90" /><el-table-column
          label="库存状态"
          min-width="120"
          ><template #default="{ row }"
            ><el-tag :type="row.qty === 0 ? 'info' : 'success'" effect="light">{{
              row.qty === 0 ? "暂无库存" : "有库存"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="可用量计算" min-width="140"
          ><template #default="{ row }">{{
            row.available ? "参与" : "不参与"
          }}</template></el-table-column
        ></el-table
      >
      <el-table v-else :data="pagedRecords" stripe empty-text="暂无匹配的物料出入库记录"
        ><el-table-column prop="date" label="日期" width="115" /><el-table-column
          label="方向"
          width="85"
          ><template #default="{ row }"
            ><el-tag :type="row.type === '入库' ? 'success' : 'warning'">{{
              row.type
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="商品" min-width="160"
          ><template #default="{ row }"
            ><div class="cell-title">{{ material(row.material).name }}</div>
            <span class="cell-sub">{{ row.material }}</span></template
          ></el-table-column
        ><el-table-column label="仓库" min-width="130"
          ><template #default="{ row }">{{
            warehouseName(row.warehouse)
          }}</template></el-table-column
        ><el-table-column prop="qty" label="数量" width="85" align="right" /><el-table-column
          prop="reason"
          label="业务类型"
          min-width="120"
        /><el-table-column label="来源单据 / 记录号" min-width="245"
          ><template #default="{ row }"
            ><DataLink v-if="state.inbounds.some((document) => document.id === row.source)" @click="inboundDetail = row.source">{{ row.source }}</DataLink>
            <div v-else class="cell-title code">{{ row.source }}</div>
            <span class="cell-sub code">{{ row.id }}</span></template
          ></el-table-column
        ></el-table
      >
      <div class="pagination">
        <span>共 {{ list.length }} 条记录</span
        ><el-pagination
          v-model:current-page="currentPage"
          :total="list.length"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="sizes, prev, pager, next"
        />
      </div>
    </FaManagementList>
    <el-drawer v-model="inboundDialog" title="登记入库" size="min(1080px, 96vw)" destroy-on-close
      :before-close="closeInbound" :close-on-click-modal="false">
      <InboundEditor ref="inboundEditor" @cancel="inboundDialog = false" @saved="inboundDialog = false" />
    </el-drawer>
    <el-drawer :model-value="!!selectedInbound" title="入库单详情" size="min(1000px, 95vw)" @close="inboundDetail = ''">
      <template v-if="selectedInbound">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="入库单号">{{ selectedInbound.id }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ selectedInbound.supplier || state.purchases.find((order) => order.id === selectedInbound?.purchase)?.supplier || '—' }}</el-descriptions-item>
          <el-descriptions-item label="仓库">{{ warehouseName(selectedInbound.warehouse) }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ selectedInbound.date }}</el-descriptions-item>
          <el-descriptions-item label="来源收货单">{{ selectedInbound.receipt || '直接采购入库' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ selectedInbound.remark || '—' }}</el-descriptions-item>
        </el-descriptions>
        <h3>入库明细</h3>
        <el-table :data="selectedInbound.lines">
          <el-table-column label="物料" min-width="220"><template #default="{ row }">{{ material(row.material)?.name }}<div class="cell-sub">{{ row.material }}</div></template></el-table-column>
          <el-table-column label="来源采购单" min-width="210"><template #default="{ row }"><DataLink href="#orders" @click="emit('navigate', 'orders')">{{ row.purchase || selectedInbound?.purchase }}</DataLink></template></el-table-column>
          <el-table-column prop="qty" label="入库数量" width="110" />
        </el-table>
      </template>
    </el-drawer>
    <el-dialog v-model="dialog" title="登记出库" width="min(960px, 94vw)" :close-on-click-modal="false"
      ><el-form label-position="top" :disabled="savingOutbound" @submit.prevent="saveMovement">
      <div class="form-grid"
        ><el-form-item label="仓库" required
          ><el-select v-model="form.warehouse" aria-label="出库仓库"
            ><el-option
              v-for="w in state.warehouses"
              :key="w.id"
              :label="w.name"
              :disabled="w.inactive"
              :value="w.id" /></el-select></el-form-item
        ><el-form-item label="出库原因" required
          ><el-input
            v-model="form.reason"
            maxlength="100"
            placeholder="例如：库存调整、物料外发" /></el-form-item></div>
        <div class="panel-heading compact"><el-button type="primary" plain :disabled="!form.warehouse" @click="stockPicker = true">选择库存物料</el-button></div>
        <el-table :data="form.lines" row-key="material" max-height="360" empty-text="请从当前仓库库存选择物料">
          <el-table-column label="品号 / 品名 / 规格" min-width="240"><template #default="{ row }">{{ material(row.material)?.name }}<div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || '—' }}</div></template></el-table-column>
          <el-table-column label="当前库存" width="110" align="right"><template #default="{ row }">{{ state.stocks[stockKey(form.warehouse, row.material)] || 0 }}</template></el-table-column>
          <el-table-column label="出库数量" width="170"><template #default="{ row }"><el-input-number v-model="row.qty" :min="1" :max="Math.min(100000, state.stocks[stockKey(form.warehouse, row.material)] || 0)" :precision="0" controls-position="right" :aria-label="`出库数量 ${row.material}`" style="width: 140px" /></template></el-table-column>
          <el-table-column label="单位" width="70"><template #default="{ row }">{{ material(row.material)?.unit }}</template></el-table-column>
          <el-table-column label="操作" width="80" fixed="right"><template #default="{ row }"><el-button link type="danger" @click="removeOutboundMaterial(row.material)">移除</el-button></template></el-table-column>
        </el-table>
        <el-alert v-if="outboundError" :title="outboundError" type="error" :closable="false" show-icon />
        </el-form
      ><template #footer
        ><el-button :disabled="savingOutbound" @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="savingOutbound" @click="saveMovement">确认出库</el-button></template
      ></el-dialog
    >
    <StockMaterialPicker v-if="stockPicker && dialog" :warehouse="form.warehouse" :excluded-ids="form.lines.map((line) => line.material)"
      @confirm="selectOutboundMaterials" @cancel="stockPicker = false" />
    <el-dialog v-model="warehouseDialog" title="新增仓库" width="480px"
      ><el-form label-position="top"
        ><el-form-item label="仓库编号" required
          ><el-input
            v-model="warehouseForm.id"
            placeholder="例如：YL01"
            maxlength="20" /></el-form-item
        ><el-form-item label="仓库名称" required
          ><el-input v-model="warehouseForm.name" maxlength="40" /></el-form-item
        ><el-form-item label="仓库性质"
          ><el-select v-model="warehouseForm.kind"
            ><el-option
              v-for="kind in ['存货仓', '现场仓', '委外仓']"
              :key="kind"
              :value="kind"
              :label="kind" /></el-select></el-form-item
        ><el-form-item label="纳入可用量计算"
          ><el-switch v-model="warehouseForm.available" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="warehouseDialog = false">取消</el-button
        ><el-button type="primary" @click="saveWarehouse">新增仓库</el-button></template
      ></el-dialog
    >
  </template>
</template>
