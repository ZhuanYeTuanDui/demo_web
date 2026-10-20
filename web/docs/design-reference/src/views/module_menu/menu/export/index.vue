<template>
  <!-- 导出页按版本跨页多选，使用卡片而非标准 CRUD 表格。 -->
  <div class="domain-page catalog-export-page">
    <section class="filter-panel g-card" aria-label="筛选菜谱版本">
      <div class="filter-panel__heading">
        <strong>筛选条件</strong>
        <ElButton
          text
          :icon="filterExpanded ? ArrowUp : ArrowDown"
          :aria-expanded="filterExpanded"
          aria-controls="catalog-export-filters"
          @click="filterExpanded = !filterExpanded"
          >{{ filterExpanded ? "收起筛选" : "展开筛选" }}</ElButton
        >
      </div>
      <div id="catalog-export-filters" v-show="filterExpanded" class="filter-panel__body">
        <ElForm inline @submit.prevent="submitSearch">
          <ElFormItem label="菜谱名称">
            <ElInput
              v-model="filters.name"
              placeholder="输入菜谱名称"
              clearable
              @keyup.enter="submitSearch"
              @clear="submitSearch"
            />
          </ElFormItem>
          <ElFormItem label="作者">
            <ElInput
              v-model="filters.author"
              placeholder="输入作者姓名"
              clearable
              @keyup.enter="submitSearch"
              @clear="submitSearch"
            />
          </ElFormItem>
          <ElFormItem label="菜品分类">
            <ElSelect
              v-model="filters.categoryId"
              clearable
              placeholder="全部分类"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in categoryOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="菜系">
            <ElSelect
              v-model="filters.cuisineId"
              clearable
              placeholder="全部菜系"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in cuisineOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="可访问 VIP 等级">
            <ElSelect
              v-model="filters.vipLevelId"
              clearable
              placeholder="全部等级"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in vipOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="版本状态">
            <ElSelect v-model="filters.status" aria-label="版本状态" @change="submitSearch">
              <ElOption label="全部状态" value="all" />
              <ElOption label="已发布" value="published" />
              <ElOption label="草稿" value="draft" />
              <ElOption label="已下架" value="offline" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem class="filter-panel__actions">
            <ElButton type="primary" :icon="Search" :loading="loading" @click="submitSearch"
              >查询</ElButton
            >
            <ElButton :icon="RefreshLeft" :disabled="loading" @click="resetSearch">重置</ElButton>
          </ElFormItem>
        </ElForm>
        <p class="filter-panel__hint">VIP 筛选包含所选等级及以下可访问的菜谱。</p>
      </div>
      <ElAlert
        v-if="optionsError"
        :title="optionsError"
        type="warning"
        :closable="false"
        show-icon
        class="filter-panel__error"
      />
    </section>

    <section class="results-panel g-card" aria-label="可导出的菜谱版本">
      <div class="results-panel__heading">
        <div>
          <h2>菜谱版本</h2>
          <span>共 {{ total }} 个版本 · 每张卡片代表一个独立版本</span>
        </div>
        <div class="results-panel__tools">
          <ElButton :disabled="loading || !hasUnselectedCurrentPage" @click="selectCurrentPage"
            >全选此页</ElButton
          >
          <ElButton
            :loading="selectingFiltered"
            :disabled="loading || !hasActiveFilters || !total || selectingFiltered"
            @click="selectAllFiltered"
            >全选筛选结果</ElButton
          >
          <ElButton :icon="List" @click="selectedOpen = true"
            >已选 {{ selectedItems.length }}</ElButton
          >
          <ElButton
            type="primary"
            :icon="Download"
            :disabled="!selectedItems.length"
            @click="openExport('selected')"
            >导出所选版本</ElButton
          >
          <ElButton :icon="Download" @click="openExport('all')">导出所有</ElButton>
          <ElButton
            :icon="Refresh"
            circle
            aria-label="刷新版本列表"
            :disabled="loading"
            @click="loadVersions"
          />
        </div>
      </div>
      <ElAlert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
        class="results-panel__error"
      >
        <template #default
          ><ElButton link type="primary" @click="loadVersions">重新加载</ElButton></template
        >
      </ElAlert>
      <div v-loading="loading" class="results-panel__body" aria-live="polite">
        <div v-if="versions.length" class="version-grid">
          <button
            v-for="item in versions"
            :key="item.id"
            type="button"
            class="version-card"
            :class="{ 'is-selected': isSelected(item.id) }"
            :aria-pressed="isSelected(item.id)"
            :aria-label="`${isSelected(item.id) ? '取消选择' : '选择'} ${item.name} 第 ${item.revision_no} 版`"
            @click="toggle(item)"
          >
            <span class="version-card__image">
              <ElImage v-if="item.cover_url" :src="item.cover_url" fit="cover" loading="lazy">
                <template #error><span class="version-card__placeholder">暂无图片</span></template>
              </ElImage>
              <span v-else class="version-card__placeholder">暂无图片</span>
              <span class="version-card__check" aria-hidden="true"
                ><ElIcon v-if="isSelected(item.id)"><Check /></ElIcon
              ></span>
            </span>
            <span class="version-card__content">
              <span class="version-card__topline">
                <span class="version-card__number">版本 #{{ item.revision_no }}</span>
                <ElTag :type="statusType(item.revision_status)" size="small">{{
                  statusLabel(item.revision_status)
                }}</ElTag>
              </span>
              <strong class="version-card__name" :title="item.name">{{ item.name }}</strong>
              <span class="version-card__meta"
                >{{ item.author || "未知作者" }} · {{ item.step_count }} 步</span
              >
              <span class="version-card__category"
                >{{ item.category_name
                }}<template v-if="item.cuisine_name"> / {{ item.cuisine_name }}</template> ·
                {{ item.vip_level_name }}</span
              >
            </span>
          </button>
        </div>
        <ElEmpty v-else-if="!loading && !loadError" description="没有匹配的菜谱版本" />
      </div>
      <div class="results-panel__footer">
        <span v-if="selectedItems.length">已跨页选中 {{ selectedItems.length }} 个版本</span>
        <span v-else>点击卡片选择版本</span>
        <ElPagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[8, 12, 20]"
          layout="total, sizes, prev, pager, next"
          background
          :disabled="loading"
          @current-change="loadVersions"
          @size-change="onPageSizeChange"
        />
      </div>
    </section>

    <ElDrawer
      v-model="selectedOpen"
      :title="`已选版本（${selectedItems.length}）`"
      size="min(440px, 100vw)"
      class="catalog-selection-drawer"
    >
      <div v-if="selectedItems.length" class="selected-list">
        <div v-for="item in selectedItems" :key="item.id" class="selected-item">
          <div>
            <strong>{{ item.name }}</strong>
            <span>版本 #{{ item.revision_no }} · {{ item.author || "未知作者" }}</span>
          </div>
          <ElButton
            :icon="Close"
            text
            :aria-label="`移除 ${item.name} 第 ${item.revision_no} 版`"
            @click="toggle(item)"
          />
        </div>
      </div>
      <ElEmpty v-else description="还没有选择版本" />
      <template #footer>
        <div class="drawer-footer">
          <ElButton :disabled="!selectedItems.length" @click="selected = {}">清空选择</ElButton>
          <ElButton
            type="primary"
            :icon="Download"
            :disabled="!selectedItems.length"
            @click="openExport('selected')"
          >
            导出 {{ selectedItems.length }} 个版本
          </ElButton>
        </div>
      </template>
    </ElDrawer>

    <section class="history-panel g-card" aria-label="菜谱导出记录">
      <div class="history-panel__heading">
        <div>
          <h2>导出记录</h2>
          <span>文件生成后可在 7 天内重复下载</span>
        </div>
        <ElButton :icon="Refresh" :loading="recordsLoading" @click="loadRecords">刷新记录</ElButton>
      </div>
      <ElAlert
        v-if="recordsError"
        :title="recordsError"
        type="error"
        :closable="false"
        class="history-panel__error"
      />
      <div v-if="records.length" class="export-record-list">
        <div v-for="record in records" :key="record.id" class="export-record">
          <div class="export-record__main">
            <strong :title="record.name">{{ record.name }}</strong>
            <span
              >{{ record.scope === "all" ? "全部版本" : "所选版本" }} · 导出人
              {{ record.created_name }} · {{ formatTime(record.created_time) }}</span
            >
            <span
              >总计 {{ record.total_count }} · 成功 {{ record.exported_count }} · 跳过
              {{ record.skipped_count }}
              <template v-if="record.expires_time">
                · 到期 {{ formatTime(record.expires_time) }}</template
              >
            </span>
            <span v-if="record.status === 'failed'" class="export-record__error">{{
              record.error_message || "生成失败，请重新提交"
            }}</span>
          </div>
          <div class="export-record__status">
            <ElTag :type="recordStatusType(record.status)">{{
              recordStatusText(record.status)
            }}</ElTag>
            <ElProgress
              v-if="isRecordRunning(record)"
              :percentage="record.progress"
              :stroke-width="6"
            />
          </div>
          <ElButton
            v-if="record.status === 'ready'"
            type="primary"
            link
            :loading="downloadingId === record.id"
            @click="downloadRecord(record)"
            >下载</ElButton
          >
          <ElButton v-else-if="isRecordRunning(record)" link @click="showRecord(record)"
            >查看进度</ElButton
          >
        </div>
      </div>
      <ElEmpty v-else-if="!recordsLoading && !recordsError" description="暂无导出记录" />
      <ElPagination
        v-if="recordsTotal > recordsPageSize"
        v-model:current-page="recordsPage"
        :page-size="recordsPageSize"
        :total="recordsTotal"
        layout="total, prev, pager, next"
        background
        class="history-panel__pagination"
        @current-change="loadRecords"
      />
    </section>

    <ElDialog
      v-model="exportDialogOpen"
      :title="activeRecord ? '导出进度' : '创建菜谱导出'"
      width="min(480px, 94vw)"
      destroy-on-close
    >
      <template v-if="!activeRecord">
        <ElForm label-position="top" @submit.prevent="createExport">
          <ElFormItem label="导出名称" required>
            <ElInput
              v-model="exportName"
              maxlength="100"
              show-word-limit
              placeholder="请输入导出名称"
            />
          </ElFormItem>
        </ElForm>
        <p class="export-dialog__hint">
          {{
            exportScope === "all"
              ? "将导出全部官方菜谱版本"
              : `将导出已选的 ${selectedItems.length} 个版本`
          }}，完成后文件保留 7 天。
        </p>
        <ElAlert v-if="createError" :title="createError" type="error" :closable="false" />
      </template>
      <div v-else class="export-dialog__progress" aria-live="polite">
        <strong>{{ activeRecord.name }}</strong>
        <div v-if="isRecordRunning(activeRecord)" class="export-dialog__working">
          <ElIcon class="is-loading"><Loading /></ElIcon>
          <span
            >{{ recordStageText(activeRecord.stage) }} · {{ activeRecord.processed_count }}/{{
              activeRecord.total_count
            }}</span
          >
        </div>
        <ElProgress
          :percentage="activeRecord.progress"
          :status="activeRecord.status === 'ready' ? 'success' : undefined"
        />
        <p v-if="activeRecord.status === 'ready'">
          已导出 {{ activeRecord.exported_count }} 个，跳过
          {{ activeRecord.skipped_count }} 个；可在
          {{ formatTime(activeRecord.expires_time) }} 前重复下载。
        </p>
        <ElAlert
          v-if="activeRecord.status === 'failed'"
          :title="activeRecord.error_message || '导出失败，请重新提交'"
          type="error"
          :closable="false"
        />
        <ElAlert
          v-if="activeRecord.status === 'expired'"
          title="文件已过期，请重新导出"
          type="warning"
          :closable="false"
        />
      </div>
      <template #footer>
        <ElButton @click="exportDialogOpen = false">{{ activeRecord ? "关闭" : "取消" }}</ElButton>
        <ElButton
          v-if="!activeRecord"
          type="primary"
          :loading="creatingExport"
          @click="createExport"
          >开始导出</ElButton
        >
        <ElButton
          v-else-if="activeRecord.status === 'ready'"
          type="primary"
          :loading="downloadingId === activeRecord.id"
          @click="downloadRecord(activeRecord)"
          >下载文件</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Close,
  Download,
  List,
  Loading,
  Refresh,
  RefreshLeft,
  Search,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import download from "@/utils/download";
