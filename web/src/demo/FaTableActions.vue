<script setup lang="ts">
defineProps<{
  actions: { label: string; action: () => void; disabled?: boolean; danger?: boolean }[];
}>();
</script>

<template>
  <div class="table-actions">
    <el-button
      v-for="item in actions.slice(0, 2)"
      :key="item.label"
      link
      :type="item.danger ? 'danger' : 'primary'"
      :disabled="item.disabled"
      @click="item.action()"
    >
      {{ item.label }}
    </el-button>
    <el-dropdown v-if="actions.length > 2" trigger="click">
      <el-button link type="primary" aria-label="更多操作">更多</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in actions.slice(2)"
            :key="item.label"
            :disabled="item.disabled"
            @click="item.action()"
            >{{ item.label }}</el-dropdown-item
          >
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.table-actions .el-button + .el-button {
  margin-left: 0;
}
</style>
