# 同源后台设计参考快照

复制日期：2026-10-20。来源：YSZN 后台 frontend/web。此目录保存真实文件副本，无软链接，不依赖原项目本机路径，可随 GitHub 仓库保存。

## 阅读顺序

1. 当前生效的 [设计约定](../../DESIGN.md)、[交互约定](../../UX-CONTRACT.md)。
2. 来源 [DESIGN.md](DESIGN.md)、[UX-CONTRACT.md](UX-CONTRACT.md)。VIP、授权等来源业务不作为 WSN 需求。
3. [公共列表说明](src/components/business/fa-management-list/README.md)、组件源码和原测试。
4. [菜谱编辑器](src/views/module_menu/menu/RecipeEditor.vue)、步骤卡和食材编辑器，参考布局和控件使用。
5. [上传说明](src/components/actions/fa-file-upload/README.md)、表格操作、表头、按钮组件、主题、store、类型、枚举、权限辅助和来源 package.json。

## 接入边界

这是设计与源码参考，不是可独立构建的组件包，不进入当前演示编译。其中 @/ 指向来源运行目录，原测试尚未在 WSN 接入执行。

- FaManagementList 依赖 Pinia 表格 store、FaTableHeader 和 ColumnOption；表头还依赖 vue-i18n、vue-draggable-plus、全局组件和主题。接入时核对原模板并在演示入口初始化。
- FaTableActions 依赖 FaButtonTable、FaButtonMore，后者还依赖权限辅助与原全局组件。不能把来源权限模型当作 WSN 需求。
- FaFileUpload 依赖 utils/http、ApiResponse、UploadFilePath 和 /storage/file/upload。当前无后端，不直接启用或搬入来源登录、请求拦截器和存储服务；后续按目标实际契约接入。
- RecipeEditor 依赖来源业务 API、配置、身份与字典，只作结构参考，不代表 WSN 需要菜谱业务。
- package.json 仅供核对版本，不替换当前依赖和锁文件；主题快照不覆盖 src/demo/style.css。

实际接入时按使用链补齐最小依赖，在 src 维护共享实现并验证；此目录保留来源快照，不在这里继续业务开发。
