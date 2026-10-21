<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, reactive, ref, watch } from "vue";
import { usePageActivation } from "./page-cache";
import { ElMessageBox } from "element-plus";
import { state, material, warehouseName, commit } from "./store";
import {
  createReceipt,
  updateReceipt,
  confirmReceipt,
  unauditReceipt,
  receiptRemaining,
  type Purchase,
  type Receipt,
} from "./model";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref(""),
  page = ref(1),
  pageSize = ref(50),
  dialog = ref(false),
  orderId = ref(""),
  warehouse = ref(""),
  detail = ref("");
const activeId = ref("");
const mode = ref<"create" | "edit" | "confirm">("create");
const logistics = reactive({ carrier: "", tracking: "" });
const saving = ref(false);
const quantities = ref<Record<string, number>>({});
const orders = computed(() =>
  state.value.purchases.filter(
    (p) =>
      !p.mergedInto &&
      p.status === "已审核" &&
      receiptRemaining(state.value, p.id).some((line) => line.qty > 0)
  )
);
const order = computed(() =>
  state.value.purchases.find((p) => p.id === orderId.value && !p.mergedInto)
);
const activeReceipt = computed(() =>
  state.value.receipts.find((receipt) => receipt.id === activeId.value)
);
const rows = computed(() => {
  if (!order.value) return [];
  if (mode.value === "create")
    return receiptRemaining(state.value, orderId.value)
      .filter((line) => line.qty > 0)
      .map((line) => ({ ...line, limit: line.qty }));
  const available = receiptRemaining(state.value, orderId.value, activeId.value);
  return (activeReceipt.value?.lines || []).map((line) => ({
    ...line,
    limit:
      mode.value === "confirm"
        ? line.qty
        : available.find((row) => row.lineId === line.lineId)?.qty || 0,
  }));
});
const filtered = computed(() =>
  state.value.receipts.filter((r) =>
    `${r.id}${r.purchase}${r.carrier || ""}${r.tracking || ""}${r.lines.map((l) => material(l.material)?.name).join("")}`.includes(
      keyword.value
    )
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.receipts.find((r) => r.id === detail.value));
const title = computed(() =>
  mode.value === "create"
    ? "新增待收货单"
    : mode.value === "edit"
      ? "修改待收货数量"
      : "确认实际收货"
);
watch([keyword, pageSize], () => (page.value = 1));
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.min(page.value, Math.max(1, Math.ceil(n / pageSize.value))))
);
watch(orderId, () => {
  if (mode.value === "create")
    quantities.value = Object.fromEntries(rows.value.map((line) => [line.lineId, line.qty]));
});
function open(purchase?: Purchase) {
  mode.value = "create";
  activeId.value = "";
  orderId.value = purchase?.id || "";
  warehouse.value = state.value.warehouses.find((w) => w.available && !w.inactive)?.id || "";
  logistics.carrier = "";
  logistics.tracking = "";
  quantities.value = Object.fromEntries(rows.value.map((line) => [line.lineId, line.qty]));
  dialog.value = true;
}
function openReceipt(receipt: Receipt, nextMode: "edit" | "confirm") {
  mode.value = nextMode;
  activeId.value = receipt.id;
  orderId.value = receipt.purchase;
  warehouse.value = receipt.warehouse;
  logistics.carrier = receipt.carrier || "";
  logistics.tracking = receipt.tracking || "";
  quantities.value = Object.fromEntries(receipt.lines.map((line) => [line.lineId, line.qty]));
  dialog.value = true;
}
usePageActivation(() => {
  const purchaseId = sessionStorage.getItem("wsn-selected-purchase");
  if (!purchaseId) return;
  sessionStorage.removeItem("wsn-selected-purchase");
  const purchase = orders.value.find((p) => p.id === purchaseId);
  if (purchase) open(purchase);
});
async function save() {
  if (saving.value) return;
  const receiptLines = rows.value.map((line) => ({
    lineId: line.lineId,
    qty: quantities.value[line.lineId] ?? 0,
  }));
  const input =
    mode.value === "confirm" ? receiptLines : receiptLines.filter((line) => line.qty > 0);
  if (!input.some((line) => line.qty > 0)) {
    commit(() => {
      throw new Error("请至少填写一项正数数量");
    });
    return;
  }
  saving.value = true;
  if (mode.value === "confirm") {
    try {
      await ElMessageBox.confirm(
        "将按本次实收数量生成入库单、增加库存并完成收货；未实收差额释放回可安排应收量。",
        "确认实际收货入库",
        { type: "warning", confirmButtonText: "确认收货入库", cancelButtonText: "返回检查" }
      );
    } catch {
      saving.value = false;
      return;
    }
  }
  const ok = commit(
    (s) => {
      if (mode.value === "create")
        createReceipt(s, orderId.value, warehouse.value, input, { ...logistics });
      else if (mode.value === "edit") updateReceipt(s, activeId.value, input);
      else confirmReceipt(s, activeId.value, input);
    },
    mode.value === "confirm" ? "收货已完成，库存与入库记录已更新" : "待收货单已保存，尚未增加库存"
  );
  saving.value = false;
  if (ok) dialog.value = false;
}
async function unaudit(receipt: Receipt) {
  try {
    await ElMessageBox.confirm(
      `将反审核收货单 ${receipt.id}，回退对应库存与入库记录，恢复为待收货；库存不足以回退时不会执行。`,
      "反审核收货单",
      { type: "warning", confirmButtonText: "确认反审核", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  commit((s) => unauditReceipt(s, receipt.id), "收货单已反审核，恢复待收货");
}
function actions(receipt: Receipt) {
  return [
    {
      label: "详情",
      action: () => {
        detail.value = receipt.id;
      },
    },
    ...(receipt.status === "待收货"
      ? [
          { label: "修改数量", action: () => openReceipt(receipt, "edit") },
          {
            label: "确认收货",
            action: () => openReceipt(receipt, "confirm"),
            disabled:
              state.value.purchases.find((order) => order.id === receipt.purchase)?.status !==
              "已审核",
          },
        ]
      : [{ label: "反审核", action: () => unaudit(receipt) }]),
  ];
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
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input
          v-model="keyword"
          clearable
          placeholder="收货单、采购单、物流或物料" /></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" @click="open()">新增待收货单</el-button
      ><el-button @click="emit('navigate', 'orders')">采购单</el-button></template
    >
    <el-table :data="paged" stripe empty-text="暂无收货单">
      <el-table-column label="收货单号 / 日期" min-width="230"
        ><template #default="{ row }"
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      >
      <el-table-column prop="purchase" label="来源采购单" min-width="210" />
      <el-table-column label="入库仓库" min-width="140"
        ><template #default="{ row }">{{ warehouseName(row.warehouse) }}</template></el-table-column
      >
      <el-table-column label="物料" min-width="180"
        ><template #default="{ row }">{{
          row.lines.map((line: { material: string }) => material(line.material)?.name).join("、")
        }}</template></el-table-column
      >
      <el-table-column label="物流信息" min-width="180"
        ><template #default="{ row }"
          >{{ row.carrier || "—" }}
          <div class="cell-sub">{{ row.tracking || "—" }}</div></template
        ></el-table-column
      >
      <el-table-column label="收货状态" width="105"
        ><template #default="{ row }"
          ><el-tag :type="row.status === '已收货' ? 'success' : 'warning'">{{
            row.status || "已收货"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column prop="auditStatus" label="审核状态" width="100" />
      <el-table-column label="操作" fixed="right" width="180"
        ><template #default="{ row }"><FaTableActions :actions="actions(row)" /></template
      ></el-table-column>
    </el-table>
    <div class="pagination">
      <span>共 {{ filtered.length }} 条</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filtered.length"
        layout="sizes, prev, pager, next"
      />
    </div>
  </FaManagementList>
  <el-dialog v-model="dialog" :title="title" width="min(1000px,94vw)" :close-on-click-modal="false">
    <el-form label-position="top" novalidate>
      <div class="receipt-fields">
        <el-form-item label="采购单" required
          ><el-select
            v-model="orderId"
            filterable
            :disabled="mode !== 'create'"
            placeholder="选择已审核且仍有可安排数量的采购单"
            ><el-option
              v-for="purchase in mode === 'create' ? orders : order ? [order] : []"
              :key="purchase.id"
              :value="purchase.id"
              :label="`${purchase.id} / ${purchase.supplier}`" /></el-select
        ></el-form-item>
        <el-form-item label="入库仓库" required
          ><el-select v-model="warehouse" :disabled="mode !== 'create'"
            ><el-option
              v-for="item in state.warehouses.filter((w) => w.available && !w.inactive)"
              :key="item.id"
              :label="item.name"
              :value="item.id" /></el-select
        ></el-form-item>
        <el-form-item label="物流公司"
          ><el-input v-model="logistics.carrier" :disabled="mode !== 'create'" maxlength="100"
        /></el-form-item>
        <el-form-item label="物流单号"
          ><el-input v-model="logistics.tracking" :disabled="mode !== 'create'" maxlength="100"
        /></el-form-item>
      </div>
    </el-form>
    <el-table :data="rows" max-height="360" empty-text="请先选择采购单">
      <el-table-column label="物料" min-width="180"
        ><template #default="{ row }"
          >{{ material(row.material)?.name }}
          <div class="cell-sub">{{ row.material }}</div></template
        ></el-table-column
      >
      <el-table-column label="采购数量" width="110"
        ><template #default="{ row }">{{
          order?.lines.find((line) => line.id === row.lineId)?.qty
        }}</template></el-table-column
      >
      <el-table-column
        :label="mode === 'confirm' ? '本单安排量' : '可安排数量'"
        prop="limit"
        width="120"
      />
      <el-table-column :label="mode === 'confirm' ? '实际收货量' : '本单安排量'" width="190"
        ><template #default="{ row }"
          ><el-input-number
            v-model="quantities[row.lineId]"
            :aria-label="`收货数量 ${row.lineId}`"
            :min="0"
            :max="row.limit"
            :precision="0" /></template
      ></el-table-column>
    </el-table>
    <p class="muted">
      {{
        mode === "confirm"
          ? "按实收量增加库存；实收量可低于本单安排量，差额恢复为可安排应收量。"
          : "保存仅预占应收数量，不增加库存。创建后仅能修改数量，物流、来源及仓库不可更改。"
      }}
    </p>
    <el-alert
      v-if="mode !== 'create' && order?.status !== '已审核'"
      title="来源采购单当前未审核，请重新审核采购单后再确认收货。"
      type="warning"
      :closable="false"
    />
    <template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button
        type="primary"
        :disabled="!order || !warehouse || (mode === 'confirm' && order.status !== '已审核')"
        :loading="saving"
        @click="save"
        >{{ mode === "confirm" ? "确认收货并入库" : "保存待收货单" }}</el-button
      ></template
    >
  </el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="收货单详情"
    size="min(850px,95vw)"
    @close="detail = ''"
  >
    <template v-if="selected">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="收货单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="采购单">{{ selected.purchase }}</el-descriptions-item>
        <el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="入库仓库">{{
          warehouseName(selected.warehouse)
        }}</el-descriptions-item>
        <el-descriptions-item label="物流公司">{{ selected.carrier || "—" }}</el-descriptions-item
        ><el-descriptions-item label="物流单号">{{
          selected.tracking || "—"
        }}</el-descriptions-item>
        <el-descriptions-item label="收货状态">{{
          selected.status || "已收货"
        }}</el-descriptions-item
        ><el-descriptions-item label="审核状态">{{
          selected.auditStatus || "已审核"
        }}</el-descriptions-item>
        <el-descriptions-item label="关联入库单" :span="2">{{
          state.inbounds
            .filter((item) => item.receipt === selected?.id)
            .map((item) => item.id)
            .join("、") || "—"
        }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="selected.lines"
        ><el-table-column label="物料"
          ><template #default="{ row }"
            >{{ material(row.material)?.name }}
            <div class="cell-sub">{{ row.material }}</div></template
          ></el-table-column
        ><el-table-column
          prop="qty"
          :label="selected.status === '待收货' ? '安排数量' : '实收数量'"
        /><el-table-column label="单位"
          ><template #default="{ row }">{{
            material(row.material)?.unit
          }}</template></el-table-column
        ></el-table
      >
      <p class="muted">
        {{
          selected.status === "待收货"
            ? "当前仅占用应收数量，尚未增加库存。"
            : "已按实收数量更新库存及入库记录，收货完成后不可直接修改。"
        }}
      </p>
      <div class="dialog-actions">
        <template v-if="selected.status === '待收货'"
          ><el-button @click="openReceipt(selected, 'edit')">修改数量</el-button
          ><el-button type="primary" @click="openReceipt(selected, 'confirm')"
            >确认实际收货</el-button
          ></template
        ><el-button v-else @click="unaudit(selected)">反审核</el-button>
      </div>
    </template>
  </el-drawer>
</template>
<style scoped>
.receipt-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
@media (max-width: 700px) {
  .receipt-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
