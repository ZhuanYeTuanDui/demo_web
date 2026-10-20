<script setup lang="ts">
import FaManagementList from "./FaManagementList.vue";
import { computed, ref, watch } from "vue";
import { Search, DataAnalysis, } from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import { convertDraft, type Line } from "./model";
import DocumentEditor from "./DocumentEditor.vue";
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const status = ref("");
const page = ref(1);
const pageSize = ref(10);
const detail = ref(sessionStorage.getItem("wsn-selected-draft") || "");
sessionStorage.removeItem("wsn-selected-draft");
const converting = ref("");
const filtered = computed(() =>
  state.value.drafts.filter(
    (d) =>
      `${d.id}${d.plan}${d.product ? material(d.product)?.name : ""}${d.lines.map((l) => material(l.material)?.name).join("")}`.includes(
        keyword.value
      ) &&
      (!status.value || d.status === status.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.drafts.find((d) => d.id === detail.value));
const detailPage = ref(1);
const detailLines = computed(
  () => selected.value?.lines.slice((detailPage.value - 1) * 20, detailPage.value * 20) || []
);
watch(detail, () => {
  detailPage.value = 1;
});
const conversion = computed(() => state.value.drafts.find((d) => d.id === converting.value));
const order = computed(() => state.value.purchases.find((p) => p.draft === detail.value));
function sourcePlan(planId: string) {
  sessionStorage.setItem("wsn-selected-plan", planId);
  emit("navigate", "analysis");
}
function save(data: { person: string; supplier: string; lines: Line[] }) {
  if (
    commit(
      (s) => convertDraft(s, converting.value, data.person, data.supplier),
      "已从采购底稿生成采购单"
    )
  ) {
    converting.value = "";
    emit("navigate", "orders");
  }
}
const cell = (value: number | null) => (value === null ? "—" : value);
watch(pageSize, () => {
  page.value = 1;
});
// 本地数据减少或状态变化后，将分页约束在有效范围内。
watch(
  () => filtered.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)));
  }
);
</script>

