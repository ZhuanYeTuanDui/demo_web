<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import ElDrawer from "./CachedDrawer.vue";
import DataLink from "./DataLink.vue";
import MaterialPicker from "./MaterialPicker.vue";
import PlanMaterialsTable from "./PlanMaterialsTable.vue";
import { planBom, updatePlan, type Line, type Plan } from "./model";
import { commit, material, state } from "./store";

const props = defineProps<{ plan: Plan; editable?: boolean }>();
const emit = defineEmits<{ close: []; navigate: [page: string] }>();
// 所有字段和明细均在本地副本编辑，取消不会改变计划或产品的共享 BOM。
const form = reactive({
  name: props.plan.name,
  workOrder: props.plan.workOrder || "",
  qty: props.plan.qty,
  bom: planBom(props.plan).map((line) => ({ ...line })),
});
const initial = JSON.stringify(form);
const dirty = computed(() => props.editable && JSON.stringify(form) !== initial);
const saving = ref(false);
const confirmingClose = ref(false);
const error = ref("");
const choosing = ref(false);
const totalBasis = computed(() => props.plan.importSource?.basis === "total");
const preview = computed<Plan>(() => (props.editable ? { ...props.plan, ...form } : props.plan));
const workOrders = computed(() =>
  state.value.workOrders.filter((order) => order.status !== "已发货" || order.id === form.workOrder)
);
const quantityLabel = computed(() => (totalBasis.value ? "需求量" : "单台用量"));

function setQuantity(materialId: string, qty: number | undefined) {
  const line = form.bom.find((item) => item.material === materialId);
  // 保留清空输入的状态供保存校验，不在编辑过程中悄悄回填默认数量。
  if (line) line.qty = qty as number;
}
function addMaterials(ids: string[]) {
  const existing = new Set(form.bom.map((line) => line.material));
  for (const materialId of ids) {
    if (!existing.has(materialId)) {
      form.bom.push({ material: materialId, qty: 1 });
      existing.add(materialId);
    }
  }
  choosing.value = false;
}
function removeMaterial(materialId: string) {
  form.bom = form.bom.filter((line) => line.material !== materialId);
}
async function requestClose(done?: () => void) {
  if (saving.value || confirmingClose.value) return;
  if (dirty.value) {
    confirmingClose.value = true;
    try {
      await ElMessageBox.confirm("放弃未保存的修改？", "取消编辑", {
        type: "warning",
        confirmButtonText: "放弃修改",
        cancelButtonText: "继续编辑",
      });
    } catch {
      return;
    } finally {
      confirmingClose.value = false;
    }
  }
  if (done) done();
  else emit("close");
}
function save() {
  if (saving.value) return;
  error.value = "";
  if (!form.name.trim() || !form.workOrder) {
    error.value = "请填写计划名称并选择关联工单";
    return;
  }
  if (
    !Number.isSafeInteger(form.qty) ||
    form.qty < 1 ||
    form.qty > 100000 ||
    (totalBasis.value && form.qty !== 1)
  ) {
    error.value = totalBasis.value
      ? "本计划按总需求填写，计划数量须保持为 1"
      : "计划数量须为 1～100000 的整数";
    return;
  }
  if (
    !form.bom.length ||
    form.bom.some((line) => !Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > 100000)
  ) {
    error.value = "请保留至少一条物料，并填写 1～100000 的整数数量";
    return;
  }
  saving.value = true;
  const lines: Line[] = form.bom.map((line) => ({ ...line }));
  const saved = commit(
    (draft) =>
      updatePlan(draft, props.plan.id, {
        name: form.name.trim(),
        workOrder: form.workOrder,
        qty: form.qty,
        bom: lines,
        product: props.plan.product,
        date: props.plan.date,
      }),
    "生产计划已修改"
  );
  saving.value = false;
  if (saved) emit("close");
  else error.value = "保存未完成，请根据错误提示检查后重试。";
}
function viewWorkOrder() {
  if (!props.plan.workOrder) return;
  sessionStorage.setItem("wsn-work-order-detail", props.plan.workOrder);
  emit("navigate", "work-orders");
}
</script>

