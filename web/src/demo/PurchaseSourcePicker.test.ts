import { afterEach, expect, it } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElPagination } from "element-plus";
import PurchaseSourcePicker from "./PurchaseSourcePicker.vue";
import { state } from "./store";
import { seed, createManualDraft, auditDraft } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ""; });
it("全选仅当前页可选行，跨页筛选保留选择，已添加行跳过且不重复", async () => {
  state.value = seed();
  state.value.drafts = [];
  for (let index = 0; index < 21; index++) {
    const draft = createManualDraft(state.value, { lines: [{ material: "M001", qty: 1 }] });
    auditDraft(state.value, draft.id);
  }
  const excluded = state.value.drafts[0]!;
  const key = `draft:${excluded.id}:${excluded.lines[0]!.id}`;
  wrapper = mount(PurchaseSourcePicker, { props: { excludedKeys: [key] }, attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { teleport: true } } });
  await flushPromises();
  const click = async (text: string) => { await wrapper!.findAll("button").find((button) => button.text() === text)!.trigger("click"); await flushPromises(); };
  const selectPage = async (checked: boolean) => { await wrapper!.get('label[aria-label="全选当前页来源物料"] input').setValue(checked); await flushPromises(); };
  await selectPage(true);
  expect(wrapper.text()).toContain("已选 19 条物料");
  expect((wrapper.get('label[aria-label="全选当前页来源物料"] input').element as HTMLInputElement).checked).toBe(true);
  wrapper.getComponent(ElPagination).vm.$emit("update:current-page", 2);
  await flushPromises();
  await selectPage(true);
  expect(wrapper.text()).toContain("已选 20 条物料");
  await selectPage(false);
  expect(wrapper.text()).toContain("已选 19 条物料");
  await selectPage(true);
  await wrapper.get('input[placeholder="物料、单号、来源计划或经办人"]').setValue("无匹配");
  expect(wrapper.text()).toContain("已选 20 条物料");
  await click("确认取单（20）");
  const rows = wrapper.emitted("confirm")![0]![0] as { key: string }[];
  expect(rows).toHaveLength(20);
  expect(new Set(rows.map((row) => row.key)).size).toBe(20);
  expect(rows.some((row) => row.key === key)).toBe(false);
});
