import { describe, expect, it } from "vitest";
import { seed, type Movement } from "./model";
import { movementDocuments } from "./movement-documents";

describe("出入库按单据汇总", () => {
  it("同一出库单多物料多仓合为一行，方向不同不混合且不改原流水", () => {
    const state = seed();
    const base: Movement = { id: "IO1", date: "2026-11-02", type: "出库", warehouse: "BZ01", material: "M001", qty: 1, source: "OUT179323822159016YJ", reason: "外发" };
    state.movements = [base, { ...base, id: "IO2", warehouse: "XC01", material: "M002", qty: 3 }, { ...base, id: "IO3", type: "入库" }];
    const before = JSON.stringify(state);
    const documents = movementDocuments(state);
    expect(documents).toHaveLength(2);
    expect(documents[0]!.lines).toHaveLength(2);
    expect(documents[0]!.warehouses).toEqual(["BZ01", "XC01"]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("历史相同文字来源不误合并，可靠入库号按单合并", () => {
    const state = seed();
    const base: Movement = { id: "IO1", date: "2026-11-02", type: "入库", warehouse: "BZ01", material: "M001", qty: 1, source: "手工登记", reason: "补录" };
    state.movements = [base, { ...base, id: "IO2" }, { ...base, id: "IO3", source: "IN-TEST" }, { ...base, id: "IO4", material: "M002", source: "IN-TEST" }];
    state.inbounds = [{ id: "IN-TEST", receipt: "", purchase: "PO-TEST", warehouse: "BZ01", date: base.date, lines: [] }];
    const documents = movementDocuments(state);
    expect(documents).toHaveLength(3);
    expect(documents.find((row) => row.id === "IN-TEST")!.lines).toHaveLength(2);
    expect(documents.filter((row) => row.source === "手工登记").map((row) => row.id)).toEqual(["IO1", "IO2"]);
  });
});
