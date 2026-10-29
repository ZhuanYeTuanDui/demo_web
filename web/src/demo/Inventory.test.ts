import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";
import Inventory from "./Inventory.vue";
import StockMaterialPicker from "./StockMaterialPicker.vue";
import { state } from "./store";
import { seed, stockKey } from "./model";

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ""; localStorage.clear(); vi.restoreAllMocks(); });
const click = async (text: string) => {
  await wrapper!.findAll("button").find((button) => button.text() === text)!.trigger("click");
  await flushPromises();
};
function setup() {
  state.value = seed();
  state.value.stocks = {};
  state.value.stocks[stockKey("BZ01", "M001")] = 5;
  state.value.stocks[stockKey("BZ01", "M002")] = 3;
  wrapper = mount(Inventory, { props: { page: "movements" }, attachTo: document.body,
    global: { plugins: [ElementPlus], renderStubDefaultSlot: true, stubs: { teleport: true, ElSelect: true, ElOption: true } } });
}
async function select(ids: string[]) {
  await click("选择库存物料");
  const picker = wrapper!.getComponent(StockMaterialPicker);
  for (const id of ids) await picker.get(`label[aria-label="选择库存物料 ${id}"] input`).setValue(true);
  await click(`添加选中物料（${ids.length}）`);
}
describe("物料出入库表单", () => {
  it("登记出库从有库存的物料多选，编辑数量后保存扣库", async () => {
    setup();
    expect(wrapper!.findAll("button").some((button) => button.text() === "登记入库")).toBe(true);
    await click("登记出库");
    await select(["M001", "M002"]);
    await flushPromises();
    await wrapper!.get('input[aria-label="出库数量 M001"]').setValue("2");
    await wrapper!.get('input[aria-label="出库数量 M001"]').trigger("change");
    await wrapper!.get('input[placeholder="例如：库存调整、物料外发"]').setValue("物料外发");
    await click("确认出库");
    expect(state.value.stocks[stockKey("BZ01", "M001")]).toBe(3);
    expect(state.value.stocks[stockKey("BZ01", "M002")]).toBe(2);
    expect(state.value.movements.filter((row) => row.type === "出库")).toHaveLength(2);
  });
  it("切换仓库清空选择与数量，取消不扣库存", async () => {
    setup();
    const before = JSON.stringify(state.value);
    await click("登记出库");
    await select(["M001", "M002"]);
    await flushPromises();
    const warehouse = wrapper!.findAllComponents({ name: "ElSelect" }).find((item) => item.attributes("aria-label") === "出库仓库")!;
    warehouse.vm.$emit("update:modelValue", "CP01");
    await flushPromises();
    expect(wrapper!.find('input[aria-label="出库数量 M001"]').exists()).toBe(false);
    await click("取消");
    expect(JSON.stringify(state.value)).toBe(before);
  });
  it("关键字段组合筛选保留已选，取消不加行，再次添加不重置已有数量", async () => {
    setup();
    state.value.materials.find((item) => item.id === "M001")!.details = { drawingNo: "DRAW-A", brand: "测试品牌" };
    await click("登记出库");
    await click("选择库存物料");
    let picker = wrapper!.getComponent(StockMaterialPicker);
    expect(picker.text()).not.toContain("交流接触器");
    await picker.get('input[placeholder="筛选品号"]').setValue("m001");
    await picker.get('input[placeholder="筛选品名"]').setValue("PLC");
    await picker.get('input[placeholder="筛选规格型号"]').setValue("LX3V");
    await picker.get('input[placeholder="筛选图号"]').setValue("draw-a");
    await picker.get('input[placeholder="筛选品牌"]').setValue("测试");
    expect(picker.text()).toContain("PLC 控制器");
    expect(picker.text()).not.toContain("触摸屏");
    await picker.get('label[aria-label="选择库存物料 M001"] input').setValue(true);
    await click("重置筛选");
    expect(picker.text()).toContain("已选 1 种物料");
    await click("添加选中物料（1）");
    await wrapper!.get('input[aria-label="出库数量 M001"]').setValue("2");
    await wrapper!.get('input[aria-label="出库数量 M001"]').trigger("change");
    await click("选择库存物料");
    picker = wrapper!.getComponent(StockMaterialPicker);
    expect(picker.get('label[aria-label="选择库存物料 M001"] input').attributes("disabled")).toBeDefined();
    await picker.get('label[aria-label="选择库存物料 M002"] input').setValue(true);
    await picker.findAll("button").find((button) => button.text() === "取消")!.trigger("click");
    await flushPromises();
    expect(wrapper!.find('input[aria-label="出库数量 M002"]').exists()).toBe(false);
    await select(["M002"]);
    expect((wrapper!.get('input[aria-label="出库数量 M001"]').element as HTMLInputElement).value).toBe("2");
  });
});
