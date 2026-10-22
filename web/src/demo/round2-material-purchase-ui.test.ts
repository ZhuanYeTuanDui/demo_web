import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElMessageBox } from "element-plus";
import Materials from "./Materials.vue";
import PurchaseEditor from "./PurchaseEditor.vue";
import PurchaseSourcePicker from "./PurchaseSourcePicker.vue";
import FaTableActions from "./FaTableActions.vue";
import { state } from "./store";
import { auditDraft, createDraft, createPurchase, seed } from "./model";

let wrapper: VueWrapper | undefined;
const global = {
  plugins: [ElementPlus],
  stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
};
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
async function click(text: string, root: Pick<VueWrapper, "findAll"> = wrapper!) {
  await root.findAll("button").find((button) => button.text() === text)!.trigger("click");
  await flushPromises();
}
async function choose(label: string) {
  await wrapper!.get(`[aria-label="${label}"] input`).setValue(true);
}
async function confirmSources() {
  await wrapper!.findAll("button").find((button) => button.text().startsWith("确认取单"))!.trigger("click");
  await flushPromises();
}

describe("物料维护与采购取单交互", () => {
  it("新增物料后可停用、恢复和删除；有库存的物料删除失败仍保留", async () => {
    state.value = seed();
    const stocks = JSON.stringify(state.value.stocks);
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as unknown as Awaited<ReturnType<typeof ElMessageBox.confirm>>);
    wrapper = mount(Materials, { attachTo: document.body, global });
    await click("新增物料");
    await wrapper.get('input[aria-label="新增物料品号"]').setValue("NEW-UI-01");
    await wrapper.get('input[aria-label="新增物料品名"]').setValue("界面新增物料");
    await wrapper.get('input[aria-label="新增物料单位"]').setValue("个");
    await click("保存物料");
    expect(state.value.materials.find((item) => item.id === "NEW-UI-01")?.name).toBe("界面新增物料");
    const run = async (label: string) => {
      wrapper!.getComponent(FaTableActions).props("actions").find((action) => action.label === label)!.action();
      await flushPromises();
    };
    await run("停用");
    expect(state.value.materials.find((item) => item.id === "NEW-UI-01")?.details?.inactive).toBe(true);
    await run("恢复");
    expect(state.value.materials.find((item) => item.id === "NEW-UI-01")?.details?.inactive).toBe(false);
    await run("删除");
    expect(state.value.materials.some((item) => item.id === "NEW-UI-01")).toBe(false);
    await wrapper.get('input[placeholder="品号、品名或规格"]').setValue("M001");
    await flushPromises();
    await run("删除");
    expect(state.value.materials.some((item) => item.id === "M001")).toBe(true);
    expect(JSON.stringify(state.value.stocks)).toBe(stocks);
  });

  it("物料详情修改沿用原档案字段并保存，品号和库存保持不变", async () => {
    state.value = seed();
    const stocks = JSON.stringify(state.value.stocks);
    wrapper = mount(Materials, { props: { materialId: "M001" }, attachTo: document.body, global });
    await click("编辑资料");
    await wrapper.get('input[placeholder="请输入品名"]').setValue("修改后的控制器");
    await click("保存修改");
    expect(state.value.materials.find((item) => item.id === "M001")?.name).toBe("修改后的控制器");
    expect(JSON.stringify(state.value.stocks)).toBe(stocks);
    expect(wrapper.text()).toContain("基本标识");
    expect(wrapper.text()).toContain("补货控制");
  });

  it("取单取消不带入；跨底稿和请购确认带入且保留已有采购行编辑", async () => {
    state.value = seed();
    const draft = createDraft(state.value, state.value.plans[0]!.id);
    auditDraft(state.value, draft.id);
    const sourceBefore = JSON.stringify({ drafts: state.value.drafts, requests: state.value.requests });
    const order = createPurchase(state.value, {
      buyer: "采购", supplier: "供应商", lines: [{ material: "M005", qty: 2 }],
    });
    wrapper = mount(PurchaseEditor, { props: { order }, attachTo: document.body, global });
    await flushPromises();
    await wrapper.get(`input[aria-label="备注 ${order.lines[0]!.id}"]`).setValue("保留手工备注");
    await click("取单");
    await choose(`选择底稿物料 ${draft.id} ${draft.lines[0]!.id}`);
    expect(wrapper.text()).toContain("共 1 条明细");
    await click("取消", wrapper.getComponent(PurchaseSourcePicker));
    expect(wrapper.findComponent(PurchaseSourcePicker).exists()).toBe(false);
    expect(wrapper.text()).toContain("共 1 条明细");
    await click("取单");
    expect(wrapper.get(`[aria-label="选择底稿物料 ${draft.id} ${draft.lines[0]!.id}"] input`).element).toHaveProperty("checked", false);
    await choose(`选择底稿物料 ${draft.id} ${draft.lines[0]!.id}`);
    await wrapper.findAll('[role="tab"]').find((tab) => tab.text() === "请购单")!.trigger("click");
    await choose("选择请购物料 PR202610001 0");
    await confirmSources();
    expect(wrapper.text()).toContain("共 3 条明细");
    expect(wrapper.get(`input[aria-label="备注 ${order.lines[0]!.id}"]`).element).toHaveProperty("value", "保留手工备注");
    await click("取单");
    expect(wrapper.get(`[aria-label="选择底稿物料 ${draft.id} ${draft.lines[0]!.id}"] input`).attributes("disabled")).toBeDefined();
    await click("取消", wrapper.getComponent(PurchaseSourcePicker));
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const saved = state.value.purchases.find((item) => item.id === order.id)!;
    expect(saved.lines).toHaveLength(3);
    expect(saved.lines[0]!.remark).toBe("保留手工备注");
    expect(JSON.stringify({ drafts: state.value.drafts, requests: state.value.requests })).toBe(sourceBefore);
  });
});
