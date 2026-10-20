import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import ElementPlus, { ElEmpty, ElProgress, ElSelect } from "element-plus";
import Dashboard from "./Dashboard.vue";
import App from "./App.vue";
import { state } from "./store";
import { createDraft, createPurchase, mergePurchases, seed, type WorkOrderStatus } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  state.value = seed();
  history.replaceState(null, "", "/");
});

describe("首页工作台与导航", () => {
  it("工单概览按已发货统计完成数，状态变化后实时更新", async () => {
    state.value = seed();
    state.value.workOrders[0]!.status = "已发货";
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    const overview = wrapper.get('section[aria-label="工单概览"]');
    expect(overview.get('[data-test="work-order-total"]').text()).toBe("2");
    expect(overview.get('[data-test="work-order-completed"]').text()).toBe("1");
    expect(overview.get('[data-test="work-order-active"]').text()).toBe("1");
    state.value.workOrders[1]!.status = "已发货";
    await nextTick();
    expect(overview.get('[data-test="work-order-completed"]').text()).toBe("2");
    expect(overview.get('[data-test="work-order-active"]').text()).toBe("0");
  });

  it("切换进行中工单后展示自身计划、底稿及经底稿追溯去重的采购单", async () => {
    state.value = seed();
    const [first, second] = state.value.workOrders;
    const [firstPlan, secondPlan] = state.value.plans;
    state.value.plans.push({ ...firstPlan!, id: "PP-EXTRA", name: "追加生产计划" });
    createDraft(state.value, firstPlan!.id);
    createDraft(state.value, secondPlan!.id);
    const firstDrafts = state.value.drafts.filter((row) => row.plan === firstPlan!.id);
    const secondDrafts = state.value.drafts.filter((row) => row.plan === secondPlan!.id);
    const crossOrder = createPurchase(state.value, {
      buyer: "采购员",
      supplier: "同一供应商",
      draftIds: [firstDrafts[0]!.id, firstDrafts[1]!.id, secondDrafts[0]!.id],
    });
    const extraOrder = createPurchase(state.value, {
      buyer: "采购员",
      supplier: "同一供应商",
      draftIds: [firstDrafts[2]!.id],
    });
    mergePurchases(state.value, [crossOrder.id, extraOrder.id]);
    // 旧单头计划关系不再用于采购归属，避免把手动物料单错误计入。
    const manualOrder = createPurchase(state.value, {
      buyer: "采购员",
      supplier: "另一供应商",
      lines: [{ material: "M001", qty: 1 }],
    });
    manualOrder.plan = firstPlan!.id;
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    const selector = wrapper.getComponent(ElSelect);
    expect(selector.props("ariaLabel")).toBe("切换进行中工单");
    selector.vm.$emit("update:modelValue", first!.id);
    await nextTick();
    const progress = wrapper.get('section[aria-label="当前工单进度"]');
    expect(progress.get('[data-test="selected-plan-count"]').text()).toBe("2");
    expect(progress.get('[data-test="selected-draft-count"]').text()).toBe(
      String(firstDrafts.length)
    );
    expect(progress.get('[data-test="selected-purchase-count"]').text()).toBe("1");
    selector.vm.$emit("update:modelValue", second!.id);
    await nextTick();
    expect(progress.get('[data-test="selected-plan-count"]').text()).toBe("1");
    expect(progress.get('[data-test="selected-draft-count"]').text()).toBe(
      String(secondDrafts.length)
    );
    expect(progress.get('[data-test="selected-purchase-count"]').text()).toBe("1");
  });

  it.each<[WorkOrderStatus, number]>([
    ["立项中", 0],
    ["采购中", 25],
    ["装配中", 50],
    ["待出货", 75],
    ["已发货", 100],
  ])("工单%s显示%s进度", (status, percentage) => {
    state.value = seed();
    state.value.workOrders = [{ ...state.value.workOrders[0]!, status }];
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    expect(wrapper.getComponent(ElProgress).props("percentage")).toBe(percentage);
  });

  it("当前工单发货后切换其他进行中工单，全部完成后保留最后工单的完成进度", async () => {
    state.value = seed();
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    const selector = wrapper.getComponent(ElSelect);
    const [first, second] = state.value.workOrders;
    selector.vm.$emit("update:modelValue", first!.id);
    await nextTick();
    first!.status = "已发货";
    await nextTick();
    expect(selector.props("modelValue")).toBe(second!.id);
    expect(
      selector.findAllComponents({ name: "ElOption" }).map((option) => option.props("value"))
    ).toEqual([second!.id]);
    second!.status = "已发货";
    await nextTick();
    expect(wrapper.getComponent(ElProgress).props("percentage")).toBe(100);
    expect(wrapper.get('section[aria-label="当前工单进度"]').text()).toContain(second!.name);
    expect(wrapper.findComponent(ElSelect).exists()).toBe(false);
  });

  it("没有工单时展示空态，不显示伪进度", () => {
    state.value = seed();
    state.value.workOrders = [];
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    expect(wrapper.get('[data-test="work-order-total"]').text()).toBe("0");
    expect(wrapper.findComponent(ElEmpty).exists()).toBe(true);
    expect(wrapper.findComponent(ElProgress).exists()).toBe(false);
  });

  it("概览跟随业务状态更新，卡片进入对应业务页面", async () => {
    state.value = seed();
    wrapper = mount(Dashboard, { global: { plugins: [ElementPlus] } });
    const card = wrapper
      .findAll(".dashboard-metric")
      .find((item) => item.text().includes("待收货采购单"))!;
    const count = state.value.purchases.filter(
      (item) => item.status === "已审核" && item.receiptStatus !== "全部收货" && !item.mergedInto
    ).length;
    expect(card.get("strong").text()).toBe(`${count}笔`);
    state.value.purchases.push({
      id: "PO-TEST",
      request: "",
      plan: "",
      date: "2026-10-20",
      buyer: "测试",
      supplier: "测试",
      lines: [],
      status: "已审核",
      receiptStatus: "未收货",
      amount: null,
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
    const logistics = wrapper
      .findAll(".nav-group")
      .find((group) => group.text().includes("收发货"))!;
    expect(logistics.find('a[href="#receipts"]').exists()).toBe(true);
    expect(logistics.find('a[href="#shipments"]').exists()).toBe(true);
    expect(procurement.find('a[href="#receipts"]').exists()).toBe(false);
    expect(production.find('a[href="#shipments"]').exists()).toBe(false);
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
