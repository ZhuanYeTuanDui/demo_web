<template>
  <div class="step-card">
    <ElAlert :title="title" :description="description" type="info" :closable="false" show-icon />
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
</style>
