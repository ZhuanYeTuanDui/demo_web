<script setup lang="ts">
import { onActivated, onDeactivated, provide, ref, type Component } from "vue";
import { pageActiveKey } from "./page-cache";

defineProps<{ component: Component; pageProps: Record<string, string> }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const active = ref(true);
provide(pageActiveKey, active);
onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
});
</script>

<template>
  <div class="cached-page">
    <component :is="component" v-bind="pageProps" @navigate="emit('navigate', $event)" />
  </div>
</template>
