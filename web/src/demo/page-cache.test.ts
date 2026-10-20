import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, KeepAlive, nextTick, ref } from "vue";
import ElementPlus, { ElDialog, ElPagination } from "element-plus";
import App from "./App.vue";
import CachedPage from "./CachedPage.vue";
import CachedDialog from "./CachedDialog.vue";
import CachedDrawer from "./CachedDrawer.vue";
import Drafts from "./Drafts.vue";
import Production from "./Production.vue";
import Purchases from "./Purchases.vue";
import { state } from "./store";
import { createDraft, seed } from "./model";
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  state.value = seed();
  sessionStorage.clear();
  history.replaceState(null, "", "/#home");
  document.documentElement.scrollTop = 0;
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  document.documentElement.scrollTop = 0;
});
function start(route: string) {
  history.replaceState(null, "", `/#${route}`);
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [ElementPlus] } });
  return wrapper;
}
async function navigate(route: string) {
  history.replaceState(null, "", `/#${route}`);
  window.dispatchEvent(new Event("hashchange"));
  await nextTick();
  await flushPromises();
  await nextTick();
}
const draftInput = 'input[placeholder="底稿号、来源计划或物料"]';
const requestInput = 'input[placeholder="单号、请购人或物料"]';
const orderInput = 'input[placeholder="单号、供应商、采购人或物料"]';
describe("业务页面缓存", () => {
  it("底稿筛选分页离开再回来保持原值和结果", async () => {
    createDraft(state.value, state.value.plans[0]!.id);
    expect(state.value.drafts).toHaveLength(1);
    expect(state.value.drafts[0]!.lines.length).toBeGreaterThan(1);
    const sample = state.value.drafts[0]!;
    state.value.drafts = Array.from({ length: 65 }, (_, index) => ({
      ...sample,
      id: `DG-CACHE-${String(index).padStart(3, "0")}`,
      lines: sample.lines.map((l) => ({ ...l })),
    }));
    const app = start("drafts");
    await app.get(draftInput).setValue("DG-CACHE");
    app.getComponent(Drafts).getComponent(ElPagination).vm.$emit("update:current-page", 2);
    await nextTick();
    await navigate("plans");
    await navigate("drafts");
    expect((app.get(draftInput).element as HTMLInputElement).value).toBe("DG-CACHE");
    expect(app.getComponent(Drafts).getComponent(ElPagination).props("currentPage")).toBe(2);
    expect(app.getComponent(Drafts).text()).toContain("DG-CACHE-050");
    expect(app.getComponent(Drafts).text()).not.toContain("DG-CACHE-000");
  });
  it("请购和采购缓存实例各自保留条件互不串值", async () => {
    const app = start("requests");
    await app.get(requestInput).setValue("仓库管理员");
    await navigate("orders");
    await app.get(orderInput).setValue("精工");
    await navigate("plans");
    await navigate("requests");
    expect((app.get(requestInput).element as HTMLInputElement).value).toBe("仓库管理员");
    await navigate("orders");
    expect((app.get(orderInput).element as HTMLInputElement).value).toBe("精工");
    expect(app.getComponent(Purchases).text()).toContain("PO202610001");
  });
  it("缓存激活重新消费指定计划和底稿跳转意图", async () => {
    createDraft(state.value, state.value.plans[0]!.id);
    const app = start("plans");
    await navigate("drafts");
    await navigate("home");
    sessionStorage.setItem("wsn-production-plan-detail", state.value.plans[1]!.id);
    await navigate("plans");
    expect(app.getComponent(Production).getComponent(CachedDrawer).props("modelValue")).toBe(true);
    expect(app.getComponent(Production).getComponent(CachedDrawer).text()).toContain(
      state.value.plans[1]!.name
    );
    expect(sessionStorage.getItem("wsn-production-plan-detail")).toBeNull();
    sessionStorage.setItem("wsn-selected-draft", state.value.drafts[0]!.id);
    await navigate("drafts");
    expect(app.getComponent(Drafts).getComponent(CachedDrawer).props("modelValue")).toBe(true);
    expect(sessionStorage.getItem("wsn-selected-draft")).toBeNull();
  });
  it("真实body弹窗离页隐藏但保留打开状态和表单，返回恢复", async () => {
    const route = ref("dialog"),
      opened = ref(true),
      closed = ref(0),
      formValue = ref("");
    const DialogPage = defineComponent({
      setup: () => () =>
        h(
          CachedDialog,
          {
            modelValue: opened.value,
            "onUpdate:modelValue": (value: boolean) => (opened.value = value),
            onClose: () => closed.value++,
            appendToBody: true,
            title: "缓存弹窗",
          },
          () =>
            h("input", {
              "data-test": "dialog-form",
              value: formValue.value,
              onInput: (event: Event) =>
                (formValue.value = (event.target as HTMLInputElement).value),
            })
        ),
    });
    const OtherPage = defineComponent({ setup: () => () => h("div", "其他页面") });
    const Host = defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () =>
            h(CachedPage, {
              key: route.value,
              component: route.value === "dialog" ? DialogPage : OtherPage,
              pageProps: {},
            }),
        }),
    });
    wrapper = mount(Host, { attachTo: document.body, global: { plugins: [ElementPlus] } });
    await flushPromises();
    await nextTick();
    expect(document.body.querySelector('[data-test="dialog-form"]')).not.toBeNull();
    expect(wrapper.getComponent(ElDialog).props("modelValue")).toBe(true);
    const form = document.body.querySelector<HTMLInputElement>('[data-test="dialog-form"]')!;
    form.value = "未保存的采购备注";
    form.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    route.value = "other";
    await nextTick();
    await flushPromises();
    await nextTick();
    const overlay = document.body.querySelector<HTMLElement>(".el-overlay");
    expect(overlay === null || overlay.style.display === "none").toBe(true);
    expect(opened.value).toBe(true);
    expect(closed.value).toBe(0);
    route.value = "dialog";
    await nextTick();
    await flushPromises();
    await nextTick();
    expect(wrapper.getComponent(ElDialog).props("modelValue")).toBe(true);
    expect(document.body.querySelector<HTMLElement>(".el-overlay")?.style.display).not.toBe("none");
    expect(opened.value).toBe(true);
    expect(document.body.querySelector<HTMLInputElement>('[data-test="dialog-form"]')!.value).toBe(
      "未保存的采购备注"
    );
  });
  it("实际App按路由恢复页面滚动位置", async () => {
    start("home");
    document.documentElement.scrollTop = 420;
    await navigate("drafts");
    expect(document.documentElement.scrollTop).toBe(0);
    document.documentElement.scrollTop = 180;
    await navigate("home");
    expect(document.documentElement.scrollTop).toBe(420);
    await navigate("drafts");
    expect(document.documentElement.scrollTop).toBe(180);
  });
});
