<template>
  <div class="ingredient-editor">
    <template v-if="box.editor_ingredients === undefined"
      ><ElInput
        v-model="box.content_text"
        type="textarea"
        :rows="3"
        placeholder="填写食材和用量说明"
        :disabled="disabled"
      /><ElButton :disabled="disabled" link type="primary" @click="startRows"
        >按条目填写 / 从食材库选择</ElButton
      ></template
    >
    <div v-for="(item, index) in items" :key="index" class="ingredient-line">
      <ElSelect
        :model-value="item.ingredient_id ?? item.name"
        filterable
        allow-create
        default-first-option
        placeholder="从食材库选择或手动输入"
        :disabled="disabled"
        remote
        :remote-method="loadLibrary"
        :loading="loading"
        @visible-change="(visible) => visible && loadLibrary('')"
        @change="select(item, $event)"
      >
        <ElOption
          v-if="item.ingredient_id && !library.some((food) => food.id === item.ingredient_id)"
          :label="item.name"
          :value="item.ingredient_id"
        />
        <ElOption
          v-for="food in library"
          :key="food.id"
          :label="`${food.name}（${food.unit}）`"
          :value="food.id"
        />
      </ElSelect>
      <ElInput v-model="item.quantity" placeholder="用量，如 300g / 半个" :disabled="disabled" />
      <ElButton :disabled="disabled" link type="danger" @click="items.splice(index, 1)"
        >删除</ElButton
      >
    </div>
    <ElButton
      :disabled="disabled"
      link
      type="primary"
      v-if="box.editor_ingredients !== undefined"
      @click="items.push({ ingredient_id: null, name: '', quantity: '' })"
      >＋ 添加食材</ElButton
    >
    <ElButton v-if="box.editor_ingredients !== undefined" :disabled="disabled" link @click="useText"
      >直接填写说明字符串（取消关联）</ElButton
    >
    <div class="ingredient-hint">
      可直接填写说明字符串，或从食材库选择并填写用量；手填内容不强制关联食材。
    </div>
    <div v-if="invalid" class="ingredient-error" role="alert">
      请至少填写一项食材，并补齐每项用量。
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, watch, ref } from "vue";
import { initializeIngredients, copy, type Box } from "./recipeEditor";
import { getIngredientOptions } from "@/api/business/recipeEditor";
const props = defineProps<{ box: Box; disabled?: boolean; showErrors?: boolean }>();
const emit = defineEmits<{ change: [box: Box] }>();
// 使用编辑副本并向父层提交更新，避免子组件直接修改传入数据。
const box = ref(copy(props.box));
const library = ref<{ id: number; name: string; unit: string }[]>([]),
  loading = ref(false);
let requestId = 0;
async function loadLibrary(name: string) {
  const token = ++requestId;
  loading.value = true;
  try {
    const result = await getIngredientOptions(name);
    if (token === requestId) library.value = result.items;
  } finally {
    if (token === requestId) loading.value = false;
  }
}
function startRows() {
  initializeIngredients(box.value, true);
  if (!box.value.editor_ingredients?.length)
    box.value.editor_ingredients = [{ ingredient_id: null, name: "", quantity: "" }];
}
function useText() {
  box.value.ingredient_links = [];
  box.value.editor_ingredients = undefined;
}
/** 旧展示文本只作初始解析；后续文本由编辑行生成，食材 ID 单独保留。 */
watch(
  () => props.box,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(box.value)) box.value = copy(value);
    initializeIngredients(box.value);
  },
  { immediate: true }
);
const items = computed(() => box.value.editor_ingredients || []);
const invalid = computed(
  () =>
    props.showErrors &&
    (box.value.editor_ingredients === undefined
      ? !box.value.content_text.trim()
      : !items.value.length ||
        items.value.some((item) => !item.name.trim() || !item.quantity.trim()))
);
function select(item: NonNullable<Box["editor_ingredients"]>[number], value: number | string) {
  const food = library.value.find((f) => f.id === value);
  if (!food && value === item.ingredient_id) return;
  item.ingredient_id = food?.id ?? null;
  item.name = food?.name ?? String(value);
}
watch(
  () => items.value,
  (rows) => {
    if (box.value.editor_ingredients === undefined) return;
    box.value.content_text = rows
      .map((item) => `${item.name.trim()}：${item.quantity.trim()}`)
      .filter(Boolean)
      .join("，");
  },
  { deep: true }
);
watch(
  box,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(props.box)) emit("change", copy(value));
  },
  { deep: true }
);
</script>
<style scoped>
.ingredient-editor {
  width: 100%;
}
.ingredient-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  margin-bottom: 12px;
}
.ingredient-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 8px;
}
.ingredient-error {
  color: var(--el-color-danger);
  margin-top: 8px;
}
@media (max-width: 600px) {
  .ingredient-line {
    grid-template-columns: 1fr;
  }
}
</style>
