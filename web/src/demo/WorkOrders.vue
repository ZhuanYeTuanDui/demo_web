<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import { state, material, commit } from "./store";
import { createWorkOrder, setWorkOrderStatus, products, today, type WorkOrder } from "./model";
const ProductionImport = defineAsyncComponent(() => import("./ProductionImport.vue"));
const scheduling = ref<WorkOrder>();
const importing = ref(false);
const importWorkOrder = ref("");
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const status = ref("");
const page = ref(1);
const pageSize = ref(50);
const dialog = ref(false);
const detail = ref("");
const initialDetail = sessionStorage.getItem("wsn-work-order-detail");
if (initialDetail) {
  detail.value = initialDetail;
  sessionStorage.removeItem("wsn-work-order-detail");
}
const error = ref("");
const saving = ref(false);
const statuses = ["立项中", "采购中", "装配中", "待出货"] as const;
const form = reactive({
  name: "",
  customer: "",
  product: "FG001",
  qty: 1,
  date: today(),
  remark: "",
});
const rows = computed(() =>
  state.value.workOrders.filter(
    (row) =>
      `${row.id}${row.name}${row.customer}`.includes(keyword.value) &&
      (!status.value || row.status === status.value)
  )
);
const paged = computed(() =>
  rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.workOrders.find((row) => row.id === detail.value));
