import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import ElementPlus, { ElPagination, ElTableV2 } from "element-plus";
import PlanMaterialsTable from "./PlanMaterialsTable.vue";
import { seed, type Plan } from "./model";
import { state } from "./store";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  state.value = seed();
});

describe("生产计划大量物料", () => {
  it("100/200/500 分页与真实虚拟渲染同时生效，滚动只替换视口行", async () => {
    state.value = seed();
    const bom = Array.from({ length: 520 }, (_, index) => {
      const material = `VIRTUAL-${index}`;
      state.value.materials.push({
        id: material,
        name: `测试物料 ${index}`,
        spec: `SPEC-${index}`,
        unit: "个",
        price: 0,
      });
      return { material, qty: index + 1 };
    });
    const plan: Plan = { ...state.value.plans[0]!, bom };
    wrapper = mount(PlanMaterialsTable, {
      props: { plan },
      global: {
        plugins: [ElementPlus],
        stubs: {
          // jsdom 无真实布局，只固定测量容器；表格与虚拟列表仍使用真实实现。
          ElAutoResizer: defineComponent({
            template: '<div><slot :width="800" :height="400" /></div>',
          }),
        },
      },
    });
    await flushPromises();
    const pagination = wrapper.getComponent(ElPagination);
    expect(pagination.props("pageSize")).toBe(100);
    expect(pagination.props("total")).toBe(520);
    expect(wrapper.getComponent(ElTableV2).props("data")).toHaveLength(100);
    expect(wrapper.findAll(".plan-material-name").length).toBeGreaterThan(0);
    expect(wrapper.findAll(".plan-material-name").length).toBeLessThan(30);
    pagination.vm.$emit("update:current-page", 2);
    await nextTick();
    expect(wrapper.getComponent(ElTableV2).props("data")[0].material).toBe("VIRTUAL-100");
    pagination.vm.$emit("update:page-size", 200);
    await nextTick();
    expect(pagination.props("currentPage")).toBe(1);
    expect(wrapper.getComponent(ElTableV2).props("data")).toHaveLength(200);
    pagination.vm.$emit("update:page-size", 500);
    await nextTick();
    expect(wrapper.getComponent(ElTableV2).props("data")).toHaveLength(500);
    expect(wrapper.findAll(".plan-material-name").length).toBeLessThan(30);
    (
      wrapper.getComponent(ElTableV2).vm.$.exposed as {
        scrollToRow: (row: number, strategy: string) => void;
      }
    ).scrollToRow(499, "end");
    await nextTick();
    expect(wrapper.text()).toContain("测试物料 499");
    expect(wrapper.text()).not.toContain("测试物料 0");
    expect(wrapper.findAll(".plan-material-name").length).toBeLessThan(30);
    pagination.vm.$emit("update:current-page", 2);
    await nextTick();
    expect(wrapper.getComponent(ElTableV2).props("data")).toHaveLength(20);
    await wrapper.setProps({ plan: { ...plan, id: "ANOTHER" } });
    expect(pagination.props("currentPage")).toBe(1);
  });
});
