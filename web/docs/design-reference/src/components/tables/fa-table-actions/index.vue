<template>
  <div class="fa-table-actions" @click.stop>
    <div class="fa-table-actions__inline">
      <ElTooltip
        v-for="action in inlineActions"
        :key="action.key"
        :content="action.label"
        placement="top"
        :show-after="200"
      >
        <span
          class="fa-table-actions__icon"
          :class="{ 'is-disabled': action.disabled }"
          role="button"
          :tabindex="action.disabled ? -1 : 0"
          :aria-label="action.label"
          @click="runInlineAction(action)"
          @keydown.enter.prevent="runInlineAction(action)"
          @keydown.space.prevent="runInlineAction(action)"
        >
          <FaButtonTable
            :type="actionButtonType(action)"
            :icon="actionIcon(action)"
            :icon-color="action.iconColor"
          />
        </span>
      </ElTooltip>
    </div>

    <ElTooltip v-if="overflowActions.length" content="更多" placement="top" :show-after="200">
      <div class="fa-table-actions__more" aria-label="更多操作">
        <FaButtonMore :list="moreItems(overflowActions)" @click="runMoreAction" />
      </div>
    </ElTooltip>

    <div v-if="actions.length" class="fa-table-actions__mobile" aria-label="行操作">
      <FaButtonMore :list="moreItems(actions)" @click="runMoreAction" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FaButtonTable from "@/components/forms/fa-button-table/index.vue";
import FaButtonMore from "@/components/forms/fa-button-more/index.vue";
import type { ButtonMoreItem } from "@/components/forms/fa-button-more/types";

export interface TableAction {
  key: string | number;
  label: string;
  type?: "primary" | "danger";
  /** 显式指定 Remix Icon；不传时按 key 和 label 自动匹配。 */
  icon?: string;
  /** 显式指定按钮色彩语义。 */
  artType?: "add" | "edit" | "delete" | "more" | "view";
  iconColor?: string;
  disabled?: boolean;
  onClick: () => void;
}

const props = withDefaults(defineProps<{ actions: TableAction[]; maxInline?: number }>(), {
  maxInline: 3,
});
const inlineActions = computed(() => props.actions.slice(0, props.maxInline));
const overflowActions = computed(() => props.actions.slice(props.maxInline));

const ICON_RULES: Array<{
  pattern: RegExp;
  icon: string;
  type: NonNullable<TableAction["artType"]>;
}> = [
  { pattern: /删除|移除|delete|remove/i, icon: "ri:delete-bin-5-line", type: "delete" },
  { pattern: /编辑|修改|更新|edit|update/i, icon: "ri:pencil-line", type: "edit" },
  { pattern: /查看|详情|预览|view|detail|preview/i, icon: "ri:eye-line", type: "view" },
  { pattern: /发布|publish/i, icon: "ri:send-plane-line", type: "add" },
  { pattern: /复制|copy|草稿/i, icon: "ri:file-copy-line", type: "add" },
  { pattern: /版本|version/i, icon: "ri:git-branch-line", type: "view" },
  { pattern: /下架|offline/i, icon: "ri:arrow-down-circle-line", type: "more" },
  { pattern: /连接|link|测试/i, icon: "ri:link", type: "view" },
  { pattern: /新增|创建|add|create/i, icon: "ri:add-fill", type: "add" },
];

function matchedRule(action: TableAction) {
  return (
    ICON_RULES.find((rule) => rule.pattern.test(action.label)) ??
    ICON_RULES.find((rule) => rule.pattern.test(String(action.key)))
  );
}

function actionButtonType(action: TableAction): NonNullable<TableAction["artType"]> {
  if (action.artType) return action.artType;
  if (action.type === "danger") return "delete";
  return matchedRule(action)?.type ?? "more";
}

function actionIcon(action: TableAction) {
  return action.icon ?? matchedRule(action)?.icon ?? "ri:more-2-fill";
}

function actionColor(action: TableAction) {
  if (action.iconColor) return action.iconColor;
  if (actionButtonType(action) === "delete") return "var(--el-color-danger)";
  return undefined;
}

function moreItems(actions: TableAction[]): ButtonMoreItem[] {
  return actions.map((action) => ({
    key: action.key,
    label: action.label,
    disabled: action.disabled,
    icon: actionIcon(action),
    iconColor: actionColor(action),
    color: actionButtonType(action) === "delete" ? "var(--el-color-danger)" : undefined,
  }));
}

function runInlineAction(action: TableAction) {
  if (!action.disabled) action.onClick();
}

function runMoreAction(item: ButtonMoreItem) {
  props.actions
    .find((action) => String(action.key) === String(item.key) && !action.disabled)
    ?.onClick();
}
</script>

<style scoped lang="scss">
.fa-table-actions {
  display: flex;
  gap: 0;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  white-space: nowrap;
}

.fa-table-actions__inline {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fa-table-actions__icon {
  display: inline-flex;
  border-radius: 6px;
  outline: none;
}

.fa-table-actions__icon:focus-visible {
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.fa-table-actions__icon.is-disabled {
  pointer-events: none;
  opacity: 0.4;
}

.fa-table-actions__inline :deep(.hover-btn) {
  width: 32px;
  min-width: 32px;
  padding: 0;
  margin-right: 6px;
}

.fa-table-actions__more {
  display: inline-flex;
}

.fa-table-actions__mobile {
  display: none;
}

@media (width <= 768px) {
  .fa-table-actions__inline,
  .fa-table-actions__more {
    display: none;
  }

  .fa-table-actions__mobile {
    display: inline-flex;
  }
}
</style>
