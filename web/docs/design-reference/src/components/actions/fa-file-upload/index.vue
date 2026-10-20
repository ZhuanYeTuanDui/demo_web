<template>
  <ElUpload
    ref="uploadRef"
    v-bind="$attrs"
    :data="data"
    :name="name"
    :disabled="disabled"
    :http-request="handleUpload"
    :aria-busy="pending > 0"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps || {}" />
    </template>
  </ElUpload>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElUpload, type UploadRawFile, type UploadRequestOptions } from "element-plus";
import { uploadFile, type FileUploadOptions, type FileUploadResult } from "./upload";

defineOptions({ name: "FaFileUpload", inheritAttrs: false });

const props = withDefaults(defineProps<FileUploadOptions & { disabled?: boolean }>(), {
  endpoint: "/storage/file/upload",
  directory: "",
  name: "file",
  data: () => ({}),
  disabled: false,
});
const emit = defineEmits<{
  uploaded: [result: FileUploadResult, file: File];
  pendingChange: [count: number];
}>();
const uploadRef = ref<InstanceType<typeof ElUpload>>();
const pending = ref(0);

/** 暴露同一上传方法给裁剪和手动确认流程，不必在页面重复发请求。 */
async function upload(file: File): Promise<FileUploadResult> {
  if (props.disabled) throw new Error("当前不可上传文件");
  pending.value += 1;
  emit("pendingChange", pending.value);
  try {
    const result = await uploadFile(file, props);
    emit("uploaded", result, file);
    return result;
  } finally {
    pending.value -= 1;
    emit("pendingChange", pending.value);
  }
}

// Element Plus 会根据 Promise 调用成功/失败回调，组件内不再手动重复调用。
function handleUpload(options: UploadRequestOptions) {
  return upload(options.file);
}

defineExpose({
  upload,
  submit: () => uploadRef.value?.submit(),
  clearFiles: () => uploadRef.value?.clearFiles(),
  handleStart: (file: UploadRawFile) => uploadRef.value?.handleStart(file),
});
</script>
