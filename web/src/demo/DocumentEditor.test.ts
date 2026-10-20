import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { nextTick } from "vue";
import DocumentEditor from "./DocumentEditor.vue";
import MaterialPicker from "./MaterialPicker.vue";
import Drafts from "./Drafts.vue";
import { state } from "./store";
import PurchaseEditor from "./PurchaseEditor.vue";
import { seed, createDraft } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  sessionStorage.clear();
});
const setup = (props: {
  kind: "request" | "purchase";
  lockedLines?: { material: string; qty: number }[];
}) => {
  state.value = seed();
  wrapper = mount(DocumentEditor, {
    props,
    attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true } },
  });
  return wrapper;
};

describe("请购及采购选料", () => {
  it("弹窗跨页筛选选料后一次带入，保留已有数量且避免重复添加", async () => {
    const editor = setup({ kind: "request" });
    await editor
      .findAll("button")
      .find((b) => b.text().includes("选择物料"))!
      .trigger("click");
    await flushPromises();
    const picker = editor.getComponent(MaterialPicker);
    // 通过真实表格复选框选择，验证筛选刷新后仍保留之前的选择。
    const selectRow = async (text: string) => {
      const row = picker.findAll("tr").find((r) => r.text().includes(text))!;
      await row.get('input[type="checkbox"]').setValue(true);
      await nextTick();
    };
    await selectRow("PLC 控制器");
    await picker.get('button[aria-label="Go to next page"]').trigger("click");
    await nextTick();
    expect(picker.text()).toContain("已选 1 种物料");
    await picker.get('input[placeholder="品号、品名、图号、规格或品牌"]').setValue("MOCK-JJ-006");
    await nextTick();
    await selectRow("垫板");
    expect(picker.text()).toContain("已选 2 种物料");
    await picker
      .findAll("button")
      .find((b) => b.text().includes("添加选中物料"))!
      .trigger("click");
    expect(editor.findComponent(MaterialPicker).exists()).toBe(false);
    const quantity = editor.get('input[aria-label="PLC 控制器数量"]');
    await quantity.setValue("3");
    await quantity.trigger("change");
    await editor
      .findAll("button")
      .find((b) => b.text().includes("选择物料"))!
      .trigger("click");
    await nextTick();
    const secondPicker = editor.getComponent(MaterialPicker);
    const existingRow = secondPicker.findAll("tr").find((r) => r.text().includes("PLC 控制器"))!;
    expect(existingRow.get('input[type="checkbox"]').attributes("disabled")).toBeDefined();
    secondPicker.vm.$emit("confirm", ["M001", "M003"]);
    await nextTick();
    await editor.get("form").trigger("submit");
    expect(editor.emitted("save")?.[0]?.[0]).toMatchObject({
      lines: [
        { material: "M001", qty: 3 },
        { material: "MOCK-JJ-006", qty: 1 },
        { material: "M003", qty: 1 },
      ],
    });
  });

  it("转采购时保留完整来源明细，分页展示不会截断提交内容", async () => {
    const lockedLines = seed()
      .materials.slice(0, 25)
      .map((m) => ({ material: m.id, qty: 2 }));
    const editor = setup({ kind: "purchase", lockedLines });
    expect(editor.text()).not.toContain("选择物料");
    expect(editor.findAll('input[role="spinbutton"]')).toHaveLength(0);
    await editor.get('input[placeholder="请输入供应商名称"]').setValue("测试供应商");
    await editor.get("form").trigger("submit");
    expect(editor.emitted("save")?.[0]?.[0]).toMatchObject({ lines: lockedLines });
  });

  it("底稿按物料多选，仅将跨计划选中底稿加入采购，未选保持待采购", async () => {
    state.value = seed();
    createDraft(state.value, state.value.plans[0]!.id);
    createDraft(state.value, state.value.plans[1]!.id);
    const first = state.value.drafts[0]!;
    const second = state.value.drafts.find((d) => d.plan !== first.plan)!;
    const selectedIds = [first.id, second.id];
    const untouched = state.value.drafts
      .filter((d) => !selectedIds.includes(d.id))
      .map((d) => d.id);
    expect(untouched.length).toBeGreaterThan(0);
    wrapper = mount(Drafts, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true } },
    });
    await flushPromises();
    for (const id of selectedIds) {
      const row = wrapper.findAll("tr").find((r) => r.text().includes(id))!;
      await row.get('input[type="checkbox"]').setValue(true);
    }
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("所选底稿转采购"))!
      .trigger("click");
    await flushPromises();
    const editor = wrapper.getComponent(PurchaseEditor);
    expect(editor.props("draftIds")).toEqual(selectedIds);
    const inputs = editor.findAll(".purchase-fields input");
    await inputs[0]!.setValue("测试采购人");
    await inputs[1]!.setValue("测试供应商");
    await editor.get("form").trigger("submit");
    await flushPromises();
    const purchase = state.value.purchases[0]!;
    expect(purchase.lines.map((l) => l.draft)).toEqual(selectedIds);
    expect(purchase.plan).toBe("");
    expect(
      state.value.drafts.filter((d) => untouched.includes(d.id)).every((d) => d.status === "待采购")
    ).toBe(true);
  });
});
