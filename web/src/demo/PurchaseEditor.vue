<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { state, material, commit } from "./store";
import { createPurchase, updatePurchase, appendPurchase, type Purchase, type Line } from "./model";
import MaterialPicker from "./MaterialPicker.vue";
const props = defineProps<{ order?: Purchase; draftIds?: string[] }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const form = reactive({
  buyer: props.order?.buyer || "",
  supplier: props.order?.supplier || "",
});
const drafts = ref<string[]>([...(props.draftIds || [])]);
const requests = ref<string[]>([]);
const lines = ref<Line[]>([]);
const picker = ref(false);
// 金额按来源行保存，同物料来自不同底稿时也分别填写，切换选料页签不会丢失。
const lineAmounts = reactive<Record<string, number | undefined>>(
  Object.fromEntries((props.order?.lines || []).map((line) => [line.id, line.amount ?? undefined]))
);
const purchaseRows = computed(() => [
  ...(props.order?.lines || []).map((line) => ({
    ...line,
    key: line.id,
    source: line.draft || line.request || "手工录入",
  })),
  ...drafts.value.flatMap((id) =>
    (state.value.drafts.find((d) => d.id === id)?.lines || []).map((line, index) => ({
      ...line,
      key: `draft:${id}:${index}`,
      source: id,
    }))
  ),
  ...requests.value.flatMap((id) =>
    (state.value.requests.find((r) => r.id === id)?.lines || []).map((line, index) => ({
      ...line,
      key: `request:${id}:${index}`,
      source: id,
    }))
  ),
  ...lines.value.map((line, index) => ({ ...line, key: `manual:${index}`, source: "手工录入" })),
]);
const totalAmount = computed(() =>
  purchaseRows.value.length && purchaseRows.value.every((row) => lineAmounts[row.key] != null)
    ? (
        purchaseRows.value.reduce((sum, row) => sum + Math.round(lineAmounts[row.key]! * 100), 0) /
        100
      ).toFixed(2)
    : "未填写完整"
);
const sourceKeyword = ref("");
const tab = ref(props.draftIds?.length ? "drafts" : "manual");
const pendingDrafts = computed(() =>
  state.value.drafts.filter(
    (d) =>
      d.status === "待采购" &&
      `${d.id}${d.plan}${material(d.lines[0]!.material)?.name}`.includes(sourceKeyword.value)
  )
);
const pendingRequests = computed(() => state.value.requests.filter((r) => r.status === "待采购"));
const totalLines = computed(
  () =>
    (props.order?.lines.length || 0) +
    lines.value.length +
    drafts.value.length +
    requests.value.reduce(
      (n, id) => n + (state.value.requests.find((r) => r.id === id)?.lines.length || 0),
      0
    )
);
// 复选框显式维护 ID 集合，筛选切换不会清空已选来源。
function toggleSource(ids: string[], id: string, checked: boolean) {
  const index = ids.indexOf(id);
  if (checked && index < 0) ids.push(id);
  if (!checked && index >= 0) ids.splice(index, 1);
}
function add(ids: string[]) {
  lines.value.push(...ids.map((material) => ({ material, qty: 1 })));
  picker.value = false;
}
function removeManual(index: number) {
  for (let i = index; i < lines.value.length - 1; i++)
    lineAmounts[`manual:${i}`] = lineAmounts[`manual:${i + 1}`];
  delete lineAmounts[`manual:${lines.value.length - 1}`];
  lines.value.splice(index, 1);
}
function save() {
  if (
    commit((s) => {
      const amounts = Object.fromEntries(
        purchaseRows.value.map((row) => [row.key, lineAmounts[row.key] ?? null])
      );
      const data = { buyer: form.buyer, supplier: form.supplier, lineAmounts: amounts };
      const sources = {
        draftIds: drafts.value,
        requestIds: requests.value,
        lines: lines.value,
        lineAmounts: amounts,
      };
      if (props.order) {
        updatePurchase(s, props.order.id, data);
        if (drafts.value.length || requests.value.length || lines.value.length)
          appendPurchase(s, props.order.id, sources);
      } else createPurchase(s, { ...data, ...sources });
    }, "采购单已保存")
  )
    emit("saved");
}
</script>
<template>
  <el-form label-position="top" class="purchase-editor" @submit.prevent="save">
    <div class="purchase-fields">
      <el-form-item label="采购人" required><el-input v-model="form.buyer" /></el-form-item>
      <el-form-item label="供应商" required><el-input v-model="form.supplier" /></el-form-item>
    </div>
    <el-tabs v-model="tab">
      <el-tab-pane label="手动添加物料" name="manual"
        ><el-button @click="picker = true">选择物料</el-button>
        <p class="muted">已手动选择 {{ lines.length }} 种物料，在下方采购明细中填写数量和金额。</p>
      </el-tab-pane>
      <el-tab-pane :label="`采购底稿（已选 ${drafts.length}）`" name="drafts"
        ><el-input v-model="sourceKeyword" placeholder="搜索底稿、计划或物料" clearable /><el-table
          :data="pendingDrafts"
          max-height="300"
          empty-text="暂无待采购底稿"
          ><el-table-column label="选择" width="65"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="drafts.includes(row.id)"
                @change="
                  (checked: string | number | boolean) => toggleSource(drafts, row.id, !!checked)
                "
                :value="row.id"
                :aria-label="`选择底稿 ${row.id}`" /></template></el-table-column
          ><el-table-column prop="id" label="底稿号" min-width="210" /><el-table-column
            label="物料"
            min-width="150"
            ><template #default="{ row }">{{
              material(row.lines[0].material)?.name
            }}</template></el-table-column
          ><el-table-column prop="plan" label="来源计划" min-width="170" /><el-table-column
            label="需购数量"
            width="100"
            ><template #default="{ row }">{{ row.lines[0].qty }}</template></el-table-column
          ></el-table
        ></el-tab-pane
      >
      <el-tab-pane :label="`请购单（已选 ${requests.length}）`" name="requests"
        ><el-table :data="pendingRequests" max-height="300" empty-text="暂无待采购请购单"
          ><el-table-column label="选择" width="65"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="requests.includes(row.id)"
                @change="
                  (checked: string | number | boolean) => toggleSource(requests, row.id, !!checked)
                "
                :value="row.id"
                :aria-label="`选择请购单 ${row.id}`" /></template></el-table-column
          ><el-table-column prop="id" label="请购单号" /><el-table-column
            prop="applicant"
            label="请购人"
          /><el-table-column label="物料"
            ><template #default="{ row }">{{
              row.lines.map((l: Line) => material(l.material)?.name).join("、")
            }}</template></el-table-column
          ></el-table
        ></el-tab-pane
      >
    </el-tabs>
    <h3>采购明细</h3>
    <el-table :data="purchaseRows" max-height="320" empty-text="请先选择采购物料" row-key="key">
      <el-table-column label="物料 / 规格" min-width="180"
        ><template #default="{ row }"
          >{{ material(row.material)?.name }}
          <div class="cell-sub">
            {{ row.material }} · {{ material(row.material)?.spec }}
          </div></template
        ></el-table-column
      >
      <el-table-column label="数量" width="160"
        ><template #default="{ row }">
          <el-input-number
            v-if="row.key.startsWith('manual:')"
            v-model="lines[Number(row.key.slice(7))]!.qty"
            :min="1"
            :max="100000"
            :precision="0"
            style="width: 130px"
          />
          <span v-else>{{ row.qty }}</span>
        </template></el-table-column
      >
      <el-table-column label="金额（元，可空）" width="180"
        ><template #default="{ row }"
          ><el-input-number
            v-model="lineAmounts[row.key]"
            :aria-label="`${material(row.material)?.name}采购金额 ${row.key}`"
            :min="0"
            :precision="2"
            :controls="false"
            placeholder="未填写"
            style="width: 150px" /></template
      ></el-table-column>
      <el-table-column prop="source" label="来源" min-width="200" />
      <el-table-column label="操作" width="80"
        ><template #default="{ row }"
          ><el-button
            v-if="row.key.startsWith('manual:')"
            link
            type="danger"
            @click="removeManual(Number(row.key.slice(7)))"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <p class="muted">
      采购合计：{{ totalAmount
      }}{{ totalAmount === "未填写完整" ? "" : " 元" }}。金额为该物料行总额，可留空后补。
    </p>
    <p v-if="order?.legacyAmount != null" class="muted">
      历史单头金额：{{ order.legacyAmount.toFixed(2) }} 元；尚未分摊到物料，请逐行核对填写。
    </p>
    <div class="editor-footer">
      <span class="muted">共 {{ totalLines }} 条明细；仅加入勾选的来源，允许跨生产计划。</span
      ><el-button @click="emit('cancel')">取消</el-button
      ><el-button type="primary" native-type="submit">保存采购单</el-button>
    </div>
  </el-form>
  <MaterialPicker
    v-if="picker"
    :excluded-ids="lines.map((l) => l.material)"
    @confirm="add"
    @cancel="picker = false"
  />
</template>
<style scoped>
.purchase-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.purchase-fields .el-input-number {
  width: 100%;
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
