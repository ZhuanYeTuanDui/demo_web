import { describe, expect, it } from "vitest";
import { seed, registerStockOutbound, stockKey } from "./model";

function setup() {
  const state = seed();
  state.stocks[stockKey("BZ01", "M001")] = 5;
  state.stocks[stockKey("BZ01", "M002")] = 3;
  const input = { id: "OUT-TEST", warehouse: "BZ01", reason: " 物料外发 ",
    lines: [{ material: "M001", qty: 2 }, { material: "M002", qty: 3 }] };
  return { state, input };
}
describe("库存多物料出库", () => {
  it("按所选仓库逐行扣减库存并生成同来源流水，防止重复出库", () => {
    const { state, input } = setup();
    registerStockOutbound(state, input);
    expect(state.stocks[stockKey("BZ01", "M001")]).toBe(3);
    expect(state.stocks[stockKey("BZ01", "M002")]).toBe(0);
    expect(state.movements.filter((row) => row.source === input.id)).toHaveLength(2);
    expect(state.movements[0]).toMatchObject({ type: "出库", warehouse: "BZ01", reason: "物料外发" });
    const saved = JSON.stringify(state);
    expect(() => registerStockOutbound(state, input)).toThrow("不能重复出库");
    expect(JSON.stringify(state)).toBe(saved);
  });
  it.each(["超库存", "零库存", "重复物料", "非法数量", "空明细", "原因缺失", "仓库失效"])("%s 时整单不扣库存、不新增流水", (scenario) => {
    const { state, input } = setup();
    if (scenario === "超库存") input.lines[1]!.qty = 4;
    if (scenario === "零库存") state.stocks[stockKey("BZ01", "M002")] = 0;
    if (scenario === "重复物料") input.lines.push({ ...input.lines[0]! });
    if (scenario === "非法数量") input.lines[1]!.qty = 0.5;
    if (scenario === "空明细") input.lines = [];
    if (scenario === "原因缺失") input.reason = " ";
    if (scenario === "仓库失效") state.warehouses.find((row) => row.id === "BZ01")!.inactive = true;
    const before = JSON.stringify(state);
    expect(() => registerStockOutbound(state, input)).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
});
