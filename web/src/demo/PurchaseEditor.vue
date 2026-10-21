<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { state, material, commit } from "./store";
import {
  createPurchase,
  updatePurchase,
  purchaseLineAmount,
  purchaseTotal,
  type Purchase,
  type PurchaseLine,
} from "./model";
import MaterialPicker from "./MaterialPicker.vue";
const props = defineProps<{ order?: Purchase; draftIds?: string[] }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
type EditRow = PurchaseLine & { key: string; existing?: boolean; requestIndex?: number };
const form = reactive({ buyer: props.order?.buyer || "", supplier: props.order?.supplier || "" });
// 编辑副本独立于已保存单据，取消或保存失败均不改变原数据。
const purchaseRows = ref<EditRow[]>(
  (props.order?.lines || []).map((line) => ({ ...line, key: line.id, existing: true }))
);
const picker = ref(false);
const saving = ref(false);
const sourceKeyword = ref("");
const tab = ref(props.draftIds?.length ? "drafts" : "manual");
const activeDraft = ref("");
const totalAmount = computed(() =>
  purchaseTotal(purchaseRows.value.map((row) => ({ amount: purchaseLineAmount(row) })))
);
const pendingDrafts = computed(() =>
  state.value.drafts.filter(
    (d) =>
      d.auditStatus === "已审核" &&
      (!props.draftIds?.length || props.draftIds.includes(d.id)) &&
      `${d.id}${d.plan}${d.lines.map((l) => `${l.material}${material(l.material)?.name}${material(l.material)?.spec}`).join("")}`.includes(
        sourceKeyword.value
      )
  )
);
const requestRows = computed(() =>
  state.value.requests.flatMap((request) =>
    request.lines.map((line, lineIndex) => ({
      ...line,
      request: request.id,
      applicant: request.applicant,
      lineIndex,
    }))
  )
);
watch(
  () => pendingDrafts.value.map((d) => d.id),
  (ids) => {
    if (!ids.includes(activeDraft.value)) activeDraft.value = ids[0] || "";
  },
  { immediate: true }
);
function draftLineSelected(draftId: string, lineId: string) {
  return purchaseRows.value.some((row) => row.draft === draftId && row.draftLine === lineId);
}
function requestLineSelected(requestId: string, lineIndex: number) {
  return purchaseRows.value.some(
    (row) =>
      row.request === requestId &&
      (row.requestIndex === lineIndex || row.requestLine === String(lineIndex))
  );
}
function toggleDraftLine(draftId: string, lineId: string, checked: boolean) {
  const key = `draft:${draftId}:${lineId}`;
  if (!checked) {
    purchaseRows.value = purchaseRows.value.filter(
      (row) => !(row.draft === draftId && row.draftLine === lineId)
    );
    return;
  }
  if (draftLineSelected(draftId, lineId)) return;
  const line = state.value.drafts.find((d) => d.id === draftId)?.lines.find((l) => l.id === lineId);
  if (line)
    purchaseRows.value.push({
      id: key,
      key,
      material: line.material,
      qty: line.qty,
      received: 0,
      draft: draftId,
      draftLine: lineId,
      unitPrice: null,
      amount: null,
      dueDate: line.dueDate || "",
      remark: "",
    });
}
function toggleRequestLine(requestId: string, lineIndex: number, checked: boolean) {
  if (!checked) {
    purchaseRows.value = purchaseRows.value.filter(
      (row) =>
        !(
          row.request === requestId &&
          (row.requestIndex === lineIndex || row.requestLine === String(lineIndex))
        )
    );
    return;
  }
  if (requestLineSelected(requestId, lineIndex)) return;
  const line = state.value.requests.find((r) => r.id === requestId)?.lines[lineIndex];
  const key = `request:${requestId}:${lineIndex}`;
  if (line)
    purchaseRows.value.push({
      ...line,
      id: key,
      key,
      received: 0,
      request: requestId,
      requestLine: String(lineIndex),
      requestIndex: lineIndex,
      unitPrice: null,
      amount: null,
      dueDate: "",
      remark: "",
    });
}
let manualSerial = 0;
function add(ids: string[]) {
  purchaseRows.value.push(
    ...ids.map((material) => {
      const key = `manual:${manualSerial++}`;
      return {
        material,
        qty: 1,
        id: key,
        key,
        received: 0,
        unitPrice: null,
        amount: null,
        dueDate: "",
        remark: "",
      };
    })
  );
  picker.value = false;
}
function remove(key: string) {
  purchaseRows.value = purchaseRows.value.filter((row) => row.key !== key);
}
function save() {
  if (saving.value) return;
  saving.value = true;
  const ok = commit((s) => {
    const draftLines: { draftId: string; lineId: string }[] = [];
    const requestLines: { requestId: string; lineIndex: number }[] = [];
    const lines: { material: string; qty: number }[] = [];
    const lineEdits: Record<
      string,
      { qty: number; unitPrice: number | null; dueDate: string; remark: string }
    > = {};
    for (const row of purchaseRows.value.filter((row) => !row.existing)) {
      let key: string;
      if (row.draft) {
        const index = s.drafts
          .find((d) => d.id === row.draft)!
          .lines.findIndex((l) => l.id === row.draftLine);
        draftLines.push({ draftId: row.draft, lineId: row.draftLine! });
        key = `draft:${row.draft}:${index}`;
      } else if (row.request) {
        requestLines.push({ requestId: row.request, lineIndex: row.requestIndex! });
        key = `request:${row.request}:${row.requestIndex}`;
      } else {
        key = `manual:${lines.length}`;
        lines.push({ material: row.material, qty: row.qty });
      }
      lineEdits[key] = {
        qty: row.qty,
        unitPrice: row.unitPrice ?? null,
        dueDate: row.dueDate || "",
        remark: row.remark || "",
      };
    }
    const sources = { draftLines, requestLines, lines, lineEdits };
    if (props.order) {
      const existing = purchaseRows.value
        .filter((row) => row.existing)
        .map(({ key, existing, requestIndex, ...line }) => ({
          ...line,
          amount: purchaseLineAmount(line),
        }));
      // 更新与追加在同一次原子提交内完成，任一步失败均不保存。
      updatePurchase(s, props.order.id, { ...form, lines: existing, sources });
    } else createPurchase(s, { ...form, ...sources });
  }, "采购单已保存");
  saving.value = false;
  if (ok) emit("saved");
}
</script>
<template>
  <el-form label-position="top" class="purchase-editor" novalidate @submit.prevent="save">
    <div class="purchase-fields">
      <el-form-item label="采购人" required><el-input v-model="form.buyer" /></el-form-item>
      <el-form-item label="供应商" required><el-input v-model="form.supplier" /></el-form-item>
    </div>
    <el-tabs v-model="tab">
      <el-tab-pane label="手动添加物料" name="manual"
        ><el-button @click="picker = true">选择物料</el-button></el-tab-pane
      >
      <el-tab-pane label="采购底稿" name="drafts">
        <el-input v-model="sourceKeyword" placeholder="搜索底稿、计划或物料" clearable />
        <p class="muted">
          只展示已审核底稿。逐行取料后可修改采购数量，来源要求量保持不变，后续采购单仍可再次取用。
        </p>
        <el-tabs
          v-if="pendingDrafts.length"
          v-model="activeDraft"
          type="card"
          class="draft-switcher"
          aria-label="切换采购底稿"
        >
          <el-tab-pane
            v-for="draft in pendingDrafts"
            :key="draft.id"
            :name="draft.id"
            :label="draft.id"
            class="draft-source-group"
          >
            <p class="muted">来源计划：{{ draft.plan }}</p>
            <el-table :data="draft.lines" row-key="id" max-height="280" empty-text="暂无物料">
              <el-table-column label="选择" width="65"
                ><template #default="{ row }"
                  ><el-checkbox
                    :model-value="draftLineSelected(draft.id, row.id)"
                    :aria-label="`选择底稿物料 ${draft.id} ${row.id}`"
                    @change="
                      (checked: string | number | boolean) =>
                        toggleDraftLine(draft.id, row.id, !!checked)
                    " /></template
              ></el-table-column>
              <el-table-column label="品号 / 名称 / 规格" min-width="240"
                ><template #default="{ row }"
                  >{{ material(row.material)?.name }}
                  <div class="cell-sub">
                    {{ row.material }} · {{ material(row.material)?.spec }}
                  </div></template
                ></el-table-column
              >
              <el-table-column prop="qty" label="来源要求量" width="120" />
            </el-table>
          </el-tab-pane> </el-tabs
        ><el-empty v-else description="暂无已审核底稿" />
      </el-tab-pane>
      <el-tab-pane label="请购单" name="requests">
        <p class="muted">逐行选择需要采购的物料，已被使用的来源仍可再次选择。</p>
        <el-table :data="requestRows" max-height="280" empty-text="暂无请购物料">
          <el-table-column label="选择" width="65"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="requestLineSelected(row.request, row.lineIndex)"
                :aria-label="`选择请购物料 ${row.request} ${row.lineIndex}`"
                @change="
                  (checked: string | number | boolean) =>
                    toggleRequestLine(row.request, row.lineIndex, !!checked)
                " /></template
          ></el-table-column>
          <el-table-column prop="request" label="请购单号" min-width="210" /><el-table-column
            prop="applicant"
            label="请购人"
            width="100"
          />
          <el-table-column label="物料" min-width="200"
            ><template #default="{ row }"
              >{{ material(row.material)?.name }}
              <div class="cell-sub">{{ row.material }}</div></template
            ></el-table-column
          >
          <el-table-column prop="qty" label="来源要求量" width="120" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <h3>采购明细</h3>
    <el-table :data="purchaseRows" max-height="380" empty-text="请先选择采购物料" row-key="key">
      <el-table-column label="品号 / 品名 / 规格" min-width="220"
        ><template #default="{ row }"
          >{{ material(row.material)?.name }}
          <div class="cell-sub">
            {{ row.material }} · {{ material(row.material)?.spec || "—" }} · 图号
            {{ material(row.material)?.details?.drawingNo || "—" }}
          </div></template
        ></el-table-column
      >
      <el-table-column label="品牌 / 材质" min-width="140"
        ><template #default="{ row }"
          >{{ material(row.material)?.details?.brand || "—" }} /
          {{ material(row.material)?.details?.texture || "—" }}</template
        ></el-table-column
      >
      <el-table-column label="数量" width="155"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.qty"
            @change="row.unitPrice == null && (row.amount = null)"
            :aria-label="`采购数量 ${row.key}`"
            :min="1"
            :max="100000"
            :precision="0"
            controls-position="right"
            style="width: 130px" /></template
      ></el-table-column>
      <el-table-column label="单位" width="75"
        ><template #default="{ row }">{{ material(row.material)?.unit }}</template></el-table-column
      >
      <el-table-column label="含税单价（元）" width="170"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.unitPrice"
            :aria-label="`含税单价 ${row.key}`"
            :min="0"
            :precision="2"
            :controls="false"
            placeholder="未填写"
            style="width: 140px" /></template
      ></el-table-column>
      <el-table-column label="价税合计（元）" width="150" align="right"
        ><template #default="{ row }"
          >{{ purchaseLineAmount(row) == null ? "未填写" : purchaseLineAmount(row)!.toFixed(2)
          }}<span v-if="row.unitPrice == null && row.amount != null" class="cell-sub"
            >历史行金额，单价未填</span
          ></template
        ></el-table-column
      >
      <el-table-column label="交期" width="175"
        ><template #default="{ row }"
          ><el-date-picker
            v-model="row.dueDate"
            type="date"
            value-format="YYYY-MM-DD"
            :aria-label="`交期 ${row.key}`"
            placeholder="选择交期"
            style="width: 150px" /></template
      ></el-table-column>
      <el-table-column label="备注" min-width="190"
        ><template #default="{ row }"
          ><el-input
            v-model="row.remark"
            :aria-label="`备注 ${row.key}`"
            maxlength="500" /></template
      ></el-table-column>
      <el-table-column label="来源单号" min-width="200"
        ><template #default="{ row }">{{
          row.draft || row.request || "手工录入"
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="80" fixed="right"
        ><template #default="{ row }"
          ><el-button
            link
            type="danger"
            :aria-label="`移除采购明细 ${row.key}`"
            @click="remove(row.key)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <p class="muted">
      采购合计：{{
        totalAmount == null ? "未填写完整" : `${totalAmount.toFixed(2)} 元`
      }}。价税合计按数量 × 含税单价计算，来源要求量不会被扣减。
    </p>
    <p v-if="order?.legacyAmount != null" class="muted">
      历史单头金额：{{ order.legacyAmount.toFixed(2) }} 元；未分摊到物料，请逐行核对。
    </p>
    <div class="editor-footer">
      <span class="muted">共 {{ purchaseRows.length }} 条明细；取消编辑保留原单。</span
      ><el-button @click="emit('cancel')">取消</el-button
      ><el-button type="primary" :loading="saving" native-type="submit">保存采购单</el-button>
    </div>
  </el-form>
  <MaterialPicker
    v-if="picker"
    :excluded-ids="
      purchaseRows.filter((row) => !row.draft && !row.request).map((row) => row.material)
    "
    @confirm="add"
    @cancel="picker = false"
  />
</template>
<style scoped>
.draft-switcher :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.draft-switcher :deep(.el-tabs__item) {
  max-width: 340px;
}
.draft-source-group {
  min-width: 0;
}
.purchase-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.editor-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.editor-footer .muted {
  margin-right: auto;
}
@media (max-width: 700px) {
  .purchase-fields {
    grid-template-columns: 1fr;
  }
  .editor-footer {
    flex-wrap: wrap;
  }
}
</style>
