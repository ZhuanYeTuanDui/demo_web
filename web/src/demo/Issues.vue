<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import { state, material, warehouseName, commit } from "./store";
import { createIssue, requirements, stockKey } from "./model";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(50);
const dialog = ref(false);
const detail = ref("");
const saving = ref(false);
const error = ref("");
const form = reactive({
  plan: "",
  lines: [] as { warehouse: string; material: string; qty: number }[],
});
const plans = computed(() =>
  state.value.plans.filter((plan) => ["待分析", "待备料"].includes(plan.status))
);
const warehouses = computed(() => state.value.warehouses.filter((w) => w.available && !w.inactive));
const rows = computed(() =>
  state.value.issues.filter((row) =>
    `${row.id}${row.plan}${state.value.plans.find((p) => p.id === row.plan)?.name || ""}`.includes(
      keyword.value
    )
  )
);
const paged = computed(() =>
  rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.issues.find((row) => row.id === detail.value));
watch([keyword, pageSize], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
watch(
  () => form.plan,
  (planId) => {
    const plan = state.value.plans.find((p) => p.id === planId);
    error.value = "";
    form.lines = [];
    if (!plan) return;
    // 按实际仓库库存拆分建议领料行，用户仍需确认出库仓库。
    for (const line of requirements(plan)) {
      let remaining = line.qty;
      for (const warehouse of warehouses.value) {
        const qty = Math.min(
          remaining,
          state.value.stocks[stockKey(warehouse.id, line.material)] || 0
        );
        if (qty > 0) form.lines.push({ ...line, warehouse: warehouse.id, qty });
        remaining -= qty;
      }
      if (remaining > 0)
        form.lines.push({ ...line, warehouse: warehouses.value[0]?.id || "", qty: remaining });
    }
  }
);
function open() {
  form.plan = "";
  form.lines = [];
  error.value = "";
  dialog.value = true;
}
const preselected = sessionStorage.getItem("wsn-selected-issue-plan");
if (preselected) {
  sessionStorage.removeItem("wsn-selected-issue-plan");
  dialog.value = true;
  form.plan = preselected;
}
async function create() {
  if (saving.value) return;
  error.value = "";
  if (!form.plan || !form.lines.length) {
    error.value = "请选择生产计划";
    return;
  }
  if (
    form.lines.some((line) => !line.warehouse || !Number.isSafeInteger(line.qty) || line.qty <= 0)
  ) {
    error.value = "请为全部物料选择仓库并填写正整数数量";
    return;
  }
  saving.value = true;
  try {
    await ElMessageBox.confirm("确认后将创建领料单并扣减库存，是否继续？", "确认生产领料", {
      type: "warning",
      confirmButtonText: "确认领料",
      cancelButtonText: "取消",
    });
  } catch {
    saving.value = false;
    return;
  }
  if (
    commit((s) => {
      createIssue(
        s,
        form.plan,
        form.lines.map((line) => ({ ...line }))
      );
    }, "领料单已创建，库存已扣减并生成出库记录")
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
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" clearable placeholder="领料单号、生产计划" /></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" :icon="Plus" @click="open">新增领料单</el-button></template
    >
    <el-table :data="paged" empty-text="暂无领料单"
      ><el-table-column prop="id" label="领料单号" min-width="210" /><el-table-column
        label="生产计划"
        min-width="230"
        ><template #default="{ row }"
          >{{ state.plans.find((p) => p.id === row.plan)?.name || row.plan }}
          <div class="cell-sub code">{{ row.plan }}</div></template
        ></el-table-column
      ><el-table-column prop="date" label="领料日期" width="130" /><el-table-column
        label="物料行数"
        width="110"
        ><template #default="{ row }">{{ row.lines.length }}</template></el-table-column
      ><el-table-column label="状态" width="100"
        ><template #default><el-tag type="success">已出库</el-tag></template></el-table-column
      ><el-table-column label="操作" width="130" fixed="right"
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
  <el-dialog v-model="dialog" title="新增领料单" width="min(900px, 96vw)">
    <el-form label-position="top" @submit.prevent="create"
      ><el-form-item label="生产计划" required :error="!form.plan ? error : ''"
        ><el-select v-model="form.plan" filterable placeholder="请选择未领料生产计划"
          ><el-option
            v-for="plan in plans"
            :key="plan.id"
            :label="`${plan.name}（${plan.id}）`"
            :value="plan.id" /></el-select
      ></el-form-item>
      <el-table :data="form.lines" max-height="420" empty-text="选择计划后带出 BOM 需求"
        ><el-table-column label="物料" min-width="200"
          ><template #default="{ row }"
            >{{ material(row.material)?.name || row.material }}
            <div class="cell-sub">{{ row.material }}</div></template
          ></el-table-column
        ><el-table-column label="出库仓库" min-width="180"
          ><template #default="{ row }"
            ><el-select v-model="row.warehouse" aria-label="出库仓库"
              ><el-option
                v-for="w in warehouses"
                :key="w.id"
                :label="w.name"
                :value="w.id" /></el-select></template></el-table-column
        ><el-table-column label="仓库库存" width="110" align="right"
          ><template #default="{ row }">{{
            state.stocks[stockKey(row.warehouse, row.material)] || 0
          }}</template></el-table-column
        ><el-table-column label="领用数量" width="170"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.qty"
              :min="1"
              :max="100000000"
              :precision="0"
              controls-position="right"
              :aria-label="`${material(row.material)?.name}领用数量`"
              style="width: 140px" /></template></el-table-column
      ></el-table>
      <p class="muted">本轮按整份计划领料；可调整各仓库分配数量，合计必须与 BOM 需求一致。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" /> </el-form
    ><template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="create"
        >确认领料并出库</el-button
      ></template
    >
  </el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="领料单详情"
    size="min(780px, 100vw)"
    @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="领料单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="生产计划">{{
          state.plans.find((p) => p.id === selected!.plan)?.name || selected.plan
        }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{
          selected.date
        }}</el-descriptions-item></el-descriptions
      >
      <h3>出库物料</h3>
      <el-table :data="selected.lines"
        ><el-table-column label="物料" min-width="200"
          ><template #default="{ row }">{{
            material(row.material)?.name || row.material
          }}</template></el-table-column
        ><el-table-column label="仓库" min-width="140"
          ><template #default="{ row }">{{
            warehouseName(row.warehouse)
          }}</template></el-table-column
        ><el-table-column prop="qty" label="出库数量" width="100" align="right"
      /></el-table>
      <div class="dialog-actions">
        <el-button @click="emit('navigate', 'movements')">查看出入库记录</el-button>
      </div></template
    ></el-drawer
  >
</template>
