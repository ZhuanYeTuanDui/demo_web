import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ElementPlus, { ElPagination } from "element-plus";
import Inventory from "./Inventory.vue";
import Production from "./Production.vue";
import FaManagementList from "./FaManagementList.vue";
import { state } from "./store";
import { seed } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  state.value = seed();
});
const button = (text: string) => wrapper!.findAll("button").find((item) => item.text() === text)!;

describe("后台列表布局", () => {
  it("收起筛选保留输入和结果，展开后可以重置", async () => {
    state.value = seed();
    wrapper = mount(Inventory, { props: { page: "stock" }, global: { plugins: [ElementPlus] } });
    const input = wrapper.get('input[placeholder="品号、品名或规格"]');
    await input.setValue("PLC");
    const table = wrapper.getComponent({ name: "ElTable" });
    const filteredRows = table.props("data");
    expect(filteredRows.length).toBeGreaterThan(0);
    expect(filteredRows.every((row: { name: string }) => row.name.includes("PLC"))).toBe(true);
    await button("收起筛选").trigger("click");
    expect(wrapper.get(".management-filters").isVisible()).toBe(false);
    expect(table.props("data")).toEqual(filteredRows);
    await button("展开筛选").trigger("click");
    expect((input.element as HTMLInputElement).value).toBe("PLC");
    await button("重置").trigger("click");
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(table.props("data")).toHaveLength(10);
  });

  it("调整每页条数回到首页，数据减少后不会停在空白页", async () => {
    state.value = seed();
    const plan = state.value.plans[0]!;
    state.value.plans = Array.from({ length: 25 }, (_, index) => ({ ...plan, id: `PP-${index}` }));
    wrapper = mount(Production, { global: { plugins: [ElementPlus] } });
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === "已审核")!.trigger("click");
    const pagination = wrapper.getComponent(ElPagination);
    expect(pagination.props("pageSize")).toBe(50);
    pagination.vm.$emit("update:page-size", 10);
    await nextTick();
    pagination.vm.$emit("update:current-page", 3);
    await nextTick();
    expect(wrapper.getComponent({ name: "ElTable" }).props("data")).toHaveLength(5);
    pagination.vm.$emit("update:page-size", 20);
    await nextTick();
    expect(pagination.props("currentPage")).toBe(1);
    expect(wrapper.getComponent({ name: "ElTable" }).props("data")).toHaveLength(20);
    pagination.vm.$emit("update:current-page", 2);
    await nextTick();
    state.value.plans = state.value.plans.slice(0, 2);
    await nextTick();
    expect(pagination.props("currentPage")).toBe(1);
    expect(wrapper.getComponent({ name: "ElTable" }).props("data")).toHaveLength(2);
  });

  it("扩展列表可用 Escape 退出，中文输入法确认不会触发查询", async () => {
    wrapper = mount(FaManagementList, {
      props: { filterable: true },
      global: { plugins: [ElementPlus] },
    });
    await wrapper.get("form").trigger("keydown", { key: "Enter", isComposing: true });
    expect(wrapper.emitted("search")).toBeUndefined();
    await button("扩展列表").trigger("click");
    expect(button("退出扩展").exists()).toBe(true);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(button("扩展列表").exists()).toBe(true);
  });
});
