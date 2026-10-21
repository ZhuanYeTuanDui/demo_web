<script setup lang="ts">
import DataLink from "./DataLink.vue";
import { computed, ref, watch } from "vue";
import { ArrowRight, Box, ShoppingCart, Calendar, Collection } from "@element-plus/icons-vue";
import { state } from "./store";
import { stockKey, type WorkOrderStatus } from "./model";

const emit = defineEmits<{ navigate: [page: string] }>();
// 完成以已发货为准，百分比仅表达业务阶段，不推算实际工时或物料完成率。
const progressByStatus: Record<WorkOrderStatus, number> = {
  立项中: 0,
  采购中: 25,
  装配中: 50,
  待出货: 75,
  已发货: 100,
};
const stages = Object.keys(progressByStatus) as WorkOrderStatus[];
const ongoing = computed(() => state.value.workOrders.filter((order) => order.status !== "已发货"));
const completed = computed(
  () => state.value.workOrders.filter((order) => order.status === "已发货").length
);
const selectedId = ref("");
watch(
  () => state.value.workOrders.map((order) => `${order.id}:${order.status}`).join("|"),
  () => {
    const current = state.value.workOrders.find((order) => order.id === selectedId.value);
    if (!current || (current.status === "已发货" && ongoing.value.length))
      selectedId.value = ongoing.value[0]?.id || state.value.workOrders[0]?.id || "";
  },
  { immediate: true }
);
const selectedOrder = computed(() =>
  state.value.workOrders.find((order) => order.id === selectedId.value)
);
const selectedPlans = computed(() =>
  state.value.plans.filter((plan) => plan.workOrder === selectedId.value)
);
const planIds = computed(() => new Set(selectedPlans.value.map((plan) => plan.id)));
const selectedDrafts = computed(() =>
  state.value.drafts.filter((draft) => planIds.value.has(draft.plan))
);
const draftIds = computed(() => new Set(selectedDrafts.value.map((draft) => draft.id)));
const selectedPurchases = computed(() =>
  state.value.purchases.filter(
    (order) =>
      !order.mergedInto && order.lines.some((line) => line.draft && draftIds.value.has(line.draft))
  )
);
const selectedIssues = computed(() =>
  state.value.issues.filter((issue) => planIds.value.has(issue.plan))
);
const selectedShipments = computed(() =>
  state.value.shipments.filter((shipment) => shipment.workOrder === selectedId.value)
);
function switchOrder(offset: number) {
  if (!ongoing.value.length) return;
  const index = ongoing.value.findIndex((order) => order.id === selectedId.value);
  selectedId.value =
    ongoing.value[(index + offset + ongoing.value.length) % ongoing.value.length]!.id;
}
function viewOrder() {
  if (!selectedOrder.value) return;
  sessionStorage.setItem("wsn-work-order-detail", selectedOrder.value.id);
  emit("navigate", "work-orders");
}
function viewPlan(id: string) {
  sessionStorage.setItem("wsn-production-plan-detail", id);
  emit("navigate", "plans");
}
// 工作台直接订阅同一份业务状态，单据和库存变动后统计同步更新。
const sections = computed(() => [
  {
    title: "收发货与领料",
    icon: Box,
    route: "receipts",
    description: "跟进分批收货、生产领料和成品发货，单据与库存同步。",
    metrics: [
      {
        label: "收货单",
        value: state.value.receipts.length,
        unit: "笔",
        note: "确认即入库，支持分次收货",
        route: "receipts",
      },
      {
        label: "领料单",
        value: state.value.issues.length,
        unit: "笔",
        note: "关联生产计划与出库记录",
        route: "issues",
      },
      {
        label: "待出货工单",
        value: state.value.workOrders.filter((w) => w.status === "待出货").length,
        unit: "个",
        note: `已生成 ${state.value.shipments.length} 笔发货单`,
        route: "shipments",
      },
      {
        label: "成品库存",
        value: state.value.materials.reduce(
          (sum, m) => sum + (state.value.stocks[stockKey("CP01", m.id)] || 0),
          0
        ),
        unit: "台",
        note: "完工入库后可办理发货",
        route: "finished-stock",
      },
    ],
  },
  {
    title: "库存概览",
    icon: Box,
    route: "stock",
    description: "查看分仓库存、维护仓库和物料档案，追溯每次出入库。",
    metrics: [
      {
        label: "有库存物料",
        value: state.value.materials.filter((m) =>
          state.value.warehouses.some((w) => (state.value.stocks[stockKey(w.id, m.id)] || 0) > 0)
        ).length,
        unit: "种",
        note: `共 ${state.value.materials.length} 种物料档案`,
        route: "materials",
      },
      {
        label: "管理仓库",
        value: state.value.warehouses.length,
        unit: "个",
        note: `${state.value.warehouses.filter((w) => w.available && !w.inactive).length} 个正常仓库参与可用量计算`,
        route: "warehouses",
      },
      {
        label: "库存变动记录",
        value: state.value.movements.length,
        unit: "笔",
        note: "采购收货与生产领料自动记录",
        route: "movements",
      },
    ],
  },
  {
    title: "生产概览",
    icon: Calendar,
    route: "plans",
    description: "从生产计划展开 BOM，分析库存缺料，再跟进领料与完工。",
    metrics: [
      {
        label: "生产计划",
        value: state.value.plans.length,
        unit: "个",
        note: "支持预设 BOM 与 Excel 物料清单",
        route: "plans",
      },
      {
        label: "待分析 / 备料",
        value: state.value.plans.filter((p) => ["待分析", "待备料"].includes(p.status)).length,
        unit: "个",
        note: "生产计划内分析缺料，核对物料缺口",
        route: "plans",
      },
      {
        label: "已完工",
        value: state.value.plans.filter((p) => p.status === "已完工").length,
        unit: "个",
        note: "成品入库自动留存记录",
        route: "plans",
      },
    ],
  },
  {
    title: "采购底稿",
    icon: Collection,
    route: "drafts",
    description: "保存 BOM 与库存分析快照，按生产计划归集底稿，勾选物料后跨计划组合采购。",
    metrics: [
      {
        label: "底稿记录",
        value: state.value.drafts.length,
        unit: "份",
        note: "每个生产计划一张，保留物料计算快照",
        route: "drafts",
      },
      {
        label: "待采购核对",
        value: state.value.drafts.filter((d) => d.status === "待采购").length,
        unit: "份",
        note: "与仓库手工请购单独立管理",
        route: "drafts",
      },
      {
        label: "已转采购",
        value: state.value.drafts.filter((d) => d.status === "已转采购").length,
        unit: "份",
        note: "可追溯对应采购订单",
        route: "orders",
      },
    ],
  },
  {
    title: "采购概览",
    icon: ShoppingCart,
    route: "orders",
    description: "临时缺料由仓库录入请购单，采购审核后跟进分批收货。",
    metrics: [
      {
        label: "待采购请购单",
        value: state.value.requests.filter((r) => r.status === "待采购").length,
        unit: "笔",
        note: "待核对并生成采购单",
        route: "requests",
      },
      {
        label: "待收货采购单",
        value: state.value.purchases.filter(
          (p) => p.status === "已审核" && p.receiptStatus !== "全部收货" && !p.mergedInto
        ).length,
        unit: "笔",
        note: "确认收货后更新库存",
        route: "orders",
      },
      {
        label: "采购记录",
        value: state.value.purchases.filter((p) => !p.mergedInto).length,
        unit: "笔",
        note: "未审核、已审核及收货进度",
        route: "orders",
      },
    ],
  },
]);
const flow = [
  { label: "工单立项", route: "work-orders" },
  { label: "生产计划", route: "plans" },
  { label: "生产计划内分析缺料", route: "plans" },
  { label: "采购底稿", route: "drafts" },
  { label: "采购下单", route: "orders" },
  { label: "收货入库", route: "receipts" },
  { label: "生产领料", route: "issues" },
  { label: "完工入库", route: "plans" },
  { label: "成品发货", route: "shipments" },
];
</script>

