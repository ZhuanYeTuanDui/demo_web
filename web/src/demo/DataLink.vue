<script setup lang="ts">
defineProps<{ href?: string }>();
const emit = defineEmits<{ click: [event: MouseEvent] }>();
// 数据文字允许拖选复制；只有未选中文字时才打开关联页面或详情。
function activate(event: MouseEvent) {
  const selection = window.getSelection();
  const target = event.currentTarget as HTMLElement;
  if (
    selection?.toString() &&
    selection.rangeCount &&
    selection.getRangeAt(0).intersectsNode(target)
  ) {
    event.preventDefault();
    return;
  }
  if (target.tagName === "A" && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey))
    return;
  event.preventDefault();
  emit("click", event);
}
</script>

<template>
  <a v-if="href" :href="href" class="data-link" @click="activate"><slot /></a>
  <button v-else type="button" class="data-link" @click="activate"><slot /></button>
</template>

<style scoped>
.data-link {
  display: inline;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand);
  font: inherit;
  line-height: inherit;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  cursor: pointer;
  -webkit-user-select: text;
  user-select: text;
}
.data-link:hover {
  text-decoration: underline;
}
.data-link:active {
  opacity: 0.8;
}
</style>
