import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { nextTick } from "vue";
import DocumentEditor from "./DocumentEditor.vue";
import MaterialPicker from "./MaterialPicker.vue";
import Drafts from "./Drafts.vue";
import { state } from "./store";
import PurchaseEditor from "./PurchaseEditor.vue";
import CachedDrawer from "./CachedDrawer.vue";
import { seed, createDraft, createPurchase, auditDraft } from "./model";

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
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
    },
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

  it("采购单逐行选取跨计划底稿，不改变来源明细", async () => {
    state.value = seed();
    createDraft(state.value, state.value.plans[0]!.id);
    createDraft(state.value, state.value.plans[1]!.id);
    const first = state.value.drafts[0]!;
    const second = state.value.drafts.find((d) => d.plan !== first.plan)!;
    const selectedIds = [first.id, second.id];
    const selectedLines = [first.lines[0]!, second.lines[0]!];
    const untouched = state.value.drafts
      .flatMap((d) => d.lines)
      .filter((l) => !selectedLines.some((chosen) => chosen.id === l.id))
      .map((l) => l.id);
    expect(untouched.length).toBeGreaterThan(0);
    auditDraft(state.value, first.id);
    auditDraft(state.value, second.id);
    wrapper = mount(PurchaseEditor, {
      props: { draftIds: selectedIds },
      attachTo: document.body,
      global: {
        plugins: [ElementPlus],
        stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
      },
    });
    await flushPromises();
    const editor = wrapper;
    expect(editor.text()).toContain("共 0 条明细");
    await editor.findAll("button").find((button) => button.text() === "取单")!.trigger("click");
    await flushPromises();
    for (const draft of [first, second]) {
      await editor
        .get(`[aria-label="选择底稿 ${draft.id}"] input`)
        .setValue(true);
    }
    await editor.findAll("button").find((button) => button.text().startsWith("确认取单"))!.trigger("click");
    await flushPromises();
    expect(editor.text()).toContain("共 0 条明细");
    for (const draft of [first, second]) {
      await editor.findAll('[role="tab"]').find(tab => tab.text() === draft.id)!.trigger("click");
      await editor.get(`[aria-label="选择底稿物料 ${draft.id} ${draft.lines[0]!.id}"] input`).setValue(true);
    }

    const inputs = editor.findAll(".purchase-fields input");
    await inputs[0]!.setValue("测试采购人");
    await inputs[1]!.setValue("测试供应商");
    await editor.get("form").trigger("submit");
    await flushPromises();
    const purchase = state.value.purchases[0]!;
    expect(purchase.lines.map((l) => l.draft)).toEqual(selectedIds);
    expect(purchase.lines.map((l) => l.draftLine)).toEqual(selectedLines.map((l) => l.id));
    expect(purchase.plan).toBe("");
    expect(
      state.value.drafts
        .flatMap((d) => d.lines)
        .filter((l) => untouched.includes(l.id))
        .every((l) => l.status === "待采购")
    ).toBe(true);
    expect(
      state.value.drafts.some(
        (d) => d.lines.some((l) => l.status === "待采购") && d.status === "已转采购"
      )
    ).toBe(false);
  });
  it("已被采购取用的已审核底稿物料仍允许重复选择", async () => {
    state.value = seed();
    const draft = createDraft(state.value, state.value.plans[0]!.id);
    auditDraft(state.value, draft.id);
    const transferred = draft.lines[0]!;
    createPurchase(state.value, {
      buyer: "采购",
      supplier: "供应商",
      draftLines: [{ draftId: draft.id, lineId: transferred.id }],
    });
    wrapper = mount(PurchaseEditor, {
      props: { draftIds: [draft.id] },
      attachTo: document.body,
      global: {
        plugins: [ElementPlus],
        stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
      },
    });
    await flushPromises();
    await wrapper.findAll("button").find((button) => button.text() === "取单")!.trigger("click");
    await flushPromises();
    await wrapper.get(`[aria-label="选择底稿 ${draft.id}"] input`).setValue(true);
    await wrapper.findAll("button").find(button => button.text().startsWith("确认取单"))!.trigger("click");
    await flushPromises();

    expect(
      wrapper
        .get(`[aria-label="选择底稿物料 ${draft.id} ${transferred.id}"] input`)
        .attributes("disabled")
    ).toBeUndefined();
    expect(
      wrapper
        .get(`[aria-label="选择底稿物料 ${draft.id} ${draft.lines[1]!.id}"] input`)
        .attributes("disabled")
    ).toBeUndefined();
    expect(wrapper.text()).toContain("共 0 条明细");
    expect(state.value.drafts[0]!.status).toBe("待采购");
  });
  it("底稿详情保留完整快照字段与物料身份，分页不改变明细", async () => {
    state.value = seed();
    const draft = createDraft(state.value, state.value.plans[0]!.id);
    const sample = draft.lines[0]!;
    draft.lines = state.value.materials.slice(0, 25).map((m, i) => ({
      ...sample,
      id: `DL-${i}`,
      material: m.id,
      sourceLine: `SNAPSHOT-${i + 1}`,
      reserved: 2,
      covered: 3,
    }));
    const before = JSON.stringify(draft.lines);
    sessionStorage.setItem("wsn-selected-draft", draft.id);
    wrapper = mount(Drafts, {
      attachTo: document.body,
      global: {
        plugins: [ElementPlus],
        stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true },
      },
    });
    await flushPromises();
    const drawer = wrapper.getComponent(CachedDrawer);
    for (const label of [
      "需求量",
      "库存量",
      "其他计划占用",
      "可分配量",
      "已覆盖量",
      "需购量",
      "预交货日期",
      "来源行",
    ])
      expect(drawer.text()).toContain(label);
    expect(drawer.text()).toContain("PLC 控制器");
    expect(drawer.text()).toContain("LX3V-3624MT-A");
    expect(drawer.text()).toContain("SNAPSHOT-1");
    expect(drawer.text()).not.toContain("SNAPSHOT-25");
    await drawer.get('button[aria-label="Go to next page"]').trigger("click");
    await flushPromises();
    expect(drawer.text()).toContain("SNAPSHOT-25");
    expect(JSON.stringify(state.value.drafts[0]!.lines)).toBe(before);
  });
});
