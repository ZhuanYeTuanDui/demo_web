<script setup lang="ts">
import DataLink from "./DataLink.vue";
import { computed, ref, watch } from "vue";
import FaManagementList from "./FaManagementList.vue";
import { state, material, warehouseName } from "./store";
import { stockKey } from "./model";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const warehouse = ref("");
const page = ref(1);
const pageSize = ref(50);
const warehouses = computed(() => state.value.warehouses.filter((w) => w.id === "CP01"));
const rows = computed(() => {
  const products = new Set(state.value.plans.map((plan) => plan.product));
  return warehouses.value
    .flatMap((w) =>
      [...products].map((product) => ({
        warehouse: w.id,
        product,
        qty: state.value.stocks[stockKey(w.id, product)] || 0,
      }))
    )
    .filter(
      (row) =>
        row.qty > 0 &&
        (!warehouse.value || row.warehouse === warehouse.value) &&
        `${row.product}${material(row.product)?.name || ""}${material(row.product)?.spec || ""}`.includes(
          keyword.value
        )
    );
});
const paged = computed(() =>
  rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
watch([keyword, warehouse, pageSize], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
</script>
<template>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      warehouse = '';
      page = 1;
    "
    ><template #filters
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" clearable placeholder="成品品号、名称、规格" /></el-form-item
      ><el-form-item label="仓库"
        ><el-select v-model="warehouse" clearable placeholder="全部成品仓库"
          ><el-option
            v-for="w in warehouses"
            :key="w.id"
            :label="w.name"
            :value="w.id" /></el-select></el-form-item></template
    ><template #toolbar
      ><el-button type="primary" @click="emit('navigate', 'shipments')"
        >成品发货</el-button
      ></template
    >
    <el-table :data="paged" empty-text="暂无成品库存，请先完成生产计划入库"
      ><el-table-column prop="product" label="成品品号" min-width="160" /><el-table-column
        label="成品名称"
        min-width="230"
        ><template #default="{ row }"
          ><DataLink :href="`#materials/${row.product}`" @click="emit('navigate', `materials/${row.product}`)">{{
            material(row.product)?.name || row.product
          }}</DataLink></template
        ></el-table-column
      ><el-table-column label="规格" min-width="180"
        ><template #default="{ row }">{{
          material(row.product)?.spec || "—"
        }}</template></el-table-column
      ><el-table-column label="仓库" min-width="150"
        ><template #default="{ row }">{{ warehouseName(row.warehouse) }}</template></el-table-column
      ><el-table-column prop="qty" label="库存数量" width="120" align="right" /><el-table-column
        label="单位"
        width="80"
        ><template #default="{ row }">{{
          material(row.product)?.unit || "台"
        }}</template></el-table-column
      ></el-table
    >
    <div class="pagination">
      <span>共 {{ rows.length }} 条记录</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="rows.length"
        layout="sizes, prev, pager, next"
      />
    </div>
  </FaManagementList>
</template>
