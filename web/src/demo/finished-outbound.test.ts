import { describe, expect, it } from "vitest";
import {
  createFinishedInbound,
  migrateDrafts,
  seed,
  shipWorkOrder,
  stockKey,
  workOrderShipmentLines,
} from "./model";

function ready() {
  const state = seed();
  const order = state.workOrders[0]!;
  order.status = "待出货";
  createFinishedInbound(state, {
    workOrder: order.id,
    warehouse: "CP01",
    lines: workOrderShipmentLines(state, order.id),
  });
  return { state, order };
}
describe("成品发货自动出库单", () => {
  it("发货生成关联出库单，明细独立保存，库存仅扣一次，重复发货不重复生成", () => {
    const { state, order } = ready();
    const stock = state.stocks[stockKey("CP01", order.product)]!;
    const movementCount = state.movements.length;
    const shipment = shipWorkOrder(state, order.id, { carrier: "验收物流", tracking: "OUT-001" });
    const document = state.finishedOutbounds![0]!;
    expect(document).toMatchObject({
      shipment: shipment.id,
      workOrder: order.id,
      warehouse: shipment.warehouse,
      date: shipment.date,
      lines: shipment.lines,
    });
    expect(document.lines).not.toBe(shipment.lines);
    expect(state.stocks[stockKey("CP01", order.product)]).toBe(stock - order.qty);
    expect(state.movements).toHaveLength(movementCount + shipment.lines.length);
    expect(state.movements.filter((row) => row.source === document.id)).toHaveLength(0);
    const saved = JSON.stringify(state);
    expect(() =>
      shipWorkOrder(state, order.id, { carrier: "验收物流", tracking: "OUT-001" })
    ).toThrow("待出货");
    expect(JSON.stringify(state)).toBe(saved);
  });
  it("库存不足时不创建发货单、出库单或部分流水", () => {
    const { state, order } = ready();
    state.stocks[stockKey("CP01", order.product)] = 0;
    const before = JSON.stringify(state);
    expect(() =>
      shipWorkOrder(state, order.id, { carrier: "验收物流", tracking: "OUT-002" })
    ).toThrow("库存不足");
    expect(JSON.stringify(state)).toBe(before);
  });
  it("旧发货补单迁移幂等，保留库存和流水，异常集合明确报错", () => {
    const { state, order } = ready();
    shipWorkOrder(state, order.id, { carrier: "历史物流", tracking: "OLD-001" });
    delete state.finishedOutbounds;
    const stock = JSON.stringify(state.stocks);
    const movements = JSON.stringify(state.movements);
    migrateDrafts(state);
    expect(state.finishedOutbounds).toHaveLength(1);
    const documents = JSON.stringify(state.finishedOutbounds);
    migrateDrafts(state);
    expect(JSON.stringify(state.finishedOutbounds)).toBe(documents);
    expect(JSON.stringify(state.stocks)).toBe(stock);
    expect(JSON.stringify(state.movements)).toBe(movements);
    expect(state.finishedOutbounds![0]!.shipment).toBe(state.shipments[0]!.id);
    const broken = JSON.parse(JSON.stringify(state));
    broken.finishedOutbounds = {};
    expect(() => migrateDrafts(broken)).toThrow("成品出库单数据格式错误");
  });
});
