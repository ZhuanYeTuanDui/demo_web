<script setup lang="ts">
import { computed, reactive, ref } from "vue";
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
import PurchaseSourcePicker, { type PurchaseSourceSelection } from "./PurchaseSourcePicker.vue";
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
const sourcePicker = ref(false);
const totalAmount = computed(() =>
  purchaseTotal(purchaseRows.value.map((row) => ({ amount: purchaseLineAmount(row) })))
);
const sourceKeys = computed(() => purchaseRows.value.flatMap((row) =>
  row.draft ? [`draft:${row.draft}:${row.draftLine}`] :
    row.request ? [`request:${row.request}:${row.requestIndex ?? row.requestLine}`] : []
));
function addSources(sources: PurchaseSourceSelection[]) {
  for (const source of sources) {
    if (source.kind === "draft") toggleDraftLine(source.draftId, source.lineId, true);
    else toggleRequestLine(source.requestId, source.lineIndex, true);
  }
  sourcePicker.value = false;
}
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
    <div class="purchase-source-actions">
      <el-button @click="picker = true">选择物料</el-button>
      <el-button type="primary" plain @click="sourcePicker = true">取单</el-button>
      <span class="muted">从采购底稿或请购单选取物料。</span>
    </div>
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
  <PurchaseSourcePicker v-if="sourcePicker" :excluded-keys="sourceKeys" :draft-ids="draftIds"
    @confirm="addSources" @cancel="sourcePicker = false" />
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
.purchase-source-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.purchase-source-actions .el-button + .el-button {
  margin-left: 0;
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