import { getVipLevelOptions, type VipLevelOption } from "@/api/business/customer";
import {
  createCatalogExportRecord,
  downloadCatalogExportRecord,
  getDictionary,
  getCatalogExportRecord,
  listCatalogExportRecords,
  listCatalogVersions,
  type CatalogExportRecord,
  type CatalogVersionFilters,
  type CatalogVersionItem,
} from "@/api/business/recipeEditor";

const page = ref(1);
const pageSize = ref(8);
const total = ref(0);
const versions = ref<CatalogVersionItem[]>([]);
const selected = ref<Record<number, CatalogVersionItem>>({});
const selectedItems = computed(() => Object.values(selected.value));
const hasUnselectedCurrentPage = computed(() =>
  versions.value.some((item) => !isSelected(item.id))
);
const appliedFilters = ref<CatalogVersionFilters>({});
const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== undefined)
);
const selectedOpen = ref(false);
const filterExpanded = ref(true);
const loading = ref(false);
const selectingFiltered = ref(false);
const loadError = ref("");
const optionsError = ref("");
const exportDialogOpen = ref(false);
const exportScope = ref<"selected" | "all">("selected");
const exportName = ref("");
const createError = ref("");
const creatingExport = ref(false);
const activeRecord = ref<CatalogExportRecord | null>(null);
const records = ref<CatalogExportRecord[]>([]);
const recordsPage = ref(1);
const recordsPageSize = 10;
const recordsTotal = ref(0);
const recordsLoading = ref(false);
const recordsError = ref("");
const downloadingId = ref<number | null>(null);
const categoryOptions = ref<{ id: number; name: string }[]>([]);
const cuisineOptions = ref<{ id: number; name: string }[]>([]);
const vipOptions = ref<VipLevelOption[]>([]);
const filters = reactive({
  name: "",
  author: "",
  status: "all",
  categoryId: null as number | null,
  cuisineId: null as number | null,
  vipLevelId: null as number | null,
});
let requestId = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

