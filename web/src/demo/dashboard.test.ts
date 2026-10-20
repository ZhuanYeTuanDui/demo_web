import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ElementPlus from "element-plus";
import Dashboard from "./Dashboard.vue";
import App from "./App.vue";
import { state } from "./store";
import { seed } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  state.value = seed();
  history.replaceState(null, "", "/");
});

describe("首页工作台与导航", () => {
  it("概览跟随业务状态更新，卡片进入对应业务页面", async () => {
    state.value = seed();
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    const card = wrapper
      .findAll(".dashboard-metric")
      .find((item) => item.text().includes("待收货采购单"))!;
    const count = state.value.purchases.filter((item) => item.status === "待入库").length;
    expect(card.get("strong").text()).toBe(`${count}笔`);
    state.value.purchases.push({
      id: "PO-TEST",
      request: "",
      plan: "",
      date: "2026-10-20",
      buyer: "测试",
      supplier: "测试",
      lines: [],
      status: "待入库",
    });
    await nextTick();
    expect(card.get("strong").text()).toBe(`${count + 1}笔`);
    await card.trigger("click");
    expect(wrapper.emitted("navigate")?.[0]).toEqual(["orders"]);
  });

  it("默认打开工作台，分组可折叠，需求分析属于生产管理", async () => {
    history.replaceState(null, "", "/");
    wrapper = mount(App, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          Dashboard: true,
          Inventory: true,
          Materials: true,
          Procurement: true,
          Production: true,
          Drafts: true,
        },
      },
    });
    expect(wrapper.findComponent(Dashboard).exists()).toBe(true);
    expect(wrapper.find('button[aria-label="工作空间"]').exists()).toBe(false);
    expect(wrapper.get('a[aria-label="首页工作台"]').isVisible()).toBe(true);
    const production = wrapper
      .findAll(".nav-group")
      .find((group) => group.text().includes("生产管理"))!;
    const procurement = wrapper
      .findAll(".nav-group")
      .find((group) => group.text().includes("采购管理"))!;
    expect(production.find('a[href="#analysis"]').exists()).toBe(true);
    expect(procurement.find('a[href="#analysis"]').exists()).toBe(false);
    const heading = production.get('button[aria-label="生产管理"]');
    await heading.trigger("click");
    expect(heading.attributes("aria-expanded")).toBe("false");
    expect(production.get('a[href="#analysis"]').isVisible()).toBe(false);
    await heading.trigger("click");
    await production.get('a[href="#analysis"]').trigger("click");
    expect(document.title).toBe("需求分析 · WSN ERP");
    await wrapper.get('button[aria-label="收起导航"]').trigger("click");
    expect(wrapper.get(".erp-shell").classes()).toContain("collapsed");
    await wrapper.get('button[aria-label="展开导航"]').trigger("click");
    expect(wrapper.get(".erp-shell").classes()).not.toContain("collapsed");
  });

  it("页面及详情跳转显示 300ms loading，连续跳转重新计时", async () => {
    history.replaceState(null, "", "/");
    wrapper = mount(App, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          Dashboard: true,
          Inventory: true,
          Materials: true,
          Procurement: true,
          Production: true,
          Drafts: true,
        },
      },
    });
    vi.useFakeTimers();
    await wrapper.get('a[aria-label="库存记录"]').trigger("click");
    expect(wrapper.get('[role="status"]').text()).toContain("正在加载");
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.get("main").attributes("aria-busy")).toBe("true");
    // 浏览器前进后退、详情深链接走同一条 hashchange 路径。
    history.replaceState(null, "", "#materials/M001");
    window.dispatchEvent(new Event("hashchange"));
    await nextTick();
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.get("main").attributes("aria-busy")).toBe("true");
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get("main").attributes("aria-busy")).toBe("false");
  });
});
