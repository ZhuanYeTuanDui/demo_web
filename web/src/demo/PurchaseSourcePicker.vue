<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import { computed, ref, watch } from "vue";
import { state } from "./store";

export type PurchaseSourceSelection =
  | { kind: "draft"; draftId: string }
  | { kind: "request"; requestId: string };
const props = defineProps<{ excludedKeys: string[]; draftIds?: string[] }>();
const emit = defineEmits<{ confirm: [sources: PurchaseSourceSelection[]]; cancel: [] }>();
const kind = ref("drafts");
const keyword = ref("");
const page = ref(1);
const selected = ref<string[]>([]);
const excluded = computed(() => new Set(props.excludedKeys));
const rows = computed(() => [
  ...state.value.drafts
    .filter((draft) => draft.auditStatus === "已审核" &&
      (!props.draftIds?.length || props.draftIds.includes(draft.id)))
    .map(draft => ({
      key: `draft:${draft.id}`,
      source: { kind: "draft", draftId: draft.id } as PurchaseSourceSelection,
      kind: "drafts", document: draft.id, plan: draft.plan, date: draft.date,
      person: draft.creator, count: draft.lines.length,
      label: `选择底稿 ${draft.id}`,
    })),
  ...state.value.requests.map(request => ({
    key: `request:${request.id}`,
    source: { kind: "request", requestId: request.id } as PurchaseSourceSelection,
    kind: "requests", document: request.id, plan: request.plan, date: request.date,
    person: request.applicant, count: request.lines.length,
    label: `选择请购单 ${request.id}`,
  })),
]);
const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    const planName = state.value.plans.find(plan => plan.id === row.plan)?.name || "";
    return row.kind === kind.value &&
      `${row.document} ${row.plan} ${planName} ${row.person}`.toLowerCase().includes(query);
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20));
watch([kind, keyword], () => { page.value = 1; });
function toggle(key: string, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, key])] : selected.value.filter((id) => id !== key);
}
function confirm() {
  // 仅在确认时带回选择，弹窗内切换来源、搜索或取消不改采购编辑副本。
  emit("confirm", rows.value.filter((row) => selected.value.includes(row.key) &&
    !excluded.value.has(row.key)).map((row) => row.source));
}
</script>

<template>
  <el-dialog :model-value="true" title="采购取单" width="min(1080px, 94vw)" top="5vh"
    append-to-body :close-on-click-modal="false" @close="emit('cancel')">
    <el-tabs v-model="kind" aria-label="取单来源">
      <el-tab-pane label="采购底稿" name="drafts" />
      <el-tab-pane label="请购单" name="requests" />
    </el-tabs>
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="搜索来源单据">
        <el-input v-model="keyword" clearable placeholder="单号、来源计划或经办人" />
      </el-form-item>
    </el-form>
    <p class="muted">先选择底稿或请购单，确认后返回采购页面勾选物料。底稿仅展示已审核单据。</p>
    <el-table :data="paged" row-key="key" max-height="360" stripe empty-text="暂无可选单据">
      <el-table-column label="选择" width="65"><template #default="{ row }">
        <el-checkbox :model-value="selected.includes(row.key) || excluded.has(row.key)"
          :disabled="excluded.has(row.key)" :aria-label="row.label"
          @change="(checked: string | number | boolean) => toggle(row.key, !!checked)" />
      </template></el-table-column>
      <el-table-column prop="document" label="来源单号" min-width="210" />
      <el-table-column label="来源计划" min-width="210"><template #default="{ row }">{{ state.plans.find(plan => plan.id === row.plan)?.name || row.plan || '—' }}</template></el-table-column>
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column prop="person" label="经办人" width="120" />
      <el-table-column prop="count" label="物料条数" width="100" />
      <el-table-column label="状态" width="90"><template #default="{ row }">
        <el-tag v-if="excluded.has(row.key)" type="info">已添加</el-tag>
      </template></el-table-column>
    </el-table>
    <div class="pagination">
      <span role="status">已选 {{ selected.length }} 张单据</span>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20"
        layout="total, prev, pager, next" />
    </div>
    <template #footer>
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">确认取单（{{ selected.length }}）</el-button>
    </template>
  </el-dialog>
</template>
