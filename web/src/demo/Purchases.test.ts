import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { state } from "./store";
import { seed, createPurchase, auditPurchase, receive } from "./model";
import PurchaseEditor from "./PurchaseEditor.vue";
import Purchases from "./Purchases.vue";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  localStorage.clear();
});
const global = {
  plugins: [ElementPlus],
  stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
};

describe("采购页面业务约束", () => {
  it("新建与重新编辑采购单均保留空金额，不用物料参考价替代", async () => {
    state.value = seed();
    wrapper = mount(PurchaseEditor, { attachTo: document.body, global });
    const inputs = wrapper.findAll(".purchase-fields input");
    await inputs[0]!.setValue("采购人");
    await inputs[1]!.setValue("供应商");
    // 从待采购请购单取料，金额字段保持未填。
    state.value.requests[0]!.status = "待采购";
    await flushPromises();
    await wrapper.get('[aria-label="选择请购单 PR202610001"] input').setValue(true);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    const order = state.value.purchases[0]!;
    expect(order.lines[0]!.amount).toBeNull();
    expect(order.amount).toBeNull();
    wrapper.unmount();
    wrapper = mount(PurchaseEditor, { props: { order }, attachTo: document.body, global });
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(state.value.purchases.find((p) => p.id === order.id)!.amount).toBeNull();
  });

  it("逐物料行录入金额，保存后编辑保留数值，清空其中一行后合计为空", async () => {
    state.value = seed();
    state.value.requests[0]!.status = "待采购";
    state.value.requests[0]!.lines = [
      { material: "M001", qty: 2 },
      { material: "M002", qty: 3 },
    ];
    wrapper = mount(PurchaseEditor, { attachTo: document.body, global });
    const inputs = wrapper.findAll(".purchase-fields input");
    await inputs[0]!.setValue("采购人");
    await inputs[1]!.setValue("供应商");
    await flushPromises();
    await wrapper.get('[aria-label="选择请购单 PR202610001"] input').setValue(true);
    await flushPromises();
    const setAmount = async (selector: string, value: string) => {
      const input = wrapper!.get(selector);
      await input.setValue(value);
      await input.trigger("change");
    };
    await setAmount('input[aria-label="PLC 控制器采购金额 request:PR202610001:0"]', "123.45");
    await setAmount('input[aria-label="触摸屏采购金额 request:PR202610001:1"]', "54.32");
    await wrapper.get("form").trigger("submit");
    const order = state.value.purchases[0]!;
    expect(order.lines.map((l) => l.amount)).toEqual([123.45, 54.32]);
    expect(order.amount).toBe(177.77);
    wrapper.unmount();
    wrapper = mount(PurchaseEditor, { props: { order }, attachTo: document.body, global });
    await flushPromises();
    const firstAmount = `input[aria-label="PLC 控制器采购金额 ${order.lines[0]!.id}"]`;
    const secondAmount = `input[aria-label="触摸屏采购金额 ${order.lines[1]!.id}"]`;
    expect((wrapper.get(firstAmount).element as HTMLInputElement).value).toBe("123.45");
    expect((wrapper.get(secondAmount).element as HTMLInputElement).value).toBe("54.32");
    await setAmount(secondAmount, "");
    await wrapper.get("form").trigger("submit");
    const edited = state.value.purchases.find((p) => p.id === order.id)!;
    expect(edited.lines.map((l) => l.amount)).toEqual([123.45, null]);
    expect(edited.amount).toBeNull();
  });

  it("已审核采购单不显示编辑，部分收货后反审核按钮禁用", async () => {
    state.value = seed();
    const order = createPurchase(state.value, {
      buyer: "采购人",
      supplier: "供应商",
      lines: [{ material: "M001", qty: 3 }],
    });
    auditPurchase(state.value, order.id);
    receive(state.value, order.id, "BZ01", [{ lineId: order.lines[0]!.id, qty: 1 }]);
    wrapper = mount(Purchases, { attachTo: document.body, global });
    await flushPromises();
    const row = wrapper.findAll("tr").find((r) => r.text().includes(order.id))!;
    expect(row.text()).not.toContain("编辑 / 添加");
    expect(row.text()).toContain("部分收货");
    const unaudit = row.findAll("button").find((b) => b.text() === "反审核")!;
    expect(unaudit.attributes("disabled")).toBeDefined();
    await unaudit.trigger("click");
    expect(state.value.purchases.find((p) => p.id === order.id)!.status).toBe("已审核");
  });
});
