<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import {
  Box,
  ShoppingCart,
  SetUp,
  OfficeBuilding,
  Collection,
  Tickets,
  List,
  Calendar,
  Fold,
  Expand,
  RefreshLeft,
  ArrowRight,
  ArrowDown,
  House,
  Loading,
  Van,
} from "@element-plus/icons-vue";
import Inventory from "./Inventory.vue";
import Procurement from "./Procurement.vue";
import Production from "./Production.vue";
import Materials from "./Materials.vue";
import Drafts from "./Drafts.vue";
import Dashboard from "./Dashboard.vue";
import Receipts from "./Receipts.vue";
import WorkOrders from "./WorkOrders.vue";
import Issues from "./Issues.vue";
import Shipments from "./Shipments.vue";
import FinishedStock from "./FinishedStock.vue";
import { reset, storageError } from "./store";

const menu = [
  { label: "工作空间", icon: House, items: [{ key: "home", label: "首页工作台", icon: House }] },
  {
    label: "库存管理",
    icon: Box,
    items: [
      { key: "stock", label: "库存记录", icon: Collection },
      { key: "warehouses", label: "仓库管理", icon: OfficeBuilding },
      { key: "materials", label: "物料档案", icon: Box },
      { key: "movements", label: "出入库记录", icon: List },
      { key: "issues", label: "领料单", icon: Tickets },
      { key: "finished-stock", label: "成品库存", icon: Box },
    ],
  },
  {
    label: "采购管理",
    icon: ShoppingCart,
    items: [
      { key: "drafts", label: "采购底稿", icon: Collection },
      { key: "requests", label: "请购单", icon: Tickets },
      { key: "orders", label: "采购单 / 采购记录", icon: ShoppingCart },
    ],
  },
  {
    label: "生产管理",
    icon: SetUp,
    items: [
      { key: "work-orders", label: "工单管理", icon: Tickets },
      { key: "plans", label: "生产计划", icon: Calendar },
      { key: "analysis", label: "需求分析", icon: SetUp },
    ],
  },
  {
    label: "收发货",
    icon: Van,
    items: [
      { key: "receipts", label: "收货单", icon: Tickets },
      { key: "shipments", label: "成品发货", icon: Van },
    ],
  },
];
const valid = menu.flatMap((m) => m.items.map((i) => i.key));
function resolveRoute(hash: string) {
  const route = hash.slice(1);
  if (/^(warehouses|materials)\/[^/]+$/.test(route) || valid.includes(route)) return route;
  return "home";
}
const route = ref(resolveRoute(location.hash));
const navigating = ref(false);
let navigationTimer: ReturnType<typeof setTimeout> | undefined;
// 所有 hash 路由共用 300ms 过渡，连续跳转以最后一次为准。
watch(
  route,
  () => {
    clearTimeout(navigationTimer);
    navigating.value = true;
    navigationTimer = setTimeout(() => {
      navigating.value = false;
    }, 300);
  },
  { flush: "sync" }
);
const page = computed(() => route.value.split("/")[0]!);
const warehouseId = computed(() =>
  page.value === "warehouses" ? route.value.split("/")[1] || "" : ""
);
const materialId = computed(() =>
  page.value === "materials" ? route.value.split("/")[1] || "" : ""
);
const collapsed = ref(false);
const closedGroups = ref<string[]>([]);
const activeGroup = computed(() => menu.find((m) => m.items.some((i) => i.key === page.value))!);
const title = computed(() =>
  materialId.value
    ? "物料基本信息"
    : warehouseId.value
      ? "仓库详情"
      : activeGroup.value.items.find((i) => i.key === page.value)!.label
);
function focusContent() {
  document.getElementById("main-content")?.focus();
}
function navigate(key: string) {
  route.value = resolveRoute(`#${key}`);
  location.hash = key;
}
function syncHash() {
  route.value = resolveRoute(location.hash);
}
// 跳转到已收起分组内的页面时，展开其所属分组以保留当前位置提示。
watch(page, () => {
  closedGroups.value = closedGroups.value.filter((label) => label !== activeGroup.value.label);
});
function toggleGroup(label: string) {
  closedGroups.value = closedGroups.value.includes(label)
    ? closedGroups.value.filter((item) => item !== label)
    : [...closedGroups.value, label];
}
onMounted(() => window.addEventListener("hashchange", syncHash));
onUnmounted(() => {
  window.removeEventListener("hashchange", syncHash);
  clearTimeout(navigationTimer);
});
watch(
  title,
  (value) => {
    document.title = `${value} · WSN ERP`;
  },
  { immediate: true }
);
async function resetAll() {
  try {
    await ElMessageBox.confirm("将清除本浏览器中的演示操作，恢复初始库存和单据。", "重置演示数据", {
      confirmButtonText: "确认重置",
      cancelButtonText: "取消",
      type: "warning",
    });
    reset();
  } catch {
    /* 用户取消时保留当前数据。 */
  }
}
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusContent">跳转到页面内容</a>
  <div class="erp-shell" :class="{ collapsed }">
    <aside class="sidebar" aria-label="主导航">
      <a
        class="brand"
        href="#home"
        aria-label="WSN ERP 首页工作台"
        @click.prevent="navigate('home')"
        ><span class="brand-mark">W</span
        ><span v-if="!collapsed"><strong>WSN ERP</strong><small>企业资源管理平台</small></span></a
      >
      <div class="workspace" v-if="!collapsed">
        <span class="workspace-dot"></span> 维萨娜 · 演示工作空间
      </div>
      <nav>
        <section v-for="(group, index) in menu" :key="group.label" class="nav-group">
          <button
            v-if="group.items[0]?.key !== 'home'"
            type="button"
            class="nav-heading"
            :aria-label="group.label"
            :aria-expanded="!closedGroups.includes(group.label)"
            :aria-controls="`nav-group-${index}`"
            :title="group.label"
            @click="toggleGroup(group.label)"
          >
            <el-icon><component :is="group.icon" /></el-icon
            ><span v-if="!collapsed">{{ group.label }}</span>
            <el-icon
              class="nav-chevron"
              :class="{ 'is-closed': closedGroups.includes(group.label) }"
              ><ArrowDown
            /></el-icon>
          </button>
          <div
            :id="`nav-group-${index}`"
            v-show="group.items[0]?.key === 'home' || !closedGroups.includes(group.label)"
          >
            <a
              v-for="item in group.items"
              :key="item.key"
              :href="`#${item.key}`"
              :class="['nav-item', { active: page === item.key }]"
              :aria-current="page === item.key ? 'page' : undefined"
              :aria-label="item.label"
              :title="collapsed ? item.label : undefined"
              @click.prevent="navigate(item.key)"
            >
              <el-icon><component :is="item.icon" /></el-icon
              ><span v-if="!collapsed">{{ item.label }}</span>
            </a>
          </div>
        </section>
      </nav>
      <div class="sidebar-bottom" v-if="!collapsed">
        <span class="workspace-dot"></span> 本地演示环境<small>数据仅保存在当前浏览器</small>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar-left">
          <el-button
            text
            :aria-label="collapsed ? '展开导航' : '收起导航'"
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
            ><el-icon :size="20"><Expand v-if="collapsed" /><Fold v-else /></el-icon></el-button
          ><span class="breadcrumb"
            >工作空间 <el-icon><ArrowRight /></el-icon> {{ activeGroup.label }}
            <el-icon><ArrowRight /></el-icon> <strong>{{ title }}</strong></span
          >
        </div>
        <div class="topbar-right">
          <el-tag effect="plain" type="success">本地演示</el-tag
          ><el-button text :icon="RefreshLeft" @click="resetAll">重置数据</el-button
          ><span class="avatar">管</span><span>演示管理员</span>
        </div>
      </header>
      <main
        id="main-content"
        tabindex="-1"
        class="page-body"
        :aria-label="title"
        :aria-busy="navigating"
      >
        <el-alert
          v-if="storageError"
          :title="storageError"
          type="error"
          :closable="false"
          show-icon
          class="storage-error"
        />
        <Dashboard v-if="page === 'home'" @navigate="navigate" />
        <Materials
          v-else-if="page === 'materials'"
          :key="materialId"
          :material-id="materialId"
          @navigate="navigate"
        />
        <Inventory
          v-else-if="['stock', 'warehouses', 'movements'].includes(page)"
          :page="page"
          :warehouse-id="warehouseId"
          @navigate="navigate"
        />
        <Drafts v-else-if="page === 'drafts'" @navigate="navigate" />
        <Procurement
          v-else-if="['analysis', 'requests', 'orders'].includes(page)"
          :page="page"
          @navigate="navigate"
        />
        <Receipts v-else-if="page === 'receipts'" @navigate="navigate" />
        <WorkOrders v-else-if="page === 'work-orders'" @navigate="navigate" />
        <Issues v-else-if="page === 'issues'" @navigate="navigate" />
        <Shipments v-else-if="page === 'shipments'" @navigate="navigate" />
        <FinishedStock v-else-if="page === 'finished-stock'" @navigate="navigate" />
        <Production v-else @navigate="navigate" />
        <footer class="page-footer">
          <span>WSN ERP · 业务流程演示</span><span>静态前端 / Mock 数据 / 无需后端</span>
        </footer>
      </main>
    </div>
  </div>
  <div v-if="navigating" class="route-loading" role="status" aria-live="polite">
    <el-icon class="is-loading" :size="28"><Loading /></el-icon><span>正在加载...</span>
  </div>
</template>
