<script setup lang="ts">
import DataLink from "./DataLink.vue";
import ElDialog from "./CachedDialog.vue";
import ElDrawer from "./CachedDrawer.vue";
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { state, material, commit } from "./store";
import {
  purchaseAmount,
  purchaseLineAmount,
  purchaseDifferences,
  auditPurchase,
  unauditPurchase,
  mergePurchases,
  type Purchase,
  type PurchaseLine,
} from "./model";
import FaManagementList from "./FaManagementList.vue";
import FaTableActions from "./FaTableActions.vue";
import PurchaseEditor from "./PurchaseEditor.vue";
const PurchasePrint = defineAsyncComponent(() => import("./PurchasePrint.vue"));
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref(""),
  status = ref(""),
  receiptStatus = ref(""),
  page = ref(1),
  pageSize = ref(50);
const auditing = ref(false);
const editing = ref(false),
  editId = ref(""),
  detail = ref(""),
  selectedIds = ref<string[]>([]),
  printOrder = ref<Purchase>();
const filtered = computed(() =>
  state.value.purchases.filter(
    (p) =>
      !p.mergedInto &&
      `${p.id}${p.supplier}${p.buyer}${p.lines.map((l) => material(l.material)?.name).join("")}`.includes(
        keyword.value
      ) &&
      (!status.value || p.status === status.value) &&
      (!receiptStatus.value || p.receiptStatus === receiptStatus.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
const selected = computed(() => state.value.purchases.find((p) => p.id === detail.value));
const editOrder = computed(() => state.value.purchases.find((p) => p.id === editId.value));
watch([keyword, status, receiptStatus, pageSize], () => (page.value = 1));
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.min(page.value, Math.max(1, Math.ceil(n / pageSize.value))))
);
const money = (amount: number | null) => (amount === null ? "未填完整" : amount.toFixed(2));
function edit(order?: Purchase) {
  editId.value = order?.id || "";
  editing.value = true;
}
function source(line: PurchaseLine) {
  if (line.draft) {
    sessionStorage.setItem("wsn-selected-draft", line.draft);
    emit("navigate", "drafts");
  } else if (line.request) {
    sessionStorage.setItem("wsn-selected-request", line.request);
    emit("navigate", "requests");
  }
}
async function audit(order: Purchase) {
  if (auditing.value) return;
  auditing.value = true;
  try {
    const differences = purchaseDifferences(state.value, order.id);
    const snapshot = JSON.stringify({ order, differences });
    if (differences.length) {
      const message = differences
        .map(
          (line) =>
            `${material(line.material)?.name || line.material}（${line.material}），来源 ${line.source}：要求 ${line.required}，本次采购 ${line.qty}`
        )
        .join("\n");
      try {
        await ElMessageBox.confirm(
          `以下物料采购数量与来源要求不一致：\n${message}\n确认后仍可审核，不改变来源要求数量。`,
          "采购数量差异确认",
          { type: "warning", confirmButtonText: "确认差异并审核", cancelButtonText: "返回检查" }
        );
      } catch {
        return;
      }
    }
    commit((s) => {
      const current = s.purchases.find((item) => item.id === order.id);
      const currentDifferences = purchaseDifferences(s, order.id);
      if (JSON.stringify({ order: current, differences: currentDifferences }) !== snapshot)
        throw new Error("采购单或来源数量已变化，请重新核对并审核");
      auditPurchase(s, order.id, differences.length > 0);
    }, "采购单已审核");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "无法核对采购来源，请检查后重试");
  } finally {
    auditing.value = false;
  }
}
async function merge() {
  try {
    await ElMessageBox.confirm(
      "将选中的同供应商未审核采购单合并，原单不再参与收货。是否继续？",
      "合并采购单",
      { type: "warning", confirmButtonText: "确认合并", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  if (
    commit((s) => {
      mergePurchases(s, selectedIds.value);
    }, "采购单已合并")
  )
    selectedIds.value = [];
}
function actions(row: Purchase) {
  return [
    { label: "详情", action: () => (detail.value = row.id) },
    ...(row.status === "未审核"
      ? [
          { label: "编辑 / 添加", action: () => edit(row) },
          { label: "审核", disabled: auditing.value, action: () => audit(row) },
        ]
      : [
          {
            label: "反审核",
            disabled: state.value.receipts.some(
              (receipt) => receipt.purchase === row.id && receipt.auditStatus === "已审核"
            ),
            action: () => commit((s) => unauditPurchase(s, row.id), "采购单已反审核"),
          },
        ]),
    { label: "打印预览", action: () => (printOrder.value = row) },
  ];
}
</script>
<template>
  <FaManagementList
    filterable
    @search="page = 1"
    @reset="
      keyword = '';
      status = '';
      receiptStatus = '';
      page = 1;
    "
  >
    <template #filters
      ><el-form-item label="关键词"
        ><el-input
          v-model="keyword"
          clearable
          placeholder="单号、供应商、采购人或物料" /></el-form-item
      ><el-form-item label="审核状态"
        ><el-select v-model="status" clearable placeholder="全部"
          ><el-option
            v-for="s in ['未审核', '已审核']"
            :key="s"
            :label="s"
            :value="s" /></el-select></el-form-item
      ><el-form-item label="收货进度"
        ><el-select v-model="receiptStatus" clearable placeholder="全部"
          ><el-option
            v-for="s in ['未收货', '部分收货', '全部收货']"
            :key="s"
            :label="s"
            :value="s" /></el-select></el-form-item
    ></template>
    <template #toolbar
      ><el-button type="primary" @click="edit()">新增采购单</el-button
      ><el-button :disabled="selectedIds.length < 2" @click="merge"
        >合并所选（{{ selectedIds.length }}）</el-button
      ></template
    >
    <el-table
      :data="paged"
      row-key="id"
      stripe
      empty-text="暂无匹配采购单"
      @selection-change="(rows: Purchase[]) => (selectedIds = rows.map((r) => r.id))"
      ><el-table-column
        type="selection"
        width="48"
        :reserve-selection="true"
        :selectable="(row: Purchase) => row.status === '未审核'" /><el-table-column
        label="采购单号 / 日期"
        min-width="230"
        ><template #default="{ row }"
          ><DataLink @click="detail = row.id">{{ row.id }}</DataLink>
          <div class="cell-sub">{{ row.date }}</div></template
        ></el-table-column
      ><el-table-column label="供应商 / 采购人" min-width="200"
        ><template #default="{ row }"
          >{{ row.supplier }}
          <div class="cell-sub">{{ row.buyer }}</div></template
        ></el-table-column
      ><el-table-column label="物料摘要" min-width="190"
        ><template #default="{ row }"
          >{{ material(row.lines[0]?.material)?.name }}
          <div class="cell-sub">共 {{ row.lines.length }} 条明细</div></template
        ></el-table-column
      ><el-table-column label="明细合计（元）" width="130" align="right"
        ><template #default="{ row }">{{
          money(purchaseAmount(row.lines))
        }}</template></el-table-column
      ><el-table-column prop="status" label="审核状态" width="100" /><el-table-column
        label="收货进度"
        width="110"
        ><template #default="{ row }"
          ><el-tag :type="row.receiptStatus === '全部收货' ? 'success' : 'info'">{{
            row.receiptStatus === "全部收货" ? "已完成" : row.receiptStatus
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="操作" width="230" fixed="right"
        ><template #default="{ row }"
          ><FaTableActions :actions="actions(row)" /></template></el-table-column
    ></el-table>
    <div class="pagination">
      <span>共 {{ filtered.length }} 条</span
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filtered.length"
        layout="sizes, prev, pager, next"
      />
    </div>
  </FaManagementList>
  <el-dialog
    v-model="editing"
    :title="editOrder ? '编辑采购单 / 添加物料' : '新增采购单'"
    width="min(1080px,94vw)"
    destroy-on-close
    :close-on-click-modal="false"
    ><PurchaseEditor :order="editOrder" @cancel="editing = false" @saved="editing = false"
  /></el-dialog>
  <el-drawer
    :model-value="!!selected"
    title="采购单详情"
    size="min(1000px,95vw)"
    @close="detail = ''"
  >
    <template v-if="selected"
      ><el-descriptions :column="2" border
        ><el-descriptions-item label="采购单号">{{ selected.id }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selected.date }}</el-descriptions-item
        ><el-descriptions-item label="供应商">{{ selected.supplier }}</el-descriptions-item
        ><el-descriptions-item label="采购人">{{ selected.buyer }}</el-descriptions-item
        ><el-descriptions-item label="审核状态">{{ selected.status }}</el-descriptions-item
        ><el-descriptions-item label="收货进度">{{ selected.receiptStatus }}</el-descriptions-item
        ><el-descriptions-item label="明细合计（元）">{{
          money(purchaseAmount(selected.lines))
        }}</el-descriptions-item></el-descriptions
      >
      <p v-if="selected.legacyAmount != null" class="muted">
        旧版单头历史金额：{{ selected.legacyAmount.toFixed(2) }}
        元；未分摊到物料，不计入当前明细合计。
      </p>
      <el-table :data="selected.lines" max-height="460">
        <el-table-column prop="material" label="品号" min-width="150" />
        <el-table-column label="品名" min-width="170"
          ><template #default="{ row }"
            ><DataLink
              :href="`#materials/${row.material}`"
              @click="emit('navigate', `materials/${row.material}`)"
              >{{ material(row.material)?.name || row.material }}</DataLink
            ></template
          ></el-table-column
        >
        <el-table-column label="规格 / 图号" min-width="200"
          ><template #default="{ row }"
            >{{ material(row.material)?.spec || "—" }}
            <div class="cell-sub">
              {{ material(row.material)?.details?.drawingNo || "—" }}
            </div></template
          ></el-table-column
        >
        <el-table-column label="来源单号" min-width="210"
          ><template #default="{ row }"
            ><DataLink v-if="row.draft || row.request" @click="source(row)">{{
              row.draft || row.request
            }}</DataLink
            ><span v-else>手工录入</span>
            <div v-if="row.draftLine || row.requestLine" class="cell-sub">
              来源行：{{ row.draftLine || row.requestLine }}
            </div></template
          ></el-table-column
        >
        <el-table-column label="品牌 / 材质" min-width="150"
          ><template #default="{ row }"
            >{{ material(row.material)?.details?.brand || "—" }} /
            {{ material(row.material)?.details?.texture || "—" }}</template
          ></el-table-column
        >
        <el-table-column prop="qty" label="数量" width="90" align="right" />
        <el-table-column label="单位" width="80"
          ><template #default="{ row }">{{
            material(row.material)?.unit || "—"
          }}</template></el-table-column
        >
        <el-table-column label="含税单价（元）" width="140" align="right"
          ><template #default="{ row }">{{
            row.unitPrice == null ? "未填写" : row.unitPrice.toFixed(2)
          }}</template></el-table-column
        >
        <el-table-column label="价税合计（元）" width="150" align="right"
          ><template #default="{ row }">{{
            purchaseLineAmount(row) == null ? "未填写" : purchaseLineAmount(row)!.toFixed(2)
          }}</template></el-table-column
        >
        <el-table-column prop="dueDate" label="交期" width="125"
          ><template #default="{ row }">{{ row.dueDate || "—" }}</template></el-table-column
        >
        <el-table-column prop="remark" label="备注" min-width="180"
          ><template #default="{ row }">{{ row.remark || "—" }}</template></el-table-column
        >
        <el-table-column prop="received" label="已收数量" width="100" align="right" />
      </el-table>
      <div class="analysis-action-buttons">
        <el-button v-if="selected.status === '未审核'" @click="edit(selected)"
          >编辑 / 添加物料</el-button
        ><el-button @click="printOrder = selected">打印预览</el-button>
      </div></template
    > </el-drawer
  ><PurchasePrint v-if="printOrder" :order="printOrder" @close="printOrder = undefined" />
</template>