const statusLabel = (status: number) =>
  ({ 0: "草稿", 1: "已发布", 2: "已下架" })[status] || "未知状态";
const statusType = (status: number): "success" | "warning" | "info" =>
  status === 1 ? "success" : status === 0 ? "warning" : "info";
const isSelected = (revisionId: number) => Boolean(selected.value[revisionId]);

function toggle(item: CatalogVersionItem) {
  const next = { ...selected.value };
  if (next[item.id]) delete next[item.id];
  else next[item.id] = item;
  selected.value = next;
}

// 只补选当前页，保留其他页的选择。
function selectCurrentPage() {
  const unselected = versions.value.filter((item) => !isSelected(item.id));
  selected.value = Object.fromEntries([
    ...Object.entries(selected.value),
    ...unselected.map((item) => [item.id, item] as const),
  ]);
}

// 使用已执行的筛选条件查询全部结果，避免输入框尚未提交时误选其他版本。
async function selectAllFiltered() {
  if (!hasActiveFilters.value || selectingFiltered.value || loading.value || !total.value) return;
  const current = requestId;
  const expectedTotal = total.value;
  const selectedFilters = { ...appliedFilters.value };
  selectingFiltered.value = true;
  try {
    const matching: CatalogVersionItem[] = [];
    for (let batch = 1; batch <= Math.ceil(expectedTotal / 100); batch++) {
      const result = await listCatalogVersions(batch, 100, selectedFilters);
      if (current !== requestId) return;
      if (result.total !== expectedTotal) {
        ElMessage.warning("筛选结果发生变化，请重新查询后再全选");
        return;
      }
      matching.push(...result.items);
    }
    if (
      matching.length !== expectedTotal ||
      new Set(matching.map((item) => item.id)).size !== expectedTotal
    ) {
      ElMessage.warning("筛选结果发生变化，请重新查询后再全选");
      return;
    }
    selected.value = Object.fromEntries([
      ...Object.entries(selected.value),
      ...matching.map((item) => [item.id, item] as const),
    ]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "筛选结果加载失败，请重试");
  } finally {
    selectingFiltered.value = false;
  }
}

