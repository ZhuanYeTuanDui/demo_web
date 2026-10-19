<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Plus, Search, Calendar, Box, CircleCheck } from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import { products, today, id, issuePlan, finishPlan } from "./model";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const status = ref("");
const dialog = ref(false);
const detail = ref("");
const form = reactive({ name: "", product: "FG001", qty: 5, date: today() });
const plans = computed(() =>
  state.value.plans.filter(
    (p) =>
      `${p.id}${p.name}${material(p.product).name}`.includes(keyword.value) &&
      (!status.value || p.status === status.value)
  )
);
const selected = computed(() => state.value.plans.find((p) => p.id === detail.value));
function create() {
  if (
    commit((s) => {
      if (!form.name.trim() || !form.date) throw new Error("请填写计划名称和计划日期");
      if (
        !products.some((p) => p.id === form.product) ||
        !Number.isSafeInteger(form.qty) ||
        form.qty <= 0 ||
        form.qty > 100000
      )
        throw new Error("请选择产品并填写有效整数数量");
      s.plans.unshift({ ...form, name: form.name.trim(), id: id("PP"), status: "待分析" });
    }, "生产计划已创建，可到采购管理分析缺料")
  ) {
    dialog.value = false;
    form.name = "";
  }
}
function analyze(planId: string) {
  sessionStorage.setItem("wsn-selected-plan", planId);
  emit("navigate", "analysis");
}
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">PRODUCTION</div>
      <h1>生产计划</h1>
      <p>以计划连接物料需求、采购备料与生产领用。</p>
    </div>
    <el-button type="primary" :icon="Plus" @click="dialog = true">新增生产计划</el-button>
  </div>
  <div class="metric-grid">
    <div class="metric">
      <span>生产计划</span><strong>{{ state.plans.length }}<small>个</small></strong
      ><el-icon><Calendar /></el-icon>
      <p>演示产品采用预设 BOM</p>
    </div>
    <div class="metric">
      <span>待分析 / 备料</span
      ><strong
        >{{ state.plans.filter((p) => ["待分析", "待备料"].includes(p.status)).length
        }}<small>个</small></strong
      ><el-icon><Box /></el-icon>
      <p>在采购管理中分析缺料</p>
    </div>
    <div class="metric">
      <span>已完工</span
      ><strong
        >{{ state.plans.filter((p) => p.status === "已完工").length }}<small>个</small></strong
      ><el-icon><CircleCheck /></el-icon>
      <p>成品入库自动留存记录</p>
    </div>
  </div>
  <section class="panel">
    <div class="filter-bar">
      <label
        >关键词<el-input
          v-model="keyword"
          :prefix-icon="Search"
          clearable
          placeholder="计划号、名称或产品" /></label
      ><label
        >计划状态<el-select v-model="status" clearable placeholder="全部状态"
          ><el-option
            v-for="s in ['待分析', '待备料', '已领料', '已完工']"
            :key="s"
            :label="s"
            :value="s" /></el-select
      ></label>
    </div>
    <div class="panel-heading">
      <h2>
        计划列表 <span class="count-badge">{{ plans.length }}</span>
      </h2>
      <span class="muted">需求分析 → 采购备料 → 领料 → 完工</span>
    </div>
    <el-table :data="plans" stripe empty-text="暂无生产计划"
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
      ><el-table-column prop="qty" label="数量（台）" width="110" align="right" /><el-table-column
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
          ><template v-if="['待分析', '待备料'].includes(row.status)"
            ><el-button link type="primary" @click="analyze(row.id)">分析缺料</el-button
            ><el-button
              link
              type="primary"
              @click="commit((s) => issuePlan(s, row.id), '领料完成，已生成出库记录')"
              >生产领料</el-button
            ></template
          ><el-button
            v-else-if="row.status === '已领料'"
            link
            type="primary"
            @click="commit((s) => finishPlan(s, row.id), '完工入库完成')"
            >完工入库</el-button
          ><el-button v-else link type="primary" @click="detail = row.id"
            >查看详情</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <div class="inline-note">
      演示简化：整单领料、整单完工；工序、排程、委外和审批规则暂未配置。
    </div>
  </section>
  <el-dialog v-model="dialog" title="新增生产计划" width="520px"
    ><el-form label-position="top" @submit.prevent="create"
      ><el-form-item label="计划名称" required
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
        /></el-form-item></div></el-form
    ><template #footer
      ><el-button @click="dialog = false">取消</el-button
      ><el-button type="primary" @click="create">创建计划</el-button></template
    ></el-dialog
  >
  <el-drawer :model-value="!!selected" title="生产计划详情" size="620px" @close="detail = ''"
    ><template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="计划号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="名称">{{ selected.name }}</el-descriptions-item
        ><el-descriptions-item label="产品">{{
          material(selected.product).name
        }}</el-descriptions-item
        ><el-descriptions-item label="数量">{{ selected.qty }} 台</el-descriptions-item
        ><el-descriptions-item label="状态">{{
          selected.status
        }}</el-descriptions-item></el-descriptions
      >
      <h3>单台产品 BOM（演示）</h3>
      <el-table :data="products.find((p) => p.id === selected?.product)?.bom"
        ><el-table-column label="物料"
          ><template #default="{ row }">{{
            material(row.material).name
          }}</template></el-table-column
        ><el-table-column prop="qty" label="单台用量"
      /></el-table>
      <h3>工序与排程</h3>
      <el-empty description="暂未配置" :image-size="65" /></template
  ></el-drawer>
</template>
