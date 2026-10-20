<script setup lang="ts">
import { inject, ref } from "vue";
import { ElDrawer } from "element-plus";
import { pageActiveKey } from "./page-cache";

defineOptions({ inheritAttrs: false });
defineProps<{ modelValue?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean]; close: []; closed: [] }>();
const active = inject(pageActiveKey, ref(true));
</script>

<template>
  <ElDrawer
    v-bind="$attrs"
    :model-value="!!modelValue && active"
    @update:model-value="
      (value) => {
        if (active) emit('update:modelValue', value);
      }
    "
    @close="active && emit('close')"
    @closed="active && emit('closed')"
  >
    <template v-for="(_, name) in $slots" #[name]="scope"
      ><slot :name="name" v-bind="scope || {}"
    /></template>
  </ElDrawer>
</template>