function getFilters(): CatalogVersionFilters {
  return {
    name: filters.name.trim() || undefined,
    author: filters.author.trim() || undefined,
    revision_status:
      filters.status === "all" ? undefined : { published: 1, draft: 0, offline: 2 }[filters.status],
    category_id: typeof filters.categoryId === "number" ? filters.categoryId : undefined,
    cuisine_id: typeof filters.cuisineId === "number" ? filters.cuisineId : undefined,
    accessible_vip_level_id:
      typeof filters.vipLevelId === "number" ? filters.vipLevelId : undefined,
  };
}

async function loadVersions() {
  const current = ++requestId;
  loading.value = true;
  loadError.value = "";
  try {
    const result = await listCatalogVersions(page.value, pageSize.value, appliedFilters.value);
    if (current !== requestId) return;
    versions.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current === requestId) {
      versions.value = [];
      total.value = 0;
      loadError.value = error instanceof Error ? error.message : "菜谱版本加载失败";
    }
  } finally {
    if (current === requestId) loading.value = false;
  }
}

function submitSearch() {
  appliedFilters.value = getFilters();
  page.value = 1;
  void loadVersions();
}

function resetSearch() {
  filters.name = "";
  filters.author = "";
  filters.status = "all";
  filters.categoryId = null;
  filters.cuisineId = null;
  filters.vipLevelId = null;
  submitSearch();
}

