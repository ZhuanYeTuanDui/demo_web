<template>
  <div class="step-card step-card--serve">
    <ElAlert :title="title" :description="description" type="success" :closable="false" show-icon />
    <StepCommonFields
      :step="step"
      :readonly="readonly"
      :type-label="typeLabel"
      :update-step="updateStep"
    >
      <template #fields>
        <ElFormItem label="出菜方式">
          <ElSelect
            :model-value="speed"
            :disabled="readonly || speedUpdating"
            @change="(value) => emit('speed-change', value)"
          >
            <ElOption
              v-for="option in servingSpeedOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </ElSelect>
          <div class="form-tip">切换时只绑定动作库中已有的正常 / 高速或低速动作。</div>
        </ElFormItem>
      </template>
    </StepCommonFields>
  </div>
</template>

<script setup lang="ts">
import { servingSpeedOptions, type ServingSpeed } from "@/config/recipeStepPreset";
import type { Step } from "../recipeEditor";
import StepCommonFields from "./StepCommonFields.vue";

defineProps<{
  step: Step;
  readonly: boolean;
  typeLabel: string;
  title: string;
  description: string;
  speed: ServingSpeed;
  speedUpdating: boolean;
  updateStep: (changes: Partial<Step>) => void;
}>();

const emit = defineEmits<{ "speed-change": [value: ServingSpeed] }>();
</script>

<style scoped>
.step-card {
  display: grid;
  gap: 18px;
}
.step-card--serve :deep(.el-alert) {
  border-left: 4px solid var(--el-color-success);
}
.form-tip {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
