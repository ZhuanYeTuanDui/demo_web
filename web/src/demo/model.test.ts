import { describe, expect, it } from "vitest";
import {
  seed,
  analysis,
  createDraft,
  convertDraft,
  receive,
  issuePlan,
  finishPlan,
  stockKey,
  move,
  convertRequest,
  migrateDrafts,
  type PurchaseDraft,
} from "./model";

describe("采购与生产演示闭环", () => {
  it("底稿保留 BOM 和库存快照，不写请购记录，零缺料行不转采购", () => {
    const s = seed();
    s.plans[1]!.qty = 3;
    const count = s.requests.length;
    const draft = createDraft(s, s.plans[1]!.id);
    expect(s.requests).toHaveLength(count);
    expect(draft.lines).toHaveLength(4);
    expect(draft.lines.find((l) => l.material === "M002")!.qty).toBe(0);
    expect(draft.lines[0]!.bomQty).toBe(3);
    expect(draft.lines[0]!.qty).toBe(1);
    const snapshot = JSON.stringify(draft.lines);
    const order = convertDraft(s, draft.id, "采购员", "供应商");
    expect(order.request).toBe("");
    expect(order.draft).toBe(draft.id);
    expect(order.lines.map((l) => l.material)).toEqual(["M001", "M003"]);
    receive(s, order.id, "BZ01");
    expect(JSON.stringify(draft.lines)).toBe(snapshot);
  });
  it("迁移旧自动请购及采购关联，保留手工请购和库存，不伪造快照", () => {
    const s = seed();
    s.requests.unshift({
      id: "PR旧计划记录",
      plan: s.plans[0]!.id,
      applicant: "计划员",
      date: "2026-10-19",
      lines: [{ material: "M001", qty: 3 }],
      status: "待采购",
    });
    const order = convertRequest(s, "PR旧计划记录", "采购员", "供应商");
    const stocks = JSON.stringify(s.stocks);
    delete (s as { drafts?: PurchaseDraft[] }).drafts;
    migrateDrafts(s);
    expect(s.requests).toHaveLength(1);
    expect(s.requests[0]!.id).toBe("PR202610001");
    expect(order.request).toBe("");
    expect(order.draft).toBe("DG旧计划记录");
    expect(s.drafts[0]!.lines[0]!.qty).toBe(3);
    expect(s.drafts[0]!.lines[0]!.stock).toBeNull();
    expect(JSON.stringify(s.stocks)).toBe(stocks);
    migrateDrafts(s);
    expect(s.drafts).toHaveLength(1);
  });
  it("失效仓库保留库存记录，但不参与需求计算和新出入库", () => {
    const s = seed();
    s.warehouses.find((w) => w.id === "BZ01")!.inactive = true;
    expect(analysis(s, s.plans[0]!)[0]!.stock).toBe(0);
    expect(() => move(s, "BZ01", { material: "M001", qty: 1 }, "入库", "测试", "测试")).toThrow(
      "已失效"
    );
    expect(() => receive(s, s.purchases[0]!.id, "BZ01")).toThrow("可用量");
    expect(s.stocks[stockKey("BZ01", "M001")]).toBe(2);
    expect(s.movements).toHaveLength(2);
    s.warehouses.find((w) => w.id === "BZ01")!.inactive = false;
    expect(analysis(s, s.plans[0]!)[0]!.stock).toBe(2);
  });
  it("根据可用仓库存计算缺料，转单、收货、领料和完工均生成正确记录", () => {
    const s = seed();
    const plan = s.plans[0]!;
    const rows = analysis(s, plan);
    expect(rows.map((r) => r.shortage)).toEqual([3, 2, 8, 6]);
    // 现场仓另有一个 PLC，但不参与可用量。
    expect(rows[0]!.stock).toBe(2);
    const request = createDraft(s, plan.id);
    expect(() => createDraft(s, plan.id)).toThrow("无新增缺料");
    const order = convertDraft(s, request.id, "陈采购", "供应商 A");
    expect(() => convertDraft(s, request.id, "陈采购", "供应商 A")).toThrow();
    expect(analysis(s, plan).every((r) => r.shortage === 0)).toBe(true);
    expect(() => issuePlan(s, plan.id)).toThrow("库存不足");
    receive(s, order.id, "BZ01");
    expect(s.movements.filter((m) => m.source === order.id)).toHaveLength(4);
    expect(() => receive(s, order.id, "BZ01")).toThrow();
    issuePlan(s, plan.id);
    expect(s.stocks[stockKey("BZ01", "M001")]).toBe(0);
    expect(s.movements.filter((m) => m.source === plan.id && m.type === "出库")).toHaveLength(4);
    expect(() => issuePlan(s, plan.id)).toThrow();
    finishPlan(s, plan.id);
    expect(s.stocks[stockKey("CP01", "FG001")]).toBe(7);
    expect(plan.status).toBe("已完工");
    expect(() => finishPlan(s, plan.id)).toThrow();
  });
  it("已备料计划占用库存，后续计划不能重复使用同一库存", () => {
    const s = seed();
    createDraft(s, s.plans[0]!.id);
    expect(analysis(s, s.plans[1]!)[0]!.usable).toBe(0);
    expect(analysis(s, s.plans[1]!)[0]!.shortage).toBe(2);
    createDraft(s, s.plans[1]!.id);
    expect(analysis(s, s.plans[0]!).every((r) => r.shortage === 0)).toBe(true);
    expect(() => createDraft(s, s.plans[0]!.id)).toThrow("无新增缺料");
  });
  it("校验采购必填、数量、仓库与库存不足", () => {
    const s = seed();
    const r = createDraft(s, s.plans[0]!.id);
    expect(() => convertDraft(s, r.id, "", "供应商")).toThrow("不能为空");
    expect(() => move(s, "BZ01", { material: "M001", qty: 3 }, "出库", "测试", "测试")).toThrow(
      "库存不足"
    );
    expect(() => move(s, "BZ01", { material: "M001", qty: -1 }, "入库", "测试", "测试")).toThrow();
    const o = convertDraft(s, r.id, "采购员", "供应商");
    expect(() => receive(s, o.id, "XC01")).toThrow("可用量");
    expect(o.status).toBe("待入库");
  });
});
