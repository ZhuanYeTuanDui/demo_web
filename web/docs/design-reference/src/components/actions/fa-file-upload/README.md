# 统一文件上传组件

所有 Web 图片上传通过 `FaFileUpload`。单图预览与裁剪可继续使用 `FaUpload`，它已复用本组件；富文本图片也通过本组件上传。

```vue
<FaFileUpload
  v-model:file-list="images"
  directory="menu"
  accept="image/*"
  list-type="picture-card"
  :limit="20"
  @uploaded="onUploaded"
>
  上传图片
</FaFileUpload>
```

`uploaded(result, file)` 返回统一的文件信息和原始文件。`result.origin_name` 为原始展示名称，`result.file_path` 为实际存储路径，`result.file_url` 为访问地址；存储接口还会返回 `file_id`。

- `endpoint`：默认 `/storage/file/upload`，可指定资源或通用上传接口。
- `directory`：存储接口的目标目录，例如 `menu`、`device`、`avatar`；不要传完整文件路径。
- `data`：额外请求字段，例如 `{ source_id: 1 }`、`{ target_path: 'images' }`。
- `name`：文件字段名，默认 `file`。
- `disabled`：禁用选择和手动上传。
- `pending-change(count)`：当前进行中的上传数量，可用于按钮或弹窗的加载状态。

Element Plus 的文件列表、上传前校验、大小提示、预览、删除、成功与失败回调以及插槽均保持原来的用法。不要再在页面配置 `http-request`，组件统一负责发送请求。

裁剪或手动确认后，可调用组件引用的 `upload(file)`；它返回 Promise 并触发同一个 `uploaded` 事件。组件还暴露 `submit()`、`clearFiles()` 和 `handleStart(file)`。

图片每次上传生成新的 128 位随机存储名，保留小写扩展名，同一图片可以反复上传。存储接口通过 `remote_path` 指定新名字；其它接口通过 multipart 文件名指定新名字。非图片保留原名。

已接入菜谱、设备图片、个人头像、系统参数单图上传、存储文件管理、资源管理和富文本编辑器。