const related = computed(() => state.value.plans.filter((plan) => plan.workOrder === detail.value));
watch([keyword, status, pageSize], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
function create() {
  if (saving.value) return;
  error.value = "";
  if (!form.name.trim()) {
    error.value = "请填写工单名称";
    return;
  }
  if (!form.date || !Number.isSafeInteger(form.qty) || form.qty <= 0) {
    error.value = "请填写日期和有效整数数量";
    return;
  }
  saving.value = true;
  if (
    commit((s) => {
      createWorkOrder(s, { ...form });
    }, "工单已创建，可关联生产计划")
  ) {
    dialog.value = false;
    form.name = "";
    form.customer = "";
    form.remark = "";
  }
  saving.value = false;
}
function newPlan(row: WorkOrder) {
  scheduling.value = row;
}
function manualPlan() {
  const row = scheduling.value;
  if (!row) return;
  scheduling.value = undefined;
  sessionStorage.setItem("wsn-selected-work-order", row.id);
  emit("navigate", "plans");
}
function importPlan() {
  if (!scheduling.value) return;
  importWorkOrder.value = scheduling.value.id;
  scheduling.value = undefined;
  detail.value = "";
  importing.value = true;
}
function imported() {
  importing.value = false;
  detail.value = importWorkOrder.value;
}
function viewPlan(planId: string) {
  sessionStorage.setItem("wsn-production-plan-detail", planId);
  emit("navigate", "plans");
}
</script>

<template>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      status = '';
      page = 1;
    "
  >
    <template #filters>
      <el-form-item label="关键词"
        ><el-input v-model="keyword" clearable placeholder="工单号、名称、客户"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select v-model="status" clearable placeholder="全部状态"
          ><el-option
            v-for="item in [...statuses, '已发货']"
            :key="item"
            :label="item"
            :value="item" /></el-select
      ></el-form-item>
    </template>
    <template #toolbar
      ><el-button
        type="primary"
        :icon="Plus"
        @click="
          dialog = true;
          error = '';
        "
        >新增工单</el-button
      ></template
    >
    <el-table :data="paged" empty-text="暂无工单，请先创建工单再安排生产计划">
      <el-table-column label="工单" min-width="230"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">{{ row.name }}</el-button>
          <div class="cell-sub code">{{ row.id }}</div></template
        ></el-table-column
      >
      <el-table-column prop="customer" label="客户" min-width="130" />
      <el-table-column label="产品" min-width="200"
        ><template #default="{ row }">{{
          material(row.product)?.name || row.product
        }}</template></el-table-column
      >
      <el-table-column prop="qty" label="数量" width="90" align="right" />
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column label="关联计划" width="100"
        ><template #default="{ row }">{{
          state.plans.filter((p) => p.workOrder === row.id).length
        }}</template></el-table-column
      >
      <el-table-column label="状态" width="110"
        ><template #default="{ row }"
          ><el-tag
            :type="
              row.status === '已发货' ? 'success' : row.status === '待出货' ? 'warning' : 'info'
            "
            >{{ row.status }}</el-tag
          ></template
        ></el-table-column
      >
      <el-table-column label="操作" width="180" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions
            :actions="[
              {
                label: '查看详情',
                action: () => {
                  detail = row.id;
                },
              },
              { label: '安排计划', action: () => newPlan(row), disabled: row.status === '已发货' },
            ]" /></template
      ></el-table-column>
    </el-table>
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
  <el-dialog
    :model-value="!!scheduling"
    title="安排生产计划"
    width="min(520px, 94vw)"
    @close="scheduling = undefined"
  >
    <p>工单：{{ scheduling?.name }}</p>
    <p class="muted">选择创建方式；Excel 导入的生产计划会自动关联当前工单。</p>
    <template #footer>
      <el-button @click="manualPlan">手工创建</el-button>
      <el-button type="primary" @click="importPlan">Excel 导入</el-button>
    </template>
  </el-dialog>
  <ProductionImport
    v-if="importing"
    :work-order="importWorkOrder"
    @close="importing = false"
    @imported="imported"
  />
  <el-dialog v-model="dialog" title="新增工单" width="600px">
    <el-form label-position="top" @submit.prevent="create"
      ><div class="form-grid">
        <el-form-item label="工单名称" required :error="!form.name.trim() ? error : ''"
          ><el-input v-model="form.name" maxlength="60"
        /></el-form-item>
        <el-form-item label="客户"
          ><el-input v-model="form.customer" maxlength="60"
        /></el-form-item>
        <el-form-item label="产品" required
          ><el-select v-model="form.product"
            ><el-option
              v-for="p in products"
              :key="p.id"
              :label="p.name"
              :value="p.id" /></el-select
        ></el-form-item>
        <el-form-item label="数量" required
          ><el-input-number v-model="form.qty" :min="1" :max="100000" :precision="0"
        /></el-form-item>
        <el-form-item label="日期" required
          ><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
      </div>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" type="textarea" maxlength="500" /></el-form-item
      ><el-alert v-if="error" :title="error" type="error" :closable="false"
    /></el-form>
    <template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="create">创建工单</el-button></template
    >
  </el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="工单详情"
    size="min(760px, 100vw)"
    @close="detail = ''"
  >
    <template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="工单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="名称">{{ selected.name }}</el-descriptions-item
        ><el-descriptions-item label="客户">{{ selected.customer || "—" }}</el-descriptions-item
        ><el-descriptions-item label="产品">{{
          material(selected.product)?.name || selected.product
        }}</el-descriptions-item
        ><el-descriptions-item label="数量">{{ selected.qty }}</el-descriptions-item
        ><el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item
        ><el-descriptions-item label="备注">{{
          selected.remark || "—"
        }}</el-descriptions-item></el-descriptions
      >
      <h3>工单进度</h3>
      <div class="button-row">
        <el-button
          v-for="item in statuses"
          :key="item"
          :type="selected.status === item ? 'primary' : 'default'"
          :disabled="selected.status === '已发货' || selected.status === item"
          @click="commit((s) => setWorkOrderStatus(s, selected!.id, item), '工单状态已更新')"
          >{{ item }}</el-button
        >
      </div>
      <p class="muted">前四种状态手动更新；完成发货后自动变为已发货。</p>
      <h3>关联生产计划</h3>
      <el-table :data="related" empty-text="暂无关联计划"
        ><el-table-column label="计划" min-width="180"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="viewPlan(row.id)">{{
              row.name
            }}</el-button></template
          ></el-table-column
        ><el-table-column label="产品" min-width="180"
          ><template #default="{ row }">{{
            material(row.product)?.name || row.product
          }}</template></el-table-column
        ><el-table-column prop="qty" label="数量" width="75" /><el-table-column
          prop="status"
          label="状态"
          width="90"
      /></el-table>
      <div class="dialog-actions">
        <el-button :disabled="selected.status === '已发货'" @click="newPlan(selected)"
          >安排生产计划</el-button
        ><el-button
          v-if="selected.status === '待出货'"
          type="primary"
          @click="emit('navigate', 'shipments')"
          >办理发货</el-button
        >
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.button-row .el-button {
  margin-left: 0;
}
</style>
