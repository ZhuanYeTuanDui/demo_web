<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Plus,
  Search,
  Tickets,
  ShoppingCart,
  Van,
  ArrowRight,
  DataAnalysis,
} from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import {
  analysis,
  createDraft,
  convertRequest,
  receive,
  validateLines,
  id,
  today,
  type Line,
  type Requisition,
  type Purchase,
} from "./model";
import DocumentEditor from "./DocumentEditor.vue";
const props = defineProps<{ page: string }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const keyword = ref("");
const status = ref("");
const currentPage = ref(1);
const initialPlan = sessionStorage.getItem("wsn-selected-plan");
const planId = ref(
  state.value.plans.some((p) => p.id === initialPlan)
    ? initialPlan!
    : state.value.plans[0]?.id || ""
);
const selectedPlan = computed(() => state.value.plans.find((p) => p.id === planId.value));
const analysisRows = computed(() =>
  selectedPlan.value ? analysis(state.value, selectedPlan.value) : []
);
const shortages = computed(() => analysisRows.value.filter((r) => r.shortage > 0));
const editing = ref(false);
const converting = ref("");
const receiving = ref("");
const receiveWarehouse = ref("BZ01");
const detail = ref("");
const convertingRequest = computed(() =>
  state.value.requests.find((r) => r.id === converting.value)
);
const allRows = computed(() =>
  props.page === "requests" ? state.value.requests : state.value.purchases
);
const filtered = computed(() =>
  allRows.value.filter(
    (r) =>
      `${r.id}${r.plan}${r.lines.map((l) => material(l.material).name).join("")}${"supplier" in r ? r.supplier : r.applicant}`.includes(
        keyword.value
      ) &&
      (!status.value || r.status === status.value)
  )
);
const paged = computed(() =>
  filtered.value.slice((currentPage.value - 1) * 10, currentPage.value * 10)
);
const selectedDoc = computed(() => allRows.value.find((r) => r.id === detail.value));
watch(
  () => props.page,
  () => {
    keyword.value = "";
    status.value = "";
    currentPage.value = 1;
    detail.value = "";
  }
);
watch([keyword, status], () => {
  currentPage.value = 1;
});
function amount(lines: Line[]) {
  return lines
    .reduce((n, l) => n + l.qty * material(l.material).price, 0)
    .toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function generate() {
  if (
    commit((s) => {
      createDraft(s, planId.value);
    }, "已保存采购底稿，保留本次 BOM 与库存计算结果")
  )
    emit("navigate", "drafts");
}
function save(data: { person: string; supplier: string; lines: Line[] }) {
  if (
    commit(
      (s) => {
        validateLines(s, data.lines);
        if (!data.person.trim()) throw new Error("请填写经办人");
        if (converting.value) {
          convertRequest(s, converting.value, data.person, data.supplier);
        } else if (props.page === "requests") {
          s.requests.unshift({
            id: id("PR"),
            plan: "",
            date: today(),
            applicant: data.person.trim(),
            lines: data.lines,
            status: "待采购",
          });
        } else {
          if (!data.supplier.trim()) throw new Error("供应商不能为空");
          s.purchases.unshift({
            id: id("PO"),
            request: "",
            plan: "",
            date: today(),
            buyer: data.person.trim(),
            supplier: data.supplier.trim(),
            lines: data.lines,
            status: "待入库",
          });
        }
      },
      converting.value ? "采购单已生成" : "单据已保存"
    )
  ) {
    const wasConverting = !!converting.value;
    editing.value = false;
    converting.value = "";
    if (wasConverting) emit("navigate", "orders");
  }
}
function confirmReceive() {
  if (
    commit(
      (s) => receive(s, receiving.value, receiveWarehouse.value),
      "采购收货成功，已更新库存并生成入库记录"
    )
  )
    receiving.value = "";
}
function viewDraft(draftId: string) {
  sessionStorage.setItem("wsn-selected-draft", draftId);
  emit("navigate", "drafts");
}
const steps = computed(() =>
  props.page === "requests"
    ? ["车间临时缺料", "纸质请购", "仓库录入请购", "采购下单", "收货入库"]
    : ["生产计划 / BOM", "需求分析", "采购底稿", "采购下单", "收货入库", "生产领料"]
);
</script>

<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">PROCUREMENT</div>
      <h1>
        {{ page === "analysis" ? "需求分析" : page === "requests" ? "请购单" : "采购单与采购记录" }}
      </h1>
      <p>
        {{
          page === "analysis"
            ? "根据生产计划、BOM 和可用库存生成采购底稿，与临时请购分开管理。"
            : page === "requests"
              ? "车间临时缺料后，由仓库根据纸质需求录入请购单，再交采购处理。"
              : "管理采购订单与收货进度，让每笔采购都有来源。"
        }}
      </p>
    </div>
    <el-button v-if="page !== 'analysis'" type="primary" :icon="Plus" @click="editing = true">{{
      page === "requests" ? "新增请购单" : "新增采购单"
    }}</el-button
    ><el-tag v-else effect="plain">按最新库存实时分析</el-tag>
  </div>
  <div class="workflow">
    <template v-for="(step, i) in steps" :key="step"
      ><span
        :class="{
          highlighted:
            (page === 'analysis' && i === 1) ||
            (page === 'requests' && i === 2) ||
            (page === 'orders' && [3, 4].includes(i)),
        }"
        ><b>{{ i + 1 }}</b
        >{{ step }}</span
      ><el-icon v-if="i < steps.length - 1"><ArrowRight /></el-icon
    ></template>
  </div>
  <template v-if="page === 'analysis'">
    <section class="panel analysis-selector">
      <div>
        <h2>选择生产计划</h2>
        <p class="muted">使用固定 BOM 展开物料，现场仓和成品仓默认不计入可用量。</p>
      </div>
      <el-select v-model="planId" placeholder="请选择生产计划" filterable
        ><el-option
          v-for="p in state.plans"
          :key="p.id"
          :label="`${p.name} / ${p.qty} 台 / ${p.status}`"
          :value="p.id"
      /></el-select>
    </section>
    <template v-if="selectedPlan"
      ><div class="analysis-banner">
        <div>
          <span class="eyebrow">MATERIAL REQUIREMENT</span>
          <h2>{{ selectedPlan.name }}</h2>
          <p>
            {{ material(selectedPlan.product).name }} <span class="divider">/</span> 计划
            {{ selectedPlan.qty }} 台 <span class="divider">/</span> {{ selectedPlan.date }}
          </p>
        </div>
        <div class="shortage-total">
          <strong>{{ shortages.length }}</strong
          ><span>种物料需纳入采购底稿</span>
        </div>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <h2>
            采购底稿预览 <span class="count-badge">{{ analysisRows.length }}</span>
          </h2>
          <span class="muted">需购 = BOM 需求 − 可分配库存 − 本计划待转底稿 / 在途</span>
        </div>
        <el-table :data="analysisRows" stripe
          ><el-table-column label="物料信息" min-width="220"
            ><template #default="{ row }"
              ><div class="cell-title">{{ material(row.material).name }}</div>
              <span class="cell-sub"
                >{{ row.material }} · {{ material(row.material).spec }}</span
              ></template
            ></el-table-column
          ><el-table-column
            prop="qty"
            label="BOM 需求量"
            min-width="105"
            align="right"
          /><el-table-column
            prop="stock"
            label="可用仓库存"
            min-width="115"
            align="right"
          /><el-table-column
            prop="reserved"
            label="其他计划占用"
            min-width="120"
            align="right"
          /><el-table-column
            prop="usable"
            label="可分配库存"
            min-width="115"
            align="right"
          /><el-table-column
            prop="pending"
            label="待转底稿 / 在途"
            min-width="115"
            align="right"
          /><el-table-column label="需购买数量" min-width="115" align="right"
            ><template #default="{ row }"
              ><strong :class="row.shortage ? 'shortage' : 'muted'">{{
                row.shortage
              }}</strong></template
            ></el-table-column
          ><el-table-column label="建议" min-width="105"
            ><template #default="{ row }"
              ><el-tag :type="row.shortage ? 'warning' : 'success'">{{
                row.shortage ? "需采购" : "已覆盖"
              }}</el-tag></template
            ></el-table-column
          ><el-table-column label="前置单据" min-width="175"
            ><template #default>{{ selectedPlan.id }}</template></el-table-column
          ></el-table
        >
        <div class="analysis-actions">
          <span v-if="['已领料', '已完工'].includes(selectedPlan.status)" class="muted"
            >该计划已领料，不再生成底稿。</span
          ><span v-else class="muted"
            >保存完整 BOM 展算行；需购数量扣除可分配库存及本计划待转底稿、在途采购。</span
          ><el-button
            type="primary"
            :icon="Plus"
            :disabled="!shortages.length || !['待分析', '待备料'].includes(selectedPlan.status)"
            @click="generate"
            >生成采购底稿</el-button
          ><el-button @click="emit('navigate', 'drafts')">查看底稿记录</el-button>
        </div>
      </section> </template
    ><el-empty v-else description="暂无生产计划，请先创建"
      ><el-button type="primary" @click="emit('navigate', 'plans')"
        >前往生产计划</el-button
      ></el-empty
    >
    <section class="panel pending-rules">
      <h2>其他需求规则</h2>
      <span class="muted">安全库存、损耗、替代料与审批规则暂未配置。</span>
    </section>
  </template>
  <template v-else>
    <div class="metric-grid">
      <div class="metric">
        <span>待采购请购单</span
        ><strong
          >{{ state.requests.filter((r) => r.status === "待采购").length }}<small>笔</small></strong
        ><el-icon><Tickets /></el-icon>
        <p>待核对并生成采购单</p>
      </div>
      <div class="metric">
        <span>待收货采购单</span
        ><strong
          >{{ state.purchases.filter((p) => p.status === "待入库").length
          }}<small>笔</small></strong
        ><el-icon><Van /></el-icon>
        <p>确认收货后更新库存</p>
      </div>
      <div class="metric">
        <span>采购记录</span><strong>{{ state.purchases.length }}<small>笔</small></strong
        ><el-icon><ShoppingCart /></el-icon>
        <p>含待入库和已入库订单</p>
      </div>
    </div>
    <section class="panel">
      <div class="filter-bar">
        <label
          >关键词<el-input
            v-model="keyword"
            :prefix-icon="Search"
            placeholder="单号、商品、计划或经办信息"
            clearable /></label
        ><label
          >单据状态<el-select v-model="status" placeholder="全部状态" clearable
            ><el-option
              v-for="s in page === 'requests' ? ['待采购', '已转采购'] : ['待入库', '已入库']"
              :key="s"
              :label="s"
              :value="s" /></el-select></label
        ><el-button
          v-if="page === 'orders'"
          :icon="DataAnalysis"
          @click="emit('navigate', 'analysis')"
          >从生产计划分析</el-button
        >
      </div>
      <div class="panel-heading">
        <h2>
          {{ page === "requests" ? "请购记录" : "采购记录" }}
          <span class="count-badge">{{ filtered.length }}</span>
        </h2>
        <span class="muted">点击单号查看商品明细与来源</span>
      </div>
      <el-table :data="paged" stripe empty-text="暂无匹配的单据"
        ><el-table-column label="单据信息" min-width="245"
          ><template #default="{ row }"
            ><el-button link type="primary" class="code" @click="detail = row.id">{{
              row.id
            }}</el-button>
            <div class="cell-sub">{{ row.date }}</div></template
          ></el-table-column
        ><el-table-column label="商品摘要" min-width="170"
          ><template #default="{ row }"
            ><div class="cell-title">{{ material(row.lines[0].material).name }}</div>
            <span class="cell-sub">共 {{ row.lines.length }} 种商品</span></template
          ></el-table-column
        ><el-table-column
          :label="page === 'requests' ? '请购人' : '采购人 / 供应商'"
          min-width="180"
          ><template #default="{ row }"
            ><div class="cell-title">{{ row.applicant || row.buyer }}</div>
            <span v-if="row.supplier" class="cell-sub">{{ row.supplier }}</span></template
          ></el-table-column
        ><el-table-column label="来源" min-width="160"
          ><template #default="{ row }"
            ><span :class="row.plan ? 'code' : 'muted'">{{
              row.draft ? `底稿：${row.draft}` : row.request ? `请购：${row.request}` : "手工录入"
            }}</span></template
          ></el-table-column
        ><el-table-column label="状态" width="110"
          ><template #default="{ row }"
            ><el-tag :type="['已转采购', '已入库'].includes(row.status) ? 'success' : 'warning'">{{
              row.status
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" width="140" fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-if="page === 'requests' && row.status === '待采购'"
              link
              type="primary"
              @click="converting = row.id"
              >生成采购单</el-button
            ><el-button
              v-else-if="page === 'orders' && row.status === '待入库'"
              link
              type="primary"
              @click="receiving = row.id"
              >确认收货</el-button
            ><el-button v-else link type="primary" @click="detail = row.id"
              >查看详情</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <div class="pagination">
        <span>共 {{ filtered.length }} 条记录</span
        ><el-pagination
          v-model:current-page="currentPage"
          :total="filtered.length"
          :page-size="10"
          layout="prev, pager, next"
        />
      </div>
    </section>
  </template>
  <el-dialog
    v-model="editing"
    :title="page === 'requests' ? '新增请购单' : '新增采购单'"
    width="700px"
    destroy-on-close
    :close-on-click-modal="false"
    ><DocumentEditor
      :kind="page === 'requests' ? 'request' : 'purchase'"
      @save="save"
      @cancel="editing = false"
  /></el-dialog>
  <el-dialog
    :model-value="!!convertingRequest"
    title="请购转采购"
    width="700px"
    destroy-on-close
    :close-on-click-modal="false"
    @close="converting = ''"
    ><template v-if="convertingRequest"
      ><el-alert
        :title="`来源请购单：${convertingRequest.id}`"
        type="info"
        :closable="false" /><DocumentEditor
        kind="purchase"
        :locked-lines="convertingRequest.lines"
        @save="save"
        @cancel="converting = ''" /></template
  ></el-dialog>
  <el-dialog :model-value="!!receiving" title="确认采购收货" width="480px" @close="receiving = ''"
    ><el-alert
      title="本次将整单收货，并自动生成入库记录。"
      type="info"
      show-icon
      :closable="false"
    />
    <p class="code">{{ receiving }}</p>
    <el-form label-position="top"
      ><el-form-item label="入库仓库" required
        ><el-select v-model="receiveWarehouse"
          ><el-option
            v-for="w in state.warehouses.filter((w) => w.available && !w.inactive)"
            :key="w.id"
            :label="w.name"
            :value="w.id" /></el-select></el-form-item></el-form
    ><template #footer
      ><el-button @click="receiving = ''">取消</el-button
      ><el-button type="primary" @click="confirmReceive">确认收货入库</el-button></template
    ></el-dialog
  >
  <el-drawer
    :model-value="!!selectedDoc"
    :title="page === 'requests' ? '请购单详情' : '采购单详情'"
    size="680px"
    @close="detail = ''"
    ><template v-if="selectedDoc"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="单据编号">{{ selectedDoc.id }}</el-descriptions-item
        ><el-descriptions-item label="日期">{{ selectedDoc.date }}</el-descriptions-item
        ><el-descriptions-item label="状态">{{ selectedDoc.status }}</el-descriptions-item
        ><el-descriptions-item label="来源计划">{{ selectedDoc.plan || "—" }}</el-descriptions-item
        ><el-descriptions-item v-if="'request' in selectedDoc" label="来源请购">{{
          (selectedDoc as Purchase).request || "—"
        }}</el-descriptions-item
        ><el-descriptions-item v-if="'draft' in selectedDoc" label="来源采购底稿"
          ><el-button
            v-if="(selectedDoc as Purchase).draft"
            link
            type="primary"
            @click="viewDraft((selectedDoc as Purchase).draft!)"
            >{{ (selectedDoc as Purchase).draft }}</el-button
          ><span v-else>—</span></el-descriptions-item
        ><el-descriptions-item label="经办人">{{
          "buyer" in selectedDoc
            ? (selectedDoc as Purchase).buyer
            : (selectedDoc as Requisition).applicant
        }}</el-descriptions-item
        ><el-descriptions-item v-if="'supplier' in selectedDoc" label="供应商">{{
          (selectedDoc as Purchase).supplier
        }}</el-descriptions-item></el-descriptions
      >
      <h3>商品明细</h3>
      <el-table :data="selectedDoc.lines"
        ><el-table-column label="商品" min-width="180"
          ><template #default="{ row }"
            ><div>{{ material(row.material).name }}</div>
            <span class="cell-sub">{{ material(row.material).spec }}</span></template
          ></el-table-column
        ><el-table-column prop="qty" label="数量" width="80" /><el-table-column
          label="单位"
          width="70"
          ><template #default="{ row }">{{
            material(row.material).unit
          }}</template></el-table-column
        ><el-table-column label="参考单价" width="110"
          ><template #default="{ row }"
            >¥{{ material(row.material).price }}</template
          ></el-table-column
        ></el-table
      >
      <p class="amount">参考金额：¥{{ amount(selectedDoc.lines) }}</p>
      <p class="muted">单价为演示参考值；税额、结算和审核规则暂未配置。</p></template
    ></el-drawer
  >
</template>