<template>
  <div class="dashboard">
    <div class="page-heading">
      <div>
        <h1>首页工作台</h1>
        <p>跟进工单进度，快速处理采购、收货、领料和发货。</p>
      </div>
    </div>
    <section class="order-overview" aria-label="工单概览">
      <div>
        <span>工单总数</span
        ><strong data-test="work-order-total">{{ state.workOrders.length }}</strong>
      </div>
      <div>
        <span>已完成工单</span><strong data-test="work-order-completed">{{ completed }}</strong
        ><small>已发货</small>
      </div>
      <div>
        <span>进行中工单</span><strong data-test="work-order-active">{{ ongoing.length }}</strong>
      </div>
      <div>
        <span>完成率</span
        ><strong
          >{{ state.workOrders.length ? Math.round((completed / state.workOrders.length) * 100) : 0
          }}<small>%</small></strong
        >
      </div>
    </section>
    <section class="panel order-focus" aria-label="当前工单进度">
      <div class="order-focus-heading">
        <h2>工单进度</h2>
        <div class="order-switch">
          <el-button
            :disabled="ongoing.length < 2"
            aria-label="上一个进行中工单"
            @click="switchOrder(-1)"
            >上一工单</el-button
          >
          <el-select
            v-if="ongoing.length"
            v-model="selectedId"
            aria-label="切换进行中工单"
            filterable
            placeholder="选择进行中的工单"
          >
            <el-option
              v-for="order in ongoing"
              :key="order.id"
              :value="order.id"
              :label="`${order.name} · ${order.status}`"
            />
          </el-select>
          <el-button
            :disabled="ongoing.length < 2"
            aria-label="下一个进行中工单"
            @click="switchOrder(1)"
            >下一工单</el-button
          >
        </div>
      </div>
      <template v-if="selectedOrder">
        <div class="order-identity">
          <div>
            <DataLink @click="viewOrder">{{ selectedOrder.name }}</DataLink>
            <p class="muted">
              {{ selectedOrder.id }} · {{ selectedOrder.customer || "未填写客户" }}
            </p>
          </div>
          <el-tag :type="selectedOrder.status === '已发货' ? 'success' : 'primary'">{{
            selectedOrder.status
          }}</el-tag>
        </div>
        <el-progress
          :percentage="progressByStatus[selectedOrder.status]"
          :status="selectedOrder.status === '已发货' ? 'success' : undefined"
          :stroke-width="10"
        />
        <ol class="order-stages">
          <li
            v-for="stage in stages"
            :key="stage"
            :class="{ reached: progressByStatus[stage] <= progressByStatus[selectedOrder.status] }"
            :aria-current="stage === selectedOrder.status ? 'step' : undefined"
          >
            {{ stage }}
          </li>
        </ol>
        <p class="muted progress-note">
          阶段进度：立项中 0% → 采购中 25% → 装配中 50% → 待出货 75% → 已发货
          100%；前四阶段由人工更新。
        </p>
        <div class="order-related">
          <div>
            <span>关联生产计划</span
            ><strong data-test="selected-plan-count">{{ selectedPlans.length }}</strong>
          </div>
          <div>
            <span>采购底稿</span
            ><strong data-test="selected-draft-count">{{ selectedDrafts.length }}</strong
            ><small>待采购 {{ selectedDrafts.filter((d) => d.status === "待采购").length }}</small>
          </div>
          <div>
            <span>关联采购单</span
            ><strong data-test="selected-purchase-count">{{ selectedPurchases.length }}</strong
            ><small>按底稿来源追溯</small>
          </div>
          <div>
            <span>领料 / 发货单</span
            ><strong>{{ selectedIssues.length }} / {{ selectedShipments.length }}</strong>
          </div>
        </div>
        <el-table
          :data="selectedPlans"
          max-height="260"
          empty-text="暂无关联计划，可进入工单安排计划或导入 Excel"
        >
          <el-table-column label="生产计划" min-width="200"
            ><template #default="{ row }"
              ><DataLink @click="viewPlan(row.id)">{{
                row.name
              }}</DataLink></template
            ></el-table-column
          >
          <el-table-column prop="qty" label="计划数量（台）" width="135" />
          <el-table-column prop="date" label="计划日期" width="130" />
          <el-table-column prop="status" label="计划状态" width="110" />
        </el-table>
        <div class="order-quick-actions">
          <el-button type="primary" @click="viewOrder">查看工单</el-button
          ><el-button @click="emit('navigate', 'plans')">生产计划</el-button
          ><el-button @click="emit('navigate', 'drafts')">采购底稿</el-button
          ><el-button @click="emit('navigate', 'receipts')">收货单</el-button
          ><el-button @click="emit('navigate', 'issues')">领料单</el-button
          ><el-button @click="emit('navigate', 'shipments')">成品发货</el-button>
        </div>
      </template>
      <el-empty v-else description="暂无工单，先创建工单开始安排生产"
        ><el-button type="primary" @click="emit('navigate', 'work-orders')"
          >创建工单</el-button
        ></el-empty
      >
    </section>
    <section class="panel dashboard-flow" aria-label="业务流程">
      <div class="panel-heading">
        <h2>业务流程</h2>
        <span class="muted">临时缺料可从请购单单独发起</span>
      </div>
      <div class="workflow">
        <template v-for="(step, index) in flow" :key="step.label">
          <a :href="`#${step.route}`" @click.prevent="emit('navigate', step.route)">{{
            step.label
          }}</a>
          <el-icon v-if="index < flow.length - 1"><ArrowRight /></el-icon>
        </template>
      </div>
    </section>
    <section v-for="section in sections" :key="section.title" class="dashboard-section">
      <div class="dashboard-section-heading">
        <div>
          <h2>
            <el-icon><component :is="section.icon" /></el-icon>{{ section.title }}
          </h2>
          <p class="muted">{{ section.description }}</p>
        </div>
        <a
          :href="`#${section.route}`"
          class="dashboard-entry"
          @click.prevent="emit('navigate', section.route)"
          >进入管理 <el-icon><ArrowRight /></el-icon
        ></a>
      </div>
      <div class="metric-grid">
        <a
          v-for="metric in section.metrics"
          :key="metric.label"
          :href="`#${metric.route}`"
          class="metric dashboard-metric"
          @click.prevent="emit('navigate', metric.route)"
        >
          <span>{{ metric.label }}</span
          ><strong
            >{{ metric.value }}<small>{{ metric.unit }}</small></strong
          >
          <p>{{ metric.note }}</p>
        </a>
      </div>
    </section>
    <el-alert
      title="本地演示：支持跨计划采购、审核、分批收货、领料与成品发货；工单前四种状态由人工切换，数据仅保存在当前浏览器。"
      type="info"
      :closable="false"
      show-icon
    />
  </div>
