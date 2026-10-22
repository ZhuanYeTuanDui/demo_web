import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElMessageBox } from "element-plus";
import FinishedInbounds from "./FinishedInbounds.vue";
import { state } from "./store";
import { seed, stockKey, createFinishedInbound, shipWorkOrder, workOrderShipmentLines } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
function setup() {
  state.value = seed();
  wrapper = mount(FinishedInbounds, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
    },
  });
}
async function click(label: string) {
  await wrapper!
    .findAll("button")
    .find((b) => b.text() === label)!
    .trigger("click");
  await flushPromises();
}
async function selectOrder() {
  const order = state.value.workOrders[0]!;
  const select = wrapper!
    .findAllComponents({ name: "ElSelect" })
    .find((c) => c.attributes("placeholder") === "选择未发货工单")!;
  select.vm.$emit("update:modelValue", order.id);
  select.vm.$emit("change", order.id);
  await flushPromises();
  return order;
}
describe("工单成品入库页面", () => {
  it("统一显示成品入库与自动出库，按类型筛选并追溯来源发货单", async () => {
    setup();
    const order = state.value.workOrders[0]!;
    order.status = "待出货";
    createFinishedInbound(state.value, { workOrder: order.id, warehouse: "CP01", lines: workOrderShipmentLines(state.value, order.id) });
    const shipment = shipWorkOrder(state.value, order.id, { carrier: "物流", tracking: "TEST-OUT" });
    await flushPromises();
    expect(wrapper!.getComponent({ name: "ElTable" }).props("data")).toHaveLength(2);
    wrapper!.findAllComponents({ name: "ElSelect" }).find(c => c.attributes("placeholder") === "全部类型")!.vm.$emit("update:modelValue", "出库");
    await flushPromises();
    const documents = wrapper!.getComponent({ name: "ElTable" }).props("data");
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({ type: "出库", shipment: shipment.id });
    await click(documents[0].id);
    expect(wrapper!.text()).toContain("成品出库单详情");
    expect(wrapper!.text()).toContain("来源发货单");
    const sourceLinks = wrapper!.findAll("button").filter(b => b.text() === shipment.id);
    await sourceLinks.at(-1)!.trigger("click");
    expect(sessionStorage.getItem("wsn-shipment-detail")).toBe(shipment.id);
    expect(wrapper!.emitted("navigate")!.at(-1)).toEqual(["shipments"]);
  });
  it("关联工单带出成品，取消确认不入库，确认后单据与库存流水仅保存一次", async () => {
    setup();
    await click("新增成品入库单");
    const order = await selectOrder();
    const before = state.value.stocks[stockKey("CP01", order.product)] || 0;
    const confirm = vi.spyOn(ElMessageBox, "confirm").mockRejectedValueOnce("cancel");
    await click("确认入库");
    expect(state.value.finishedInbounds || []).toHaveLength(0);
    expect(state.value.stocks[stockKey("CP01", order.product)] || 0).toBe(before);
    confirm.mockResolvedValue("confirm" as never);
    await click("确认入库");
    const inbound = state.value.finishedInbounds![0]!;
    expect(inbound.workOrder).toBe(order.id);
    expect(inbound.lines).toEqual([{ material: order.product, qty: order.qty }]);
    expect(state.value.stocks[stockKey("CP01", order.product)]).toBe(before + order.qty);
    expect(state.value.movements.filter((m) => m.source === inbound.id)).toHaveLength(1);
    expect(state.value.plans.some((p) => p.status === "已完工")).toBe(false);
  });
  it("工单为空时明确报错，放弃编辑不产生单据", async () => {
    setup();
    await click("新增成品入库单");
    await click("确认入库");
    expect(wrapper!.text()).toContain("请选择工单、成品仓库、日期");
    expect(state.value.finishedInbounds || []).toHaveLength(0);
    await selectOrder();
    const confirm = vi.spyOn(ElMessageBox, "confirm").mockRejectedValueOnce("cancel");
    await click("取消");
    expect(wrapper!.find('input[aria-label="入库数量 1"]').exists()).toBe(true);
    confirm.mockResolvedValue("confirm" as never);
    await click("取消");
    expect(state.value.finishedInbounds || []).toHaveLength(0);
  });
});
