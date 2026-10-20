import { describe, expect, it } from "vitest";
import {
  seed,
  analysis,
  createDraft,
  createPurchase,
  appendPurchase,
  auditPurchase,
  unauditPurchase,
  mergePurchases,
  updatePurchase,
  receive,
  createIssue,
  issuePlan,
  finishPlan,
  setWorkOrderStatus,
  shipWorkOrder,
  migrateDrafts,
  stockKey,
} from "./model";

describe("采购和工单新流程", () => {
  it("跨计划选择部分底稿并追加物料，采购单不直接关联计划", () => {
    const s = seed();
    createDraft(s, s.plans[0]!.id);
    createDraft(s, s.plans[1]!.id);
    const a = s.drafts.find((d) => d.plan === s.plans[0]!.id)!;
    const b = s.drafts.find((d) => d.plan === s.plans[1]!.id)!;
    const order = createPurchase(s, {
      buyer: "采购员",
      supplier: "供应商",
      draftLines: [
        { draftId: a.id, lineId: a.lines[0]!.id },
        { draftId: b.id, lineId: b.lines[0]!.id },
      ],
    });
    expect(order.plan).toBe("");
    expect(order.lines.map((l) => l.draft)).toEqual([a.id, b.id]);
    expect(s.drafts.some((d) => d.status === "待采购")).toBe(true);
    appendPurchase(s, order.id, { lines: [{ material: "M001", qty: 2 }] });
    expect(order.lines).toHaveLength(3);
    auditPurchase(s, order.id);
    expect(() => appendPurchase(s, order.id, { lines: [{ material: "M001", qty: 2 }] })).toThrow(
      "未审核"
    );
    unauditPurchase(s, order.id);
    expect(order.status).toBe("未审核");
  });
  it("合并保留空金额及来源，旧单不能重复业务，不同供应商不允许合并", () => {
    const s = seed();
    const a = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      lineAmounts: { "manual:0": 10 },
      lines: [{ material: "M001", qty: 1 }],
    });
    const b = createPurchase(s, {
      buyer: "乙",
      supplier: "A",
      lines: [{ material: "M001", qty: 2 }],
    });
    const merged = mergePurchases(s, [a.id, b.id]);
    expect(merged.amount).toBeNull();
    expect(merged.lines).toHaveLength(2);
    expect(a.mergedInto).toBe(merged.id);
    expect(() => auditPurchase(s, a.id)).toThrow();
    const c = createPurchase(s, {
      buyer: "丙",
      supplier: "B",
      lineAmounts: { "manual:0": 20 },
      lines: [{ material: "M002", qty: 1 }],
    });
    expect(() => mergePurchases(s, [merged.id, c.id])).toThrow("同供应商");
    expect(merged.mergedInto).toBeUndefined();
  });
  it("收货校验失败无部分变更，分次收货生成不可变入库并禁止反审核超收", () => {
    const s = seed();
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      lines: [
        { material: "M001", qty: 3 },
        { material: "M002", qty: 2 },
      ],
    });
    expect(() => receive(s, order.id, "BZ01")).toThrow("已审核");
    auditPurchase(s, order.id);
    const before = JSON.stringify(s);
    expect(() =>
      receive(s, order.id, "BZ01", [
        { lineId: order.lines[0]!.id, qty: 1 },
        { lineId: order.lines[1]!.id, qty: 3 },
      ])
    ).toThrow("超过");
    expect(JSON.stringify(s)).toBe(before);
    const receipt = receive(s, order.id, "BZ01", [{ lineId: order.lines[0]!.id, qty: 1 }]);
    expect(order.receiptStatus).toBe("部分收货");
    expect(s.inbounds[0]!.receipt).toBe(receipt.id);
    expect(s.stocks[stockKey("BZ01", "M001")]).toBe(3);
    expect(() => unauditPurchase(s, order.id)).toThrow("收货");
    receive(s, order.id, "BZ01");
    expect(order.receiptStatus).toBe("全部收货");
    expect(order.status).toBe("已审核");
    expect(s.receipts).toHaveLength(2);
    expect(() => receive(s, order.id, "BZ01")).toThrow();
  });
  it("采购领料完工发货走完闭环且重复操作被阻止", () => {
    const s = seed();
    const plan = s.plans[0]!;
    const work = s.workOrders[0]!;
    createDraft(s, plan.id);
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      draftIds: s.drafts.map((d) => d.id),
    });
    auditPurchase(s, order.id);
    receive(s, order.id, "BZ01");
    issuePlan(s, plan.id);
    expect(s.issues).toHaveLength(1);
    expect(s.movements.filter((m) => m.source === s.issues[0]!.id)).toHaveLength(4);
    expect(() => issuePlan(s, plan.id)).toThrow();
    finishPlan(s, plan.id);
    expect(() => setWorkOrderStatus(s, work.id, "已发货")).toThrow("发货操作");
    setWorkOrderStatus(s, work.id, "待出货");
    const shipment = shipWorkOrder(s, work.id, { carrier: "顺丰", tracking: "SF001" });
    expect(shipment.lines).toEqual([{ material: plan.product, qty: 5 }]);
    expect(s.stocks[stockKey("CP01", plan.product)]).toBe(2);
    expect(work.status).toBe("已发货");
    expect(() => shipWorkOrder(s, work.id, { carrier: "顺丰", tracking: "SF001" })).toThrow();
  });
  it("旧单物料底稿按计划归并，行状态来源金额和到货保留，迁移幂等", () => {
    const s = seed();
    const draft = createDraft(s, s.plans[0]!.id);
    const oldLines = draft.lines;
    s.drafts = oldLines.map((line, index) => ({
      ...draft,
      id: `OLD-${index}`,
      status: index === 0 ? "已转采购" : "待采购",
      lines: [{ ...line, id: undefined, status: undefined }],
    })) as unknown as typeof s.drafts;
    const order = s.purchases[0]!;
    order.draft = "OLD-0";
    order.lines = [
      {
        ...order.lines[0]!,
        material: oldLines[0]!.material,
        qty: oldLines[0]!.qty,
        received: 1,
        amount: 12.34,
        draft: "OLD-0",
      },
    ];
    order.amount = 12.34;
    migrateDrafts(s);
    expect(s.drafts).toHaveLength(1);
    expect(s.drafts[0]!.id).toBe("OLD-0");
    expect(s.drafts[0]!.status).toBe("待采购");
    expect(s.drafts[0]!.lines.map((l) => l.status)).toEqual([
      "已转采购",
      "待采购",
      "待采购",
      "待采购",
    ]);
    expect(order.lines[0]!.draftLine).toBe("OLD-0-L1");
    expect(order.lines[0]!.amount).toBe(12.34);
    expect(order.lines[0]!.received).toBe(1);
    expect(s.drafts[0]!.lines.map((l) => l.sourceLine)).toEqual(oldLines.map((l) => l.sourceLine));
    const saved = JSON.stringify(s);
    migrateDrafts(s);
    expect(JSON.stringify(s)).toBe(saved);
  });
  it("已填金额合并求和，审核单不能参与合并", () => {
    const s = seed();
    const a = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      lineAmounts: { "manual:0": 0 },
      lines: [{ material: "M001", qty: 1 }],
    });
    const b = createPurchase(s, {
      buyer: "乙",
      supplier: "A",
      lineAmounts: { "manual:0": 20.5 },
      lines: [{ material: "M002", qty: 1 }],
    });
    expect(mergePurchases(s, [a.id, b.id]).amount).toBe(20.5);
    const c = createPurchase(s, {
      buyer: "丙",
      supplier: "A",
      lines: [{ material: "M003", qty: 1 }],
    });
    auditPurchase(s, c.id);
    expect(() => mergePurchases(s, [s.purchases[1]!.id, c.id])).toThrow("未审核");
  });
  it("领料逐仓验证失败不产生部分出库，工单多个不同产品计划汇总发货", () => {
    const s = seed();
    const a = s.plans[0]!;
    const b = s.plans[1]!;
    const work = s.workOrders[0]!;
    a.qty = 1;
    b.qty = 1;
    b.workOrder = work.id;
    const before = JSON.stringify(s);
    expect(() => createIssue(s, a.id, [{ warehouse: "BZ01", material: "M001", qty: 1 }])).toThrow(
      "全部需求"
    );
    expect(JSON.stringify(s)).toBe(before);
    issuePlan(s, a.id);
    finishPlan(s, a.id);
    issuePlan(s, b.id);
    finishPlan(s, b.id);
    setWorkOrderStatus(s, work.id, "待出货");
    const shipment = shipWorkOrder(s, work.id, { carrier: "顺丰", tracking: "SF002" });
    expect(shipment.lines).toEqual([
      { material: "FG001", qty: 1 },
      { material: "FG002", qty: 1 },
    ]);
    expect(s.stocks["CP01:FG001"]).toBe(2);
    expect(s.stocks["CP01:FG002"]).toBe(0);
  });
  it("合并跨计划同物料后序先收货，不重复缺料且前序不能抢领到货", () => {
    const s = seed();
    const a = s.plans[0]!;
    const b = s.plans[1]!;
    a.bom = [{ material: "M001", qty: 1 }];
    b.bom = [{ material: "M001", qty: 1 }];
    createDraft(s, a.id);
    createDraft(s, b.id);
    const da = s.drafts.find((d) => d.plan === a.id)!;
    const db = s.drafts.find((d) => d.plan === b.id)!;
    const pa = createPurchase(s, { buyer: "甲", supplier: "A", draftIds: [da.id] });
    const pb = createPurchase(s, { buyer: "乙", supplier: "A", draftIds: [db.id] });
    const merged = mergePurchases(s, [pa.id, pb.id]);
    auditPurchase(s, merged.id);
    receive(s, merged.id, "BZ01", [
      { lineId: merged.lines.find((l) => l.draft === db.id)!.id, qty: 1 },
    ]);
    expect(analysis(s, a)[0]!.shortage).toBe(0);
    expect(analysis(s, b)[0]!.shortage).toBe(0);
    expect(analysis(s, a)[0]!.usable).toBe(2);
    expect(() => issuePlan(s, a.id)).toThrow("库存不足");
    const before = JSON.stringify(s);
    expect(() => createDraft(s, b.id)).toThrow("无新增缺料");
    expect(JSON.stringify(s)).toBe(before);
    receive(s, merged.id, "BZ01");
    expect(analysis(s, a)[0]!.shortage).toBe(0);
    expect(analysis(s, b)[0]!.shortage).toBe(0);
    issuePlan(s, a.id);
    issuePlan(s, b.id);
    expect(s.stocks["BZ01:M001"]).toBe(0);
    const saved = JSON.stringify(s);
    migrateDrafts(s);
    migrateDrafts(s);
    expect(merged.lines.map((l) => l.draft)).toEqual([da.id, db.id]);
    expect(s.purchases.find((p) => p.id === pa.id)!.mergedInto).toBe(merged.id);
    expect(JSON.parse(saved).stocks).toEqual(s.stocks);
  });
  it("来源行金额独立填写，追加空行合计为空，补齐后按分求和", () => {
    const s = seed();
    createDraft(s, s.plans[0]!.id);
    const draft = s.drafts[0]!;
    s.requests[0]!.status = "待采购";
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      draftLines: [{ draftId: draft.id, lineId: draft.lines[0]!.id }],
      requestIds: [s.requests[0]!.id],
      lines: [{ material: "M001", qty: 1 }],
      amount: 999,
      lineAmounts: {
        [`draft:${draft.id}:0`]: 0.1,
        [`request:${s.requests[0]!.id}:0`]: 0.2,
        "manual:0": 0,
      },
    });
    expect(order.lines.map((l) => l.amount)).toEqual([0.1, 0.2, 0]);
    expect(order.amount).toBe(0.3);
    appendPurchase(s, order.id, { lines: [{ material: "M002", qty: 1 }] });
    expect(order.amount).toBeNull();
    const added = order.lines[3]!;
    updatePurchase(s, order.id, {
      buyer: "甲",
      supplier: "A",
      amount: 999,
      lineAmounts: { [added.id]: 1.01 },
    });
    expect(order.amount).toBe(1.31);
    updatePurchase(s, order.id, { buyer: "甲", supplier: "A", lineAmounts: { [added.id]: null } });
    expect(order.amount).toBeNull();
  });
  it("非法行金额创建追加更新均原子失败", () => {
    const s = seed();
    createDraft(s, s.plans[0]!.id);
    const draft = s.drafts[0]!;
    const before = JSON.stringify(s);
    expect(() =>
      createPurchase(s, {
        buyer: "甲",
        supplier: "A",
        draftIds: [draft.id],
        lineAmounts: { [`draft:${draft.id}:0`]: 1.001 },
      })
    ).toThrow("两位");
    expect(JSON.stringify(s)).toBe(before);
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      lines: [{ material: "M001", qty: 1 }],
      lineAmounts: { "manual:0": 0.1 },
    });
    const saved = JSON.stringify(s);
    for (const amount of [-1, Infinity, NaN, 0.001]) {
      expect(() =>
        appendPurchase(s, order.id, {
          draftIds: [draft.id],
          lineAmounts: { [`draft:${draft.id}:0`]: amount },
        })
      ).toThrow();
      expect(() =>
        updatePurchase(s, order.id, {
          buyer: "变更",
          supplier: "A",
          lineAmounts: { [order.lines[0]!.id]: amount },
        })
      ).toThrow();
      expect(JSON.stringify(s)).toBe(saved);
    }
  });
  it("旧单头金额仅保存为历史金额，不分摊到物料，迁移幂等", () => {
    const s = seed();
    const order = s.purchases[0]!;
    order.amount = 88.88;
    migrateDrafts(s);
    expect(order.legacyAmount).toBe(88.88);
    expect(order.amount).toBeNull();
    expect(order.lines[0]!.amount).toBeNull();
    const saved = JSON.stringify(s);
    migrateDrafts(s);
    expect(JSON.stringify(s)).toBe(saved);
  });
  it("计划底稿精确选行，部分转单保留头待采购，金额按原索引且最后行转完才完成", () => {
    const s = seed();
    const draft = createDraft(s, s.plans[0]!.id);
    const selected = draft.lines[2]!;
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      draftLines: [{ draftId: draft.id, lineId: selected.id }],
      lineAmounts: { [`draft:${draft.id}:2`]: 23.45 },
    });
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]!.draftLine).toBe(selected.id);
    expect(order.amount).toBe(23.45);
    expect(selected.status).toBe("已转采购");
    expect(draft.status).toBe("待采购");
    expect(analysis(s, s.plans[0]!)[2]!.pending).toBe(selected.qty);
    const saved = JSON.stringify(s);
    expect(() =>
      appendPurchase(s, order.id, { draftLines: [{ draftId: draft.id, lineId: selected.id }] })
    ).toThrow("已转");
    expect(JSON.stringify(s)).toBe(saved);
    appendPurchase(s, order.id, { draftIds: [draft.id] });
    expect(order.lines).toHaveLength(4);
    expect(draft.status).toBe("已转采购");
    expect(analysis(s, s.plans[0]!).every((l) => l.shortage === 0)).toBe(true);
  });
  it("已转底稿新增缺料追加到原单，同物料新增数量保留历史行及覆盖", () => {
    const s = seed();
    const plan = s.plans[0]!;
    plan.bom = [{ material: "M001", qty: 1 }];
    const draft = createDraft(s, plan.id);
    const original = { ...draft.lines[0]! };
    const order = createPurchase(s, { buyer: "甲", supplier: "A", draftIds: [draft.id] });
    plan.qty = 6;
    const updated = createDraft(s, plan.id);
    expect(updated.id).toBe(draft.id);
    expect(s.drafts).toHaveLength(1);
    expect(updated.lines).toHaveLength(2);
    expect(updated.lines[0]).toEqual({ ...original, status: "已转采购" });
    expect(updated.lines[1]!.qty).toBe(1);
    expect(updated.lines[1]!.id).not.toBe(original.id);
    expect(updated.status).toBe("待采购");
    expect(analysis(s, plan)[0]!.pending).toBe(4);
    expect(analysis(s, plan)[0]!.shortage).toBe(0);
    expect(() => createDraft(s, plan.id)).toThrow("无新增缺料");
    appendPurchase(s, order.id, {
      draftLines: [{ draftId: draft.id, lineId: updated.lines[1]!.id }],
    });
    expect(updated.status).toBe("已转采购");
  });
  it("归并迁移保留原计划库存排队及相同物料不同历史行来源", () => {
    const s = seed();
    const a = createDraft(s, s.plans[0]!.id);
    const b = createDraft(s, s.plans[1]!.id);
    const duplicate = {
      ...a,
      id: "OLD-A-EXTRA",
      lines: [{ ...a.lines[0]!, id: "OLD-A-L", qty: 1, status: "已转采购" as const }],
      status: "已转采购" as const,
    };
    s.drafts.unshift(duplicate);
    const order = createPurchase(s, {
      buyer: "甲",
      supplier: "A",
      draftLines: [
        { draftId: a.id, lineId: a.lines[0]!.id },
        { draftId: b.id, lineId: b.lines[0]!.id },
      ],
    });
    order.lines.push({
      ...order.lines[0]!,
      id: "EXTRA-P-L",
      draft: duplicate.id,
      draftLine: "OLD-A-L",
      qty: 1,
      received: 0,
    });
    const before = analysis(s, s.plans[1]!)[0]!.reserved;
    migrateDrafts(s);
    expect(s.drafts).toHaveLength(2);
    expect(analysis(s, s.plans[1]!)[0]!.reserved).toBe(before);
    const merged = s.drafts.find((d) => d.plan === a.plan)!;
    expect(merged.id).toBe(duplicate.id);
    expect(order.lines[0]!.draft).toBe(merged.id);
    expect(order.lines[0]!.draftLine).toBe(a.lines[0]!.id);
    expect(order.lines[2]!.draftLine).toBe("OLD-A-L");
    const saved = JSON.stringify(s);
    migrateDrafts(s);
    expect(JSON.stringify(s)).toBe(saved);
  });
});