<template>



  <FaManagementList
    class="panel"
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      status = '';
      page = 1;
    "
  >
    <template #filters>
      <el-form-item label="关键词"
        ><el-input
          v-model="keyword"
          :prefix-icon="Search"
          placeholder="底稿号、来源计划、机种或物料"
          clearable
          @input="page = 1" /></el-form-item
      ><el-form-item label="底稿状态"
        ><el-select v-model="status" clearable placeholder="全部状态" @change="page = 1"
          ><el-option label="待采购" value="待采购" /><el-option
            label="已转采购"
            value="已转采购" /></el-select
      ></el-form-item>
    </template>
    <template #toolbar
      ><div class="panel-heading">
        <el-button type="primary" :icon="DataAnalysis" @click="emit('navigate', 'analysis')"
          >需求分析生成底稿</el-button
        >
        <h2>
          底稿记录 <span class="count-badge">{{ filtered.length }}</span>
        </h2>
        <span class="muted">与仓库手工录入的请购单独立管理</span>
      </div></template
    >
    <el-table :data="paged" stripe empty-text="暂无采购底稿，请先从需求分析生成"
      ><el-table-column label="底稿单号 / 日期" min-width="245"
        ><template #default="{ row }"
          ><el-button link type="primary" class="code" @click="detail = row.id">{{
            row.id
          }}</el-button>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      ><el-table-column label="机种 / 来源计划" min-width="235"
        ><template #default="{ row }"
          ><div class="cell-title">
            {{ row.product ? material(row.product)?.name || "—" : "—" }}
          </div>
          <el-button link type="primary" class="code" @click="sourcePlan(row.plan)">{{
            row.plan
          }}</el-button></template
        ></el-table-column
      ><el-table-column label="需采购物料" min-width="105" align="right"
        ><template #default="{ row }"
          >{{ row.lines.filter((l: Line) => l.qty > 0).length }} 种</template
        ></el-table-column
      ><el-table-column label="性质" width="85"><template #default>需求</template></el-table-column
      ><el-table-column label="状态" width="110"
        ><template #default="{ row }"
          ><el-tag :type="row.status === '已转采购' ? 'success' : 'warning'">{{
            row.status
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="备注" min-width="170"
        ><template #default="{ row }">{{
          row.legacy ? "旧版计划记录迁移" : row.remark
        }}</template></el-table-column
      ><el-table-column label="操作" width="150" fixed="right"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="detail = row.id">详情</el-button
          ><el-button
            v-if="row.status === '待采购'"
            link
            type="primary"
            @click="converting = row.id"
            >转采购单</el-button
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
  <el-drawer
    :model-value="!!selected"
    title="采购底稿详情"
    size="1360px"
    class="draft-drawer"
    @close="detail = ''"
    ><template v-if="selected"
      ><el-alert
        v-if="selected.legacy"
        title="此记录由旧版自动请购迁移，历史库存与 BOM 计算快照缺失，相关字段显示 —。"
        type="warning"
        :closable="false"
        show-icon
      /><el-descriptions :column="2" border class="draft-header"
        ><el-descriptions-item label="底稿单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="性质">需求</el-descriptions-item
        ><el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item
        ><el-descriptions-item label="机种">{{
          selected.product ? material(selected.product)?.name || "—" : "—"
        }}</el-descriptions-item
        ><el-descriptions-item label="来源计划"
          ><el-button link type="primary" @click="sourcePlan(selected.plan)">{{
            selected.plan
          }}</el-button></el-descriptions-item
        ><el-descriptions-item label="制单人">{{ selected.creator }}</el-descriptions-item
        ><el-descriptions-item label="采购人 / 供应商">{{
          order ? `${order.buyer} / ${order.supplier}` : "—"
        }}</el-descriptions-item
        ><el-descriptions-item label="部门 / 送货地址">—</el-descriptions-item
        ><el-descriptions-item label="审核 / 税价合计">暂未配置</el-descriptions-item
        ><el-descriptions-item label="备注" :span="2">{{
          selected.remark
        }}</el-descriptions-item></el-descriptions
      >
      <div class="panel-heading">
        <h2>物料明细</h2>
        <span class="muted">BOM 需求量是总用量，需购买数量是本次缺口</span>
      </div>
      <el-table :data="detailLines" stripe max-height="420"
        ><el-table-column label="品号 / 品名" min-width="190"
          ><template #default="{ row }"
            ><div>{{ material(row.material).name }}</div>
            <span class="cell-sub"
              >{{ row.material }} · {{ material(row.material).spec }}</span
            ></template
          ></el-table-column
        ><el-table-column label="BOM 需求量" width="110" align="right"
          ><template #default="{ row }">{{ cell(row.bomQty) }}</template></el-table-column
        ><el-table-column label="生成时可分配" width="125" align="right"
          ><template #default="{ row }">{{ cell(row.usable) }}</template></el-table-column
        ><el-table-column label="已覆盖量" width="105" align="right"
          ><template #default="{ row }">{{ cell(row.covered) }}</template></el-table-column
        ><el-table-column label="需购买数量" width="115" align="right"
          ><template #default="{ row }"
            ><strong :class="row.qty > 0 ? 'shortage' : 'muted'">{{ row.qty }}</strong></template
          ></el-table-column
        ><el-table-column label="单位" width="80"
          ><template #default="{ row }">{{
            material(row.material).unit
          }}</template></el-table-column
        ><el-table-column prop="dueDate" label="预交货日期" min-width="120"
          ><template #default="{ row }">{{ row.dueDate || "—" }}</template></el-table-column
        ><el-table-column label="前置单据" min-width="220"
          ><template #default="{ row }"
            ><el-button link type="primary" class="code" @click="sourcePlan(selected.plan)">{{
              row.sourceLine
            }}</el-button></template
          ></el-table-column
        ><el-table-column label="行状态" width="115"
          ><template #default="{ row }"
            ><el-tag :type="!row.qty || selected.status === '已转采购' ? 'success' : 'warning'">{{
              !row.qty ? "无需采购" : selected.status === "已转采购" ? "已转采购" : "待采购"
            }}</el-tag></template
          ></el-table-column
        ></el-table
      >
      <div class="pagination"><span>共 {{ selected.lines.length }} 条物料明细</span><el-pagination v-model:current-page="detailPage" :total="selected.lines.length" :page-size="20" layout="total, prev, pager, next" /></div>
      <div class="inline-note">
        已保存的数量为生成时计算结果，不随库存变化回写。审批、拆分及分行结束规则暂未配置。
      </div>
      <p v-if="order" class="code">关联采购单：{{ order.id }}</p></template
    ><template #footer
      ><el-button @click="detail = ''">关闭</el-button
      ><el-button
        v-if="selected?.status === '待采购'"
        type="primary"
        @click="converting = selected.id"
        >转采购单</el-button
      ></template
    ></el-drawer
  >
  <el-dialog
    :model-value="!!conversion"
    title="采购底稿转采购单"
    width="min(1080px, 94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    @close="converting = ''"
    ><template v-if="conversion"
      ><el-alert
        :title="`来源底稿：${conversion.id}，仅带入需购数量大于 0 的物料。`"
        type="info"
        :closable="false" /><DocumentEditor
        kind="purchase"
        :locked-lines="conversion.lines.filter((l) => l.qty > 0)"
        @save="save"
        @cancel="converting = ''" /></template
  ></el-dialog>
</template>
<style>
.draft-drawer {
  max-width: calc(100vw - 18px);
}
.draft-header {
  margin: 20px 0 4px;
}
</style>
