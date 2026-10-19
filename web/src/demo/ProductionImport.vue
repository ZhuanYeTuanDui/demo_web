<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { Document, Loading, UploadFilled } from "@element-plus/icons-vue";
import type { UploadFile, UploadInstance } from "element-plus";
import { state, commit } from "./store";
import { today } from "./model";
import { importProductionPlans, parseProductionExcel, type ImportPreview } from "./production-import";

const emit = defineEmits<{ close: []; imported: [planId: string] }>();
const preview = ref<ImportPreview>();
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const errorBox = ref<HTMLElement>();
const uploadRef = ref<UploadInstance>();
const fileName = ref("");
const options = reactive({ date: today(), missingUnit: "个" });
const activeSheet = ref("");
const page = ref(1);
const keyword = ref("");
const selected = computed(() => preview.value?.sheets.find((s) => s.sheet === activeSheet.value));
const filtered = computed(() => selected.value?.rows.filter((r) => `${r.name}${r.spec}${r.drawingNo}${r.part}`.includes(keyword.value)) || []);
const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20));
const missingUnits = computed(() => preview.value?.sheets.flatMap((s) => s.rows).filter((r) =>
  !r.unit && !state.value.materials.find((m) => m.id === r.materialId)?.unit).length || 0);

async function showError(message: string) {
  error.value = message;
  await nextTick();
  errorBox.value?.focus();
}
async function chooseFile(uploadFile: UploadFile) {
  if (loading.value || saving.value) return;
  const file = uploadFile.raw;
  // 文件由本地解析器处理，清空组件队列以支持重复选择同一文件。
  uploadRef.value?.clearFiles();
  preview.value = undefined;
  error.value = "";
  fileName.value = "";
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) return showError("请选择 .xls 或 .xlsx 文件。");
  if (file.size > 10 * 1024 * 1024) return showError("文件不能超过 10 MB，请精简后导入。");
  fileName.value = file.name;
  loading.value = true;
  try {
    preview.value = parseProductionExcel(await file.arrayBuffer(), file.name, state.value.materials);
    activeSheet.value = preview.value.sheets[0]?.sheet || "";
    page.value = 1;
    keyword.value = "";
    if (preview.value.errors.length) await showError("Excel 中存在解析错误，请修正后重新选择文件。");
  } catch (e) {
    await showError(`无法读取 Excel：${e instanceof Error ? e.message : "文件损坏或格式不支持"}`);
  } finally {
    loading.value = false;
  }
}
async function generate() {
  if (!preview.value || saving.value) return;
  error.value = "";
  saving.value = true;
  let firstPlan = "";
  const success = commit((draft) => {
    try {
      firstPlan = importProductionPlans(draft, preview.value!, options.date, options.missingUnit)[0]!.id;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "导入失败";
      throw e;
    }
  }, `已生成 ${preview.value.sheets.length} 个生产计划，可继续分析需求`);
  saving.value = false;
  if (success) emit("imported", firstPlan);
  else await showError(error.value || "未能保存导入结果，请检查浏览器存储空间后重试。");
}
</script>

