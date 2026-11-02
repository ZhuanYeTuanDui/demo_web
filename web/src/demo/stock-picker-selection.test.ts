import { afterEach, expect, it } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import ElementPlus, { ElPagination } from "element-plus";
import InboundSourcePicker from "./InboundSourcePicker.vue";
import StockMaterialPicker from "./StockMaterialPicker.vue";
import { state } from "./store";
import { seed, createPurchase, auditPurchase, stockKey } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ""; });
it.each(["入库", "出库"])("%s表头只切换当前页可选项，跳过已添加并保留其他页", async (kind) => {
  state.value = seed();
  const keys: string[] = [];
  state.value.purchases = [];
  state.value.materials = Array.from({ length: 21 }, (_, index) => ({
    id: `TEST${index}`, name: `测试物料${index}`, spec: "规格", unit: "个", price: 0,
  }));
  for (const item of state.value.materials) {
    state.value.stocks[stockKey("BZ01", item.id)] = 3;
    if (kind === "入库") {
      const order = createPurchase(state.value, { buyer: "甲", supplier: "测试供应商", lines: [{ material: item.id, qty: 3 }] });
      auditPurchase(state.value, order.id);
      keys.unshift(JSON.stringify([order.id, order.lines[0]!.id]));
    } else keys.push(item.id);
  }
  const global = { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true } };
  wrapper = kind === "入库"
    ? mount(InboundSourcePicker, { props: { supplier: "测试", excludedKeys: [keys[0]!] }, attachTo: document.body, global })
    : mount(StockMaterialPicker, { props: { warehouse: "BZ01", excludedIds: [keys[0]!] }, attachTo: document.body, global });
  await flushPromises();
  const header = `label[aria-label="全选当前页${kind === "入库" ? "采购" : "库存"}物料"] input`;
  await wrapper.get(header).setValue(true);
  expect(wrapper.text()).toContain("已选 19");
  wrapper.getComponent(ElPagination).vm.$emit("update:current-page", 2);
  await flushPromises();
  await wrapper.get(header).setValue(true);
  expect(wrapper.text()).toContain("已选 20");
  await wrapper.get(header).setValue(false);
  expect(wrapper.text()).toContain("已选 19");
  await wrapper.get(header).setValue(true);
  const confirm = wrapper.findAll("button").find((button) => button.text() === (kind === "入库" ? "确认取单（20）" : "添加选中物料（20）"))!;
  await confirm.trigger("click");
  const rows = wrapper.emitted("confirm")![0]![0] as (string | { key: string })[];
  expect(rows).toHaveLength(20);
  expect(rows.map((row) => typeof row === "string" ? row : row.key)).not.toContain(keys[0]);
});
