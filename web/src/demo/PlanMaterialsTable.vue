<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { ElAutoResizer, ElTableV2, type Column } from "element-plus";
import DataLink from "./DataLink.vue";
import { material } from "./store";
import { planBom, type Plan } from "./model";

const props = defineProps<{ plan: Plan }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const page = ref(1);
const pageSize = ref(100);
const lines = computed(() => planBom(props.plan));
const paged = computed(() =>
  lines.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const createdMaterials = computed(
  () =>
    new Set(props.plan.importSource?.rows.filter((row) => row.created).map((row) => row.material))
);
watch([() => props.plan.id, pageSize], () => {
  page.value = 1;
});
watch(
  () => lines.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
// 分页限制当前数据集，TableV2 再仅挂载视口附近的行，避免大 BOM 同时创建全部单元格。
const columns = computed<Column[]>(() => [
  {
    key: "material",
    dataKey: "material",
    title: "物料",
    width: 260,
    cellRenderer: ({ rowData }) =>
      h("div", { class: "plan-material-name" }, [
        h(
          DataLink,
          {
            href: `#materials/${rowData.material}`,
            onClick: () => emit("navigate", `materials/${rowData.material}`),
          },
          () => material(rowData.material)?.name || rowData.material
        ),
        h("span", { class: "cell-sub" }, rowData.material),
        props.plan.importSource
          ? h(
              "span",
              { class: "cell-sub" },
              createdMaterials.value.has(rowData.material) ? "本次新建" : "匹配已有"
            )
          : null,
      ]),
  },
  {
    key: "spec",
    title: "图号 / 规格",
    width: 230,
    cellRenderer: ({ rowData }) =>
      h(
        "span",
        {
          title: String(
            material(rowData.material)?.details?.drawingNo ||
              material(rowData.material)?.spec ||
              "—"
          ),
        },
        String(
          material(rowData.material)?.details?.drawingNo || material(rowData.material)?.spec || "—"
        )
      ),
  },
  {
    key: "unit",
    title: "单位",
    width: 70,
    cellRenderer: ({ rowData }) => h("span", material(rowData.material)?.unit || "—"),
  },
  {
    key: "qty",
    dataKey: "qty",
    title: props.plan.importSource?.basis === "total" ? "需求量" : "单台用量",
    width: 100,
    align: "right",
  },
]);
</script>

<template>
  <div class="plan-materials-viewport" aria-label="生产计划物料明细">
    <ElAutoResizer
      ><template #default="{ width, height }">
        <ElTableV2
          :key="`${plan.id}-${page}-${pageSize}`"
          :columns="columns"
          :data="paged"
          :width="width"
          :height="height"
          :row-height="76"
          :header-height="42"
          row-key="material"
          fixed
        /> </template
    ></ElAutoResizer>
  </div>
  <div class="pagination">
    <span>共 {{ lines.length }} 条物料</span>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[100, 200, 500]"
      :total="lines.length"
      :pager-count="5"
      layout="sizes, prev, pager, next"
    />
  </div>
</template>

<style scoped>
.plan-materials-viewport {
  height: min(480px, 55vh);
  min-height: 220px;
  width: 100%;
}
.plan-materials-viewport :deep(.el-table-v2__cell-text) {
  white-space: normal;
}
.plan-materials-viewport :deep(.cell-sub) {
  margin-top: 1px;
}
.pagination {
  padding-inline: 0;
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .pagination :deep(.el-pagination) {
    flex-wrap: wrap;
  }
}
</style>
