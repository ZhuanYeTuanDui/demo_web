<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { state } from "./store";
import type { Purchase } from "./model";
import { purchasePrintHtml } from "./purchase-print";

const props = defineProps<{ order: Purchase }>();
const emit = defineEmits<{ close: [] }>();
const frame = ref<HTMLIFrameElement>();
const ready = ref(false);
const html = computed(() => purchasePrintHtml(props.order, state.value.materials));

// 在同一份独立文档中预览和打印，避免后台菜单、抽屉样式进入纸张。
function print() {
  const target = frame.value?.contentWindow;
  if (!target || !ready.value) {
    ElMessage.error("预览尚未加载完成，请稍后重试");
    return;
  }
  try {
    target.focus();
    target.print();
  } catch {
    ElMessage.error("浏览器未能打开打印窗口，请检查浏览器设置后重试");
  }
}
</script>

<template>
  <el-dialog
    :model-value="true"
    title="采购合同 · 打印预览"
    width="920px"
    top="3vh"
    append-to-body
    :close-on-click-modal="false"
    @close="emit('close')"
  >
    <el-alert
      title="A4 纵向。行金额为采购明细录入，合计由明细计算；请核对金额与合同条款。联系方式、交期等缺失信息保留空白。"
      type="warning"
      :closable="false"
      show-icon
    />
    <iframe
      ref="frame"
      class="purchase-print-preview"
      title="采购合同 A4 预览"
      :srcdoc="html"
      @load="ready = true"
    />
    <template #footer>
      <span class="print-hint">打印窗口可选择打印机或“另存为 PDF”，建议关闭页眉和页脚。</span>
      <el-button @click="emit('close')">关闭</el-button>
      <el-button type="primary" :disabled="!ready" @click="print">打印</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.purchase-print-preview {
  display: block;
  width: 100%;
  height: 67vh;
  margin-top: 16px;
  border: 1px solid #dcdfe6;
  background: #e8eaed;
}
.print-hint {
  display: inline-block;
  margin: 0 16px 8px 0;
  color: #606266;
  font-size: 12px;
}
</style>
