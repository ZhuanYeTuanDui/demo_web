import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import Drafts from "./Drafts.vue";
import FaTableActions from "./FaTableActions.vue";
import { state, storageError } from "./store";
import { seed, createManualDraft } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ""; localStorage.clear(); });
function setup() {
  state.value = seed();
  storageError.value = "";
  state.value.drafts = [];
  const draft = createManualDraft(state.value, { lines: [
    { material: "M001", qty: 2 }, { material: "M002", qty: 3 }, { material: "M003", qty: 4 },
  ] });
  state.value.materials.find((item) => item.id === "M002")!.details = { drawingNo: "DRAW-TWO" };
  wrapper = mount(Drafts, { attachTo: document.body, global: { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true, ElDropdown: true } } });
  return draft.id;
}
async function action(label: string) {
  await flushPromises();
  wrapper!.getComponent(FaTableActions).props("actions").find((item) => item.label === label)!.action();
  await flushPromises();
}
describe("底稿明细搜索", () => {
  it("编辑按名称图号规格搜索，过滤后移除正确行并保留隐藏数量修改", async () => {
    const id = setup();
    await action("编辑");
    const search = wrapper!.get('input[aria-label="搜索需购物料"]');
    const qty = wrapper!.get('input[aria-label="PLC 控制器需购数量"]');
    await qty.setValue("7");
    await qty.trigger("change");
    for (const query of ["m002", "触摸屏", "draw-two", "PI3070"]) {
      await search.setValue(query);
      expect(wrapper!.find('input[aria-label="触摸屏需购数量"]').exists()).toBe(true);
      expect(wrapper!.find('input[aria-label="PLC 控制器需购数量"]').exists()).toBe(false);
    }
    await wrapper!.findAll("button").find((button) => button.text() === "移除")!.trigger("click");
    await search.setValue("");
    expect((wrapper!.get('input[aria-label="PLC 控制器需购数量"]').element as HTMLInputElement).value).toBe("7");
    await search.setValue("无匹配");
    await wrapper!.findAll("button").find((button) => button.text() === "保存底稿")!.trigger("click");
    await flushPromises();
    expect(state.value.drafts.find((draft) => draft.id === id)!.lines.map((line) => [line.material, line.qty])).toEqual([["M001", 7], ["M003", 4]]);
  });
  it("详情抽屉搜索更新计数，清空恢复，重新打开清除搜索", async () => {
    setup();
    await action("详情");
    const search = wrapper!.get('input[placeholder="物料编码、名称、图号或规格"]');
    await search.setValue("m002");
    expect(wrapper!.text()).toContain("共 1 条物料");
    await search.setValue("draw-two");
    expect(wrapper!.text()).toContain("共 1 条物料");
    await search.setValue("无匹配");
    expect(wrapper!.text()).toContain("共 0 条物料");
    await search.setValue("");
    expect(wrapper!.text()).toContain("共 3 条物料");
    await search.setValue("PLC");
    wrapper!.findAllComponents({ name: "ElDrawer" })[0]!.vm.$emit("close");
    await flushPromises();
    await action("详情");
    expect(wrapper!.text()).toContain("共 3 条物料");
  });
});

