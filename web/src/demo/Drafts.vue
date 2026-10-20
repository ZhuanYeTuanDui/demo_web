<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
  detail = ref(sessionStorage.getItem("wsn-selected-draft") || "");
sessionStorage.removeItem("wsn-selected-draft");
const filtered = computed(() =>
  state.value.drafts.filter(
    (d) =>
      `${d.id}${d.plan}${material(d.lines[0]!.material)?.name}`.includes(keyword.value) &&
      (!status.value || d.status === status.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.drafts.find((d) => d.id === detail.value));
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
  sessionStorage.setItem("wsn-selected-plan", id);
  emit("navigate", "analysis");
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
      ><el-button @click="emit('navigate', 'analysis')">需求分析</el-button></template
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
          ><el-button link type="primary" @click="detail = row.id">{{ row.id }}</el-button>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      >
      <el-table-column label="物料 / 规格" min-width="210"
        ><template #default="{ row }"
          >{{ material(row.lines[0].material)?.name }}
          <div class="cell-sub">
            {{ row.lines[0].material }} · {{ material(row.lines[0].material)?.spec }}
          </div></template
        ></el-table-column
      >
      <el-table-column label="来源计划" min-width="180"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="sourcePlan(row.plan)">{{
            row.plan
          }}</el-button></template
        ></el-table-column
      >
      <el-table-column label="需求量" width="100" align="right"
        ><template #default="{ row }">{{ row.lines[0].bomQty ?? "—" }}</template></el-table-column
      ><el-table-column label="库存量" width="100" align="right"
        ><template #default="{ row }">{{ row.lines[0].stock ?? "—" }}</template></el-table-column
      ><el-table-column label="需购量" width="100" align="right"
        ><template #default="{ row }"
          ><strong class="shortage">{{ row.lines[0].qty }}</strong></template
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
    size="min(760px, 95vw)"
    @close="detail = ''"
  >
    <template v-if="selected"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="底稿号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="来源计划"
          ><el-button link type="primary" @click="sourcePlan(selected.plan)">{{
            selected.plan
          }}</el-button></el-descriptions-item
        ><el-descriptions-item label="物料">{{
          material(selected.lines[0]!.material)?.name
        }}</el-descriptions-item
        ><el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item
        ><el-descriptions-item label="备注">{{
          selected.remark
        }}</el-descriptions-item></el-descriptions
      >
      <el-table :data="selected.lines"
        ><el-table-column prop="bomQty" label="需求量" /><el-table-column
          prop="stock"
          label="库存量" /><el-table-column prop="usable" label="可分配量" /><el-table-column
          prop="qty"
          label="本次需购量"
      /></el-table>
      <p class="muted">数量保留生成时的计算快照。</p>
      <p v-for="o in orders" :key="o.id">
        <el-button link type="primary" @click="emit('navigate', 'orders')"
          >采购单：{{ o.id }}</el-button
        >
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
