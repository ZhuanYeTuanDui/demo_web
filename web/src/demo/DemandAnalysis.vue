<script setup lang="ts">
import ElDialog from "./CachedDialog.vue";
import { computed } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { state, material, commit } from "./store";
import { analysis, createDraft } from "./model";

const props = defineProps<{ planId: string }>();
const emit = defineEmits<{ close: []; navigate: [page: string] }>();
const selectedPlan = computed(() => state.value.plans.find((plan) => plan.id === props.planId));
const analysisRows = computed(() =>
  selectedPlan.value ? analysis(state.value, selectedPlan.value) : []
);
const shortages = computed(() => analysisRows.value.filter((row) => row.shortage > 0));
function generate() {
  if (
    commit((draft) => {
      createDraft(draft, props.planId);
    }, "已按缺料物料生成采购底稿")
  )
    emit("navigate", "drafts");
}
</script>

<template>
  <el-dialog
    :model-value="true"
    title="需求分析 · 分析缺料"
    width="min(1280px, 96vw)"
    top="5vh"
    :close-on-click-modal="false"
    @close="emit('close')"
  >
    <div v-if="selectedPlan" class="demand-plan">
      <strong>{{ selectedPlan.name }}</strong>
      <span class="muted"
        >{{ selectedPlan.id }} · {{ selectedPlan.qty }} 台 · {{ selectedPlan.status }}</span
      >
    </div>
    <template v-if="selectedPlan">
      <section class="panel">
        <div class="panel-heading">
          <h2>
            物料需求分析 <span class="count-badge">{{ analysisRows.length }}</span>
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
          ><span v-else class="muted">仅为缺料生成一物料一底稿；库存充足的行不进入采购底稿。</span>
          <div class="analysis-action-buttons">
            <el-button
              type="primary"
              :icon="Plus"
              :disabled="!shortages.length || !['待分析', '待备料'].includes(selectedPlan.status)"
              @click="generate"
              >生成采购底稿</el-button
            ><el-button @click="emit('navigate', 'drafts')">查看底稿记录</el-button>
          </div>
        </div>
      </section> </template
    ><el-empty v-else description="暂无生产计划，请先创建"
      ><el-button type="primary" @click="emit('navigate', 'plans')"
        >前往生产计划</el-button
      ></el-empty
    >
  </el-dialog>
</template>

<style scoped>
.demand-plan {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
.panel {
  border: 0;
  margin: 0;
}
</style>