function onPageSizeChange() {
  page.value = 1;
  void loadVersions();
}

const isRecordRunning = (record: CatalogExportRecord) =>
  record.status === "queued" || record.status === "running";
const recordStatusText = (status: CatalogExportRecord["status"]) =>
  ({ queued: "排队中", running: "生成中", ready: "可下载", failed: "失败", expired: "已过期" })[
    status
  ];
const recordStatusType = (
  status: CatalogExportRecord["status"]
): "success" | "warning" | "info" | "danger" =>
  ({ queued: "info", running: "warning", ready: "success", failed: "danger", expired: "info" })[
    status
  ] as "success" | "warning" | "info" | "danger";
const recordStageText = (stage: string) =>
  ({
    queued: "等待开始",
    generating: "正在生成菜谱",
    merging: "正在合并菜谱",
    uploading: "正在上传文件",
  })[stage] || "正在处理";
const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";

function openExport(scope: "selected" | "all") {
  if (scope === "selected" && !selectedItems.value.length) return;
  exportScope.value = scope;
  exportName.value = "";
  createError.value = "";
  activeRecord.value = null;
  selectedOpen.value = false;
  exportDialogOpen.value = true;
}

async function createExport() {
  if (creatingExport.value || activeRecord.value) return;
  const name = exportName.value.trim();
  if (!name) {
    createError.value = "请输入导出名称";
    return;
  }
  creatingExport.value = true;
  createError.value = "";
  try {
    const record = await createCatalogExportRecord({
      name,
      scope: exportScope.value,
      revision_ids:
        exportScope.value === "selected" ? selectedItems.value.map((item) => item.id) : undefined,
    });
    activeRecord.value = record;
    recordsPage.value = 1;
    await loadRecords();
    startPolling();
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "创建导出任务失败";
  } finally {
    creatingExport.value = false;
  }
}

async function loadRecords() {
  if (!records.value.length) recordsLoading.value = true;
  recordsError.value = "";
  try {
    const result = await listCatalogExportRecords(recordsPage.value, recordsPageSize);
    records.value = result.items;
    recordsTotal.value = result.total;
    if (activeRecord.value) {
      const current = result.items.find((item) => item.id === activeRecord.value?.id);
      if (current) activeRecord.value = current;
    }
    if (result.items.some(isRecordRunning)) startPolling();
  } catch (error) {
    recordsError.value = error instanceof Error ? error.message : "导出记录加载失败";
  } finally {
    recordsLoading.value = false;
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => void pollRecords(), 2000);
}

async function pollRecords() {
  if (polling) return;
  polling = true;
  try {
    await loadRecords();
    if (activeRecord.value && isRecordRunning(activeRecord.value)) {
      activeRecord.value = await getCatalogExportRecord(activeRecord.value.id);
    }
    if (
      !records.value.some(isRecordRunning) &&
      (!activeRecord.value || !isRecordRunning(activeRecord.value))
    ) {
      clearInterval(pollTimer!);
      pollTimer = null;
    }
  } catch (error) {
    recordsError.value = error instanceof Error ? error.message : "导出进度更新失败";
  } finally {
    polling = false;
  }
}

function showRecord(record: CatalogExportRecord) {
  activeRecord.value = record;
  exportDialogOpen.value = true;
  if (isRecordRunning(record)) startPolling();
}

async function downloadRecord(record: CatalogExportRecord) {
  if (downloadingId.value !== null || record.status !== "ready") return;
  downloadingId.value = record.id;
  try {
    const blob = await downloadCatalogExportRecord(record.id);
    download.saveAs(blob, `${record.name}.db`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "下载失败，请刷新记录后重试");
    await loadRecords();
  } finally {
    downloadingId.value = null;
  }
}

