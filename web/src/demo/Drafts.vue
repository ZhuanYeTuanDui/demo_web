<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { usePageActivation } from "./page-cache";
import { state, material, commit } from "./store";
import {
  createManualDraft,
  updateDraft,
  deleteDraft,
  auditDraft,
  unauditDraft,
  type PurchaseDraft,
} from "./model";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import MaterialPicker from "./MaterialPicker.vue";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const auditTab = ref("未审核");
const page = ref(1);
const pageSize = ref(50);
const detail = ref("");
const editor = ref(false);
const editingId = ref("");
const picking = ref(false);
const error = ref("");
const saving = ref(false);
const form = reactive({
  plan: "",
  remark: "",
  lines: [] as { id?: string; material: string; qty: number }[],
});
usePageActivation(() => {
  const draftId = sessionStorage.getItem("wsn-selected-draft");
  if (!draftId) return;
  sessionStorage.removeItem("wsn-selected-draft");
  detail.value = draftId;
  const draft = state.value.drafts.find((item) => item.id === draftId);
  if (draft) auditTab.value = draft.auditStatus || "已审核";
});
const filtered = computed(() =>
  state.value.drafts.filter(
    (d) =>
      (d.auditStatus || "已审核") === auditTab.value &&
      `${d.id}${d.plan}${d.lines.map((l) => `${l.material}${material(l.material)?.name}${material(l.material)?.spec}`).join("")}`.includes(
        keyword.value
      )
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
watch([keyword, auditTab, pageSize], () => {
  page.value = 1;
});
watch(
  () => filtered.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
function sourcePlan(id: string) {
  sessionStorage.setItem("wsn-production-plan-detail", id);
  emit("navigate", "plans");
}
function openEditor(draft?: PurchaseDraft) {
  editingId.value = draft?.id || "";
  form.plan = draft?.plan || "";
  form.remark = draft?.remark || "";
  form.lines = (draft?.lines || []).map((line) => ({
    id: line.id,
    material: line.material,
    qty: line.qty,
  }));
  error.value = "";
  editor.value = true;
}
function addMaterials(ids: string[]) {
  for (const id of ids)
    if (!form.lines.some((line) => line.material === id)) form.lines.push({ material: id, qty: 1 });
  picking.value = false;
}
function save() {
  if (saving.value) return;
  error.value = "";
  if (
    !form.lines.length ||
    form.lines.some((line) => !Number.isSafeInteger(line.qty) || line.qty <= 0)
  ) {
    error.value = "请选择至少一种物料，并填写正整数需购数量";
    return;
  }
  saving.value = true;
  if (
    commit(
      (s) => {
        if (editingId.value)
          updateDraft(s, editingId.value, {
            remark: form.remark,
            lines: form.lines.map((line) => ({ ...line })),
          });
        else
          createManualDraft(s, {
            plan: form.plan || undefined,
            remark: form.remark,
            lines: form.lines.map((line) => ({ ...line })),
          });
      },
      editingId.value ? "采购底稿已修改" : "采购底稿已新增，请审核后由采购单取料"
    )
  )
    editor.value = false;
  saving.value = false;
}
async function remove(draft: PurchaseDraft) {
  try {
    await ElMessageBox.confirm(
      `确认删除底稿 ${draft.id}？已有采购来源引用的底稿不能删除。`,
      "删除采购底稿",
      { type: "warning", confirmButtonText: "删除底稿", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  if (commit((s) => deleteDraft(s, draft.id), "采购底稿已删除") && detail.value === draft.id)
    detail.value = "";
}
function actions(row: PurchaseDraft) {
  const audited = (row.auditStatus || "已审核") === "已审核";
  return [
    ...(audited
      ? [
          {
            label: "返审",
            action: () => {
              commit((s) => unauditDraft(s, row.id), "采购底稿已返审");
            },
          },
        ]
      : [
          { label: "编辑", action: () => openEditor(row) },
          {
            label: "审核",
            action: () => {
              commit((s) => auditDraft(s, row.id), "采购底稿已审核");
            },
          },
          {
            label: "删除",
            danger: true,
            action: () => {
              remove(row);
            },
          },
        ]),
    {
      label: "详情",
      action: () => {
        detail.value = row.id;
      },
    },
  ];
}
const orders = computed(() =>
  state.value.purchases.filter(
    (p) => !p.mergedInto && p.lines.some((l) => l.draft === detail.value)
  )
);
</script>
<template>
  <el-tabs v-model="auditTab" aria-label="采购底稿审核状态"
    ><el-tab-pane label="未审核" name="未审核" /><el-tab-pane label="已审核" name="已审核"
  /></el-tabs>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      page = 1;
    "
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" placeholder="底稿号、来源计划或物料" clearable /></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" @click="openEditor()">新增底稿</el-button
      ><el-button @click="emit('navigate', 'plans')">生产计划</el-button></template
    >
    <el-table :data="paged" row-key="id" stripe empty-text="暂无该审核状态的采购底稿">
      <el-table-column label="底稿号 / 日期" min-width="230"
        ><template #default="{ row }"
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      >
      <el-table-column label="来源计划" min-width="180"
        ><template #default="{ row }"
          ><DataLink v-if="row.plan" @click="sourcePlan(row.plan)">{{ row.plan }}</DataLink
          ><span v-else>手工底稿</span></template
        ></el-table-column
      >
      <el-table-column label="物料条数" width="100" align="right"
        ><template #default="{ row }">{{ row.lines.length }}</template></el-table-column
      >
      <el-table-column label="审核状态" width="110"
        ><template #default="{ row }"
          ><el-tag :type="row.auditStatus === '未审核' ? 'info' : 'success'">{{
            row.auditStatus || "已审核"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column prop="remark" label="备注" min-width="200" />
      <el-table-column label="操作" width="180" fixed="right"
        ><template #default="{ row }"><FaTableActions :actions="actions(row)" /></template
      ></el-table-column>
    </el-table>
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
    <template v-if="selected">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="底稿号">{{ selected.id }}</el-descriptions-item>
        <el-descriptions-item label="来源计划"
          ><DataLink v-if="selected.plan" @click="sourcePlan(selected.plan)">{{
            selected.plan
          }}</DataLink
          ><span v-else>手工底稿</span></el-descriptions-item
        >
        <el-descriptions-item label="审核状态">{{
          selected.auditStatus || "已审核"
        }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ selected.remark || "—" }}</el-descriptions-item>
      </el-descriptions>
      <p class="muted">
        底稿保存需求与库存计算快照。只有已审核底稿可由采购单取料，来源数量不因采购取料改变，允许后续再次取用。
      </p>
      <el-table :data="detailLines" stripe max-height="440" row-key="id">
        <el-table-column label="品号 / 名称 / 规格" min-width="240" fixed="left"
          ><template #default="{ row }"
            ><DataLink
              :href="`#materials/${row.material}`"
              @click="emit('navigate', `materials/${row.material}`)"
              >{{ material(row.material)?.name }}</DataLink
            >
            <div class="cell-sub">
              {{ row.material }} · {{ material(row.material)?.spec }} · 图号
              {{ material(row.material)?.details?.drawingNo || "—" }}
            </div></template
          ></el-table-column
        >
        <el-table-column label="需求量" width="100"
          ><template #default="{ row }">{{ row.bomQty ?? "—" }}</template></el-table-column
        >
        <el-table-column label="库存量" width="100"
          ><template #default="{ row }">{{ row.stock ?? "—" }}</template></el-table-column
        >
        <el-table-column label="其他计划占用" width="120"
          ><template #default="{ row }">{{ row.reserved ?? "—" }}</template></el-table-column
        >
        <el-table-column label="可分配量" width="110"
          ><template #default="{ row }">{{ row.usable ?? "—" }}</template></el-table-column
        >
        <el-table-column label="已覆盖量" width="110"
          ><template #default="{ row }">{{ row.covered ?? "—" }}</template></el-table-column
        >
        <el-table-column prop="qty" label="需购量" width="100" />
        <el-table-column prop="dueDate" label="预交货日期" width="130" />
        <el-table-column prop="sourceLine" label="来源行" min-width="240" />
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
      <p v-for="order in orders" :key="order.id">
        <DataLink href="#orders" @click="emit('navigate', 'orders')"
          >采购单：{{ order.id }}</DataLink
        >
      </p>
    </template>
  </el-drawer>
  <el-dialog
    v-model="editor"
    :title="editingId ? '编辑采购底稿' : '新增采购底稿'"
    width="min(960px, 96vw)"
    :close-on-click-modal="false"
  >
    <el-form label-position="top" novalidate @submit.prevent="save">
      <div class="form-grid">
        <el-form-item label="来源生产计划（选填）"
          ><el-select
            v-model="form.plan"
            clearable
            filterable
            :disabled="!!editingId"
            placeholder="手工底稿可不关联计划"
            ><el-option
              v-for="plan in state.plans.filter((item) => item.auditStatus === '已审核')"
              :key="plan.id"
              :label="`${plan.name}（${plan.id}）`"
              :value="plan.id" /></el-select></el-form-item
        ><el-form-item label="备注"
          ><el-input v-model="form.remark" maxlength="500"
        /></el-form-item>
      </div>
      <div class="panel-heading compact">
        <h2>需购物料</h2>
        <el-button @click="picking = true">选择物料</el-button>
      </div>
      <el-table :data="form.lines" row-key="material" max-height="420" empty-text="请选择需购物料">
        <el-table-column label="物料" min-width="230"
          ><template #default="{ row }"
            >{{ material(row.material)?.name }}
            <div class="cell-sub">{{ row.material }}</div></template
          ></el-table-column
        >
        <el-table-column label="需购数量" width="180"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.qty"
              :min="1"
              :max="100000000"
              :precision="0"
              controls-position="right"
              :aria-label="`${material(row.material)?.name}需购数量`" /></template
        ></el-table-column>
        <el-table-column label="操作" width="90"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.lines.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
    </el-form>
    <template #footer
      ><el-button @click="editor = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="save">保存底稿</el-button></template
    >
  </el-dialog>
  <MaterialPicker
    v-if="picking"
    :excluded-ids="form.lines.map((line) => line.material)"
    @confirm="addMaterials"
    @cancel="picking = false"
  />
</template>
