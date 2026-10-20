<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ArrowLeft, Edit, Check, OfficeBuilding } from "@element-plus/icons-vue";
import { state, commit } from "./store";
import type { Warehouse } from "./model";

const props = defineProps<{ warehouseId: string }>();
const emit = defineEmits<{ back: [] }>();
const warehouse = computed(() => state.value.warehouses.find((w) => w.id === props.warehouseId));
const editing = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({
  id: "",
  name: "",
  kind: "存货仓",
  available: false,
  phone: "",
  fax: "",
  postcode: "",
  address: "",
  inactive: false,
  remark: "",
});
const rules: FormRules = {
  name: [{ required: true, whitespace: true, message: "请填写仓库名称", trigger: "blur" }],
  kind: [{ required: true, message: "请选择仓库性质", trigger: "change" }],
};
function restore() {
  const w = warehouse.value;
  if (!w) return;
  Object.assign(form, {
    ...w,
    phone: w.phone || "",
    fax: w.fax || "",
    postcode: w.postcode || "",
    address: w.address || "",
    inactive: !!w.inactive,
    remark: w.remark || "",
  });
}
function startEditing() {
  restore();
  editing.value = true;
}
function cancel() {
  editing.value = false;
  formRef.value?.clearValidate();
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  if (
    commit((s) => {
      const w = s.warehouses.find((w) => w.id === props.warehouseId);
      if (!w) throw new Error("仓库不存在，请返回列表");
      if (!form.name.trim() || !["存货仓", "现场仓", "委外仓"].includes(form.kind))
        throw new Error("请检查仓库名称和性质");
      // 编号是库存及单据关联键，只更新档案属性，保留全部关联记录。
      const changes: Partial<Warehouse> = {
        name: form.name.trim(),
        kind: form.kind,
        available: form.available,
        phone: form.phone.trim(),
        fax: form.fax.trim(),
        postcode: form.postcode.trim(),
        address: form.address.trim(),
        inactive: form.inactive,
        remark: form.remark.trim(),
      };
      Object.assign(w, changes);
    }, "仓库资料已保存")
  )
    editing.value = false;
}
</script>

