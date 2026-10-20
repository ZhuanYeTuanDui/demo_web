<template>
  <ElForm label-position="top" :disabled="readonly">
    <div class="step-form-grid">
      <ElFormItem label="步骤名称（必填）">
        <ElInput
          :model-value="step.name"
          maxlength="255"
          @update:model-value="(value) => updateStep({ name: value })"
        />
      </ElFormItem>
      <ElFormItem label="步骤类型">
        <ElInput :model-value="typeLabel" disabled />
      </ElFormItem>
      <ElFormItem label="预计耗时（毫秒，可选）">
        <ElInputNumber
          :model-value="step.estimated_duration_ms"
          :min="0"
          :precision="0"
          controls-position="right"
          @update:model-value="(value) => updateStep({ estimated_duration_ms: value ?? null })"
        />
        <div class="form-tip">仅用于后台预估，不改变设备动作的执行时长。</div>
      </ElFormItem>
      <slot name="fields" />
    </div>
    <ElFormItem label="步骤说明">
      <ElInput
        :model-value="step.description"
        type="textarea"
        :rows="2"
        @update:model-value="(value) => updateStep({ description: value })"
      />
    </ElFormItem>
    <slot />
  </ElForm>
</template>

<script setup lang="ts">
import type { Step } from "../recipeEditor";

defineProps<{
  step: Step;
  readonly: boolean;
  typeLabel: string;
  updateStep: (changes: Partial<Step>) => void;
}>();
</script>

<style scoped>
.step-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}
.step-form-grid :deep(.el-select),
.step-form-grid :deep(.el-input-number) {
  width: 100%;
}
.form-tip {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}
@media (max-width: 900px) {
  .step-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
