import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ElementPlus, { ElSelect } from "element-plus";
import WorkOrders from "./WorkOrders.vue";
import Production from "./Production.vue";
import Issues from "./Issues.vue";
import Shipments from "./Shipments.vue";
import DemandAnalysis from "./DemandAnalysis.vue";
import Drafts from "./Drafts.vue";
import { state, storageError } from "./store";
import { createManualDraft, requirements, seed, stockKey } from "./model";

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  state.value = seed();
  storageError.value = "";
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  sessionStorage.clear();
});
const click = async (label: string) => {
  const button = wrapper!.findAll("button").find((item) => item.text() === label);
  expect(button, `应存在${label}按钮`).toBeTruthy();
  await button!.trigger("click");
};

describe("生产单据页面闭环", () => {
  it("未审核计划编辑支持取消和保存，审核后在已审核页签显示", async () => {
    const plan = state.value.plans[0]!;
    plan.auditStatus = "未审核";
    const originalName = plan.name;
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await click("编辑");
    await flushPromises();
    await wrapper.get('input[maxlength="60"]').setValue("取消的修改");
    await click("取消");
    expect(state.value.plans[0]!.name).toBe(originalName);
    await flushPromises();
    await click("编辑");
    await flushPromises();
    await wrapper.get('input[maxlength="60"]').setValue("审核前修改计划");
    await click("保存修改");
    await flushPromises();
    expect(state.value.plans[0]!.name).toBe("审核前修改计划");
    await click("审核");
    await flushPromises();
    expect(state.value.plans[0]!.auditStatus).toBe("已审核");
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "已审核")!
      .trigger("click");
    expect(wrapper.text()).toContain("审核前修改计划");
  });

  it("底稿只有编辑审核入口，修改数量后保存，详情不再提供主动转采购", async () => {
    const draft = createManualDraft(state.value, {
      remark: "手工测试",
      lines: [{ material: "M001", qty: 2 }],
    });
    wrapper = mount(Drafts, { global: { plugins: [ElementPlus] } });
    expect(wrapper.text()).not.toContain("转采购单");
    expect(wrapper.text()).not.toContain("请购单");
    await flushPromises();
    await click("编辑");
    await flushPromises();
    const qty = wrapper.get('input[aria-label="PLC 控制器需购数量"]');
    await qty.setValue("5");
    await qty.trigger("change");
    await click("保存底稿");
    await flushPromises();
    expect(state.value.drafts.find((item) => item.id === draft.id)!.lines[0]!.qty).toBe(5);
    await click("审核");
    expect(state.value.drafts.find((item) => item.id === draft.id)!.auditStatus).toBe("已审核");
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "已审核")!
      .trigger("click");
    expect(wrapper.text()).toContain("返审");
    expect(wrapper.text()).not.toContain("选择物料转采购");
  });

  it("领料可移除不需要的物料，不扣其库存也不推定生产计划已齐料", async () => {
    const plan = state.value.plans[0]!;
    const lines = requirements(plan);
    lines.forEach((line) => {
      state.value.stocks[stockKey("BZ01", line.material)] = line.qty;
    });
    const removed = lines[0]!;
    const oldStatus = plan.status;
    sessionStorage.setItem("wsn-selected-issue-plan", plan.id);
    wrapper = mount(Issues, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await click("移除");
    await click("确认领料并出库");
    await flushPromises();
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".el-message-box__btns .el-button--primary")
    )
      .at(-1)!
      .click();
    await flushPromises();
    expect(state.value.issues).toHaveLength(1);
    expect(state.value.issues[0]!.lines.some((line) => line.material === removed.material)).toBe(
      false
    );
    expect(state.value.stocks[stockKey("BZ01", removed.material)]).toBe(removed.qty);
    expect(
      state.value.movements.some(
        (line) => line.source === state.value.issues[0]!.id && line.material === removed.material
      )
    ).toBe(false);
    expect(state.value.plans[0]!.status).toBe(oldStatus);
  });

  it("计划分析缺料打开绑定当前计划的弹窗，不跳转页面", async () => {
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "已审核")!
      .trigger("click");
    await click("分析缺料");
    await flushPromises();
    expect(wrapper.emitted("navigate")).toBeUndefined();
    expect(wrapper.getComponent(DemandAnalysis).props("planId")).toBe(state.value.plans[0]!.id);
    expect(sessionStorage.getItem("wsn-selected-plan")).toBeNull();
  });

  it("分析弹窗生成底稿后进入底稿页面并关闭弹窗", async () => {
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "已审核")!
      .trigger("click");
    await click("分析缺料");
    await flushPromises();
    await click("生成采购底稿");
    await flushPromises();
    const planDrafts = state.value.drafts.filter(
      (draft) => draft.plan === state.value.plans[0]!.id
    );
    expect(planDrafts).toHaveLength(1);
    expect(planDrafts[0]!.lines).toHaveLength(4);
    expect(wrapper.emitted("navigate")?.at(-1)).toEqual(["drafts"]);
    expect(wrapper.findComponent(DemandAnalysis).exists()).toBe(false);
  });

  it("消费分析跳转意图后打开对应计划弹窗，关闭后保留计划筛选", async () => {
    const planId = state.value.plans[1]!.id;
    sessionStorage.setItem("wsn-production-plan-analysis", planId);
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(wrapper.getComponent(DemandAnalysis).props("planId")).toBe(planId);
    expect(sessionStorage.getItem("wsn-production-plan-analysis")).toBeNull();
    const keyword = wrapper.get('input[placeholder="计划号、名称或产品"]');
    await keyword.setValue("成型机");
    wrapper.getComponent(DemandAnalysis).vm.$emit("close");
    await nextTick();
    expect(wrapper.findComponent(DemandAnalysis).exists()).toBe(false);
    expect((keyword.element as HTMLInputElement).value).toBe("成型机");
  });

  it("生产计划不再提供领料入口，已审核计划保留完工操作", async () => {
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "已审核")!
      .trigger("click");
    expect(wrapper.findAll("button").some((button) => button.text() === "生产领料")).toBe(false);
    expect(wrapper.text()).toContain("分析缺料");
    expect(wrapper.text()).toContain("返审");
    expect(state.value.issues).toHaveLength(0);
  });

  it("预选生产计划创建领料单，库存和关联出库同时更新", async () => {
    const plan = state.value.plans[0]!;
    const previousStatus = plan.status;
    requirements(plan).forEach((line) => {
      state.value.stocks[stockKey("BZ01", line.material)] = line.qty;
    });
    sessionStorage.setItem("wsn-selected-issue-plan", plan.id);

    wrapper = mount(Issues, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await click("确认领料并出库");
    await flushPromises();
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".el-message-box__btns .el-button--primary")
    )
      .at(-1)!
      .click();
    await flushPromises();
    expect(state.value.issues).toHaveLength(1);
    const issue = state.value.issues[0]!;
    expect(issue.plan).toBe(plan.id);
    expect(state.value.movements.filter((row) => row.source === issue.id)).toHaveLength(
      requirements(plan).length
    );
    requirements(plan).forEach((line) =>
      expect(state.value.stocks[stockKey("BZ01", line.material)]).toBe(0)
    );
    expect(state.value.plans[0]!.status).toBe(previousStatus);
  });

  it("创建计划缺少工单时保留表单并阻止保存", async () => {
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    const original = state.value.plans.length;
    await click("新增生产计划");
    await flushPromises();
    await click("创建计划");
    expect(state.value.plans).toHaveLength(original);
    expect(wrapper.text()).toContain("请选择工单并填写计划名称和计划日期");
  });

  it("待出货工单确认物流后生成发货单并扣成品库存", async () => {
    const plan = state.value.plans[0]!;
    const workOrder = state.value.workOrders.find((row) => row.id === plan.workOrder)!;
    workOrder.status = "待出货";
    plan.status = "已完工";
    state.value.stocks[stockKey("CP01", plan.product)] = plan.qty;

    wrapper = mount(Shipments, { global: { plugins: [ElementPlus] } });
    await click("新增发货单");
    await flushPromises();
    wrapper
      .findAllComponents(ElSelect)
      .find((select) => select.props("placeholder") === "请选择待出货工单")!
      .vm.$emit("update:modelValue", workOrder.id);
    await nextTick();
    await wrapper.get('input[maxlength="60"]').setValue("顺丰速运");
    await wrapper.get('input[maxlength="100"]').setValue("SF123456789");
    await click("确认发货并出库");
    await flushPromises();
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".el-message-box__btns .el-button--primary")
    )
      .at(-1)!
      .click();
    await flushPromises();
    expect(state.value.shipments).toHaveLength(1);
    expect(state.value.shipments[0]!.tracking).toBe("SF123456789");
    expect(state.value.workOrders.find((row) => row.id === workOrder.id)!.status).toBe("已发货");
    expect(state.value.stocks[stockKey("CP01", plan.product)]).toBe(0);
    expect(
      state.value.movements.some(
        (row) => row.source === state.value.shipments[0]!.id && row.type === "出库"
      )
    ).toBe(true);
  });

  it("工单可直接选择 Excel 导入并自动带入工单，完成后返回工单详情", async () => {
    wrapper = mount(WorkOrders, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          ProductionImport: {
            name: "ProductionImport",
            props: ["workOrder"],
            emits: ["close", "imported"],
            template: '<div data-test="work-order-import">{{workOrder}}</div>',
          },
        },
      },
    });
    await flushPromises();
    await click("安排计划");
    await flushPromises();
    await click("Excel 导入");
    await flushPromises();
    const importer = wrapper.findComponent({ name: "ProductionImport" });
    expect(importer.props("workOrder")).toBe(state.value.workOrders[0]!.id);
    expect(wrapper.emitted("navigate")).toBeUndefined();
    importer.vm.$emit("imported", "PP-IMPORTED");
    await flushPromises();
    expect(wrapper.find('[data-test="work-order-import"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("工单详情");
  });

  it("工单安排计划跳转到生产计划路由并带入工单", async () => {
    wrapper = mount(WorkOrders, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    await flushPromises();
    await click("安排计划");
    await flushPromises();
    await click("手工创建");
    expect(wrapper.emitted("navigate")?.[0]).toEqual(["plans"]);
    expect(sessionStorage.getItem("wsn-selected-work-order")).toBe(state.value.workOrders[0]!.id);
    wrapper.unmount();
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(wrapper.text()).toContain("新增生产计划");
    const selectedOrder = wrapper
      .findAllComponents(ElSelect)
      .find((select) => select.props("modelValue") === state.value.workOrders[0]!.id);
    expect(selectedOrder).toBeTruthy();
  });
});
