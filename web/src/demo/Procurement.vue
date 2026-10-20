<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import {
  analysis,
  createDraft,
  convertRequest,
  validateLines,
  id,
  today,
  type Line,
  type Requisition,
} from "./model";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import DocumentEditor from "./DocumentEditor.vue";
import Purchases from "./Purchases.vue";
const props = defineProps<{ page: string }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref(""),
  status = ref(""),
  currentPage = ref(1),
  pageSize = ref(50),
  editing = ref(false),
  converting = ref(""),
  detail = ref("");
// 同一采购组件在采购单和请购单间复用，切页时消费指定来源，直接打开对应单据。
watch(
  () => props.page,
  (page) => {
    if (page !== "requests") return;
    const requestId = sessionStorage.getItem("wsn-selected-request");
    if (requestId) {
      detail.value = requestId;
      sessionStorage.removeItem("wsn-selected-request");
    }
  },
  { immediate: true }
);
const initial = sessionStorage.getItem("wsn-selected-plan");
const planId = ref(
  state.value.plans.some((p) => p.id === initial) ? initial! : state.value.plans[0]?.id || ""
);
const selectedPlan = computed(() => state.value.plans.find((p) => p.id === planId.value));
const analysisRows = computed(() =>
  selectedPlan.value ? analysis(state.value, selectedPlan.value) : []
);
const shortages = computed(() => analysisRows.value.filter((r) => r.shortage > 0));
const filtered = computed(() =>
  state.value.requests.filter(
    (r) =>
      `${r.id}${r.applicant}${r.lines.map((l) => material(l.material)?.name).join("")}`.includes(
        keyword.value
      ) &&
      (!status.value || r.status === status.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
);
const selected = computed(() => state.value.requests.find((r) => r.id === detail.value));
const convertingRequest = computed(() =>
  state.value.requests.find((r) => r.id === converting.value)
);
watch([keyword, status, pageSize], () => (currentPage.value = 1));
watch(
  () => filtered.value.length,
  (n) =>
    (currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(n / pageSize.value))))
);
function generate() {
  if (
    commit((s) => {
      createDraft(s, planId.value);
    }, "已按缺料物料生成采购底稿")
  )
    emit("navigate", "drafts");
}
function save(data: { person: string; supplier: string; lines: Line[] }) {
  if (
    commit(
      (s) => {
        if (converting.value) {
          convertRequest(s, converting.value, data.person, data.supplier);
          return;
        }
        validateLines(s, data.lines);
        if (!data.person.trim()) throw new Error("请填写请购人");
        s.requests.unshift({
          id: id("PR"),
          plan: "",
          date: today(),
          applicant: data.person.trim(),
          lines: data.lines,
          status: "待采购",
        });
      },
      converting.value ? "采购单已生成" : "请购单已保存"
    )
  ) {
    const converted = !!converting.value;
    editing.value = false;
    converting.value = "";
    if (converted) emit("navigate", "orders");
  }
}
function actions(row: Requisition) {
  return [
    { label: "详情", action: () => (detail.value = row.id) },
    ...(row.status === "待采购"
      ? [{ label: "生成采购单", action: () => (converting.value = row.id) }]
      : []),
  ];
}
</script>
<template>
  <Purchases v-if="page === 'orders'" @navigate="emit('navigate', $event)" />
  <template v-if="page === 'analysis'">
    <section class="panel analysis-selector">
      <div>
        <h2>选择生产计划</h2>
        <p class="muted">
          按计划 BOM 和计划数量计算需求，支持 Excel 导入清单；现场仓和成品仓默认不计入可用量。
        </p>
      </div>
      <el-select v-model="planId" placeholder="请选择生产计划" filterable
        ><el-option
          v-for="p in state.plans"
          :key="p.id"
          :label="`${p.name} / ${p.qty} 台 / ${p.status}`"
          :value="p.id"
      /></el-select>
    </section>
    <template v-if="selectedPlan">
      <section class="panel">
        <div class="panel-heading">
          <h2>
            物料需求分析 <span class="count-badge">{{ analysisRows.length }}</span>
          </h2>
          <span class="muted">需购 = BOM 需求 − 可分配库存 − 本计划待转底稿 / 在途</span>
        </div>
        <el-table :data="analysisRows" stripe
          ><el-table-column label="物料信息" min-width="220"
            ><template #default="{ row }"
              ><div class="cell-title">{{ material(row.material).name }}</div>
              <span class="cell-sub"
                >{{ row.material }} · {{ material(row.material).spec }}</span
              ></template
            ></el-table-column
          ><el-table-column
            prop="qty"
            label="BOM 需求量"
            min-width="105"
            align="right"
          /><el-table-column
            prop="stock"
            label="可用仓库存"
            min-width="115"
            align="right"
          /><el-table-column
            prop="reserved"
            label="其他计划占用"
            min-width="120"
            align="right"
          /><el-table-column
            prop="usable"
            label="可分配库存"
            min-width="115"
            align="right"
          /><el-table-column
            prop="pending"
            label="待转底稿 / 在途"
            min-width="115"
            align="right"
          /><el-table-column label="需购买数量" min-width="115" align="right"
            ><template #default="{ row }"
              ><strong :class="row.shortage ? 'shortage' : 'muted'">{{
                row.shortage
              }}</strong></template
            ></el-table-column
          ><el-table-column label="建议" min-width="105"
            ><template #default="{ row }"
              ><el-tag :type="row.shortage ? 'warning' : 'success'">{{
                row.shortage ? "需采购" : "已覆盖"
              }}</el-tag></template
            ></el-table-column
          ><el-table-column label="前置单据" min-width="175"
            ><template #default>{{ selectedPlan.id }}</template></el-table-column
          ></el-table
        >
        <div class="analysis-actions">
          <span v-if="['已领料', '已完工'].includes(selectedPlan.status)" class="muted"
            >该计划已领料，不再生成底稿。</span
          ><span v-else class="muted">仅为缺料生成一物料一底稿；库存充足的行不进入采购底稿。</span>
          <div class="analysis-action-buttons">
            <el-button
              type="primary"
              :icon="Plus"
              :disabled="!shortages.length || !['待分析', '待备料'].includes(selectedPlan.status)"
              @click="generate"
              >生成采购底稿</el-button
            ><el-button @click="emit('navigate', 'drafts')">查看底稿记录</el-button>
          </div>
        </div>
      </section> </template
    ><el-empty v-else description="暂无生产计划，请先创建"
      ><el-button type="primary" @click="emit('navigate', 'plans')"
        >前往生产计划</el-button
      ></el-empty
    >
  </template>

  <FaManagementList
    v-if="page === 'requests'"
    filterable
    @search="currentPage = 1"
    @reset="
      keyword = '';
      status = '';
      currentPage = 1;
    "
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" clearable placeholder="单号、请购人或物料" /></el-form-item
      ><el-form-item label="状态"
        ><el-select v-model="status" clearable placeholder="全部"
          ><el-option
            v-for="s in ['待采购', '已转采购']"
            :key="s"
            :label="s"
            :value="s" /></el-select></el-form-item></template
    ><template #toolbar
      ><el-button type="primary" @click="editing = true">新增请购单</el-button></template
    >
    <el-table :data="paged" stripe empty-text="暂无匹配请购单"
      ><el-table-column label="请购单号 / 日期" min-width="230"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">{{ row.id }}</el-button>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      ><el-table-column prop="applicant" label="请购人" min-width="150" /><el-table-column
        label="物料"
        min-width="220"
        ><template #default="{ row }">{{
          row.lines.map((l: Line) => material(l.material)?.name).join("、")
        }}</template></el-table-column
      ><el-table-column prop="status" label="状态" width="110" /><el-table-column
        label="操作"
        width="190"
        ><template #default="{ row }"
          ><FaTableActions :actions="actions(row)" /></template></el-table-column
    ></el-table>
    <div class="pagination">
      <span>共 {{ filtered.length }} 条</span
      ><el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filtered.length"
        layout="sizes, prev, pager, next"
      /></div
  ></FaManagementList>
  <el-dialog
    v-model="editing"
    title="新增请购单"
    width="min(1080px,94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    ><DocumentEditor kind="request" @save="save" @cancel="editing = false"
  /></el-dialog>
  <el-dialog
    :model-value="!!convertingRequest"
    title="请购转采购"
    width="min(1080px,94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    @close="converting = ''"
    ><DocumentEditor
      v-if="convertingRequest"
      kind="purchase"
      :locked-lines="convertingRequest.lines"
      @save="save"
      @cancel="converting = ''"
  /></el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="请购单详情"
    size="min(700px,95vw)"
    @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="请购人">{{ selected.applicant }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="状态">{{
          selected.status
        }}</el-descriptions-item></el-descriptions
      ><el-table :data="selected.lines"
        ><el-table-column label="物料"
          ><template #default="{ row }"
            >{{ material(row.material)?.name }}
            <div class="cell-sub">{{ material(row.material)?.spec }}</div></template
          ></el-table-column
        ><el-table-column prop="qty" label="数量" /><el-table-column label="单位"
          ><template #default="{ row }">{{
            material(row.material)?.unit
          }}</template></el-table-column
        ></el-table
      ></template
    ></el-drawer
  >
</template>
