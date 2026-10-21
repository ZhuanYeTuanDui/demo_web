<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, ref, watch } from "vue";
import { usePageActivation } from "./page-cache";
import { state, material, commit } from "./store";
import { convertRequest, validateLines, id, today, type Line, type Requisition } from "./model";
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
// 各路由单独缓存，仅消费属于当前业务页的跳转意图。
usePageActivation(() => {
  if (props.page === "requests") {
    const requestId = sessionStorage.getItem("wsn-selected-request");
    if (!requestId) return;
    sessionStorage.removeItem("wsn-selected-request");
    detail.value = requestId;
  }
});
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
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink>
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
