<script setup lang="ts">
import DataLink from "./DataLink.vue";
import FaManagementList from "./FaManagementList.vue";
import { computed, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ArrowLeft, Edit, Check, Search, Box } from "@element-plus/icons-vue";
import { state, commit, warehouseName } from "./store";
import {
  categories,
  groups,
  materialDraft,
  materialCategory,
  categoryName,
  saveMaterial,
  type Field,
  type Value,
} from "./material-profile";

const props = defineProps<{ materialId?: string }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const selected = computed(() => state.value.materials.find((m) => m.id === props.materialId));
const editing = ref(false);
const tab = ref("basic");
const formRef = ref<FormInstance>();
const form = reactive<Record<string, Value>>({});
const snapshot = computed(() => (selected.value ? materialDraft(selected.value) : {}));
const keyword = ref("");
const categorySearch = ref("");
const category = ref("");
const page = ref(1);
const pageSize = ref(10);
const categoryList = computed(() =>
  categories.filter((c) =>
    `${c.id}${c.name}`.toLowerCase().includes(categorySearch.value.toLowerCase())
  )
);
const filtered = computed(() =>
  state.value.materials.filter(
    (m) =>
      (!category.value || materialCategory(m) === category.value) &&
      `${m.id}${m.name}${m.spec}`.toLowerCase().includes(keyword.value.toLowerCase())
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const rules: FormRules = Object.fromEntries(
  groups
    .flatMap((g) => g.fields)
    .filter((f) => f.required || f.type === "number")
    .map((f) => [
      f.key,
      f.required
        ? [{ required: true, whitespace: true, message: `请填写${f.label}`, trigger: "blur" }]
        : [
            {
              type: "number",
              min: f.min ?? 0,
              max: f.max ?? 1000000,
              message: `${f.label}须在 ${f.min ?? 0}～${f.max ?? 1000000} 之间`,
              trigger: "blur",
            },
          ],
    ])
);
function startEditing() {
  if (!selected.value) return;
  Object.assign(form, materialDraft(selected.value));
  tab.value = "basic";
  editing.value = true;
}
function cancel() {
  editing.value = false;
  formRef.value?.clearValidate();
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  if (commit((s) => saveMaterial(s, props.materialId!, form), "物料基本信息已保存"))
    editing.value = false;
}
function setValue(key: string, value: Value | undefined) {
  form[key] = value ?? null;
}
function options(field: Field) {
  if (field.key === "category")
    return categories.map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` }));
  if (field.key === "mainWarehouse")
    return state.value.warehouses.map((w) => ({ value: w.id, label: `${w.id} · ${w.name}` }));
  return (field.options || []).map((value) => ({ value, label: value }));
}
function display(field: Field) {
  const value = snapshot.value[field.key];
  if (value === null || value === undefined || value === "") return "—";
  if (field.key === "category") return `${value} · ${categoryName(String(value))}`;
  if (field.key === "mainWarehouse") return `${value} · ${warehouseName(String(value))}`;
  if (field.key === "taxRate") return `${Number(value).toFixed(2)}%`;
  if (field.type === "switch") return value ? "是" : "否";
  return String(value);
}
watch(pageSize, () => {
  page.value = 1;
});
// 本地数据减少或状态变化后，将分页约束在有效范围内。
watch(() => filtered.value.length, (total) => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))); });
</script>

<template>
  <template v-if="!materialId">

    <div class="materials-layout">
      <aside class="panel material-categories" aria-label="商品分类">
        <div class="panel-heading"><h2>商品分类</h2></div>
        <div class="category-search">
          <el-input
            v-model="categorySearch"
            placeholder="分类编号或名称"
            :prefix-icon="Search"
            clearable
            aria-label="搜索商品分类"
          />
        </div>
        <button
          type="button"
          :class="['category-button', { selected: !category }]"
          :aria-pressed="!category"
          @click="
            category = '';
            page = 1;
          "
        >
          全部物料 <small>{{ state.materials.length }}</small></button
        ><button
          v-for="c in categoryList"
          :key="c.id"
          type="button"
          :class="['category-button', { selected: category === c.id }]"
          :aria-pressed="category === c.id"
          @click="
            category = c.id;
            page = 1;
          "
        >
          <span class="category-code">{{ c.id }}</span
          >{{ c.name
          }}<small>{{ state.materials.filter((m) => materialCategory(m) === c.id).length }}</small>
        </button>
        <p v-if="!categoryList.length" class="muted category-search">暂无匹配分类</p>
      </aside>
      <FaManagementList
        class="panel material-list"
        filterable
        @search="page = 1"
        @reset="
          keyword = '';
          category = '';
          page = 1;
        "
      >
        <template #filters>
          <el-form-item label="关键词"
            ><el-input
              v-model="keyword"
              placeholder="品号、品名或规格"
              :prefix-icon="Search"
              clearable
              @input="page = 1"
          /></el-form-item>
        </template>
        <template #toolbar
          ><div class="panel-heading">
            <h2>
              {{ category ? categoryName(category) : "全部物料" }}
              <span class="count-badge">{{ filtered.length }}</span>
            </h2>
            <span class="muted">点击品号或名称查看基本信息</span>
          </div></template
        >
        <el-table :data="paged" stripe empty-text="该分类暂无物料"
          ><el-table-column label="物料信息" min-width="235"
            ><template #default="{ row }"
              ><DataLink :href="`#materials/${row.id}`" @click="emit('navigate', `materials/${row.id}`)">{{
                row.name
              }}</DataLink>
              <div class="cell-sub code">
                <DataLink :href="`#materials/${row.id}`" @click="emit('navigate', `materials/${row.id}`)">{{
                  row.id
                }}</DataLink>
              </div></template
            ></el-table-column
          ><el-table-column prop="spec" label="规格" min-width="190" /><el-table-column
            label="商品分类"
            min-width="120"
            ><template #default="{ row }">{{
              categoryName(materialCategory(row))
            }}</template></el-table-column
          ><el-table-column prop="unit" label="库存单位" width="100" /><el-table-column
            label="操作"
            width="110"
            fixed="right"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="emit('navigate', `materials/${row.id}`)"
                >查看详情</el-button
              ></template
            ></el-table-column
          ></el-table
        >
        <div class="pagination">
          <span>共 {{ filtered.length }} 条记录</span
          ><el-pagination
            v-model:current-page="page"
            :total="filtered.length"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="sizes, prev, pager, next"
          />
        </div>
      </FaManagementList>
    </div>
  </template>
  <div v-else class="material-detail">
    <el-button text :icon="ArrowLeft" class="material-back" @click="emit('navigate', 'materials')"
      >返回物料档案</el-button
    >
    <template v-if="selected"
      ><div class="detail-toolbar">

        <div class="material-actions">
          <template v-if="editing"
            ><el-button @click="cancel">取消编辑</el-button
            ><el-button type="primary" :icon="Check" @click="save">保存修改</el-button></template
          ><el-button v-else type="primary" :icon="Edit" @click="startEditing">编辑资料</el-button>
        </div>
      </div>
      <section class="panel material-profile">
        <div class="material-profile-icon">
          <el-icon :size="26"><Box /></el-icon>
        </div>
        <div>
          <h2>{{ selected.name }}</h2>
          <p class="muted">
            {{ selected.id }}<span class="divider">/</span>{{ selected.spec || "规格未填写"
            }}<span class="divider">/</span>{{ selected.unit }}
          </p>
        </div>
        <el-tag effect="plain">{{ categoryName(materialCategory(selected)) }}</el-tag>
      </section>
      <section class="panel material-tabs">
        <el-tabs v-model="tab"
          ><el-tab-pane label="基本数据" name="basic" /><el-tab-pane
            label="单价"
            name="prices"
            :disabled="editing" /><el-tab-pane
            label="选配属性"
            name="attributes"
            :disabled="editing" /><el-tab-pane
            label="照片/描述"
            name="photos"
            :disabled="editing" /><el-tab-pane label="数据浏览" name="browse" :disabled="editing"
        /></el-tabs>
      </section>
      <template v-if="tab === 'basic'"
        ><el-alert
          v-if="editing"
          title="品号保持不变；补货、核算和状态属性目前仅作档案维护。"
          type="info"
          :closable="false"
          class="material-note"
        /><el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="save"
          ><section v-for="group in groups" :key="group.title" class="panel material-section">
            <div class="panel-heading">
              <h2>{{ group.title }}</h2>
              <span v-if="group.title === '基本标识'" class="muted"
                >品号：{{ selected.id }}（不可修改）</span
              >
            </div>
            <div :class="['material-field-grid', { editing }]">
              <template v-for="field in group.fields" :key="field.key"
                ><el-form-item v-if="editing" :label="field.label" :prop="field.key"
                  ><el-select
                    v-if="field.type === 'select'"
                    :model-value="String(form[field.key] || '')"
                    clearable
                    filterable
                    placeholder="请选择（选填）"
                    @update:model-value="setValue(field.key, $event)"
                    ><el-option
                      v-for="option in options(field)"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value" /></el-select
                  ><el-input-number
                    v-else-if="field.type === 'number'"
                    :model-value="
                      typeof form[field.key] === 'number' ? Number(form[field.key]) : undefined
                    "
                    :min="field.min ?? 0"
                    :max="field.max ?? 1000000"
                    :precision="field.integer ? 0 : 4"
                    :controls="true"
                    controls-position="right"
                    @update:model-value="setValue(field.key, $event)" /><el-switch
                    v-else-if="field.type === 'switch'"
                    :model-value="!!form[field.key]"
                    active-text="是"
                    inactive-text="否"
                    @update:model-value="setValue(field.key, !!$event)" /><el-input
                    v-else
                    :model-value="String(form[field.key] ?? '')"
                    :maxlength="field.key === 'name' ? 80 : 120"
                    :placeholder="field.required ? `请输入${field.label}` : '未填写'"
                    @update:model-value="setValue(field.key, $event)"
                /></el-form-item>
                <div v-else class="material-field">
                  <div class="field-label">{{ field.label }}</div>
                  <el-tag
                    v-if="field.type === 'switch'"
                    :type="snapshot[field.key] ? 'success' : 'info'"
                    >{{ display(field) }}</el-tag
                  >
                  <div v-else class="field-value">{{ display(field) }}</div>
                </div></template
              >
            </div>
          </section>
          <section class="panel material-section">
            <div class="panel-heading"><h2>备注</h2></div>
            <div class="material-remark">
              <el-form-item v-if="editing" label="补充说明"
                ><el-input
                  :model-value="String(form.remark || '')"
                  type="textarea"
                  :rows="3"
                  maxlength="500"
                  show-word-limit
                  placeholder="填写物料相关说明（选填）"
                  @update:model-value="setValue('remark', $event)"
              /></el-form-item>
              <p v-else>{{ snapshot.remark || "—" }}</p>
            </div>
          </section>
          <div v-if="editing" class="material-save-bar">
            <el-button @click="cancel">取消编辑</el-button
            ><el-button type="primary" :icon="Check" native-type="submit">保存修改</el-button>
          </div></el-form
        ></template
      >
      <section v-else class="panel">
        <el-empty description="暂未配置，待补充业务资料" :image-size="100" />
      </section>
    </template>
    <section v-else class="panel">
      <el-empty description="物料不存在或已被重置"
        ><el-button type="primary" @click="emit('navigate', 'materials')"
          >返回物料档案</el-button
        ></el-empty
      >
    </section>
  </div>