<template>
  <el-dialog :model-value="true" title="从 Excel 导入生产计划" width="min(1180px, 96vw)" top="4vh" class="production-import"
    :close-on-click-modal="false" :close-on-press-escape="!loading && !saving"
    :show-close="!loading && !saving" @close="emit('close')">
    <p class="import-help">上传后核对物料，再生成计划。单表直接解析；多表只读取“机加、标准、钣金、电气”，每张表生成一个计划。缺失单位默认为“个”，缺失数量默认为 1，均可核对修改。</p>
    <div v-if="error" ref="errorBox" class="import-error" role="alert" tabindex="-1">
      <strong>{{ error }}</strong>
      <ul v-if="preview?.errors.length"><li v-for="message in preview.errors.slice(0, 100)" :key="message">{{ message }}</li></ul>
      <p v-if="(preview?.errors.length || 0) > 100">共 {{ preview?.errors.length }} 个错误，此处显示前 100 个。</p>
    </div>
    <el-form label-position="top" @submit.prevent="generate">
      <el-form-item label="上传 Excel 文件" required>
        <el-upload ref="uploadRef" class="import-upload" :class="{ 'has-file': fileName }" drag
          accept=".xls,.xlsx" :auto-upload="false" :show-file-list="false" :multiple="false"
          :disabled="loading || saving" :on-change="chooseFile" aria-label="点击选择或拖拽 Excel 文件">
          <div class="import-upload-content">
            <span class="import-upload-icon" aria-hidden="true"><el-icon :class="{ 'is-loading': loading }"><Loading v-if="loading" /><Document v-else-if="fileName" /><UploadFilled v-else /></el-icon></span>
            <div class="import-upload-copy">
              <div v-if="fileName" class="import-upload-name">{{ fileName }}</div>
              <div v-else class="import-upload-title">将 Excel 文件拖拽到此处，或<span>点击选择文件</span></div>
              <p>{{ loading ? '正在解析文件，请稍候…' : fileName ? '点击或拖入其他文件可重新解析' : '支持 .xls、.xlsx 格式，单个文件不超过 10 MB' }}</p>
            </div>
            <span v-if="fileName && !loading" class="import-upload-replace">更换文件</span>
          </div>
        </el-upload>
      </el-form-item>
      <p v-if="loading" role="status">正在解析文件，请稍候…</p>
      <template v-if="preview">
        <p role="status">已识别 {{ preview.sheets.length }} 张表、{{ preview.sheets.reduce((n, s) => n + s.rows.length, 0) }} 条物料明细。相同物料生成计划时会合并用量。</p>
        <p v-if="preview.ignored.length" class="muted">忽略的工作表：{{ preview.ignored.join('、') }}</p>
        <el-alert v-if="preview.warnings.length" type="warning" :closable="false" title="请核对数量口径；图片备注不导入图片本体。">
          <template #default><ul class="import-warnings"><li v-for="message in preview.warnings" :key="message">{{ message }}</li></ul></template>
        </el-alert>
        <div class="import-options">
          <el-form-item label="计划日期" required><el-date-picker v-model="options.date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item v-if="missingUnits" :label="`缺失单位统一补充（${missingUnits} 条，可逐行填写）`" required>
            <el-input v-model="options.missingUnit" placeholder="例如：件；请按实际业务填写" maxlength="20" />
          </el-form-item>
        </div>
        <el-tabs v-model="activeSheet" @tab-change="page = 1; keyword = ''">
          <el-tab-pane v-for="sheet in preview.sheets" :key="sheet.sheet" :name="sheet.sheet" :label="`${sheet.sheet}（${sheet.rows.length} 条）`" />
        </el-tabs>
        <template v-if="selected">
          <div class="import-options">
            <el-form-item label="计划名称" required><el-input v-model="selected.name" maxlength="120" /></el-form-item>
            <el-form-item label="表内数量的含义" required>
              <el-select v-model="selected.basis" @change="selected.qty = 1">
                <el-option label="每台用量（乘以计划数量）" value="perUnit" />
                <el-option label="本次总需求（计划数量固定为 1）" value="total" />
              </el-select>
            </el-form-item>
            <el-form-item label="计划数量（台）" required><el-input-number v-model="selected.qty" :min="1" :max="100000" :precision="0" :disabled="selected.basis === 'total'" /></el-form-item>
          </div>
          <el-form-item label="筛选物料"><el-input v-model="keyword" placeholder="名称、规格、图号或部件" clearable @input="page = 1" /></el-form-item>
          <el-table :data="paged" max-height="380" stripe empty-text="暂无匹配物料">
            <el-table-column prop="row" label="原始行" width="75" />
            <el-table-column prop="part" label="所属部件" min-width="180" show-overflow-tooltip />
            <el-table-column prop="name" label="物料名称" min-width="130" />
            <el-table-column label="图号 / 规格" min-width="180"><template #default="{ row }">{{ row.drawingNo || row.spec || '未提供' }}</template></el-table-column>
            <el-table-column label="表内数量" width="140"><template #default="{ row }">
              <el-input-number v-model="row.qty" :aria-label="`第 ${row.row} 行数量`" :min="1" :max="100000" :precision="0" controls-position="right" style="width: 116px" />
            </template></el-table-column>
            <el-table-column label="库存单位" width="110"><template #default="{ row }">
              <el-input v-model="row.unit" :aria-label="`第 ${row.row} 行库存单位`" :placeholder="state.materials.find(m => m.id === row.materialId)?.unit || options.missingUnit || '需补充'" maxlength="20" />
            </template></el-table-column>
            <el-table-column label="物料关联" min-width="200"><template #default="{ row }">
              <el-select v-if="row.candidates.length > 1" v-model="row.materialId" :aria-label="`第 ${row.row} 行关联物料`" placeholder="多个匹配，请选择">
                <el-option v-for="candidate in row.candidates" :key="candidate" :value="candidate" :label="`${candidate} ${state.materials.find(m => m.id === candidate)?.name}`" />
                <el-option value="__new__" label="作为新物料建档" />
              </el-select>
              <template v-else><el-tag :type="row.materialId ? 'success' : 'info'">{{ row.materialId ? '已匹配' : '将自动建档' }}</el-tag><div class="cell-sub">{{ row.materialId || '源表未提供价格，参考价暂为 0' }}</div></template>
            </template></el-table-column>
          </el-table>
          <el-pagination v-model:current-page="page" class="import-pagination" :total="filtered.length" :page-size="20" layout="total, prev, pager, next" />
        </template>
      </template>
    </el-form>
    <template #footer>
      <el-button :disabled="loading || saving" @click="emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="loading || !preview?.sheets.length || !!preview?.errors.length" @click="generate">生成 {{ preview?.sheets.length || 0 }} 个生产计划</el-button>
    </template>
  </el-dialog>
