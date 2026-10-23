import { describe, expect, it } from "vitest";
import { createMockState, mockDatabase } from "./mock-data";
import { createMockScenarios } from "./mock-scenarios";
import { analysis, requirements, stockKey } from "./model";

describe("关系表 mock 与既有业务适配", () => {
  it("按行号重建计划快照，保持缺料口径和未知采购价", () => {
    const database = structuredClone(mockDatabase);
    database.tables.production_plan_lines!.reverse();
    const state = createMockState(database, "2026-10-22");
    expect(requirements(state.plans[0]!)).toEqual([
      { material: "M001", qty: 5 }, { material: "M002", qty: 5 },
      { material: "M003", qty: 20 }, { material: "M004", qty: 10 },
    ]);
    expect(analysis(state, state.plans[0]!).map((row) => row.shortage)).toEqual([3, 2, 8, 6]);
    expect(state.purchases[0]!.lines[0]!.requestLine).toBe("0");
    expect(state.purchases[0]!.amount).toBeNull();
    expect(state.purchases[0]!.lines[0]!.unitPrice).toBeUndefined();
    expect(state.plans[0]!.date).toBe("2026-10-22");
  });
  it("每次初始化隔离，不允许丢失未知单据或损坏来源", () => {
    const first = createMockState();
    first.plans[0]!.bom![0]!.qty = 99;
    expect(createMockState().plans[0]!.bom![0]!.qty).toBe(1);
    const invalid = structuredClone(mockDatabase);
    invalid.tables.purchase_lines![0]!.source_requisition_line_id = "不存在";
    expect(() => createMockState(invalid)).toThrow("请购来源行不存在");
    const unsupported = structuredClone(mockDatabase);
    unsupported.tables.receipts!.push({ id: "RC-UNKNOWN" });
    expect(() => createMockState(unsupported)).toThrow("不支持非空 receipts");
  });
  it("分批收货、领料入库和发货场景通过业务方法保持一致", () => {
    const scenarios = createMockScenarios();
    const partial = scenarios.find((row) => row.key === "partial-receipt")!.state;
    expect(partial.purchases[0]!.receiptStatus).toBe("部分收货");
    expect(partial.purchases[0]!.lines[0]!.received).toBe(2);
    expect(partial.stocks[stockKey("BZ01", "M005")]).toBe(10);
    expect(partial.receipts.filter((row) => row.status === "待收货")).toHaveLength(1);
    const production = scenarios.find((row) => row.key === "production")!.state;
    expect(production.issues).toHaveLength(1);
    expect(production.plans[0]!.status).toBe("待备料");
    expect(production.stocks[stockKey("CP01", "FG001")]).toBe(7);
    const shipped = scenarios.find((row) => row.key === "shipped")!.state;
    expect(shipped.workOrders[0]!.status).toBe("已发货");
    expect(shipped.finishedOutbounds).toHaveLength(1);
    expect(shipped.stocks[stockKey("CP01", "FG001")]).toBe(2);
  });
});
