import { describe, expect, it } from "vitest";
import {
  seed,
  createDraft,
  auditDraft,
  unauditDraft,
  deleteDraft,
  updateDraft,
  createManualDraft,
  auditPlan,
  unauditPlan,
  updatePlan,
  createPurchase,
  updatePurchase,
  auditPurchase,
  unauditPurchase,
  purchaseDifferences,
  purchaseTotal,
  createReceipt,
  updateReceipt,
  confirmReceipt,
  unauditReceipt,
  receiptRemaining,
  createIssue,
  unauditIssue,
  auditIssue,
  finishPlan,
  migrateDrafts,
  mergePurchases,
} from "./model";

function sourced() {
  const state = seed();
  const plan = state.plans[0]!;
  const draft = createDraft(state, plan.id);
  auditDraft(state, draft.id);
  return { state, plan, draft };
}

describe("本轮 TODO 业务规则", () => {
  it("计划及底稿审核状态独立，按已审核直接下游逐级返审", () => {
    const { state, plan, draft } = sourced();
    expect(plan.status).toBe("待备料");
    expect(() => unauditPlan(state, plan.id)).toThrow("直接下游");
    const order = createPurchase(state, { buyer: "甲", supplier: "乙", draftIds: [draft.id] });
    auditPurchase(state, order.id);
    expect(() => unauditDraft(state, draft.id)).toThrow("直接下游");
    unauditPurchase(state, order.id);
    unauditDraft(state, draft.id);
    unauditPlan(state, plan.id);
    expect(plan.auditStatus).toBe("未审核");
    expect(plan.status).toBe("待备料");
    updatePlan(state, plan.id, { name: "改名", product: plan.product, qty: 6, date: plan.date });
    auditPlan(state, plan.id);
    expect(plan.name).toBe("改名");
    expect(() => deleteDraft(state, draft.id)).toThrow("来源引用");
    expect(() => updateDraft(state, draft.id, { lines: draft.lines.slice(1) })).toThrow("来源引用");
  });

  it("新底稿默认未审核，未审不能取料，来源行审核后可重复且部分取用", () => {
    const state = seed();
    const draft = createManualDraft(state, {
      lines: [
        { material: "M001", qty: 2 },
        { material: "M002", qty: 3 },
      ],
    });
    expect(draft.auditStatus).toBe("未审核");
    expect(() =>
      createPurchase(state, { buyer: "甲", supplier: "乙", draftIds: [draft.id] })
    ).toThrow("已审核");
    updateDraft(state, draft.id, { remark: "补货", lines: draft.lines });
    auditDraft(state, draft.id);
    const source = { draftLines: [{ draftId: draft.id, lineId: draft.lines[0]!.id }] };
    const a = createPurchase(state, { buyer: "甲", supplier: "乙", ...source });
    const b = createPurchase(state, { buyer: "甲", supplier: "乙", ...source });
    expect(a.lines).toHaveLength(1);
    expect(b.lines[0]!.qty).toBe(2);
    expect(draft.lines.map((l) => l.qty)).toEqual([2, 3]);
    expect(draft.lines[0]!.status).toBe("待采购");
    expect(state.requests).toHaveLength(1);
  });

  it.each([1, 5])("采购量 %i 与来源 2 不符提示，确认可审核且来源保持不变", (qty) => {
    const { state, draft } = sourced();
    draft.lines[0]!.qty = 2;
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      draftLines: [{ draftId: draft.id, lineId: draft.lines[0]!.id }],
      lineEdits: {
        [`draft:${draft.id}:0`]: { qty, unitPrice: 0.11, dueDate: "2026-11-01", remark: "分批" },
      },
    });
    expect(purchaseDifferences(state, order.id)).toEqual([
      { material: draft.lines[0]!.material, source: draft.id, required: 2, qty },
    ]);
    expect(() => auditPurchase(state, order.id)).toThrow("差异");
    auditPurchase(state, order.id, true);
    expect(order.status).toBe("已审核");
    expect(order.lines[0]!.amount).toBe(qty * 0.11);
    expect(order.lines[0]!.dueDate).toBe("2026-11-01");
    expect(draft.lines[0]!.qty).toBe(2);
  });

  it("请购逐行重复取料，修改移除来源和手工行后仅更新采购明细", () => {
    const state = seed();
    const request = state.requests[0]!;
    request.lines.push({ material: "M001", qty: 2 });
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      requestLines: [{ requestId: request.id, lineIndex: 1 }],
      lines: [{ material: "M003", qty: 1 }],
    });
    expect(order.lines[0]!.requestLine).toBe("1");
    const repeated = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      requestLines: [{ requestId: request.id, lineIndex: 1 }],
    });
    expect(repeated.lines[0]!.qty).toBe(2);
    updatePurchase(state, order.id, {
      buyer: "甲",
      supplier: "乙",
      lines: [],
      sources: {
        lines: [{ material: "M002", qty: 3 }],
        lineEdits: { "manual:0": { unitPrice: 1.23, dueDate: "2026-12-01", remark: "新的" } },
      },
    });
    expect(order.lines).toHaveLength(1);
    expect(order.amount).toBe(3.69);
    expect(request.lines[1]!.qty).toBe(2);
  });

  it("历史金额不编造单价，改数量须清空历史总额；有单价时按分统一计算", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ material: "M001", qty: 2 }],
      lineAmounts: { "manual:0": 5 },
    });
    expect(order.lines[0]!.unitPrice).toBeUndefined();
    updatePurchase(state, order.id, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ ...order.lines[0]!, qty: 3 }],
    });
    expect(order.amount).toBeNull();
    updatePurchase(state, order.id, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ ...order.lines[0]!, unitPrice: 0.1 }],
    });
    expect(order.amount).toBe(0.3);
    expect(purchaseTotal(order.lines)).toBe(0.3);
  });

  it("多张待收货单共同占用，修改数量不能超量，实收差额释放且防重复入库", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ material: "M001", qty: 10 }],
    });
    auditPurchase(state, order.id);
    const lineId = order.lines[0]!.id;
    const first = createReceipt(state, order.id, "BZ01", [{ lineId, qty: 6 }], {
      carrier: "顺丰",
      tracking: "SF1",
    });
    const second = createReceipt(state, order.id, "BZ01", [{ lineId, qty: 4 }]);
    expect(state.stocks["BZ01:M001"]).toBe(2);
    expect(state.inbounds).toHaveLength(0);
    expect(receiptRemaining(state, order.id)[0]!.qty).toBe(0);
    const saved = JSON.stringify(state);
    expect(() => updateReceipt(state, second.id, [{ lineId, qty: 5 }])).toThrow("超过");
    expect(JSON.stringify(state)).toBe(saved);
    confirmReceipt(state, first.id, [{ lineId, qty: 3 }]);
    expect(state.stocks["BZ01:M001"]).toBe(5);
    expect(receiptRemaining(state, order.id)[0]!.qty).toBe(3);
    expect(order.lines[0]!.received).toBe(3);
    expect(state.inbounds[0]!.receipt).toBe(first.id);
    expect(() => confirmReceipt(state, first.id)).toThrow("重复");
    expect(() => updateReceipt(state, first.id, [{ lineId, qty: 1 }])).toThrow("待收货");
    confirmReceipt(state, second.id);
    const last = createReceipt(state, order.id, "BZ01", [{ lineId, qty: 3 }]);
    confirmReceipt(state, last.id);
    expect(order.receiptStatus).toBe("全部收货");
    expect(order.lines[0]!.received).toBe(10);
  });

  it("采购返审按下游审核状态，待单引用保留，不能合并丢失来源", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ material: "M001", qty: 3 }],
    });
    auditPurchase(state, order.id);
    const receipt = createReceipt(state, order.id, "BZ01", [
      { lineId: order.lines[0]!.id, qty: 3 },
    ]);
    unauditPurchase(state, order.id);
    expect(order.status).toBe("未审核");
    expect(() =>
      updatePurchase(state, order.id, {
        buyer: "甲",
        supplier: "乙",
        lines: [],
        sources: { lines: [{ material: "M002", qty: 1 }] },
      })
    ).toThrow("收货单引用");
    const other = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ material: "M001", qty: 1 }],
    });
    expect(() => mergePurchases(state, [order.id, other.id])).toThrow("收货单引用");
    auditPurchase(state, order.id);
    confirmReceipt(state, receipt.id);
    expect(() => unauditPurchase(state, order.id)).toThrow("已审核");
    unauditReceipt(state, receipt.id);
    expect(state.stocks["BZ01:M001"]).toBe(2);
    expect(state.inbounds).toHaveLength(0);
    expect(state.movements.some((m) => m.reason.includes(receipt.id))).toBe(false);
    unauditPurchase(state, order.id);
    expect(order.status).toBe("未审核");
  });

  it("收货库存已使用时原子阻止反审核", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "甲",
      supplier: "乙",
      lines: [{ material: "M001", qty: 3 }],
    });
    auditPurchase(state, order.id);
    const receipt = createReceipt(state, order.id, "BZ01", [
      { lineId: order.lines[0]!.id, qty: 3 },
    ]);
    confirmReceipt(state, receipt.id);
    state.stocks["BZ01:M001"] = 1;
    const saved = JSON.stringify(state);
    expect(() => unauditReceipt(state, receipt.id)).toThrow("库存不足");
    expect(JSON.stringify(state)).toBe(saved);
  });

  it("领料允许多次部分、任意正常仓库，按同仓物料合计校验且不推定齐料", () => {
    const { state, plan } = sourced();
    const issue = createIssue(state, plan.id, [{ warehouse: "XC01", material: "M001", qty: 1 }]);
    expect(plan.status).toBe("待备料");
    const second = createIssue(state, plan.id, [{ warehouse: "BZ01", material: "M001", qty: 1 }]);
    expect(state.issues).toHaveLength(2);
    const saved = JSON.stringify(state);
    expect(() =>
      createIssue(state, plan.id, [
        { warehouse: "BZ01", material: "M001", qty: 1 },
        { warehouse: "BZ01", material: "M001", qty: 1 },
      ])
    ).toThrow("库存不足");
    expect(JSON.stringify(state)).toBe(saved);
    unauditIssue(state, issue.id);
    expect(state.stocks["XC01:M001"]).toBe(1);
    auditIssue(state, issue.id);
    expect(state.stocks["XC01:M001"]).toBe(0);
    expect(second.auditStatus).toBe("已审核");
  });

  it("未领料的已审核计划可以完工，仍防重复完工", () => {
    const state = seed();
    const plan = state.plans[0]!;
    finishPlan(state, plan.id);
    expect(plan.status).toBe("已完工");
    expect(state.issues).toHaveLength(0);
    expect(() => finishPlan(state, plan.id)).toThrow("重复");
  });

  it("迁移保留历史审核和金额，新底稿不再按计划错误合并", () => {
    const state = seed();
    const plan = state.plans[0]!;
    const a = createManualDraft(state, { plan: plan.id, lines: [{ material: "M001", qty: 1 }] });
    const b = createManualDraft(state, { plan: plan.id, lines: [{ material: "M002", qty: 1 }] });
    auditDraft(state, a.id);
    migrateDrafts(state);
    expect(state.drafts.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect(state.drafts.find((d) => d.id === a.id)!.auditStatus).toBe("已审核");
    expect(state.drafts.find((d) => d.id === b.id)!.auditStatus).toBe("未审核");
    const saved = JSON.stringify(state);
    migrateDrafts(state);
    expect(JSON.stringify(state)).toBe(saved);
  });
});
