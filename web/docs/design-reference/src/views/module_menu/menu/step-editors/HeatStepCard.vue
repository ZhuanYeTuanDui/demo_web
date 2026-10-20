<template>
  <div class="step-card step-card--heat">
    <ElAlert
      title="热锅起油"
      description="热锅档位、等待时间、供水和注油通过对应动作参数配置。"
      type="warning"
      :closable="false"
      show-icon
    />
    <StepCommonFields
      :step="step"
      :readonly="readonly"
      :type-label="typeLabel"
      :update-step="updateStep"
    >
      <template #fields>
        <ElFormItem label="电磁炉档位">
          <ElInputNumber
            :model-value="values.level"
            :disabled="readonly"
            :min="1"
            :max="99"
            :precision="0"
            controls-position="right"
            @update:model-value="(value) => emit('parameter-change', 'heat_level', value ?? 99)"
          />
        </ElFormItem>
        <ElFormItem label="热锅时间（秒）">
          <ElInputNumber
            :model-value="values.time"
            :disabled="readonly"
            :min="11"
            :max="28"
            :precision="0"
            controls-position="right"
            @update:model-value="(value) => emit('parameter-change', 'heat_time', value ?? 11)"
          />
        </ElFormItem>
        <ElFormItem label="锅内加水（ml）">
          <ElInputNumber
            :model-value="values.water"
            :disabled="readonly"
            :min="0"
            :max="3000"
            :precision="0"
            controls-position="right"
            @update:model-value="(value) => emit('parameter-change', 'heat_water', value ?? 0)"
          />
        </ElFormItem>
        <ElFormItem label="食用油（ml）">
          <ElInputNumber
            :model-value="values.oil"
            :disabled="readonly"
            :min="0"
            :max="430"
            :precision="0"
            controls-position="right"
            @update:model-value="(value) => emit('parameter-change', 'heat_oil', value ?? 0)"
          />
        </ElFormItem>
      </template>
    </StepCommonFields>
  </div>
</template>

<script setup lang="ts">
import type { Step } from "../recipeEditor";
import StepCommonFields from "./StepCommonFields.vue";

defineProps<{
  step: Step;
  readonly: boolean;
  typeLabel: string;
  updateStep: (changes: Partial<Step>) => void;
  values: { level: number; time: number; water: number; oil: number };
}>();

const emit = defineEmits<{
  "parameter-change": [role: "heat_level" | "heat_time" | "heat_water" | "heat_oil", value: number];
}>();
</script>

<style scoped>
.step-card {
  display: grid;
  gap: 18px;
}
.step-card--heat :deep(.el-alert) {
  border-left: 4px solid var(--el-color-warning);
}
</style>
