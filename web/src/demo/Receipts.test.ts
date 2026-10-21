import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElMessageBox, ElSelect } from "element-plus";
import Receipts from "./Receipts.vue";
import FaTableActions from "./FaTableActions.vue";
import { state } from "./store";
import { seed, createPurchase, auditPurchase, receiptRemaining, stockKey } from "./model";
type ConfirmationResult = Awaited<ReturnType<typeof ElMessageBox.confirm>>;
const confirmation = "confirm" as unknown as ConfirmationResult;
let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});
const setup = () => {
  state.value = seed();
  const order = createPurchase(state.value, {
    buyer: "采购",
    supplier: "供应商",
    lines: [{ material: "M001", qty: 10 }],
  });
  auditPurchase(state.value, order.id);
  wrapper = mount(Receipts, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true, ElDropdown: true, ElSelect: true, ElOption: true },
    },
  });
  return order;
};
const click = async (text: string) => {
  await wrapper!
    .findAll("button")
    .find((button) => button.text() === text)!
    .trigger("click");
  await flushPromises();
};
const setQty = async (lineId: string, qty: string) => {
  const input = wrapper!.get(`input[aria-label="收货数量 ${lineId}"]`);
  await input.setValue(qty);
  await input.trigger("change");
};
describe("采购两阶段收货", () => {
  it("点击新增可打开空表单，创建只预占数量、物流保存，改量不改资料，确认实收释放差额", async () => {
    const order = setup();
    const stockBefore = state.value.stocks[stockKey("BZ01", "M001")];
    await click("新增待收货单");
    expect(wrapper!.text()).toContain("新增待收货单");
    wrapper!
      .findAllComponents({ name: "ElSelect" })
      .find((component) => component.attributes("placeholder")?.includes("选择已审核"))!
      .vm.$emit("update:modelValue", order.id);
    await flushPromises();
    const textInputs = wrapper!.findAll(".receipt-fields .el-form-item");
    await textInputs[2]!.get("input").setValue("顺丰");
    await textInputs[3]!.get("input").setValue("SF001");
    await setQty(order.lines[0]!.id, "6");
    await click("保存待收货单");
    const receipt = state.value.receipts[0]!;
    expect(receipt).toMatchObject({ status: "待收货", carrier: "顺丰", tracking: "SF001" });
    expect(state.value.stocks[stockKey("BZ01", "M001")]).toBe(stockBefore);
    expect(receiptRemaining(state.value, order.id)[0]!.qty).toBe(4);
    const rowActions = () =>
      wrapper!
        .findAllComponents(FaTableActions)
        .find((component) =>
          component.props("actions").some((action) => action.label === "修改数量")
        )!
        .props("actions");
    rowActions()
      .find((action) => action.label === "修改数量")!
      .action();
    await flushPromises();
    expect(
      wrapper!
        .findAll(".receipt-fields input")
        .every((input) => input.attributes("disabled") !== undefined)
    ).toBe(true);
    await setQty(order.lines[0]!.id, "5");
    await click("保存待收货单");
    expect(state.value.receipts[0]!.carrier).toBe("顺丰");
    expect(receiptRemaining(state.value, order.id)[0]!.qty).toBe(5);
    rowActions()
      .find((action) => action.label === "确认收货")!
      .action();
    await flushPromises();
    await setQty(order.lines[0]!.id, "3");
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue(confirmation);
    await click("确认收货并入库");
    expect(state.value.receipts[0]!.status).toBe("已收货");
    expect(state.value.stocks[stockKey("BZ01", "M001")]).toBe(stockBefore! + 3);
    expect(receiptRemaining(state.value, order.id)[0]!.qty).toBe(7);
    expect(state.value.inbounds.filter((inbound) => inbound.receipt === receipt.id)).toHaveLength(
      1
    );
    expect(wrapper!.text()).not.toContain("修改数量");
  });
});
