<script setup lang="ts">
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { Plus, Search, Upload } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { state, material, commit } from "./store";
import {
  products,
  today,
  id,
  finishPlan,
  planBom,
  requirements,
  type Plan,
} from "./model";
const ProductionImport = defineAsyncComponent(() => import("./ProductionImport.vue"));
const importing = ref(false);
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const page = ref(1);
const pageSize = ref(50);
const status = ref("");
const dialog = ref(false);
const detail = ref("");
const initialDetail = sessionStorage.getItem("wsn-production-plan-detail");
if (initialDetail) { detail.value = initialDetail; sessionStorage.removeItem("wsn-production-plan-detail"); }
const form = reactive({ name: "", product: "FG001", qty: 5, date: today(), workOrder: "" });
const workOrders = computed(() => state.value.workOrders.filter(order => order.status !== "已发货"));
const formError = ref("");
const saving = ref(false);
const initialWorkOrder = sessionStorage.getItem("wsn-selected-work-order");
if (initialWorkOrder) {
  form.workOrder = initialWorkOrder;
  dialog.value = true;
  sessionStorage.removeItem("wsn-selected-work-order");
}
const plans = computed(() =>
  state.value.plans.filter(
    (p) =>
      `${p.id}${p.name}${material(p.product).name}`.includes(keyword.value) &&
      (!status.value || p.status === status.value)
  )
);
const pagedPlans = computed(() =>
  plans.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
watch([keyword, status, pageSize], () => {
  page.value = 1;
});
const selected = computed(() => state.value.plans.find((p) => p.id === detail.value));
function create() {
  if (saving.value) return;
  formError.value = "";
  if (!form.workOrder || !form.name.trim() || !form.date) { formError.value = "请选择工单并填写计划名称和计划日期"; return; }
  saving.value = true;
  if (
    commit((s) => {
      if (!s.workOrders.some(order => order.id === form.workOrder && order.status !== "已发货")) throw new Error("请选择未发货工单");
      if (!form.name.trim() || !form.date) throw new Error("请填写计划名称和计划日期");
      if (
        !products.some((p) => p.id === form.product) ||
        !Number.isSafeInteger(form.qty) ||
        form.qty <= 0 ||
        form.qty > 100000
      )
        throw new Error("请选择产品并填写有效整数数量");
      const plan: Plan = { ...form, name: form.name.trim(), id: id("PP"), status: "待分析" };
      requirements(plan);
      s.plans.unshift(plan);
    }, "生产计划已创建，可到采购管理分析缺料")
  ) {
    dialog.value = false;
    form.name = "";
  }
  saving.value = false;
}
function issue(planId: string) {
  sessionStorage.setItem("wsn-selected-issue-plan", planId);
  emit("navigate", "issues");
}
function viewWorkOrder(orderId: string) {
  sessionStorage.setItem("wsn-work-order-detail", orderId);
  emit("navigate", "work-orders");
}
const finishing = ref(false);
async function finish(planId: string) {
  if (finishing.value) return;
  finishing.value = true;
  try { await ElMessageBox.confirm("确认完工后将增加成品库存，是否继续？", "确认完工入库", { type: "warning", confirmButtonText: "确认入库", cancelButtonText: "取消" }); } catch { finishing.value = false; return; }
  commit(s => finishPlan(s, planId), "完工入库完成");
  finishing.value = false;
}
function analyze(planId: string) {
  sessionStorage.setItem("wsn-selected-plan", planId);
  emit("navigate", "analysis");
}
// 本地数据减少或状态变化后，将分页约束在有效范围内。
watch(() => plans.value.length, (total) => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))); });
</script>
<template>


  <FaManagementList
    class="panel"
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
        ><el-input
          v-model="keyword"
          :prefix-icon="Search"
          clearable
          placeholder="计划号、名称或产品" /></el-form-item
      ><el-form-item label="计划状态"
        ><el-select v-model="status" clearable placeholder="全部状态"
          ><el-option
            v-for="s in ['待分析', '待备料', '已领料', '已完工']"
            :key="s"
            :label="s"
            :value="s" /></el-select
      ></el-form-item>
    </template>
    <template #toolbar
      ><div class="panel-heading">
        <el-button :icon="Upload" @click="importing = true">导入 Excel</el-button>
        <el-button type="primary" :icon="Plus" @click="dialog = true">新增生产计划</el-button>

        <h2>
          计划列表 <span class="count-badge">{{ plans.length }}</span>
        </h2>
        <span class="muted">需求分析 → 采购备料 → 领料 → 完工</span>
      </div></template
    >
    <el-table :data="pagedPlans" stripe empty-text="暂无生产计划"
      ><el-table-column label="生产计划" min-width="255"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">{{ row.name }}</el-button>
          <div class="cell-sub code">{{ row.id }}</div></template
        ></el-table-column
      ><el-table-column label="计划产品" min-width="220"
        ><template #default="{ row }"
          ><div class="cell-title">{{ material(row.product).name }}</div>
          <span class="cell-sub">{{ material(row.product).spec }}</span></template
        ></el-table-column
      ><el-table-column label="关联工单" min-width="180"><template #default="{ row }"><el-button v-if="row.workOrder" link type="primary" @click="viewWorkOrder(row.workOrder)">{{ state.workOrders.find(w => w.id === row.workOrder)?.name || row.workOrder }}</el-button><span v-else class="muted">—</span></template></el-table-column><el-table-column prop="qty" label="数量（台）" width="110" align="right" /><el-table-column
        prop="date"
        label="计划日期"
        width="125"
      /><el-table-column label="状态" width="110"
        ><template #default="{ row }"
          ><el-tag
            :type="
              row.status === '已完工' ? 'success' : row.status === '待备料' ? 'warning' : 'info'
            "
            >{{ row.status }}</el-tag
          ></template
        ></el-table-column
      ><el-table-column label="操作" width="190" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions :actions="['待分析', '待备料'].includes(row.status) ? [{ label: '分析缺料', action: () => analyze(row.id) }, { label: '生产领料', action: () => issue(row.id) }, { label: '查看详情', action: () => { detail = row.id; } }] : row.status === '已领料' ? [{ label: '完工入库', action: () => { finish(row.id); }, disabled: finishing }, { label: '查看详情', action: () => { detail = row.id; } }] : [{ label: '查看详情', action: () => { detail = row.id; } }]" /></template
        ></el-table-column
      ></el-table
    >
    <div class="pagination">
      <span>共 {{ plans.length }} 条记录</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="plans.length"
        layout="sizes, prev, pager, next"
      />
    </div>
    <div class="inline-note">
      生产领料通过领料单办理；完工后成品入库，再由工单办理发货。
    </div>
  </FaManagementList>
  <el-dialog v-model="dialog" title="新增生产计划" width="520px"
    ><el-form label-position="top" @submit.prevent="create"
      ><el-form-item label="关联工单" required :error="!form.workOrder ? formError : ''"><el-select v-model="form.workOrder" filterable placeholder="请先选择工单"><el-option v-for="order in workOrders" :key="order.id" :label="`${order.name}（${order.id}）`" :value="order.id" /></el-select></el-form-item><el-form-item label="计划名称" required :error="!form.name.trim() ? formError : ''"
        ><el-input
          v-model="form.name"
          placeholder="例如：十月包装机交付计划"
          maxlength="60" /></el-form-item
      ><el-form-item label="计划产品（预设 BOM）" required
        ><el-select v-model="form.product"
          ><el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" /></el-select
      ></el-form-item>
      <div class="form-grid">
        <el-form-item label="计划数量（台）" required
          ><el-input-number
            v-model="form.qty"
            :min="1"
            :max="100000"
            :precision="0" /></el-form-item
        ><el-form-item label="计划日期" required
          ><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD"
        /></el-form-item></div><el-alert v-if="formError" :title="formError" type="error" :closable="false" /></el-form
    ><template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="create">创建计划</el-button></template
    ></el-dialog
  >
  <el-drawer :model-value="!!selected" title="生产计划详情" size="620px" @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="计划号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="名称">{{ selected.name }}</el-descriptions-item
        ><el-descriptions-item label="关联工单"><el-button v-if="selected.workOrder" link type="primary" @click="viewWorkOrder(selected.workOrder)">{{ state.workOrders.find(w => w.id === selected!.workOrder)?.name || selected.workOrder }}</el-button><span v-else>—</span></el-descriptions-item
        ><el-descriptions-item label="产品">{{
          material(selected.product).name
        }}</el-descriptions-item
        ><el-descriptions-item label="数量">{{ selected.qty }} 台</el-descriptions-item
        ><el-descriptions-item label="状态">{{
          selected.status
        }}</el-descriptions-item></el-descriptions
      >
      <p v-if="selected.importSource" class="muted">来源：{{ selected.importSource.file }} / {{ selected.importSource.sheet }}，{{ selected.importSource.rows.length }} 条原始明细</p>
      <h3>{{ selected.importSource?.basis === 'total' ? '本次需求清单' : '单台产品 BOM' }}</h3>
      <el-table :data="planBom(selected)"
        ><el-table-column label="物料"
          ><template #default="{ row }"><el-button link type="primary" @click="emit('navigate', `materials/${row.material}`)">{{ material(row.material).name }}</el-button><el-tag v-if="selected.importSource" size="small" :type="selected.importSource.rows.some(r => r.material === row.material && r.created) ? 'success' : 'info'">{{ selected.importSource.rows.some(r => r.material === row.material && r.created) ? '本次新建' : '匹配已有' }}</el-tag></template></el-table-column
        ><el-table-column label="图号 / 规格" min-width="180"><template #default="{ row }">{{ material(row.material).details?.drawingNo || material(row.material).spec || '—' }}</template></el-table-column
        ><el-table-column label="单位" width="70"><template #default="{ row }">{{ material(row.material).unit }}</template></el-table-column
        ><el-table-column prop="qty" :label="selected.importSource?.basis === 'total' ? '需求量' : '单台用量'" width="90"
      /></el-table>
      <h3>工序与排程</h3>
      <el-empty description="暂未配置" :image-size="65" /></template
  ></el-drawer>
  <ProductionImport v-if="importing" :work-order="form.workOrder" @close="importing = false" @imported="planId => { importing = false; detail = planId; }" />
</template>
