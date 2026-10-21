<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, ref, watch } from "vue";
import { usePageActivation } from "./page-cache";
import { state, material } from "./store";
import type { PurchaseDraft } from "./model";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import PurchaseEditor from "./PurchaseEditor.vue";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref(""),
  status = ref(""),
  page = ref(1),
  pageSize = ref(50);
const selectedIds = ref<string[]>([]),
  converting = ref(false),
  detail = ref("");
// 仅在本页激活时消费新的来源跳转，普通返回保留筛选及分页。
usePageActivation(() => {
  const draftId = sessionStorage.getItem("wsn-selected-draft");
  if (!draftId) return;
  sessionStorage.removeItem("wsn-selected-draft");
  detail.value = draftId;
});
const filtered = computed(() =>
  state.value.drafts.filter(
    (d) =>
      `${d.id}${d.plan}${d.lines.map((l) => `${l.material}${material(l.material)?.name}${material(l.material)?.spec}`).join("")}`.includes(
        keyword.value
      ) &&
      (!status.value || d.status === status.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.drafts.find((d) => d.id === detail.value));
const detailPage = ref(1);
const detailLines = computed(
  () => selected.value?.lines.slice((detailPage.value - 1) * 20, detailPage.value * 20) || []
);
watch(detail, () => {
  detailPage.value = 1;
});
const pendingCount = (draft: PurchaseDraft) =>
  draft.lines.filter((line) => line.status === "待采购").length;
const selectedPending = computed(() =>
  selectedIds.value.filter((id) =>
    state.value.drafts.some((d) => d.id === id && d.status === "待采购")
  )
);
watch([keyword, status, pageSize], () => (page.value = 1));
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.min(page.value, Math.max(1, Math.ceil(n / pageSize.value))))
);
function sourcePlan(id: string) {
  sessionStorage.setItem("wsn-production-plan-detail", id);
  emit("navigate", "plans");
}
function convert(ids: string[]) {
  selectedIds.value = ids;
  converting.value = true;
}
function actions(row: PurchaseDraft) {
  return [
    { label: "详情", action: () => (detail.value = row.id) },
    ...(row.status === "待采购" ? [{ label: "转采购单", action: () => convert([row.id]) }] : []),
  ];
}
const orders = computed(() =>
  state.value.purchases.filter(
    (p) => !p.mergedInto && p.lines.some((l) => l.draft === detail.value)
  )
);
</script>
<template>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      status = '';
      page = 1;
    "
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" placeholder="底稿号、来源计划或物料" clearable /></el-form-item
      ><el-form-item label="状态"
        ><el-select v-model="status" clearable placeholder="全部"
          ><el-option
            v-for="s in ['待采购', '已转采购']"
            :key="s"
            :label="s"
            :value="s" /></el-select></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" :disabled="!selectedPending.length" @click="converting = true"
        >所选底稿转采购（{{ selectedPending.length }}）</el-button
      ><el-button @click="emit('navigate', 'plans')">生产计划</el-button></template
    >
    <el-table
      :data="paged"
      row-key="id"
      stripe
      empty-text="暂无采购底稿，请先分析缺料"
      @selection-change="(rows: PurchaseDraft[]) => (selectedIds = rows.map((r) => r.id))"
    >
      <el-table-column
        type="selection"
        :reserve-selection="true"
        :selectable="(row: PurchaseDraft) => row.status === '待采购'"
        width="48" />
      <el-table-column label="底稿号 / 日期" min-width="230"
        ><template #default="{ row }"
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      >
      <el-table-column label="来源计划" min-width="180"
        ><template #default="{ row }"
          ><DataLink @click="sourcePlan(row.plan)">{{
            row.plan
          }}</DataLink></template
        ></el-table-column
      >
      <el-table-column label="物料条数" width="100" align="right"
        ><template #default="{ row }">{{ row.lines.length }}</template></el-table-column
      >
      <el-table-column label="待转 / 已转物料" width="150" align="right"
        ><template #default="{ row }"
          >{{ pendingCount(row) }} / {{ row.lines.length - pendingCount(row) }}</template
        ></el-table-column
      >
      <el-table-column prop="status" label="处理状态" width="110" /><el-table-column
        label="操作"
        width="170"
        fixed="right"
        ><template #default="{ row }"
          ><FaTableActions :actions="actions(row)" /></template></el-table-column
    ></el-table>
    <div class="pagination">
      <span>共 {{ filtered.length }} 条</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filtered.length"
        layout="sizes, prev, pager, next"
      />
    </div>
  </FaManagementList>
  <el-drawer
    :model-value="!!selected"
    title="采购底稿详情"
    size="min(1500px, 95vw)"
    @close="detail = ''"
  >
    <template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="底稿号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="来源计划"
          ><DataLink @click="sourcePlan(selected.plan)">{{
            selected.plan
          }}</DataLink></el-descriptions-item
        ><el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item
        ><el-descriptions-item label="备注">{{
          selected.remark
        }}</el-descriptions-item></el-descriptions
      >
      <p class="muted">
        此底稿保存生成时的需求与库存计算快照，不随后续库存变化回写；每条物料独立记录转采购状态。
      </p>
      <el-table :data="detailLines" stripe max-height="440" row-key="id">
        <el-table-column label="品号 / 名称 / 规格" min-width="240" fixed="left"
          ><template #default="{ row }"
            >{{ material(row.material)?.name }}
            <div class="cell-sub">
              {{ row.material }} · {{ material(row.material)?.spec }} · 图号
              {{ material(row.material)?.details?.drawingNo || "—" }}
            </div></template
          ></el-table-column
        >
        <el-table-column prop="bomQty" label="需求量" width="100"
          ><template #default="{ row }">{{ row.bomQty ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="stock" label="库存量" width="100"
          ><template #default="{ row }">{{ row.stock ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="reserved" label="其他计划占用" width="120"
          ><template #default="{ row }">{{ row.reserved ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="usable" label="可分配量" width="110"
          ><template #default="{ row }">{{ row.usable ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="covered" label="已覆盖量" width="110"
          ><template #default="{ row }">{{ row.covered ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="qty" label="需购量" width="100" />
        <el-table-column prop="dueDate" label="预交货日期" width="130" />
        <el-table-column prop="sourceLine" label="来源行" min-width="240" />
        <el-table-column label="行状态" width="120" fixed="right"
          ><template #default="{ row }">{{
            row.status === "已转采购" ? "已转采购单" : "未转采购单"
          }}</template></el-table-column
        >
      </el-table>
      <div class="pagination">
        <span>共 {{ selected.lines.length }} 条物料</span
        ><el-pagination
          v-model:current-page="detailPage"
          :page-size="20"
          :total="selected.lines.length"
          layout="prev, pager, next"
        />
      </div>
      <el-button v-if="selected.status === '待采购'" type="primary" @click="convert([selected.id])"
        >选择物料转采购</el-button
      >
      <p v-for="o in orders" :key="o.id">
        <DataLink href="#orders" @click="emit('navigate', 'orders')"
          >采购单：{{ o.id }}</DataLink>
      </p></template
    >
  </el-drawer>
  <el-dialog
    v-model="converting"
    title="所选底稿转采购单"
    width="min(1080px,94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    ><PurchaseEditor
      :draft-ids="selectedPending"
      @cancel="converting = false"
      @saved="
        converting = false;
        selectedIds = [];
        emit('navigate', 'orders');
      "
  /></el-dialog>
</template>
