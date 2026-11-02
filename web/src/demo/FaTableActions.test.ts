import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import FaTableActions from "./FaTableActions.vue";

describe("操作列展示", () => {
  it("四个操作直接显示，长名称截两字并保留完整提示及原动作", async () => {
    const action = vi.fn();
    const wrapper = mount(FaTableActions, { props: { actions: [
      { label: "查看详情", action }, { label: "编辑", action },
      { label: "安排计划", action, disabled: true }, { label: "删除", action, danger: true },
    ] }, global: { plugins: [ElementPlus] } });
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["查看", "编辑", "安排", "删除"]);
    const button = wrapper.get('button[aria-label="查看详情"]');
    expect(button.attributes("title")).toBe("查看详情");
    await button.trigger("click");
    expect(action).toHaveBeenCalledOnce();
    expect(wrapper.get('button[aria-label="安排计划"]').attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });
  it("第五项起折叠，菜单保留完整名称", () => {
    const wrapper = mount(FaTableActions, { props: { actions: ["查看详情", "编辑", "审核", "删除", "打印预览"].map((label) => ({ label, action: vi.fn() })) },
      global: { plugins: [ElementPlus], renderStubDefaultSlot: true, stubs: { ElDropdown: { template: '<div><slot /><slot name="dropdown" /></div>' }, ElDropdownMenu: true, ElDropdownItem: true } } });
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["查看", "编辑", "审核", "删除", "更多"]);
    expect(wrapper.text()).toContain("打印预览");
    wrapper.unmount();
  });
});
