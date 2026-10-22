<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import { computed, ref, watch } from "vue";
import { state, material } from "./store";
import { materialIsActive } from "./model";

export type PurchaseSourceSelection =
  | { kind: "draft"; draftId: string; lineId: string }
  | { kind: "request"; requestId: string; lineIndex: number };
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
    .flatMap((draft) => draft.lines.map((line) => ({
      key: `draft:${draft.id}:${line.id}`,
      source: { kind: "draft", draftId: draft.id, lineId: line.id } as PurchaseSourceSelection,
      kind: "drafts", document: draft.id, plan: draft.plan, ...line,
      label: `选择底稿物料 ${draft.id} ${line.id}`,
    }))),
  ...state.value.requests.flatMap((request) => request.lines.map((line, lineIndex) => ({
    key: `request:${request.id}:${lineIndex}`,
    source: { kind: "request", requestId: request.id, lineIndex } as PurchaseSourceSelection,
    kind: "requests", document: request.id, plan: request.plan, ...line,
    label: `选择请购物料 ${request.id} ${lineIndex}`,
  }))),
]);
const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    const item = material(row.material);
    return row.kind === kind.value && item && materialIsActive(item) &&
      `${row.document} ${row.plan} ${row.material} ${item.name} ${item.spec}`.toLowerCase().includes(query);
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
    !excluded.value.has(row.key) && materialIsActive(material(row.material))).map((row) => row.source));
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
      <el-form-item label="搜索来源单据或物料">
        <el-input v-model="keyword" clearable placeholder="单号、计划、品号、品名或规格" />
      </el-form-item>
    </el-form>
    <p class="muted">底稿仅展示已审核单据。可跨单、跨来源选择；来源数量不扣减，其他采购单仍可取用。</p>
    <el-table :data="paged" row-key="key" max-height="360" stripe empty-text="暂无可取物料">
      <el-table-column label="选择" width="65"><template #default="{ row }">
        <el-checkbox :model-value="selected.includes(row.key) || excluded.has(row.key)"
          :disabled="excluded.has(row.key)" :aria-label="row.label"
          @change="(checked: string | number | boolean) => toggle(row.key, !!checked)" />
      </template></el-table-column>
      <el-table-column prop="document" label="来源单号" min-width="210" />
      <el-table-column label="品号 / 品名 / 规格" min-width="240"><template #default="{ row }">
        {{ material(row.material)?.name }}
        <div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || '—' }}</div>
      </template></el-table-column>
      <el-table-column prop="qty" label="来源要求量" width="120" />
      <el-table-column label="状态" width="90"><template #default="{ row }">
        <el-tag v-if="excluded.has(row.key)" type="info">已添加</el-tag>
      </template></el-table-column>
    </el-table>
    <div class="pagination">
      <span role="status">已选 {{ selected.length }} 条物料</span>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20"
        layout="total, prev, pager, next" />
    </div>
    <template #footer>
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">确认取单（{{ selected.length }}）</el-button>
    </template>
  </el-dialog>
</template>
