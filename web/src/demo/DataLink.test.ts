import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import DataLink from "./DataLink.vue";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

describe("数据文字链接", () => {
  it("普通点击打开详情，拖选文字时不打开", async () => {
    const wrapper = mount(DataLink, {
      props: { href: "#materials/M001" },
      slots: { default: "PLC 控制器" },
      attachTo: document.body,
    });
    await wrapper.get("a").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    const range = document.createRange();
    range.selectNodeContents(wrapper.get("a").element);
    window.getSelection()!.addRange(range);
    await wrapper.get("a").trigger("click");
    expect(window.getSelection()!.toString()).toBe("PLC 控制器");
    expect(wrapper.emitted("click")).toHaveLength(1);
    wrapper.unmount();
  });

  it("抽屉入口可用键盘按钮语义，页面链接保留修饰键默认导航", async () => {
    const drawer = mount(DataLink, { slots: { default: "PO001" } });
    expect(drawer.get("button").attributes("type")).toBe("button");
    await drawer.get("button").trigger("click");
    expect(drawer.emitted("click")).toHaveLength(1);
    drawer.unmount();
    const link = mount(DataLink, { props: { href: "#orders" }, slots: { default: "采购单" } });
    await link.get("a").trigger("click", { ctrlKey: true });
    expect(link.emitted("click")).toBeUndefined();
    link.unmount();
  });
});
