<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Plus, Delete } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { state, material } from "./store";
import { validateLines, type Line } from "./model";
import MaterialPicker from "./MaterialPicker.vue";
const props = defineProps<{ kind: "request" | "purchase"; lockedLines?: Line[] }>();
const emit = defineEmits<{
  save: [data: { person: string; supplier: string; lines: Line[] }];
  cancel: [];
}>();
const person = ref(props.kind === "purchase" ? "陈采购" : "仓库管理员");
const supplier = ref("");
const picking = ref(false);
const page = ref(1);
const lines = reactive<Line[]>(
  props.lockedLines?.map((l) => ({ ...l })) || []
);
const paged = computed(() => lines.slice((page.value - 1) * 20, page.value * 20));
watch(() => lines.length, () => { page.value = Math.min(page.value, Math.max(1, Math.ceil(lines.length / 20))); });
function addMaterials(ids: string[]) {
  const existing = new Set(lines.map((line) => line.material));
  for (const id of ids) {
    if (existing.has(id)) continue;
    lines.push({ material: id, qty: 1 });
    existing.add(id);
  }
  picking.value = false;
}
function removeLine(id: string) {
  const index = lines.findIndex((line) => line.material === id);
  if (index >= 0) lines.splice(index, 1);
}
function submit() {
  if (!person.value.trim()) {
    ElMessage.error(props.kind === "request" ? "请填写请购人" : "请填写采购人");
    return;
  }
  if (props.kind === "purchase" && !supplier.value.trim()) {
    ElMessage.error("请填写供应商");
    return;
  }
  try {
    validateLines(state.value, lines);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "请检查物料明细");
    return;
  }
  emit("save", {
    person: person.value,
    supplier: supplier.value,
    lines: lines.map((l) => ({ ...l })),
  });
}
</script>
<template>
  <el-form label-position="top" @submit.prevent="submit"
    ><div class="form-grid">
      <el-form-item :label="kind === 'request' ? '请购人' : '采购人'" required
        ><el-input v-model="person" maxlength="30" /></el-form-item
      ><el-form-item v-if="kind === 'purchase'" label="供应商" required
        ><el-input v-model="supplier" placeholder="请输入供应商名称" maxlength="60"
      /></el-form-item>
    </div>
    <div class="panel-heading compact">
      <h2>物料明细 <span class="count-badge">{{ lines.length }}</span></h2>
      <el-button v-if="!lockedLines" :icon="Plus" @click="picking = true"
        >选择物料</el-button
      >
    </div>
    <el-table :data="paged" row-key="material" stripe max-height="360" empty-text="点击“选择物料”，可筛选并批量添加">
      <el-table-column label="品号 / 品名" min-width="200"><template #default="{ row }"><div>{{ material(row.material).name }}</div><span class="cell-sub code">{{ row.material }}</span></template></el-table-column>
      <el-table-column label="图号 / 规格" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ material(row.material).details?.drawingNo || material(row.material).spec || '—' }}</template></el-table-column>
      <el-table-column label="单位" width="75"><template #default="{ row }">{{ material(row.material).unit || '—' }}</template></el-table-column>
      <el-table-column label="数量" width="190"><template #default="{ row }">
        <span v-if="lockedLines">{{ row.qty }}</span>
        <el-input-number v-else v-model="row.qty" :min="1" :max="100000" :precision="0" controls-position="right" :aria-label="`${material(row.material).name}数量`" style="width: 130px" />
      </template></el-table-column>
      <el-table-column v-if="!lockedLines" label="操作" width="100"><template #default="{ row }"><el-button text type="danger" :icon="Delete" :aria-label="`移除${material(row.material).name}`" @click="removeLine(row.material)" /></template></el-table-column>
    </el-table>
    <div class="pagination"><span>共 {{ lines.length }} 种物料</span><el-pagination v-model:current-page="page" :total="lines.length" :page-size="20" layout="prev, pager, next" /></div>
    <div class="dialog-actions">
      <el-button @click="emit('cancel')">取消</el-button
      ><el-button type="primary" native-type="submit">{{
        lockedLines ? "确认生成采购单" : "保存单据"
      }}</el-button>
    </div>
  </el-form>
  <MaterialPicker v-if="picking" :excluded-ids="lines.map(l => l.material)" @confirm="addMaterials" @cancel="picking = false" />
</template>
