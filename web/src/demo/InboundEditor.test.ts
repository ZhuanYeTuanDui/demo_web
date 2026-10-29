import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElMessageBox } from "element-plus";
import InboundEditor from "./InboundEditor.vue";
import InboundSourcePicker from "./InboundSourcePicker.vue";
import { state } from "./store";
import { seed, createPurchase, auditPurchase } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ""; localStorage.clear(); vi.restoreAllMocks(); });
const click = async (text: string) => {
  await wrapper!.findAll("button").find((button) => button.text() === text)!.trigger("click");
  await flushPromises();
};
function setup() {
  state.value = seed();
  const orders = ["华东五金总公司", "华东五金分公司", "其他供应商"].map((supplier) => {
    const order = createPurchase(state.value, { buyer: "甲", supplier, lines: [{ material: "M001", qty: 3 }] });
    auditPurchase(state.value, order.id);
    return order;
  });
  wrapper = mount(InboundEditor, { attachTo: document.body, global: { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true } } });
  return orders;
}
describe("入库新建与取单", () => {
  it("供应商必填，模糊取单可跨单选同物料，取消不改明细，保存后同步采购", async () => {
    const orders = setup();
    expect(wrapper!.findAll("button").find((button) => button.text() === "取单")!.attributes("disabled")).toBeDefined();
    await wrapper!.get('input[placeholder^="先填写供应商"]').setValue("华东五金");
    await click("取单");
    const picker = wrapper!.getComponent(InboundSourcePicker);
    expect(picker.text()).toContain(orders[0]!.id);
    expect(picker.text()).toContain(orders[1]!.id);
    expect(picker.text()).not.toContain(orders[2]!.id);
    for (const checkbox of picker.findAll('input[type="checkbox"]')) await checkbox.setValue(true);
    await click("确认取单（2）");
    expect(wrapper!.text()).toContain("关联 2 张采购单");
    await click("取单");
    expect(wrapper!.getComponent(InboundSourcePicker).findAll('input[type="checkbox"]').every((checkbox) => checkbox.attributes("disabled") !== undefined)).toBe(true);
    await wrapper!.getComponent(InboundSourcePicker).findAll("button").find((button) => button.text() === "取消")!.trigger("click");
    await flushPromises();
    expect(wrapper!.text()).toContain("关联 2 张采购单");
    const quantity = wrapper!.get(`input[aria-label="入库数量 ${orders[0]!.id} ${orders[0]!.lines[0]!.id}"]`);
    await quantity.setValue("1");
    await quantity.trigger("change");
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    await wrapper!.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper!.emitted("saved")).toHaveLength(1);
    expect(state.value.inbounds[0]!.lines).toHaveLength(2);
    expect(state.value.purchases.find((order) => order.id === orders[0]!.id)!.lines[0]!.received).toBe(1);
    expect(state.value.purchases.find((order) => order.id === orders[0]!.id)!.receiptStatus).toBe("部分收货");
  });

  it("取消确认保留输入，切换供应商清除旧来源，取消编辑需要确认", async () => {
    setup();
    await wrapper!.get('input[placeholder^="先填写供应商"]').setValue("华东五金");
    await click("取单");
    await wrapper!.getComponent(InboundSourcePicker).findAll('input[type="checkbox"]')[0]!.setValue(true);
    await click("确认取单（1）");
    const confirm = vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
    await wrapper!.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper!.emitted("saved")).toBeUndefined();
    expect(wrapper!.text()).toContain("共 1 条明细");
    await wrapper!.get('input[placeholder^="先填写供应商"]').setValue("其他");
    expect(wrapper!.text()).toContain("共 0 条明细");
    await click("取消");
    expect(confirm).toHaveBeenCalled();
    expect(wrapper!.emitted("cancel")).toBeUndefined();
    confirm.mockResolvedValue("confirm" as never);
    await click("取消");
    expect(wrapper!.emitted("cancel")).toHaveLength(1);
  });
});
