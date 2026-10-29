import { describe, expect, it } from "vitest";
import { seed, createPurchase, auditPurchase, createPurchaseInbound, createReceipt,
  confirmReceipt, unauditReceipt, unauditPurchase, receiptRemaining, stockKey, migrateDrafts } from "./model";

function setup() {
  const state = seed();
  const orders = ["华东五金有限公司", "华东五金分公司"].map((supplier) => {
    const order = createPurchase(state, { buyer: "采购员", supplier,
      lines: [{ material: "M001", qty: 10 }, { material: "M002", qty: 5 }] });
    auditPurchase(state, order.id);
    return order;
  });
  const input = { id: "IN-TEST", supplier: " 华东五金 ", warehouse: "BZ01", remark: "跨单入库",
    lines: orders.flatMap((order) => order.lines.map((line) => ({ purchase: order.id, lineId: line.id, qty: 2 }))) };
  return { state, orders, input };
}

describe("供应商跨采购单入库", () => {
  it("同物料不同采购来源分别追踪，累计库存、已收与收货状态，刷新保留来源", () => {
    const { state, orders, input } = setup();
    const before = state.stocks[stockKey("BZ01", "M001")] || 0;
    const document = createPurchaseInbound(state, input);
    expect(document.lines).toHaveLength(4);
    expect(new Set(document.lines.map((line) => line.purchase)).size).toBe(2);
    expect(document.supplier).toBe("华东五金");
    expect(state.stocks[stockKey("BZ01", "M001")]).toBe(before + 4);
    expect(state.movements.filter((row) => row.source === document.id)).toHaveLength(4);
    for (const order of orders) {
      expect(order.lines.map((line) => line.received)).toEqual([2, 2]);
      expect(order.receiptStatus).toBe("部分收货");
      expect(receiptRemaining(state, order.id).map((line) => line.qty)).toEqual([8, 3]);
      expect(() => unauditPurchase(state, order.id)).toThrow("已有物料入库");
    }
    const reloaded = JSON.parse(JSON.stringify(state));
    migrateDrafts(reloaded);
    expect(reloaded.inbounds[0]).toEqual(document);
    expect(() => createPurchaseInbound(state, input)).toThrow("不能重复入库");
    expect(state.stocks[stockKey("BZ01", "M001")]).toBe(before + 4);
  });

  it("直接入库与待收占用共同限制采购可收量，收货反审核只回退自身数量", () => {
    const { state, orders, input } = setup();
    const order = orders[0]!;
    const line = order.lines[0]!;
    const receipt = createReceipt(state, order.id, "BZ01", [{ lineId: line.id, qty: 6 }]);
    input.lines = [{ purchase: order.id, lineId: line.id, qty: 5 }];
    const snapshot = JSON.stringify(state);
    expect(() => createPurchaseInbound(state, input)).toThrow("剩余应收");
    expect(JSON.stringify(state)).toBe(snapshot);
    input.lines[0]!.qty = 4;
    createPurchaseInbound(state, input);
    expect(receiptRemaining(state, order.id)[0]!.qty).toBe(0);
    confirmReceipt(state, receipt.id);
    expect(order.lines[0]!.received).toBe(10);
    unauditReceipt(state, receipt.id);
    expect(order.lines[0]!.received).toBe(4);
    expect(state.inbounds.some((row) => row.id === input.id)).toBe(true);
    expect(() => unauditPurchase(state, order.id)).toThrow("已有物料入库");
  });

  it.each(["供应商为空", "供应商不匹配", "未审核", "重复行", "超量", "失效仓库", "空明细", "非法数量", "无效来源"])("%s 时不产生部分入库", (scenario) => {
    const { state, orders, input } = setup();
    if (scenario === "供应商为空") input.supplier = " ";
    if (scenario === "供应商不匹配") input.supplier = "不存在";
    if (scenario === "未审核") orders[1]!.status = "未审核";
    if (scenario === "重复行") input.lines.push({ ...input.lines[0]! });
    if (scenario === "超量") input.lines.at(-1)!.qty = 11;
    if (scenario === "失效仓库") input.warehouse = "不存在";
    if (scenario === "空明细") input.lines = [];
    if (scenario === "非法数量") input.lines.at(-1)!.qty = 0.5;
    if (scenario === "无效来源") input.lines.at(-1)!.lineId = "不存在";
    const snapshot = JSON.stringify(state);
    expect(() => createPurchaseInbound(state, input)).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("仅一行部分入库也阻止反审核，全部入库更新采购状态", () => {
    const { state, orders, input } = setup();
    const order = orders[0]!;
    input.lines = [{ purchase: order.id, lineId: order.lines[0]!.id, qty: 1 }];
    createPurchaseInbound(state, input);
    expect(() => unauditPurchase(state, order.id)).toThrow("已有物料入库");
    unauditPurchase(state, orders[1]!.id);
    createPurchaseInbound(state, { ...input, id: "IN-REST", lines: order.lines.map((line) => ({
      purchase: order.id, lineId: line.id, qty: line.qty - line.received,
    })) });
    expect(order.receiptStatus).toBe("全部收货");
  });
});
