<template>
  <div class="step-card step-card--feed">
    <ElAlert
      :title="`料盒 ${box?.box_no || '-'} 投料`"
      description="主投料动作由工艺和接料设置维护；下方执行动作只展示固体、液体、供水和机械臂等附加动作。"
      type="info"
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
        <ElFormItem label="绑定料盒">
          <ElSelect
            :model-value="step.box_id"
            :disabled="readonly"
            clearable
            @update:model-value="(value) => emit('update:boxId', value ?? null)"
          >
            <ElOption
              v-for="item in boxes"
              :key="item.id"
              :label="`料盒 ${item.box_no}${boxDisabled(item.id) ? '（已绑定）' : ''}`"
              :value="item.id"
              :disabled="boxDisabled(item.id)"
            />
          </ElSelect>
          <div class="form-tip">同一版本中，一个料盒只能绑定一个步骤。</div>
        </ElFormItem>
        <ElFormItem label="投料工艺">
          <ElSelect
            :model-value="feedingState.process"
            :disabled="readonly || !hasMainCommand || commandUpdating || feedingState.receive"
            @change="(value) => emit('process-change', value)"
          >
            <ElOption
              v-for="option in feedingProcessOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </ElSelect>
          <div class="form-tip">修改时只切换为动作库中已有的主投料动作。</div>
        </ElFormItem>
        <ElFormItem label="接料">
          <ElSwitch
            :model-value="feedingState.receive"
            :disabled="readonly || !hasMainCommand || commandUpdating"
            active-text="接料"
            inactive-text="不接料"
            @change="(value) => emit('receive-change', Boolean(value))"
          />
          <div class="form-tip">接料使用超低速接料动作；取消后恢复为超低速投料。</div>
        </ElFormItem>
      </template>

      <ElAlert
        v-if="!hasMainCommand"
        title="当前步骤缺少料盒默认动作，请删除后重新添加该步骤"
        type="error"
        :closable="false"
        show-icon
      />

      <template v-if="box">
        <ElDivider content-position="left">料盒 {{ box.box_no }} · 备料说明</ElDivider>
        <ElFormItem label="食材和用量" required>
          <BoxIngredientEditor
            :box="box"
            :disabled="readonly"
            :show-errors="showErrors"
            @change="(value) => emit('box-change', value)"
          />
        </ElFormItem>
        <ElFormItem label="备料提示">
          <ElInput
            :model-value="box.remark"
            :disabled="readonly"
            maxlength="500"
            @update:model-value="onRemarkChange"
          />
        </ElFormItem>
        <p class="muted">说明文本用于备料展示，实际投料由设备动作执行。</p>
      </template>
    </StepCommonFields>
  </div>
</template>

<script setup lang="ts">
import { feedingProcessOptions, type FeedingCommandState } from "@/config/recipeCommand";
import BoxIngredientEditor from "../BoxIngredientEditor.vue";
import type { Box, Step } from "../recipeEditor";
import StepCommonFields from "./StepCommonFields.vue";

const props = defineProps<{
  step: Step;
  box?: Box;
  boxes: Box[];
  readonly: boolean;
  typeLabel: string;
  feedingState: FeedingCommandState;
  hasMainCommand: boolean;
  commandUpdating: boolean;
  showErrors: boolean;
  boxDisabled: (id: number) => boolean;
  updateStep: (changes: Partial<Step>) => void;
}>();

const emit = defineEmits<{
  "update:boxId": [value: number | null];
  "process-change": [value: number];
  "receive-change": [value: boolean];
  "box-change": [value: Box];
}>();

function onRemarkChange(value: string) {
  if (!props.readonly && props.box) emit("box-change", { ...props.box, remark: value });
}
</script>

<style scoped>
.step-card {
  display: grid;
  gap: 18px;
}
.step-card--feed :deep(.el-alert) {
  border-left: 4px solid var(--el-color-primary);
}
.form-tip,
.muted {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
