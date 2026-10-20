<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Box, ShoppingCart, Calendar, Collection } from "@element-plus/icons-vue";
import { state } from "./store";
import { stockKey } from "./model";

const emit = defineEmits<{ navigate: [page: string] }>();
// 工作台直接订阅同一份业务状态，单据和库存变动后统计同步更新。
const sections = computed(() => [
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
        note: "进入需求分析，核对物料缺口",
        route: "analysis",
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
    description: "保存 BOM 与库存分析快照，核对需购数量后整单转采购。",
    metrics: [
      {
        label: "底稿记录",
        value: state.value.drafts.length,
        unit: "份",
        note: "保留生成时的 BOM 和库存结果",
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
    description: "临时缺料由仓库录入请购单，采购下单后跟进整单收货。",
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
        value: state.value.purchases.filter((p) => p.status === "待入库").length,
        unit: "笔",
        note: "确认收货后更新库存",
        route: "orders",
      },
      {
        label: "采购记录",
        value: state.value.purchases.length,
        unit: "笔",
        note: "含待入库和已入库订单",
        route: "orders",
      },
    ],
  },
]);
const flow = [
  { label: "生产计划", route: "plans" },
  { label: "需求分析", route: "analysis" },
  { label: "采购底稿", route: "drafts" },
  { label: "采购下单", route: "orders" },
  { label: "收货入库", route: "orders" },
  { label: "生产领料 / 完工", route: "plans" },
];
</script>

<template>
  <div class="dashboard">
    <div class="page-heading">
      <div>
        <h1>首页工作台</h1>
        <p>集中查看库存、生产与采购进度，进入对应业务处理。</p>
      </div>
    </div>
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
      title="演示边界：整单转采购、收货、领料与完工；安全库存、损耗、替代料、工序、排程和审批规则暂未配置。"
      type="info"
      :closable="false"
      show-icon
    />
  </div>
</template>
