<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import DataLink from "./DataLink.vue";
import { state, material, warehouseName, commit } from "./store";
import { usePageActivation } from "./page-cache";
import { createIssue, auditIssue, unauditIssue, requirements, stockKey, type Issue } from "./model";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(50);
const dialog = ref(false);
const detail = ref("");
const saving = ref(false);
const error = ref("");
const materialKeyword = ref("");
const detailKeyword = ref("");
const form = reactive({
  plan: "",
  lines: [] as { warehouse: string; material: string; qty: number }[],
});
const plans = computed(() =>
  state.value.plans.filter((plan) => (plan.auditStatus || "已审核") === "已审核")
);
const warehouses = computed(() => state.value.warehouses.filter((w) => !w.inactive));
const stockedWarehouses = (materialId: string) => warehouses.value.filter(warehouse =>
  (state.value.stocks[stockKey(warehouse.id, materialId)] || 0) > 0
);
function matchesMaterial(materialId: string, query: string) {
  const item = material(materialId);
  return `${materialId} ${item?.name || ""} ${item?.spec || ""} ${item?.details?.drawingNo || ""}`
    .toLowerCase().includes(query.trim().toLowerCase());
}
// 搜索只影响展示；提交仍包含其他搜索条件下已填写的有库存物料。
const stockedLines = computed(() => form.lines.filter(line => stockedWarehouses(line.material).length > 0));
const visibleLines = computed(() => stockedLines.value.filter(line => matchesMaterial(line.material, materialKeyword.value)));
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
const detailLines = computed(() => selected.value?.lines.filter(line => matchesMaterial(line.material, detailKeyword.value)) || []);
watch(detail, () => { detailKeyword.value = ""; });
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
    materialKeyword.value = "";
    form.lines = [];
    if (!plan) return;
    // 按实际仓库库存拆分建议领料行，用户仍需确认出库仓库。
    for (const line of requirements(plan)) {
      if (material(line.material)?.details?.inactive) continue;
      let remaining = line.qty;
      for (const warehouse of warehouses.value) {
        const qty = Math.min(
          remaining,
          state.value.stocks[stockKey(warehouse.id, line.material)] || 0
        );
        if (qty > 0) form.lines.push({ ...line, warehouse: warehouse.id, qty });
        remaining -= qty;
      }
    }
  }
);
function open() {
  form.plan = "";
  form.lines = [];
  error.value = "";
  materialKeyword.value = "";
  dialog.value = true;
}
usePageActivation(() => {
  const planId = sessionStorage.getItem("wsn-selected-issue-plan");
  if (planId) {
    sessionStorage.removeItem("wsn-selected-issue-plan");
    dialog.value = true;
    form.plan = planId;
  }
});
async function create() {
  if (saving.value) return;
  error.value = "";
  if (!form.plan || !stockedLines.value.length) {
    error.value = "请选择生产计划并保留至少一条领用物料";
    return;
  }
  if (
    stockedLines.value.some((line) => !line.warehouse || !Number.isSafeInteger(line.qty) || line.qty <= 0)
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
        stockedLines.value.map((line) => ({ ...line }))
      );
    }, "领料单已创建，库存已扣减并生成出库记录")
  )
    dialog.value = false;
  saving.value = false;
}
async function toggleAudit(row: Issue) {
  const audited = (row.auditStatus || "已审核") === "已审核";
  try {
    await ElMessageBox.confirm(
      audited
        ? `返审领料单 ${row.id} 将恢复本单出库库存，是否继续？`
        : `审核领料单 ${row.id} 将重新校验并扣减库存，是否继续？`,
      audited ? "返审领料单" : "审核领料单",
      {
        type: "warning",
        confirmButtonText: audited ? "确认返审" : "审核并出库",
        cancelButtonText: "取消",
      }
    );
  } catch {
    return;
  }
  commit(
    (s) => (audited ? unauditIssue(s, row.id) : auditIssue(s, row.id)),
    audited ? "领料单已返审，库存已恢复" : "领料单已审核并出库"
  );
}
function actions(row: Issue) {
  return [
    {
      label: "查看详情",
      action: () => {
        detail.value = row.id;
      },
    },
    {
      label: row.auditStatus === "未审核" ? "审核并出库" : "返审",
      action: () => {
        toggleAudit(row);
      },
    },
  ];
}
function removeLine(line: (typeof form.lines)[number]) {
  const index = form.lines.indexOf(line);
  if (index >= 0) form.lines.splice(index, 1);
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
        ><template #default="{ row }"
          ><el-tag :type="row.auditStatus === '未审核' ? 'info' : 'success'">{{
            row.auditStatus === "未审核" ? "未审核" : "已审核 / 已出库"
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="操作" width="130" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions :actions="actions(row)" /></template></el-table-column
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
        ><el-select v-model="form.plan" filterable placeholder="请选择生产计划"
          ><el-option
            v-for="plan in plans"
            :key="plan.id"
            :label="`${plan.name}（${plan.id}）`"
            :value="plan.id" /></el-select
      ></el-form-item>
      <el-form-item label="搜索物料"><el-input v-model="materialKeyword" clearable placeholder="名称、编码、规格型号" /></el-form-item>
      <el-table :data="visibleLines" max-height="420" :empty-text="form.plan ? '暂无符合条件的有库存 BOM 物料' : '选择计划后带出有库存的 BOM 物料'"
        ><el-table-column label="物料" min-width="200"
          ><template #default="{ row }"
            ><DataLink :href="`#materials/${row.material}`" @click="emit('navigate', `materials/${row.material}`)">{{ material(row.material)?.name || row.material }}</DataLink>
            <div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || '—' }}</div></template
          ></el-table-column
        ><el-table-column label="出库仓库" min-width="180"
          ><template #default="{ row }"
            ><el-select v-model="row.warehouse" aria-label="出库仓库"
              ><el-option
                v-for="w in stockedWarehouses(row.material)"
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
        ><el-table-column label="操作" width="90" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="danger" @click="removeLine(row)"
              >移除</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <p class="muted">
        仅展示有实际库存的 BOM 物料，可移除本次不领用的物料，同一计划允许多次领料。只按所选仓库实际库存出库，不扣除需求分析占用，不计算
        BOM 剩余量。
      </p>
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
        ><el-descriptions-item label="审核状态">{{
          selected.auditStatus || "已审核"
        }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{
          selected.date
        }}</el-descriptions-item></el-descriptions
      >
      <h3>出库物料</h3>
      <el-form label-position="top"><el-form-item label="搜索物料"><el-input v-model="detailKeyword" clearable placeholder="名称、编码、规格型号" /></el-form-item></el-form>
      <el-table :data="detailLines" max-height="420" empty-text="暂无匹配物料"
        ><el-table-column label="物料" min-width="200"
          ><template #default="{ row }"><DataLink :href="`#materials/${row.material}`" @click="emit('navigate', `materials/${row.material}`)">{{ material(row.material)?.name || row.material }}</DataLink><div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || '—' }}</div></template></el-table-column
        ><el-table-column label="仓库" min-width="140"
          ><template #default="{ row }">{{
            warehouseName(row.warehouse)
          }}</template></el-table-column
        ><el-table-column prop="qty" label="出库数量" width="100" align="right"
      /></el-table>
      <div class="dialog-actions">
        <el-button @click="emit('navigate', 'movements')">查看物料出入库</el-button>
      </div></template
    ></el-drawer
  >
</template>