<template>
  <div class="warehouse-detail">
    <el-button text :icon="ArrowLeft" class="warehouse-back" @click="emit('back')"
      >返回仓库列表</el-button
    >
    <template v-if="warehouse">
      <div class="detail-toolbar">

        <div class="warehouse-actions">
          <template v-if="editing"
            ><el-button @click="cancel">取消编辑</el-button
            ><el-button type="primary" :icon="Check" @click="save">保存修改</el-button></template
          ><el-button v-else type="primary" :icon="Edit" @click="startEditing">编辑资料</el-button>
        </div>
      </div>
      <section class="panel warehouse-profile">
        <div class="warehouse-profile-icon">
          <el-icon :size="26"><OfficeBuilding /></el-icon>
        </div>
        <div>
          <h2>{{ warehouse.name }}</h2>
          <p class="muted">{{ warehouse.id }}<span class="divider">/</span>{{ warehouse.kind }}</p>
        </div>
        <el-tag :type="warehouse.inactive ? 'info' : 'success'">{{
          warehouse.inactive ? "已失效" : "正常使用"
        }}</el-tag>
      </section>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="save"
      >
        <section class="panel warehouse-section">
          <div class="panel-heading">
            <h2>基本信息</h2>
            <span class="muted">仓库的唯一标识与分类</span>
          </div>
          <div class="warehouse-section-body">
            <template v-if="editing"
              ><div class="form-grid">
                <el-form-item label="仓库编号"
                  ><el-input :model-value="warehouse.id" disabled /><span class="muted"
                    >编号用于关联库存与历史单据，暂不支持修改。</span
                  ></el-form-item
                ><el-form-item prop="name" label="仓库名称"
                  ><el-input v-model="form.name" maxlength="40" show-word-limit /></el-form-item
                ><el-form-item prop="kind" label="仓库性质"
                  ><el-select v-model="form.kind"
                    ><el-option
                      v-for="kind in ['存货仓', '现场仓', '委外仓']"
                      :key="kind"
                      :value="kind"
                      :label="kind" /></el-select
                ></el-form-item></div
            ></template>
            <dl v-else class="warehouse-fields">
              <div>
                <dt>仓库编号</dt>
                <dd class="code">{{ warehouse.id }}</dd>
              </div>
              <div>
                <dt>仓库名称</dt>
                <dd>{{ warehouse.name }}</dd>
              </div>
              <div>
                <dt>仓库性质</dt>
                <dd>{{ warehouse.kind }}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section class="panel warehouse-section">
          <div class="panel-heading">
            <h2>联系方式</h2>
            <span class="muted">联系与地址资料（选填）</span>
          </div>
          <div class="warehouse-section-body">
            <div v-if="editing" class="form-grid">
              <el-form-item label="电话"
                ><el-input
                  v-model="form.phone"
                  maxlength="40"
                  placeholder="请输入电话（选填）" /></el-form-item
              ><el-form-item label="传真"
                ><el-input
                  v-model="form.fax"
                  maxlength="40"
                  placeholder="请输入传真（选填）" /></el-form-item
              ><el-form-item label="邮编"
                ><el-input
                  v-model="form.postcode"
                  maxlength="20"
                  placeholder="请输入邮编（选填）" /></el-form-item
              ><el-form-item label="地址"
                ><el-input
                  v-model="form.address"
                  maxlength="200"
                  placeholder="请输入仓库地址（选填）"
              /></el-form-item>
            </div>
            <dl v-else class="warehouse-fields">
              <div>
                <dt>电话</dt>
                <dd>{{ warehouse.phone || "—" }}</dd>
              </div>
              <div>
                <dt>传真</dt>
                <dd>{{ warehouse.fax || "—" }}</dd>
              </div>
              <div>
                <dt>邮编</dt>
                <dd>{{ warehouse.postcode || "—" }}</dd>
              </div>
              <div class="full-width">
                <dt>地址</dt>
                <dd>{{ warehouse.address || "—" }}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section class="panel warehouse-section">
          <div class="panel-heading"><h2>库存规则与状态</h2></div>
          <div class="warehouse-section-body">
            <div v-if="editing" class="form-grid">
              <el-form-item label="纳入可用量计算"
                ><el-switch
                  v-model="form.available"
                  active-text="参与"
                  inactive-text="不参与"
                /><span class="warehouse-field-hint"
                  >单独配置，不由仓库性质自动决定。</span
                ></el-form-item
              ><el-form-item label="失效"
                ><el-switch
                  v-model="form.inactive"
                  active-text="已失效"
                  inactive-text="正常使用"
                /><span class="warehouse-field-hint"
                  >失效后保留历史记录，不再用于新增出入库。</span
                ></el-form-item
              >
            </div>
            <dl v-else class="warehouse-fields">
              <div>
                <dt>纳入可用量计算</dt>
                <dd>
                  <el-tag :type="warehouse.available ? 'success' : 'info'">{{
                    warehouse.available ? "参与计算" : "不参与计算"
                  }}</el-tag>
                </dd>
              </div>
              <div>
                <dt>失效</dt>
                <dd>{{ warehouse.inactive ? "是" : "否" }}</dd>
              </div>
            </dl>
          </div>
          <div class="inline-note">
            仅正常且勾选参与计算的仓库计入物料需求分析；修改后按最新配置重新计算。
          </div>
        </section>
        <section class="panel warehouse-section">
          <div class="panel-heading"><h2>备注</h2></div>
          <div class="warehouse-section-body">
            <el-form-item v-if="editing" label="补充说明"
              ><el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit
                placeholder="填写仓库相关说明（选填）"
            /></el-form-item>
            <p v-else class="warehouse-remark">{{ warehouse.remark || "—" }}</p>
          </div>
        </section>
      </el-form>
    </template>
    <section v-else class="panel">
      <el-empty description="仓库不存在或已被重置"
        ><el-button type="primary" @click="emit('back')">返回仓库列表</el-button></el-empty
      >
    </section>
  </div>
</template>

<style scoped>
.warehouse-back {
  margin: -8px 0 16px -12px;
}
.warehouse-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.warehouse-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
}
.warehouse-profile-icon {
  background: #edf3ff;
  color: var(--brand);
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.warehouse-profile h2 {
  font-size: 20px;
}
.warehouse-profile p {
  margin: 8px 0 0;
}
.warehouse-profile > .el-tag {
  margin-left: auto;
}
.warehouse-section .panel-heading {
  border-bottom: 1px solid var(--line);
}
.warehouse-section-body {
  padding: 24px;
}
.warehouse-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 24px;
  margin: 0;
}
.warehouse-fields dt {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 10px;
}
.warehouse-fields dd {
  margin: 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.full-width {
  grid-column: 1 / -1;
}
.warehouse-field-hint {
  display: block;
  width: 100%;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 8px;
}
.warehouse-remark {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .warehouse-fields {
    grid-template-columns: 1fr 1fr;
  }
  .warehouse-profile {
    padding: 20px 16px;
    flex-wrap: wrap;
  }
  .warehouse-profile h2 {
    font-size: 17px;
  }
  .warehouse-section-body {
    padding: 20px 16px;
  }
}
@media (max-width: 420px) {
  .warehouse-fields {
    grid-template-columns: 1fr;
  }
}
</style>