</template>

<style>
/* 对话框传送至页面根节点，使用专属类约束高度，保留页脚操作区。 */
.el-dialog.production-import { max-height: 92vh; display: flex; flex-direction: column; }
.production-import > .el-dialog__body { overflow: auto; min-height: 0; }
.production-import > .el-dialog__header, .production-import > .el-dialog__footer { flex-shrink: 0; }
</style>

<style scoped>
.import-upload { width: 100%; }
.import-upload :deep(.el-upload) { width: 100%; }
.import-upload :deep(.el-upload-dragger) { padding: 28px; border-radius: 12px; background: var(--el-fill-color-lighter); transition: border-color .2s, background-color .2s; }
.import-upload :deep(.el-upload-dragger:hover), .import-upload :deep(.el-upload-dragger.is-dragover) { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.import-upload :deep(.el-upload:focus-visible) { outline: 2px solid var(--el-color-primary); outline-offset: 3px; border-radius: 12px; }
.import-upload-content { display: flex; align-items: center; justify-content: center; gap: 18px; }
.import-upload-icon { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 14px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 30px; }
.import-upload-copy { min-width: 0; text-align: left; }
.import-upload-title, .import-upload-name { color: var(--el-text-color-primary); font-size: 15px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }
.import-upload-title span { margin-left: 4px; color: var(--el-color-primary); }
.import-upload-copy p { margin: 6px 0 0; color: var(--el-text-color-regular); font-size: 13px; line-height: 1.6; }
.import-upload-replace { margin-left: auto; flex-shrink: 0; color: var(--el-color-primary); font-size: 14px; }
.has-file .import-upload-content { justify-content: flex-start; }
@media (max-width: 600px) {
  .import-upload :deep(.el-upload-dragger) { padding: 20px 14px; }
  .import-upload-content { flex-wrap: wrap; gap: 12px; }
  .import-upload-copy { flex: 1; }
  .import-upload-replace { display: none; }
}
.import-help { margin: 0 0 20px; line-height: 1.7; }
.import-error { border: 1px solid var(--el-color-danger); border-radius: 8px; padding: 12px; margin-bottom: 16px; color: var(--el-color-danger); max-height: 220px; overflow: auto; }
.import-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }
.import-options :deep(.el-select), .import-options :deep(.el-date-editor) { width: 100%; }
.import-warnings { max-height: 100px; overflow: auto; padding-left: 18px; margin: 6px 0; }
.import-pagination { justify-content: flex-end; margin-top: 16px; }
</style>
