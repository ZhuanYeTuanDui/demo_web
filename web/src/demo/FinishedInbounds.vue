<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import DataLink from "./DataLink.vue";
import { state, material, warehouseName, commit } from "./store";
import { createFinishedInbound, finishedProducts, id, today, type Line } from "./model";

const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(50);
const dialog = ref(false);
const detail = ref("");
const saving = ref(false);
const error = ref("");
const form = reactive({
  id: "",
  workOrder: "",
  warehouse: "CP01",
  date: today(),
  remark: "",
  lines: [] as Line[],
});
const baseline = ref("");
const products = computed(() => finishedProducts(state.value));
const workOrders = computed(() => state.value.workOrders.filter((w) => w.status !== "已发货"));
const warehouses = computed(() =>
  state.value.warehouses.filter((w) => w.id === "CP01" && !w.inactive)
);
const rows = computed(() =>
  (state.value.finishedInbounds || []).filter((row) =>
    `${row.id} ${row.workOrder} ${orderName(row.workOrder)} ${row.remark || ""}`
      .toLowerCase()
      .includes(keyword.value.trim().toLowerCase())
  )
);
const paged = computed(() =>
  rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() =>
  (state.value.finishedInbounds || []).find((row) => row.id === detail.value)
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
function orderName(orderId: string) {
  return state.value.workOrders.find((w) => w.id === orderId)?.name || orderId;
}
function viewOrder(orderId: string) {
  sessionStorage.setItem("wsn-work-order-detail", orderId);
  emit("navigate", "work-orders");
}
function open() {
  Object.assign(form, {
    id: id("FI"),
    workOrder: "",
    warehouse: "CP01",
    date: today(),
    remark: "",
    lines: [],
  });
  baseline.value = JSON.stringify(form);
  error.value = "";
  dialog.value = true;
}
function selectOrder() {
  // 工单仅提供默认值，入库明细保留独立快照，不更改生产计划。
  const order = state.value.workOrders.find((w) => w.id === form.workOrder);
  form.lines =
    order && products.value.some((p) => p.id === order.product)
      ? [{ material: order.product, qty: order.qty }]
      : [];
}
async function close() {
  if (saving.value) return;
  if (JSON.stringify(form) !== baseline.value) {
    try {
      await ElMessageBox.confirm("尚有未保存内容，确认放弃？", "取消新增入库单", {
        confirmButtonText: "放弃修改",
        cancelButtonText: "继续编辑",
        type: "warning",
      });
    } catch {
      return;
    }
  }
  dialog.value = false;
}
function beforeClose(done: () => void) {
  void close().then(() => {
    if (!dialog.value) done();
  });
}
async function create() {
  if (saving.value) return;
  error.value = "";
  if (
    !form.workOrder ||
    !form.warehouse ||
    !form.date ||
    !form.lines.length ||
    form.lines.some((l) => !l.material || !Number.isSafeInteger(l.qty) || l.qty < 1)
  ) {
    error.value = "请选择工单、成品仓库、日期，并填写有效成品和整数数量";
    return;
  }
  saving.value = true;
  const input = JSON.parse(JSON.stringify(form)) as typeof form;
  try {
    await ElMessageBox.confirm(
      "确认后将增加成品库存并生成入库流水，入库单不可重复执行。是否继续？",
      "确认成品入库",
      { type: "warning", confirmButtonText: "确认入库", cancelButtonText: "取消" }
    );
    if (
      commit((s) => {
        createFinishedInbound(s, input);
      }, "成品入库完成")
    )
      dialog.value = false;
  } catch {
    /* 用户取消确认，保留本次输入。 */
  } finally {
    saving.value = false;
  }
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
        ><el-input v-model="keyword" clearable placeholder="入库单号、工单或备注" /></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" :icon="Plus" @click="open">新增成品入库单</el-button></template
    >
    <el-table :data="paged" empty-text="暂无成品入库单">
      <el-table-column label="入库单号" min-width="210"
        ><template #default="{ row }"
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink></template
        ></el-table-column
      >
      <el-table-column label="关联工单" min-width="220"
        ><template #default="{ row }"
          ><DataLink @click="viewOrder(row.workOrder)">{{ orderName(row.workOrder) }}</DataLink>
          <div class="cell-sub">{{ row.workOrder }}</div></template
        ></el-table-column
      >
      <el-table-column label="仓库" min-width="140"
        ><template #default="{ row }">{{ warehouseName(row.warehouse) }}</template></el-table-column
      >
      <el-table-column prop="date" label="入库日期" width="120" />
      <el-table-column label="物料行数" width="100" align="right"
        ><template #default="{ row }">{{ row.lines.length }}</template></el-table-column
      >
      <el-table-column prop="remark" label="备注" min-width="180" />
      <el-table-column label="操作" width="110" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions
            :actions="[
              {
                label: '查看详情',
                action: () => {
                  detail = row.id;
                },
              },
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
    :model-value="dialog"
    title="新增成品入库单"
    width="min(960px, 96vw)"
    top="5vh"
    :before-close="beforeClose"
    :close-on-click-modal="false"
  >
    <el-form label-position="top" :disabled="saving" @submit.prevent="create">
      <div class="form-grid">
        <el-form-item label="关联工单" required
          ><el-select
            v-model="form.workOrder"
            filterable
            placeholder="选择未发货工单"
            @change="selectOrder"
            ><el-option
              v-for="w in workOrders"
              :key="w.id"
              :label="`${w.name}（${w.id}）`"
              :value="w.id" /></el-select
        ></el-form-item>
        <el-form-item label="成品仓库" required
          ><el-select v-model="form.warehouse" placeholder="选择成品仓库"
            ><el-option
              v-for="w in warehouses"
              :key="w.id"
              :label="w.name"
              :value="w.id" /></el-select
        ></el-form-item>
        <el-form-item label="入库日期" required
          ><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" maxlength="500" /></el-form-item>
      </div>
      <div class="panel-heading compact">
        <h3>成品明细</h3>
        <el-button @click="form.lines.push({ material: '', qty: 1 })">添加成品</el-button>
      </div>
      <el-table :data="form.lines" max-height="320" empty-text="选择工单后可添加成品">
        <el-table-column label="成品" min-width="260"
          ><template #default="{ row }"
            ><el-select v-model="row.material" filterable placeholder="从成品分类选择"
              ><el-option
                v-for="p in products"
                :key="p.id"
                :label="`${p.name}（${p.id}）`"
                :value="p.id"
                :disabled="
                  form.lines.some((l) => l !== row && l.material === p.id)
                " /></el-select></template
        ></el-table-column>
        <el-table-column label="规格" min-width="150"
          ><template #default="{ row }">{{
            material(row.material)?.spec || "—"
          }}</template></el-table-column
        >
        <el-table-column label="入库数量" width="170"
          ><template #default="{ row, $index }"
            ><el-input-number
              v-model="row.qty"
              :min="1"
              :max="100000"
              :precision="0"
              controls-position="right"
              :aria-label="`入库数量 ${$index + 1}`"
              style="width: 140px" /></template
        ></el-table-column>
        <el-table-column label="单位" width="70"
          ><template #default="{ row }">{{
            material(row.material)?.unit || "—"
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="80"
          ><template #default="{ $index }"
            ><el-button text type="danger" @click="form.lines.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="close">取消</el-button
      ><el-button type="primary" :loading="saving" @click="create">确认入库</el-button></template
    >
  </el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="成品入库单详情"
    size="min(860px, 96vw)"
    @close="detail = ''"
  >
    <template v-if="selected">
      <el-descriptions :column="1" border
        ><el-descriptions-item label="入库单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="关联工单"
          ><DataLink @click="viewOrder(selected.workOrder)">{{
            orderName(selected.workOrder)
          }}</DataLink></el-descriptions-item
        ><el-descriptions-item label="仓库">{{
          warehouseName(selected.warehouse)
        }}</el-descriptions-item
        ><el-descriptions-item label="入库日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="备注">{{
          selected.remark || "—"
        }}</el-descriptions-item></el-descriptions
      >
      <h3>入库明细</h3>
      <el-table :data="selected.lines"
        ><el-table-column label="成品" min-width="200"
          ><template #default="{ row }"
            ><DataLink
              :href="`#materials/${row.material}`"
              @click="emit('navigate', `materials/${row.material}`)"
              >{{ material(row.material)?.name || row.material }}</DataLink
            >
            <div class="cell-sub">{{ row.material }}</div></template
          ></el-table-column
        ><el-table-column label="规格" min-width="170"
          ><template #default="{ row }">{{
            material(row.material)?.spec || "—"
          }}</template></el-table-column
        ><el-table-column prop="qty" label="数量" width="100" /><el-table-column
          label="单位"
          width="70"
          ><template #default="{ row }">{{
            material(row.material)?.unit || "—"
          }}</template></el-table-column
        ></el-table
      >
    </template>
  </el-drawer>
</template>
