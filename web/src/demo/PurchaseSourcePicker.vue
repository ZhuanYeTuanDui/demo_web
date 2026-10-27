<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import { computed, ref, watch } from "vue";
import { state, material } from "./store";

export interface PurchaseSourceLine {
  key: string;
  sourceType: "draft" | "request";
  document: string;
  plan: string;
  person: string;
  material: string;
  qty: number;
  dueDate?: string;
  draftId?: string;
  lineId?: string;
  requestId?: string;
  lineIndex?: number;
  requestLine?: string;
}
const props = defineProps<{ excludedKeys: string[]; draftIds?: string[] }>();
const emit = defineEmits<{ confirm: [lines: PurchaseSourceLine[]]; cancel: [] }>();
const kind = ref<"draft" | "request">("draft");
const keyword = ref("");
const page = ref(1);
const selected = ref<string[]>([]);
const excluded = computed(() => new Set(props.excludedKeys));
const allRows = computed<PurchaseSourceLine[]>(() => [
  ...state.value.drafts
    .filter((draft) => draft.auditStatus === "已审核" &&
      (!props.draftIds?.length || props.draftIds.includes(draft.id)))
    .flatMap((draft) => draft.lines.map((line) => ({
      key: `draft:${draft.id}:${line.id}`,
      sourceType: "draft" as const,
      document: draft.id,
      plan: draft.plan,
      person: draft.creator,
      material: line.material,
      qty: line.qty,
      dueDate: line.dueDate,
      draftId: draft.id,
      lineId: line.id,
    }))),
  ...state.value.requests.flatMap((request) => request.lines.map((line, index) => ({
    key: `request:${request.id}:${index}`,
    sourceType: "request" as const,
    document: request.id,
    plan: request.plan,
    person: request.applicant,
    material: line.material,
    qty: line.qty,
    requestId: request.id,
    lineIndex: index,
    requestLine: String(index),
  }))),
]);
const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return allRows.value.filter((row) => {
    const planName = state.value.plans.find((plan) => plan.id === row.plan)?.name || "";
    const item = material(row.material);
    return row.sourceType === kind.value &&
      `${row.document} ${row.plan} ${planName} ${row.person} ${row.material} ${item?.name || ""} ${item?.spec || ""}`
        .toLowerCase().includes(query);
  });
});
const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20));
watch([kind, keyword], () => { page.value = 1; });
function toggle(key: string, checked: boolean) {
  selected.value = checked
    ? [...new Set([...selected.value, key])]
    : selected.value.filter((id) => id !== key);
}
function confirm() {
  const chosen = allRows.value.filter((row) => selected.value.includes(row.key) && !excluded.value.has(row.key));
  emit("confirm", chosen);
}
</script>

<template>
  <el-dialog :model-value="true" title="采购取单" width="min(1080px, 94vw)" top="5vh"
    append-to-body :close-on-click-modal="false" @close="emit('cancel')">
    <el-tabs v-model="kind" aria-label="取单来源">
      <el-tab-pane label="采购底稿" name="draft" />
      <el-tab-pane label="请购单" name="request" />
    </el-tabs>
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="搜索来源物料">
        <el-input v-model="keyword" clearable placeholder="物料、单号、来源计划或经办人" />
      </el-form-item>
    </el-form>
    <p class="muted">底稿与请购单物料已合并展示；勾选后直接加入采购明细。</p>
    <el-table :data="paged" row-key="key" max-height="420" stripe empty-text="当前没有可取的来源物料">
      <el-table-column label="选择" width="65"><template #default="{ row }">
        <el-checkbox :model-value="selected.includes(row.key) || excluded.has(row.key)"
          :disabled="excluded.has(row.key)" :aria-label="`选择来源物料 ${row.key}`"
          @change="(checked: string | number | boolean) => toggle(row.key, !!checked)" />
      </template></el-table-column>
      <el-table-column label="品号 / 名称 / 规格" min-width="260"><template #default="{ row }">
        <div>{{ material(row.material)?.name || row.material }}</div>
        <span class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || "—" }}</span>
      </template></el-table-column>
      <el-table-column prop="document" label="来源单号" min-width="190" />
      <el-table-column label="来源计划" min-width="200"><template #default="{ row }">{{
        state.plans.find((plan) => plan.id === row.plan)?.name || row.plan || "—"
      }}</template></el-table-column>
      <el-table-column prop="person" label="经办人" width="110" />
      <el-table-column prop="qty" label="来源要求量" width="110" />
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
