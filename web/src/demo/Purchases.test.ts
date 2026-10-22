import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElMessageBox } from "element-plus";
import { state } from "./store";
import { seed, createPurchase, createDraft, auditDraft, purchaseLineAmount } from "./model";
import PurchaseEditor from "./PurchaseEditor.vue";
import Purchases from "./Purchases.vue";
import FaTableActions from "./FaTableActions.vue";
type ConfirmationResult = Awaited<ReturnType<typeof ElMessageBox.confirm>>;
const confirmation = "confirm" as unknown as ConfirmationResult;
let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});
const global = {
  plugins: [ElementPlus],
  stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
};
const selectRequest = async (index: number) => {
  await wrapper!.findAll("button").find((button) => button.text() === "取单")!.trigger("click");
  await flushPromises();
  await wrapper!.findAll('[role="tab"]').find((tab) => tab.text() === "请购单")!.trigger("click");
  await wrapper!.get(`[aria-label="选择请购物料 PR202610001 ${index}"] input`).setValue(true);
  await wrapper!.findAll("button").find((button) => button.text().startsWith("确认取单"))!.trigger("click");
  await flushPromises();
};
const inputNumber = async (label: string, value: string) => {
  const input = wrapper!.get(`input[aria-label="${label}"]`);
  await input.setValue(value);
  await input.trigger("change");
};
async function fillHeader() {
  const inputs = wrapper!.findAll(".purchase-fields input");
  await inputs[0]!.setValue("采购人");
  await inputs[1]!.setValue("供应商");
}

describe("采购来源编辑与审核", () => {
  it("请购单按行取料，少买多买均允许且来源数量不变，再次取料仍显示完整要求量", async () => {
    state.value = seed();
    state.value.requests[0]!.lines = [
      { material: "M001", qty: 2 },
      { material: "M002", qty: 3 },
    ];
    wrapper = mount(PurchaseEditor, { attachTo: document.body, global });
    await fillHeader();
    await selectRequest(0);
    expect(wrapper.text()).toContain("共 1 条明细");
    await inputNumber("采购数量 request:PR202610001:0", "5");
    await inputNumber("含税单价 request:PR202610001:0", "12.34");
    await wrapper.get('input[aria-label="备注 request:PR202610001:0"]').setValue("单独包装");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    const order = state.value.purchases[0]!;
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({
      qty: 5,
      unitPrice: 12.34,
      remark: "单独包装",
      request: "PR202610001",
      requestLine: "0",
    });
    expect(purchaseLineAmount(order.lines[0]!)).toBe(61.7);
    expect(state.value.requests[0]!.lines.map((line) => line.qty)).toEqual([2, 3]);
    wrapper.unmount();
    wrapper = mount(PurchaseEditor, { attachTo: document.body, global });
    await selectRequest(0);
    expect(
      (
        wrapper.get('input[aria-label="采购数量 request:PR202610001:0"]')
          .element as HTMLInputElement
      ).value
    ).toBe("2");
  });

  it("仅已审核底稿可取料，已取过来源可再次选择", async () => {
    state.value = seed();
    const draft = createDraft(state.value, state.value.plans[0]!.id);
    wrapper = mount(PurchaseEditor, { attachTo: document.body, global });
    await wrapper.findAll("button").find((button) => button.text() === "取单")!.trigger("click");
    await flushPromises();
    expect(
      wrapper.find(`[aria-label="选择底稿物料 ${draft.id} ${draft.lines[0]!.id}"]`).exists()
    ).toBe(false);
    auditDraft(state.value, draft.id);
    await flushPromises();
    const line = draft.lines[0]!;
    createPurchase(state.value, {
      buyer: "旧采购",
      supplier: "供应商",
      draftLines: [{ draftId: draft.id, lineId: line.id }],
    });
    await flushPromises();
    await wrapper.get(`[aria-label="选择底稿物料 ${draft.id} ${line.id}"] input`).setValue(true);
    await wrapper.findAll("button").find((button) => button.text().startsWith("确认取单"))!.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("共 1 条明细");
    expect(draft.lines[0]!.qty).toBe(line.qty);
  });

  it("重新编辑可移除全部旧行再添加新来源，保存原子更新，取消保留已保存数据", async () => {
    state.value = seed();
    const order = createPurchase(state.value, {
      buyer: "采购",
      supplier: "供应商",
      lines: [{ material: "M005", qty: 2 }],
    });
    const before = JSON.stringify(state.value.purchases);
    wrapper = mount(PurchaseEditor, { props: { order }, attachTo: document.body, global });
    await flushPromises();
    await wrapper.get(`button[aria-label="移除采购明细 ${order.lines[0]!.id}"]`).trigger("click");
    await selectRequest(0);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "取消")!
      .trigger("click");
    expect(JSON.stringify(state.value.purchases)).toBe(before);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(state.value.purchases.find((item) => item.id === order.id)!.lines[0]!.request).toBe(
      "PR202610001"
    );
  });

  it("采购审核数量差异可取消或确认继续，界面不含收货入口", async () => {
    state.value = seed();
    const order = createPurchase(state.value, {
      buyer: "采购",
      supplier: "供应商",
      requestLines: [{ requestId: "PR202610001", lineIndex: 0 }],
      lineEdits: { "request:PR202610001:0": { qty: 5 } },
    });
    const confirm = vi
      .spyOn(ElMessageBox, "confirm")
      .mockRejectedValueOnce("cancel")
      .mockResolvedValueOnce(confirmation);
    wrapper = mount(Purchases, { attachTo: document.body, global });
    expect(wrapper.text()).not.toContain("收货管理");
    await flushPromises();
    const rowActions = wrapper
      .findAllComponents(FaTableActions)
      .find((component) => component.props("actions").some((action) => action.label === "审核"))!;
    await rowActions
      .props("actions")
      .find((action) => action.label === "审核")!
      .action();
    expect(state.value.purchases.find((item) => item.id === order.id)!.status).toBe("未审核");
    await rowActions
      .props("actions")
      .find((action) => action.label === "审核")!
      .action();
    expect(state.value.purchases.find((item) => item.id === order.id)!.status).toBe("已审核");
    expect(confirm.mock.calls[0]![0]).toContain("来源 PR202610001");
    expect(confirm.mock.calls[0]![0]).toContain("本次采购 5");
    expect(wrapper.text()).not.toContain("办理收货");
  });

  it("确认审核期间数量变化会阻止沿用旧确认", async () => {
    state.value = seed();
    const order = createPurchase(state.value, {
      buyer: "采购",
      supplier: "供应商",
      requestLines: [{ requestId: "PR202610001", lineIndex: 0 }],
      lineEdits: { "request:PR202610001:0": { qty: 5 } },
    });
    let resolve!: (value: ConfirmationResult) => void;
    vi.spyOn(ElMessageBox, "confirm").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    wrapper = mount(Purchases, { attachTo: document.body, global });
    await flushPromises();
    const actions = wrapper
      .findAllComponents(FaTableActions)
      .find((component) => component.props("actions").some((action) => action.label === "审核"))!
      .props("actions");
    const pending = actions.find((action) => action.label === "审核")!.action();
    state.value.requests[0]!.lines[0]!.qty += 1;
    resolve(confirmation);
    await pending;
    expect(state.value.purchases.find((item) => item.id === order.id)!.status).toBe("未审核");
  });
});
