<script setup lang="ts">
import { reactive, ref } from "vue";
import { Plus, Delete } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { state } from "./store";
import type { Line } from "./model";
const props = defineProps<{ kind: "request" | "purchase"; lockedLines?: Line[] }>();
const emit = defineEmits<{
  save: [data: { person: string; supplier: string; lines: Line[] }];
  cancel: [];
}>();
const person = ref(props.kind === "purchase" ? "陈采购" : "仓库管理员");
const supplier = ref("");
const lines = reactive<Line[]>(
  props.lockedLines?.map((l) => ({ ...l })) || [{ material: "M001", qty: 1 }]
);
function submit() {
  if (!person.value.trim()) {
    ElMessage.error(props.kind === "request" ? "请填写请购人" : "请填写采购人");
    return;
  }
  if (props.kind === "purchase" && !supplier.value.trim()) {
    ElMessage.error("请填写供应商");
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
      <h2>商品明细</h2>
      <el-button v-if="!lockedLines" :icon="Plus" @click="lines.push({ material: '', qty: 1 })"
        >添加商品</el-button
      >
    </div>
    <div class="editor-line" v-for="(line, index) in lines" :key="index">
      <label
        >商品 {{ index + 1
        }}<el-select
          v-model="line.material"
          filterable
          :disabled="!!lockedLines"
          placeholder="请选择商品"
          ><el-option
            v-for="m in state.materials"
            :key="m.id"
            :label="`${m.name} · ${m.spec}`"
            :value="m.id" /></el-select></label
      ><label
        >数量<el-input-number
          v-model="line.qty"
          :min="1"
          :max="100000"
          :precision="0"
          :disabled="!!lockedLines" /></label
      ><el-button
        v-if="!lockedLines"
        text
        type="danger"
        :icon="Delete"
        :aria-label="`删除第 ${index + 1} 行`"
        :disabled="lines.length === 1"
        @click="lines.splice(index, 1)"
      />
    </div>
    <div class="dialog-actions">
      <el-button @click="emit('cancel')">取消</el-button
      ><el-button type="primary" native-type="submit">{{
        lockedLines ? "确认生成采购单" : "保存单据"
      }}</el-button>
    </div>
  </el-form>
</template>
