<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import { state, material, warehouseName, commit } from "./store";
import { shipWorkOrder, stockKey } from "./model";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(50);
const dialog = ref(false);
const detail = ref("");
const saving = ref(false);
const error = ref("");
const form = reactive({ workOrder: "", carrier: "", tracking: "", warehouse: "CP01" });
const pending = computed(() => state.value.workOrders.filter((row) => row.status === "待出货"));
const order = computed(() => state.value.workOrders.find((row) => row.id === form.workOrder));
const plans = computed(() => state.value.plans.filter((plan) => plan.workOrder === form.workOrder));
const lines = computed(() => {
  const totals = new Map<string, number>();
  plans.value.forEach((plan) =>
    totals.set(plan.product, (totals.get(plan.product) || 0) + plan.qty)
  );
  return [...totals].map(([material, qty]) => ({ material, qty }));
});
const rows = computed(() =>
  state.value.shipments.filter((row) =>
    `${row.id}${row.workOrder}${row.carrier}${row.tracking}`.includes(keyword.value)
  )
);
const paged = computed(() =>
  rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.shipments.find((row) => row.id === detail.value));
const warehouses = computed(() =>
  state.value.warehouses.filter((w) => !w.inactive && w.id === "CP01")
);
watch([keyword, pageSize], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
function open() {
  Object.assign(form, { workOrder: "", carrier: "", tracking: "", warehouse: "CP01" });
  error.value = "";
  dialog.value = true;
}
async function create() {
  if (saving.value) return;
  error.value = "";
  if (!form.workOrder || !form.carrier.trim() || !form.tracking.trim() || !form.warehouse) {
    error.value = "请选择待出货工单、成品仓库并填写物流公司和物流单号";
    return;
  }
  if (!plans.value.length || plans.value.some((plan) => plan.status !== "已完工")) {
    error.value = "关联生产计划必须全部完工入库后才能发货";
    return;
  }
  saving.value = true;
  try {
    await ElMessageBox.confirm(
      "确认后将扣减成品库存、生成出库记录，并将工单改为已发货。是否继续？",
      "确认成品发货",
      { type: "warning", confirmButtonText: "确认发货", cancelButtonText: "取消" }
    );
  } catch {
    saving.value = false;
    return;
  }
  if (
    commit((s) => {
      shipWorkOrder(s, form.workOrder, {
        carrier: form.carrier,
        tracking: form.tracking,
        warehouse: form.warehouse,
      });
    }, "发货单已创建，工单已发货")
  )
    dialog.value = false;
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
          placeholder="发货单、工单、物流公司或单号" /></el-form-item></template
    ><template #toolbar
      ><el-button type="primary" :icon="Plus" @click="open">新增发货单</el-button></template
    >
    <el-table :data="paged" empty-text="暂无发货单"
      ><el-table-column prop="id" label="发货单号" min-width="210" /><el-table-column
        label="工单"
        min-width="220"
        ><template #default="{ row }"
          >{{ state.workOrders.find((w) => w.id === row.workOrder)?.name || row.workOrder }}
          <div class="cell-sub code">{{ row.workOrder }}</div></template
        ></el-table-column
      ><el-table-column prop="date" label="发货日期" width="120" /><el-table-column
        prop="carrier"
        label="物流公司"
        min-width="130" /><el-table-column
        prop="tracking"
        label="物流单号"
        min-width="180" /><el-table-column label="操作" width="130" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions
            :actions="[
              {
                label: '查看详情',
                action: () => {
                  detail = row.id;
                },
              },
            ]" /></template></el-table-column
    ></el-table>
    <div class="pagination">
      <span>共 {{ rows.length }} 条记录</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="rows.length"
        layout="sizes, prev, pager, next"
      />
    </div>
  </FaManagementList>
  <el-dialog v-model="dialog" title="新增成品发货单" width="min(800px, 96vw)"
    ><el-form label-position="top" @submit.prevent="create"
      ><div class="form-grid">
        <el-form-item label="待出货工单" required
          ><el-select v-model="form.workOrder" filterable placeholder="请选择待出货工单"
            ><el-option
              v-for="row in pending"
              :key="row.id"
              :label="`${row.name}（${row.id}）`"
              :value="row.id" /></el-select></el-form-item
        ><el-form-item label="出库仓库" required
          ><el-select v-model="form.warehouse"
            ><el-option
              v-for="w in warehouses"
              :key="w.id"
              :label="w.name"
              :value="w.id" /></el-select></el-form-item
        ><el-form-item label="物流公司" required :error="!form.carrier.trim() ? error : ''"
          ><el-input v-model="form.carrier" maxlength="60" /></el-form-item
        ><el-form-item label="物流单号" required
          ><el-input v-model="form.tracking" maxlength="100"
        /></el-form-item>
      </div>
      <el-descriptions v-if="order" :column="2" border
        ><el-descriptions-item label="客户">{{ order.customer || "—" }}</el-descriptions-item
        ><el-descriptions-item label="关联计划"
          >{{ plans.length }} 个</el-descriptions-item
        ></el-descriptions
      >
      <h3>成品发货明细</h3>
      <el-table :data="lines" empty-text="选择工单后显示关联计划成品"
        ><el-table-column label="成品" min-width="220"
          ><template #default="{ row }">{{
            material(row.material)?.name || row.material
          }}</template></el-table-column
        ><el-table-column prop="qty" label="发货数量" width="110" align="right" /><el-table-column
          label="仓库库存"
          width="110"
          align="right"
          ><template #default="{ row }">{{
            state.stocks[stockKey(form.warehouse, row.material)] || 0
          }}</template></el-table-column
        ></el-table
      ><el-alert v-if="error" :title="error" type="error" :closable="false" />
      <p class="muted">按工单关联生产计划整单发货；发货单创建后不可修改。</p> </el-form
    ><template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="create"
        >确认发货并出库</el-button
      ></template
    ></el-dialog
  >
  <el-drawer
    :model-value="!!selected"
    title="发货单详情"
    size="min(720px, 100vw)"
    @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="发货单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="工单">{{ selected.workOrder }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="物流公司">{{ selected.carrier }}</el-descriptions-item
        ><el-descriptions-item label="物流单号">{{ selected.tracking }}</el-descriptions-item
        ><el-descriptions-item label="出库仓库">{{
          warehouseName(selected.warehouse)
        }}</el-descriptions-item></el-descriptions
      >
      <h3>发货成品</h3>
      <el-table :data="selected.lines"
        ><el-table-column label="成品" min-width="220"
          ><template #default="{ row }">{{
            material(row.material)?.name || row.material
          }}</template></el-table-column
        ><el-table-column prop="qty" label="数量" width="100" align="right"
      /></el-table>
      <div class="dialog-actions">
        <el-button @click="emit('navigate', 'movements')">查看出入库记录</el-button>
      </div></template
    ></el-drawer
  >
</template>
