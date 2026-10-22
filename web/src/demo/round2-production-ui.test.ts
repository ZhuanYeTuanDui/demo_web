import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import ElementPlus, {
  ElInputNumber,
  ElMessageBox,
  ElSelect,
  ElTable,
  ElTableV2,
} from "element-plus";
import PlanDetails from "./PlanDetails.vue";
import MaterialPicker from "./MaterialPicker.vue";
import Issues from "./Issues.vue";
import { state, storageError } from "./store";
import { requirements, seed, stockKey, type Plan } from "./model";

let wrapper: VueWrapper | undefined;
const resizer = defineComponent({ template: '<div><slot :width="960" :height="320" /></div>' });
const global = { plugins: [ElementPlus], stubs: { ElAutoResizer: resizer } };
const click = async (label: string) => {
  const button = wrapper!.findAll("button").find((item) => item.text() === label);
  expect(button, `应存在${label}按钮`).toBeTruthy();
  await button!.trigger("click");
};
beforeEach(() => {
  state.value = seed();
  storageError.value = "";
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  sessionStorage.clear();
});
function editPlan(): Plan {
  const plan = state.value.plans[0]!;
  plan.auditStatus = "未审核";
  return plan;
}

describe("计划共用详情与编辑", () => {
  it("编辑副本的名称、工单、数量和物料后统一保存，不改产品共享BOM", async () => {
    const plan = editPlan();
    const originalRequirement = requirements(plan);
    const another = { ...state.value.workOrders[0]!, id: "WO-ANOTHER", name: "另一工单" };
    state.value.workOrders.push(another);
    wrapper = mount(PlanDetails, { props: { plan, editable: true }, global });
    await flushPromises();
    await wrapper.get('input[maxlength="60"]').setValue("编辑后的计划");
    wrapper.getComponent(ElSelect).vm.$emit("update:modelValue", another.id);
    const quantity = wrapper
      .findAllComponents(ElInputNumber)
      .find((input) => input.props("ariaLabel") === "计划数量")!;
    quantity.vm.$emit("update:modelValue", 3);
    await nextTick();
    const removedId = wrapper.getComponent(ElTableV2).props("data")[0].material;
    await click("移除");
    await click("添加物料");
    wrapper.getComponent(MaterialPicker).vm.$emit("confirm", ["M005"]);
    await nextTick();
    const firstQty = wrapper
      .findAllComponents(ElInputNumber)
      .find((input) => input.props("ariaLabel")?.endsWith("单台用量"))!;
    firstQty.vm.$emit("update:modelValue", 7);
    await nextTick();
    expect(state.value.plans[0]!.name).not.toBe("编辑后的计划");
    expect(requirements(state.value.plans[0]!)).toEqual(originalRequirement);
    await click("保存修改");
    await flushPromises();
    const saved = state.value.plans[0]!;
    expect(saved.name).toBe("编辑后的计划");
    expect(saved.workOrder).toBe(another.id);
    expect(saved.qty).toBe(3);
    expect(saved.bom!.some((line) => line.material === removedId)).toBe(false);
    expect(saved.bom!.some((line) => line.material === "M005")).toBe(true);
    expect(saved.bom![0]!.qty).toBe(7);
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(requirements({ ...saved, bom: undefined, qty: plan.qty })).toEqual(originalRequirement);
  });

  it("取消编辑先确认，继续编辑和放弃均不提前修改数据", async () => {
    const plan = editPlan();
    const oldName = plan.name;
    const confirm = vi
      .spyOn(ElMessageBox, "confirm")
      .mockRejectedValueOnce("cancel")
      .mockResolvedValueOnce("confirm" as never);
    wrapper = mount(PlanDetails, { props: { plan, editable: true }, global });
    await flushPromises();
    await wrapper.get('input[maxlength="60"]').setValue("未保存");
    await click("取消");
    await flushPromises();
    expect(confirm).toHaveBeenCalledOnce();
    expect(wrapper.emitted("close")).toBeUndefined();
    expect((wrapper.get('input[maxlength="60"]').element as HTMLInputElement).value).toBe("未保存");
    await click("取消");
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(state.value.plans[0]!.name).toBe(oldName);
  });

  it("只读详情不出现编辑控件，总需求计划编辑保持数量1且保存失败保留输入", async () => {
    const plan = editPlan();
    plan.qty = 1;
    plan.bom = [{ material: "M001", qty: 8 }];
    plan.importSource = { file: "total.xlsx", sheet: "机加", basis: "total", rows: [] };
    wrapper = mount(PlanDetails, { props: { plan }, global });
    await flushPromises();
    expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false);
    expect(wrapper.text()).toContain("需求量");
    expect(wrapper.text()).not.toContain("保存修改");
    wrapper.unmount();
    wrapper = mount(PlanDetails, { props: { plan, editable: true }, global });
    await flushPromises();
    expect(
      wrapper
        .findAllComponents(ElInputNumber)
        .find((input) => input.props("ariaLabel") === "计划数量")!
        .props("disabled")
    ).toBe(true);
    await wrapper.get('input[maxlength="60"]').setValue("保留失败输入");
    state.value.plans[0]!.auditStatus = "已审核";
    await click("保存修改");
    await flushPromises();
    expect(wrapper.emitted("close")).toBeUndefined();
    expect((wrapper.get('input[maxlength="60"]').element as HTMLInputElement).value).toBe(
      "保留失败输入"
    );
    expect(state.value.plans[0]!.name).not.toBe("保留失败输入");
  });
});

