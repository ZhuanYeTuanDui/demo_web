<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  Search,
  Plus,
  Download,
  Refresh,
  Box,
  OfficeBuilding,
  Sort,
} from "@element-plus/icons-vue";
import { state, material, warehouseName, commit } from "./store";
import { stockKey, move, type Movement } from "./model";

const props = defineProps<{ page: string }>();
const keyword = ref("");
const warehouse = ref("");
const direction = ref("");
const currentPage = ref(1);
const dialog = ref(false);
const warehouseDialog = ref(false);
const form = reactive({
  warehouse: "BZ01",
  material: "M001",
  qty: 1,
  type: "入库" as Movement["type"],
  reason: "",
});
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
      `${r.source}${r.id}${material(r.material)?.name}`
        .toLowerCase()
        .includes(keyword.value.toLowerCase())
  )
);
const list = computed(() => (props.page === "movements" ? records.value : rows.value));
const pagedRows = computed(() =>
  rows.value.slice((currentPage.value - 1) * 10, currentPage.value * 10)
);
const pagedRecords = computed(() =>
  records.value.slice((currentPage.value - 1) * 10, currentPage.value * 10)
);
watch([keyword, warehouse, direction, () => props.page], () => {
  currentPage.value = 1;
});
const totals = computed(() => ({
  quantity: Object.values(state.value.stocks).reduce((a, b) => a + b, 0),
  types: state.value.materials.filter((m) =>
    state.value.warehouses.some((w) => (state.value.stocks[stockKey(w.id, m.id)] || 0) > 0)
  ).length,
}));
function clear() {
  keyword.value = "";
  warehouse.value = "";
  direction.value = "";
}
function saveMovement() {
  if (
    commit((s) => {
      if (!form.reason.trim()) throw new Error("请填写出入库原因");
      move(
        s,
        form.warehouse,
        { material: form.material, qty: form.qty },
        form.type,
        "手工登记",
        form.reason.trim()
      );
    }, "记录已保存，库存已更新")
  ) {
    dialog.value = false;
    form.reason = "";
    form.qty = 1;
  }
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
  link.download = props.page === "movements" ? "出入库记录.csv" : "库存记录.csv";
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">INVENTORY</div>
      <h1>
        {{ page === "warehouses" ? "仓库管理" : page === "movements" ? "出入库记录" : "库存记录" }}
      </h1>
      <p>
        {{
          page === "warehouses"
            ? "管理仓库档案与可用量参与规则。"
            : page === "movements"
              ? "每一次库存变动都有记录，关联采购与生产来源。"
              : "查看商品分仓库存，掌握当前可用物料。"
        }}
      </p>
    </div>
    <el-button
      v-if="page === 'warehouses'"
      type="primary"
      :icon="Plus"
      @click="warehouseDialog = true"
      >新增仓库</el-button
    ><el-button v-else type="primary" :icon="Plus" @click="dialog = true">登记出入库</el-button>
  </div>
  <div class="metric-grid">
    <div class="metric">
      <span>库存商品种类</span><strong>{{ totals.types }}<small>种</small></strong
      ><el-icon><Box /></el-icon>
      <p>当前有库存的商品</p>
    </div>
    <div class="metric">
      <span>管理仓库</span><strong>{{ state.warehouses.length }}<small>个</small></strong
      ><el-icon><OfficeBuilding /></el-icon>
      <p>{{ state.warehouses.filter((w) => w.available).length }} 个参与可用量计算</p>
    </div>
    <div class="metric">
      <span>库存变动记录</span><strong>{{ state.movements.length }}<small>笔</small></strong
      ><el-icon><Sort /></el-icon>
      <p>采购收货与生产领料自动记录</p>
    </div>
  </div>
  <section class="panel" v-if="page === 'warehouses'">
    <div class="panel-heading">
      <h2>仓库档案</h2>
      <span class="muted">{{ state.warehouses.length }} 个仓库</span>
    </div>
    <el-table :data="state.warehouses" stripe
      ><el-table-column prop="id" label="仓库编号" min-width="130" /><el-table-column
        prop="name"
        label="仓库名称"
        min-width="180"
      /><el-table-column prop="kind" label="仓库性质" min-width="120" /><el-table-column
        label="纳入可用量计算"
        min-width="180"
        ><template #default="{ row }"
          ><el-tag :type="row.available ? 'success' : 'info'" effect="light">{{
            row.available ? "参与计算" : "不参与计算"
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="状态"
        ><template #default><span class="status-text">正常使用</span></template></el-table-column
      ></el-table
    >
    <div class="inline-note">需求分析只使用参与可用量计算的仓库；现场仓与成品仓默认不参与。</div>
  </section>
  <section class="panel" v-else>
    <div class="filter-bar">
      <label
        >关键词<el-input
          v-model="keyword"
          :prefix-icon="Search"
          clearable
          :placeholder="
            page === 'movements' ? '商品、记录号或来源单号' : '品号、品名或规格'
          " /></label
      ><label
        >仓库<el-select v-model="warehouse" placeholder="全部仓库" clearable
          ><el-option
            v-for="w in state.warehouses"
            :key="w.id"
            :label="w.name"
            :value="w.id" /></el-select></label
      ><label v-if="page === 'movements'"
        >方向<el-select v-model="direction" clearable placeholder="全部方向"
          ><el-option label="入库" value="入库" /><el-option
            label="出库"
            value="出库" /></el-select></label
      ><el-button :icon="Refresh" @click="clear">重置筛选</el-button>
    </div>
    <div class="panel-heading">
      <h2>
        {{ page === "movements" ? "出入库流水" : "分仓库存明细" }}
        <span class="count-badge">{{ list.length }}</span>
      </h2>
      <el-button :icon="Download" @click="exportCsv">导出记录</el-button>
    </div>
    <el-table v-if="page === 'stock'" :data="pagedRows" stripe empty-text="暂无匹配的库存记录"
      ><el-table-column label="商品信息" min-width="230"
        ><template #default="{ row }"
          ><div class="cell-title">{{ row.name }}</div>
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
    <el-table v-else :data="pagedRecords" stripe empty-text="暂无匹配的出入库记录"
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
        ><template #default="{ row }">{{ warehouseName(row.warehouse) }}</template></el-table-column
      ><el-table-column prop="qty" label="数量" width="85" align="right" /><el-table-column
        prop="reason"
        label="业务类型"
        min-width="120"
      /><el-table-column label="来源单据 / 记录号" min-width="245"
        ><template #default="{ row }"
          ><div class="cell-title code">{{ row.source }}</div>
          <span class="cell-sub code">{{ row.id }}</span></template
        ></el-table-column
      ></el-table
    >
    <div class="pagination">
      <span>共 {{ list.length }} 条记录</span
      ><el-pagination
        v-model:current-page="currentPage"
        :total="list.length"
        :page-size="10"
        layout="prev, pager, next"
      />
    </div>
  </section>
  <el-dialog v-model="dialog" title="登记出入库" width="520px" :close-on-click-modal="false"
    ><el-form label-position="top" @submit.prevent="saveMovement"
      ><el-form-item label="变动方向" required
        ><el-radio-group v-model="form.type"
          ><el-radio-button value="入库">入库</el-radio-button
          ><el-radio-button value="出库">出库</el-radio-button></el-radio-group
        ></el-form-item
      ><el-form-item label="仓库" required
        ><el-select v-model="form.warehouse"
          ><el-option
            v-for="w in state.warehouses"
            :key="w.id"
            :label="w.name"
            :value="w.id" /></el-select></el-form-item
      ><el-form-item label="商品" required
        ><el-select v-model="form.material" filterable
          ><el-option
            v-for="m in state.materials"
            :key="m.id"
            :label="`${m.name} · ${m.id}`"
            :value="m.id" /></el-select></el-form-item
      ><el-form-item label="数量" required
        ><el-input-number v-model="form.qty" :min="1" :max="100000" :precision="0" /></el-form-item
      ><el-form-item label="原因" required
        ><el-input
          v-model="form.reason"
          maxlength="100"
          placeholder="例如：期初补录、库存调整" /></el-form-item></el-form
    ><template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" @click="saveMovement">保存记录</el-button></template
    ></el-dialog
  >
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