</template>

<style scoped>
.order-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-panel);
  background: var(--el-bg-color);
  margin-bottom: 18px;
}
.order-overview > div {
  padding: 18px 22px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.order-overview > div:last-child {
  border-right: 0;
}
.order-overview span,
.order-related span {
  display: block;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.order-overview strong {
  font-size: 28px;
  color: var(--el-text-color-primary);
}
.order-overview small,
.order-related small {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}
.order-focus {
  padding: 18px;
  margin-bottom: 22px;
}
.order-focus-heading,
.order-identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.order-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}
.order-switch .el-select {
  width: 300px;
}
.order-switch .el-button + .el-button {
  margin-left: 0;
}
.order-identity {
  margin: 18px 0;
}
.order-identity .el-button {
  font-size: 16px;
  font-weight: 600;
  white-space: normal;
  text-align: left;
}
.order-identity p {
  margin: 6px 0 0;
}
.order-stages {
  display: flex;
  justify-content: space-between;
  padding: 0;
  margin: 14px 0 8px;
  list-style: none;
  gap: 8px;
  color: var(--el-text-color-secondary);
}
.order-stages .reached {
  color: var(--brand);
  font-weight: 600;
}
.progress-note {
  font-size: 12px;
  line-height: 1.6;
}
.order-related {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 16px;
}
.order-related strong {
  font-size: 20px;
}
.order-related small {
  display: block;
  margin: 6px 0 0;
}
.order-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.order-quick-actions .el-button + .el-button {
  margin-left: 0;
}
@media (max-width: 900px) {
  .order-focus-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .order-switch {
    width: 100%;
  }
  .order-switch .el-select {
    width: auto;
    flex: 1;
    min-width: 0;
  }
}
@media (max-width: 600px) {
  .order-overview,
  .order-related {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .order-overview > div {
    padding: 14px;
  }
  .order-stages {
    font-size: 12px;
    flex-wrap: wrap;
  }
  .order-switch {
    flex-wrap: wrap;
  }
  .order-switch .el-select {
    min-width: 160px;
  }
}
</style>
