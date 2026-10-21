import { describe, expect, it } from "vitest";
import {
  seed,
  stockKey,
  createManualDraft,
  auditDraft,
  unauditDraft,
  auditPlan,
  unauditPlan,
  createPurchase,
  purchaseDifferences,
  auditPurchase,
  unauditPurchase,
  createReceipt,
  updateReceipt,
  confirmReceipt,
  receiptRemaining,
  createIssue,
  unauditIssue,
  finishPlan,
  migrateDrafts,
} from "./model";

describe("TODO 跨模块业务验收", () => {
  it("少买、多买、来源重复取用与逐级返审使用同一来源关系", () => {
    const state = seed();
    const plan = state.plans[0]!;
    plan.auditStatus = "已审核";
    const draft = createManualDraft(state, {
      plan: plan.id,
      lines: [{ material: "M001", qty: 2 }],
    });
    auditDraft(state, draft.id);
    const source = { draftLines: [{ draftId: draft.id, lineId: draft.lines[0]!.id }] };
    const first = createPurchase(state, {
      buyer: "采购员",
      supplier: "供应商",
      ...source,
      lineEdits: {
        [`draft:${draft.id}:0`]: {
          qty: 1,
          unitPrice: 0.29,
          dueDate: "2026-10-25",
          remark: "第一批",
        },
      },
    });
    const second = createPurchase(state, {
      buyer: "采购员",
      supplier: "供应商",
      ...source,
      lineEdits: { [`draft:${draft.id}:0`]: { qty: 5, unitPrice: 0.29 } },
    });
    expect(draft.lines[0]!.qty).toBe(2);
    expect(first.amount).toBe(0.29);
    expect(second.amount).toBe(1.45);
    expect(purchaseDifferences(state, first.id)).toEqual([
      { material: "M001", source: draft.id, required: 2, qty: 1 },
    ]);
    expect(() => auditPurchase(state, first.id)).toThrow("差异");
    auditPurchase(state, first.id, true);
    expect(() => unauditDraft(state, draft.id)).toThrow("下游");
    unauditPurchase(state, first.id);
    unauditDraft(state, draft.id);
    // 已创建但未审核的采购及底稿允许逐级返审，来源仍完整保留。
    unauditPlan(state, plan.id);
    expect(first.lines[0]!.draftLine).toBe(draft.lines[0]!.id);
    expect(second.lines[0]!.qty).toBe(5);
    auditPlan(state, plan.id);
    auditDraft(state, draft.id);
    auditPurchase(state, first.id, true);
    expect(first.lines[0]!.dueDate).toBe("2026-10-25");
  });

  it("多张待单只预占，实收差额释放，刷新迁移后可继续安排", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "采购员",
      supplier: "供应商",
      lines: [{ material: "M001", qty: 10 }],
    });
    auditPurchase(state, order.id);
    const lineId = order.lines[0]!.id;
    const key = stockKey("BZ01", "M001");
    const before = state.stocks[key]!;
    const first = createReceipt(state, order.id, "BZ01", [{ lineId, qty: 6 }], {
      carrier: "物流公司",
      tracking: "TRACK-1",
    });
    const second = createReceipt(state, order.id, "BZ01", [{ lineId, qty: 4 }]);
    expect(state.stocks[key]).toBe(before);
    expect(receiptRemaining(state, order.id)[0]!.qty).toBe(0);
    expect(() => updateReceipt(state, second.id, [{ lineId, qty: 5 }])).toThrow();
    confirmReceipt(state, first.id, [{ lineId, qty: 3 }]);
    expect(state.stocks[key]).toBe(before + 3);
    expect(receiptRemaining(state, order.id)[0]!.qty).toBe(3);
    expect(() => confirmReceipt(state, first.id)).toThrow();
    expect(state.inbounds.filter((row) => row.receipt === first.id)).toHaveLength(1);
    const restored = JSON.parse(JSON.stringify(state));
    migrateDrafts(restored);
    expect(restored.receipts.find((row: { id: string }) => row.id === second.id).status).toBe(
      "待收货"
    );
    expect(receiptRemaining(restored, order.id)[0]!.qty).toBe(3);
    const last = createReceipt(restored, order.id, "BZ01", [{ lineId, qty: 3 }]);
    confirmReceipt(restored, second.id);
    confirmReceipt(restored, last.id);
    expect(
      restored.purchases.find((row: { id: string }) => row.id === order.id).receiptStatus
    ).toBe("全部收货");
    expect(restored.stocks[key]).toBe(before + 10);
  });

  it("领料只看实际库存，可多次部分领料且完工不依赖齐料状态", () => {
    const state = seed();
    const plan = state.plans[0]!;
    plan.auditStatus = "已审核";
    state.stocks[stockKey("XC01", "M001")] = 10;
    const warehouse = state.warehouses.find((row) => row.id === "XC01")!;
    warehouse.available = false;
    const first = createIssue(state, plan.id, [{ warehouse: "XC01", material: "M001", qty: 2 }]);
    createIssue(state, plan.id, [{ warehouse: "XC01", material: "M001", qty: 3 }]);
    expect(state.stocks[stockKey("XC01", "M001")]).toBe(5);
    expect(plan.status).toBe("待分析");
    unauditIssue(state, first.id);
    expect(state.stocks[stockKey("XC01", "M001")]).toBe(7);
    finishPlan(state, plan.id);
    expect(plan.status).toBe("已完工");
    expect(() => finishPlan(state, plan.id)).toThrow();
  });
});
