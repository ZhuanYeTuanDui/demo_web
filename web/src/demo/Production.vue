<script setup lang="ts">
import FaManagementList from "./FaManagementList.vue";
import { computed, defineAsyncComponent, reactive, ref, watch } from "vue";
import { Plus, Search, Upload } from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import {
  products,
  today,
  id,
  issuePlan,
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
const pageSize = ref(10);
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
const pagedPlans = computed(() =>
  plans.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
watch([keyword, status, pageSize], () => {
  page.value = 1;
});
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
      const plan: Plan = { ...form, name: form.name.trim(), id: id("PP"), status: "待分析" };
      requirements(plan);
      s.plans.unshift(plan);
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
      演示简化：整单领料、整单完工；工序、排程、委外和审批规则暂未配置。
    </div>
  </FaManagementList>
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
      <p v-if="selected.importSource" class="muted">来源：{{ selected.importSource.file }} / {{ selected.importSource.sheet }}，{{ selected.importSource.rows.length }} 条原始明细</p>
      <h3>{{ selected.importSource?.basis === 'total' ? '本次需求清单' : '单台产品 BOM' }}</h3>
      <el-table :data="planBom(selected)"
        ><el-table-column label="物料"
          ><template #default="{ row }">{{
            material(row.material).name
          }}</template></el-table-column
        ><el-table-column label="图号 / 规格" min-width="180"><template #default="{ row }">{{ material(row.material).details?.drawingNo || material(row.material).spec || '—' }}</template></el-table-column
        ><el-table-column label="单位" width="70"><template #default="{ row }">{{ material(row.material).unit }}</template></el-table-column
        ><el-table-column prop="qty" :label="selected.importSource?.basis === 'total' ? '需求量' : '单台用量'" width="90"
      /></el-table>
      <h3>工序与排程</h3>
      <el-empty description="暂未配置" :image-size="65" /></template
  ></el-drawer>
  <ProductionImport v-if="importing" @close="importing = false" @imported="planId => { importing = false; detail = planId; }" />
</template>
