import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { createPinia } from "pinia";
import FaManagementList from "./index.vue";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());

function setup() {
  wrapper = mount(FaManagementList, {
    global: { plugins: [ElementPlus, createPinia()] },
    props: { rows: [{ id: 1, name: "设备一" }], total: 21 },
    slots: {
      filters: '<el-form-item label="名称"><el-input /></el-form-item>',
      default: '<el-table-column prop="name" label="名称" />',
    },
  });
}

describe("FaManagementList", () => {
  it("统一渲染筛选、工具栏、表格和精简分页", () => {
    setup();
    expect(wrapper.text()).toContain("查询");
    expect(wrapper.text()).toContain("新增");
    expect(wrapper.text()).toContain("批量删除");
    expect(wrapper.find(".table-card").exists()).toBe(true);
    expect(wrapper.find('[id^="fa-table-header-"]').exists()).toBe(true);
    expect(wrapper.find(".el-pagination__jump").exists()).toBe(false);
  });

  it("公共表格工具栏触发刷新事件", async () => {
    setup();
    const toolButtons = wrapper.findAll('[role="button"]');
    expect(toolButtons.length).toBeGreaterThanOrEqual(2);
    await toolButtons[1]!.trigger("click");
    expect(wrapper.emitted("refresh")?.[0]).toEqual([{ page: 1, pageSize: 10 }]);
  });

  it("查询和分页变化输出统一事件", async () => {
    setup();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("查询"))!
      .trigger("click");
    await flushPromises();
    expect(wrapper.emitted("search")?.[0]).toEqual([{ page: 1, pageSize: 10 }]);
    const exposed = wrapper.vm as unknown as { clearSelection: () => void };
    expect(typeof exposed.clearSelection).toBe("function");
  });

  it("选择行后批量删除输出稳定主键和行数据", async () => {
    setup();
    wrapper
      .findComponent({ name: "ElTable" })
      .vm.$emit("selection-change", [{ id: 1, name: "设备一" }]);
    await flushPromises();
    const remove = wrapper.findAll("button").find((button) => button.text().includes("批量删除"))!;
    expect(remove.attributes("disabled")).toBeUndefined();
    await remove.trigger("click");
    expect(wrapper.emitted("batchDelete")?.[0]).toEqual([[1], [{ id: 1, name: "设备一" }]]);
  });

  it("配置列渲染业务插槽，保留树形设置且筛选重置到第一页", async () => {
    wrapper = mount(FaManagementList, {
      global: { plugins: [ElementPlus, createPinia()] },
      props: {
        page: 3,
        rows: [{ id: 1, name: "测试客户", children: [] }],
        total: 30,
        tableProps: { treeProps: { children: "children" }, defaultExpandAll: true },
        columns: [{ prop: "name", label: "客户", useSlot: true, slotName: "customer-name" }],
      },
      slots: {
        "customer-name":
          '<template #customer-name="{ row }"><strong>{{ row.name }}</strong></template>',
      },
    });
    await flushPromises();
    const table = wrapper.findComponent({ name: "ElTable" });
    expect(table.props("treeProps")).toEqual({ children: "children" });
    expect(table.props("defaultExpandAll")).toBe(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("查询"))!
      .trigger("click");
    expect(wrapper.emitted("search")?.[0]).toEqual([{ page: 1, pageSize: 10 }]);
  });
});