</template>

<style scoped>
.materials-layout {
  display: grid;
  grid-template-columns: 225px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.category-search {
  margin: 0 14px 12px;
}
.category-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 20px);
  min-height: 40px;
  border: 0;
  border-radius: 5px;
  margin: 2px 10px;
  padding: 10px 12px;
  background: transparent;
  color: #52637a;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.category-button:hover {
  background: #f5f8fc;
}
.category-button.selected {
  background: #edf3ff;
  color: var(--brand);
}
.category-button small {
  margin-left: auto;
  color: var(--muted);
}
.category-code {
  display: inline-block;
  width: 24px;
  font-size: 11px;
  color: var(--muted);
}
.material-categories {
  padding-bottom: 14px;
}
.material-list {
  min-width: 0;
}
.material-back {
  margin: -8px 0 16px -12px;
}
.material-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.material-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
}
.material-profile-icon {
  display: grid;
  place-items: center;
  color: var(--brand);
  background: #edf3ff;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  flex-shrink: 0;
}
.material-profile h2 {
  font-size: 20px;
}
.material-profile p {
  margin: 8px 0 0;
}
.material-profile > .el-tag {
  margin-left: auto;
}
.material-tabs {
  padding: 0 20px;
}
.material-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.material-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.material-section .panel-heading {
  border-bottom: 1px solid var(--line);
}
.material-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 24px;
  padding: 24px;
}
.material-field-grid.editing {
  gap: 8px 24px;
}
.material-field-grid :deep(.el-input-number) {
  width: 100%;
}
.field-label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 10px;
}
.field-value {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.material-remark {
  padding: 24px;
}
.material-remark p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
}
.material-note {
  margin-bottom: 20px;
}
.material-save-bar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 20px;
}
@media (max-width: 1100px) {
  .materials-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 14px;
  }
  .material-field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .materials-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .material-categories {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .material-categories .panel-heading,
  .category-search {
    grid-column: 1 / -1;
  }
  .material-field-grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 20px 16px;
  }
  .material-profile {
    padding: 20px 16px;
    flex-wrap: wrap;
  }
  .material-profile h2 {
    font-size: 17px;
  }
}
</style>
