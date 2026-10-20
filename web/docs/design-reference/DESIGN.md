# YSZN 后台界面设计约定

本项目面向中文后台操作人员，使用 Vue 3、Element Plus 和现有后台主题。
业务功能扩展以已有设备、VIP 列表和菜谱编辑器为依据，保持信息密度和操作习惯。

## 视觉与组件来源

- 颜色、字号和圆角以运行时主题为真值，不在业务页面建立第二套配色。
  Element Plus 主题入口为 `src/styles/element-plus/_theme.scss`，正文和提示复用
  `--el-text-color-*` 等语义变量。未自定义主题时主色为 `#4080ff`。
- 列表复用 `FaManagementList`，行内操作复用 `FaTableActions`。
- 表单使用 `ElForm/ElFormItem`，等级选项使用 `ElSelect/ElOption`，整数等级使用
  `ElInputNumber`，弹窗使用 `ElDialog`，状态反馈使用 `ElMessage/ElAlert`。
- VIP 设备绑定弹窗在窄屏按视口缩放，表格保留自身横向滚动，不改变页面全局滚动。
- 菜谱等级字段位于基本信息，说明“所有版本共用”，不作为版本内容重复存储。

## 本次业务约定

等级数值越大权限越高，等级 ID 仅是关联键。默认等级数值为 0；新增菜谱默认选择
默认等级。设备绑定变更显式保存、确认成功后刷新，不做乐观授权更新。
交互约定见 `UX-CONTRACT.md`；接口规则见后端上位机和 VIP 文档。
