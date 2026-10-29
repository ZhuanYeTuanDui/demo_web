<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { state, material, commit } from "./store";
import { createPurchaseInbound, id, receiptRemaining } from "./model";
import InboundSourcePicker, { type InboundSourceLine } from "./InboundSourcePicker.vue";

const emit = defineEmits<{ saved: []; cancel: [] }>();
const form = reactive({ id: id("IN"), supplier: "", warehouse: "BZ01", remark: "" });
const lines = ref<InboundSourceLine[]>([]);
const picker = ref(false);
const saving = ref(false);
const error = ref("");
const warehouses = computed(() => state.value.warehouses.filter((w) => w.available && !w.inactive));
// 更换供应商时清除来源，防止旧供应商物料混入新单。
watch(() => form.supplier, () => { lines.value = []; picker.value = false; });
function add(rows: InboundSourceLine[]) {
  const keys = new Set(lines.value.map((line) => line.key));
  lines.value.push(...rows.filter((row) => !keys.has(row.key)).map((row) => ({ ...row })));
  picker.value = false;
}
function remaining(row: InboundSourceLine) {
  return receiptRemaining(state.value, row.purchase).find((line) => line.lineId === row.lineId)?.qty || 0;
}
async function cancel() {
  if (saving.value) return;
  if (form.supplier || form.remark || lines.value.length || form.warehouse !== "BZ01") {
    try {
      await ElMessageBox.confirm("尚有未保存内容，确认放弃？", "取消登记入库", {
        confirmButtonText: "放弃修改", cancelButtonText: "继续编辑", type: "warning",
      });
    } catch { return; }
  }
  emit("cancel");
}
async function save() {
  if (saving.value) return;
  error.value = "";
  if (!form.supplier.trim()) { error.value = "请先填写供应商名称"; return; }
  if (!form.warehouse || !lines.value.length) { error.value = "请选择仓库，并取单选择入库物料"; return; }
  if (lines.value.some((line) => !Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > remaining(line))) {
    error.value = "入库数量须为正整数，且不能超过扣除待收占用后的可入库数量"; return;
  }
  saving.value = true;
  try {
    await ElMessageBox.confirm("确认后将增加库存、更新来源采购单已收数量；有物料入库的采购单不能反审核。是否继续？", "确认采购入库", {
      type: "warning", confirmButtonText: "确认入库", cancelButtonText: "取消",
    });
    if (commit((draft) => { createPurchaseInbound(draft, { ...form, lines: lines.value }); }, "入库单已保存，库存与采购已收数量已更新")) emit("saved");
  } catch { /* 用户取消确认，保留输入。 */ }
  finally { saving.value = false; }
}
defineExpose({ cancel });
</script>

<template>
  <el-form label-position="top" class="inbound-editor" :disabled="saving" @submit.prevent="save">
    <div class="form-grid">
      <el-form-item label="供应商名称" required :error="!form.supplier.trim() ? error : ''">
        <el-input v-model="form.supplier" maxlength="200" placeholder="先填写供应商名称，按包含关系匹配采购单" />
      </el-form-item>
      <el-form-item label="入库仓库" required><el-select v-model="form.warehouse" placeholder="选择入库仓库">
        <el-option v-for="warehouse in warehouses" :key="warehouse.id" :label="warehouse.name" :value="warehouse.id" />
      </el-select></el-form-item>
      <el-form-item label="入库单号"><el-input :model-value="form.id" readonly /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" maxlength="500" /></el-form-item>
    </div>
    <div class="panel-heading compact"><el-button type="primary" plain :disabled="!form.supplier.trim()" @click="picker = true">取单</el-button>
      <span class="muted">先填供应商，再跨采购单勾选物料加入入库明细。</span></div>
    <h3>入库明细</h3>
    <el-table :data="lines" row-key="key" max-height="55vh" empty-text="请取单选择物料">
      <el-table-column label="品号 / 品名 / 规格" min-width="240"><template #default="{ row }">
        {{ material(row.material)?.name }}<div class="cell-sub">{{ row.material }} · {{ material(row.material)?.spec || "—" }}</div>
      </template></el-table-column>
      <el-table-column prop="purchase" label="来源采购单" min-width="200" />
      <el-table-column prop="supplier" label="供应商" min-width="180" />
      <el-table-column label="可入库数量" width="120" align="right"><template #default="{ row }">{{ remaining(row) }}</template></el-table-column>
      <el-table-column label="入库数量" width="170"><template #default="{ row }"><el-input-number v-model="row.qty" :min="1" :max="remaining(row)" :precision="0"
        controls-position="right" :aria-label="`入库数量 ${row.purchase} ${row.lineId}`" style="width: 140px" /></template></el-table-column>
      <el-table-column label="单位" width="70"><template #default="{ row }">{{ material(row.material)?.unit }}</template></el-table-column>
      <el-table-column label="操作" width="80" fixed="right"><template #default="{ row }"><el-button link type="danger" @click="lines = lines.filter((line) => line.key !== row.key)">移除</el-button></template></el-table-column>
    </el-table>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div class="inbound-footer"><span class="muted">共 {{ lines.length }} 条明细，关联 {{ new Set(lines.map((line) => line.purchase)).size }} 张采购单</span>
      <el-button @click="cancel">取消</el-button><el-button type="primary" :loading="saving" native-type="submit">确认入库</el-button></div>
  </el-form>
  <InboundSourcePicker v-if="picker" :supplier="form.supplier" :excluded-keys="lines.map((line) => line.key)" @confirm="add" @cancel="picker = false" />
</template>

<style scoped>
.inbound-footer { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.inbound-footer .muted { margin-right: auto; }
</style>
