<script setup lang="ts">
import { ref, useId } from "vue";
import { Search, Refresh, Filter, FullScreen, Close, Setting } from "@element-plus/icons-vue";

// 沿用来源组件的插槽结构，只接入本地演示需要的能力，不引入后台状态与权限依赖。
defineProps<{ filterable?: boolean }>();
const emit = defineEmits<{ search: []; reset: [] }>();
const filtersVisible = ref(true);
const expanded = ref(false);
const density = ref("default");
const bordered = ref(false);
const striped = ref(true);
const filterId = useId();
function search(event?: KeyboardEvent) {
  if (event?.isComposing) return;
  event?.preventDefault();
  emit("search");
}
</script>

<template>
  <section
    class="panel management-list"
    :class="[
      `density-${density}`,
      { 'list-expanded': expanded, 'list-bordered': bordered, 'list-plain': !striped },
    ]"
    @keydown.esc="expanded = false"
  >
    <div v-if="filterable" v-show="filtersVisible" :id="filterId" class="management-filters">
      <el-form inline novalidate @submit.prevent="search()" @keydown.enter="search($event)">
        <slot name="filters" />
        <el-form-item class="filter-actions">
          <el-button type="primary" :icon="Search" @click="search()">查询</el-button>
          <el-button :icon="Refresh" @click="emit('reset')">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="management-toolbar">
      <div class="management-business"><slot name="toolbar" /></div>
      <div class="management-display" aria-label="列表显示设置">
        <el-button
          v-if="filterable"
          :icon="Filter"
          :aria-expanded="filtersVisible"
          :aria-controls="filterId"
          @click="filtersVisible = !filtersVisible"
        >
          {{ filtersVisible ? "收起筛选" : "展开筛选" }}
        </el-button>
        <el-popover placement="bottom-end" :width="220" trigger="click">
          <template #reference><el-button :icon="Setting">表格设置</el-button></template>
          <div class="list-settings">
            <span>行间距</span>
            <el-radio-group v-model="density" size="small" aria-label="表格行间距">
              <el-radio-button value="compact">紧凑</el-radio-button>
              <el-radio-button value="default">标准</el-radio-button>
              <el-radio-button value="relaxed">宽松</el-radio-button>
            </el-radio-group>
            <el-switch v-model="striped" active-text="斑马纹" aria-label="斑马纹" />
            <el-switch v-model="bordered" active-text="单元格边框" aria-label="单元格边框" />
          </div>
        </el-popover>
        <el-button
          :icon="expanded ? Close : FullScreen"
          :aria-pressed="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? "退出扩展" : "扩展列表" }}
        </el-button>
      </div>
    </div>
    <div class="management-content"><slot /></div>
  </section>
</template>
