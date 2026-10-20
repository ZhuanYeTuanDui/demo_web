<template>
  <div class="step-card step-card--fixed">
    <ElAlert :title="title" :description="description" type="success" :closable="false" show-icon />
    <StepCommonFields
      :step="step"
      :readonly="readonly"
      :type-label="typeLabel"
      :update-step="updateStep"
    />
  </div>
</template>

<script setup lang="ts">
import type { Step } from "../recipeEditor";
import StepCommonFields from "./StepCommonFields.vue";

defineProps<{
  step: Step;
  readonly: boolean;
  typeLabel: string;
  title: string;
  description: string;
  updateStep: (changes: Partial<Step>) => void;
}>();
</script>

<style scoped>
.step-card {
  display: grid;
  gap: 18px;
}
.step-card--fixed :deep(.el-alert) {
  border-left: 4px solid var(--el-color-success);
}
</style>