async function loadFilterOptions() {
  try {
    const [categories, cuisines, levels] = await Promise.all([
      getDictionary("/menu/category/list"),
      getDictionary("/menu/cuisine/list"),
      getVipLevelOptions(),
    ]);
    categoryOptions.value = categories;
    cuisineOptions.value = cuisines;
    vipOptions.value = levels;
  } catch {
    optionsError.value = "分类、菜系或 VIP 选项加载失败，请刷新页面重试";
  }
}

onMounted(() => {
  void loadVersions();
  void loadFilterOptions();
  void loadRecords();
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped lang="scss">
.catalog-export-page {
  display: grid;
  gap: 16px;
  padding: 16px;
}
.filter-panel {
  padding: 14px 24px;
}
.filter-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filter-panel__heading strong {
  font-size: 15px;
}
.filter-panel__body {
  margin-top: 16px;
}
.filter-panel__body :deep(.el-form) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 20px;
}
.filter-panel :deep(.el-form-item) {
  margin: 0;
}
.filter-panel :deep(.el-input),
.filter-panel :deep(.el-select) {
  width: 196px;
}
.filter-panel__hint {
  margin: 12px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.filter-panel__error {
  margin-top: 12px;
}
.results-panel {
  min-width: 0;
  padding: 20px 24px;
}
.results-panel__heading,
.results-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.results-panel__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.results-panel__heading h2 {
  margin: 0 0 5px;
  font-size: 18px;
}
.results-panel__heading span,
.results-panel__footer > span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.results-panel__error {
  margin-top: 16px;
}
.results-panel__body {
  min-height: 270px;
  margin-top: 18px;
}
.version-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.version-card {
  display: block;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s,
    box-shadow 0.18s;
}
.version-card:hover {
  border-color: var(--el-color-primary-light-3);
  box-shadow: var(--el-box-shadow-light);
}
.version-card:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.version-card.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.version-card__image {
  position: relative;
  display: block;
  height: 142px;
  background: var(--el-fill-color-light);
}
.version-card__image :deep(.el-image) {
  width: 100%;
  height: 100%;
}
.version-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.version-card__check {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 2px solid var(--el-border-color);
  border-radius: 50%;
  background: var(--el-bg-color);
  color: var(--el-color-white);
}
.is-selected .version-card__check {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}
.version-card__content {
  display: grid;
  gap: 8px;
  padding: 15px;
}
.version-card__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.version-card__number {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
}
.version-card__name {
  overflow: hidden;
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.version-card__meta,
.version-card__category {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.results-panel__footer {
  margin-top: 22px;
}
.selected-list {
  display: grid;
  gap: 10px;
}
.selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
}
.selected-item > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.selected-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-item span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.history-panel {
  min-width: 0;
  padding: 20px 24px;
}
.history-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.history-panel__heading h2 {
  margin: 0 0 5px;
  font-size: 18px;
}
.history-panel__heading span,
.export-record__main > span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.history-panel__error {
  margin-top: 14px;
}
.export-record-list {
  margin-top: 16px;
}
.export-record {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px 72px;
  align-items: center;
  gap: 16px;
  padding: 15px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.export-record__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.export-record__main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.export-record__main .export-record__error {
  color: var(--el-color-danger);
}
.export-record__status {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.export-record__status :deep(.el-progress) {
  width: 100%;
}
.history-panel__pagination {
  justify-content: flex-end;
  margin-top: 14px;
}
.export-dialog__hint {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.export-dialog__progress {
  display: grid;
  gap: 15px;
}
.export-dialog__progress p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
.export-dialog__working {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-primary);
}
@media (max-width: 1360px) {
  .version-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 980px) {
  .version-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 620px) {
  .catalog-export-page {
    padding: 10px;
  }
  .results-panel {
    padding: 18px;
  }
  .filter-panel {
    padding: 14px 18px;
  }
  .version-grid {
    grid-template-columns: 1fr;
  }
  .results-panel__heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .results-panel__footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .results-panel__footer :deep(.el-pagination) {
    max-width: 100%;
    overflow-x: auto;
  }
  .history-panel {
    padding: 18px;
  }
  .history-panel__heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .export-record {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .export-record__status {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .version-card {
    transition: none;
  }
}
</style>
