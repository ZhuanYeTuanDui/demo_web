import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElTooltip } from "element-plus";
import FaTableActions from "./index.vue";

vi.mock("@/utils/checkPerm", () => ({ checkPerm: () => true }));

let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());

describe("FaTableActions", () => {
  it("用图标按钮展示常用操作，并以原文字作为提示", async () => {
    const view = vi.fn();
    wrapper = mount(FaTableActions, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          FaSvgIcon: { template: '<span class="fa-svg-icon" />' },
          FaIconButton: { template: '<span class="fa-icon-button" />' },
        },
      },
      props: {
        actions: [
          { key: "view", label: "查看", onClick: view },
          { key: "edit", label: "编辑", onClick: vi.fn() },
          { key: "copy", label: "复制草稿", onClick: vi.fn() },
          { key: "delete", label: "删除", type: "danger", onClick: vi.fn() },
        ],
      },
    });

    const tips = wrapper
      .findAllComponents(ElTooltip)
      .map((item) => item.props("content"))
      .filter(Boolean);
    expect(tips).toEqual(["查看", "编辑", "复制草稿", "更多"]);
    expect(wrapper.text()).not.toContain("查看");
    await wrapper.find('[aria-label="查看"]').trigger("click");
    expect(view).toHaveBeenCalledOnce();
    expect(wrapper.find('[aria-label="更多操作"]').exists()).toBe(true);
  });
});