describe("领料库存筛选与搜索", () => {
  it("仅带出有库存BOM物料，搜索后移除按原行定位，不误删其他物料", async () => {
    const plan = state.value.plans[0]!;
    plan.bom = [
      { material: "M001", qty: 2 },
      { material: "M002", qty: 2 },
      { material: "M003", qty: 2 },
    ];
    state.value.stocks = {
      [stockKey("XC01", "M001")]: 1,
      [stockKey("BZ01", "M002")]: 2,
      [stockKey("BZ01", "M005")]: 9,
    };
    sessionStorage.setItem("wsn-selected-issue-plan", plan.id);
    wrapper = mount(Issues, { global });
    await flushPromises();
    const table = wrapper
      .findAllComponents({ name: "ElTable" })
      .find((item) => item.props("data").length > 0)!;
    expect(table.props("data").map((line: { material: string }) => line.material)).toEqual([
      "M001",
      "M002",
    ]);
    expect(table.props("data")[0].warehouse).toBe("XC01");
    const search = wrapper.get('input[placeholder="名称、编码、规格型号"]');
    await search.setValue("PI3070ig-O");
    expect(table.props("data")).toHaveLength(1);
    await click("移除");
    await search.setValue("");
    expect(table.props("data")).toEqual([{ material: "M001", warehouse: "XC01", qty: 1 }]);
  });

  it("搜索不丢失其他已填写行，提交全部明细；历史详情支持编码搜索", async () => {
    const plan = state.value.plans[0]!;
    plan.qty = 1;
    plan.bom = [
      { material: "M001", qty: 2 },
      { material: "M002", qty: 3 },
    ];
    state.value.stocks = { [stockKey("BZ01", "M001")]: 10, [stockKey("BZ01", "M002")]: 10 };
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    sessionStorage.setItem("wsn-selected-issue-plan", plan.id);
    wrapper = mount(Issues, { global });
    await flushPromises();
    await wrapper.get('input[placeholder="名称、编码、规格型号"]').setValue("PLC");
    await click("确认领料并出库");
    await flushPromises();
    expect(state.value.issues[0]!.lines).toHaveLength(2);
    expect(state.value.stocks[stockKey("BZ01", "M002")]).toBe(7);
    await click("查看详情");
    await flushPromises();
    const searches = wrapper.findAll('input[placeholder="名称、编码、规格型号"]');
    await searches.at(-1)!.setValue("M002");
    const detail = wrapper.findAllComponents({ name: "ElTable" }).at(-1)!;
    expect(detail.props("data")).toEqual([{ material: "M002", warehouse: "BZ01", qty: 3 }]);
  });
});