<template>
  <el-drawer
    :model-value="true"
    :title="editable ? '编辑生产计划' : '生产计划详情'"
    size="min(1040px, 96vw)"
    :before-close="requestClose"
    :close-on-click-modal="false"
    @close="emit('close')"
  >
    <el-form v-if="editable" label-position="top" :disabled="saving" @submit.prevent="save">
      <div class="plan-identity muted">
        计划号：{{ plan.id }} · {{ plan.auditStatus || "已审核" }} · {{ plan.status }}
      </div>
      <div class="form-grid">
        <el-form-item label="计划名称" required :error="!form.name.trim() ? error : ''">
          <el-input v-model="form.name" maxlength="60" placeholder="请输入计划名称" />
        </el-form-item>
        <el-form-item label="关联工单" required :error="!form.workOrder ? error : ''">
          <el-select v-model="form.workOrder" filterable placeholder="请选择关联工单">
            <el-option
              v-for="order in workOrders"
              :key="order.id"
              :label="`${order.name}（${order.id}）`"
              :value="order.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划数量（台）" required>
          <el-input-number
            v-model="form.qty"
            :min="1"
            :max="100000"
            :precision="0"
            :disabled="totalBasis"
            aria-label="计划数量"
          />
          <span v-if="totalBasis" class="cell-sub">按总需求导入，计划数量保持为 1。</span>
        </el-form-item>
        <el-form-item label="计划产品"
          ><span>{{ material(plan.product)?.name || plan.product }}</span></el-form-item
        >
      </div>
    </el-form>
    <el-descriptions v-else :column="1" border>
      <el-descriptions-item label="计划号">{{ plan.id }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ plan.name }}</el-descriptions-item>
      <el-descriptions-item label="关联工单"
        ><DataLink v-if="plan.workOrder" @click="viewWorkOrder">{{
          state.workOrders.find((order) => order.id === plan.workOrder)?.name || plan.workOrder
        }}</DataLink
        ><span v-else>—</span></el-descriptions-item
      >
      <el-descriptions-item label="产品">{{
        material(plan.product)?.name || plan.product
      }}</el-descriptions-item>
      <el-descriptions-item label="数量">{{ plan.qty }} 台</el-descriptions-item>
      <el-descriptions-item label="审核状态">{{
        plan.auditStatus || "已审核"
      }}</el-descriptions-item>
      <el-descriptions-item label="业务状态">{{ plan.status }}</el-descriptions-item>
    </el-descriptions>
    <p v-if="plan.importSource" class="muted">
      来源：{{ plan.importSource.file }} / {{ plan.importSource.sheet }}，{{
        plan.importSource.rows.length
      }}
      条原始明细
    </p>
    <div class="plan-materials-heading">
      <h3>{{ totalBasis ? "本次需求清单" : "单台产品 BOM" }}</h3>
      <el-button v-if="editable" :icon="Plus" :disabled="saving" @click="choosing = true"
        >添加物料</el-button
      >
    </div>
    <p v-if="editable" class="muted plan-quantity-note">
      {{
        totalBasis ? "物料数量为本计划总需求，不再乘计划数量。" : "总需求 = 单台用量 × 计划数量。"
      }}
      物料调整仅作用于当前计划。
    </p>
    <PlanMaterialsTable
      :plan="preview"
      :editable="editable"
      :disabled="saving"
      @quantity="setQuantity"
      @remove="removeMaterial"
      @navigate="emit('navigate', $event)"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer>
      <el-button :disabled="saving" @click="requestClose()">{{
        editable ? "取消" : "关闭"
      }}</el-button>
      <el-button v-if="editable" type="primary" :loading="saving" @click="save">保存修改</el-button>
    </template>
    <MaterialPicker
      v-if="choosing"
      :excluded-ids="form.bom.map((line) => line.material)"
      @cancel="choosing = false"
      @confirm="addMaterials"
    />
  </el-drawer>
</template>

<style scoped>
.plan-identity {
  margin-bottom: 16px;
}
.plan-materials-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}
.plan-materials-heading h3 {
  margin: 0;
}
.plan-quantity-note {
  margin-block: 10px;
}
</style>
