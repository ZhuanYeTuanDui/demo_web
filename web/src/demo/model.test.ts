import { describe, expect, it } from "vitest";
import {
  seed,
  analysis,
  createRequest,
  convertRequest,
  receive,
  issuePlan,
  finishPlan,
  stockKey,
  move,
} from "./model";

describe("采购与生产演示闭环", () => {
  it("根据可用仓库存计算缺料，转单、收货、领料和完工均生成正确记录", () => {
    const s = seed();
    const plan = s.plans[0]!;
    const rows = analysis(s, plan);
    expect(rows.map((r) => r.shortage)).toEqual([3, 2, 8, 6]);
    // 现场仓另有一个 PLC，但不参与可用量。
    expect(rows[0]!.stock).toBe(2);
    const request = createRequest(s, plan.id);
    expect(() => createRequest(s, plan.id)).toThrow("无新增缺料");
    const order = convertRequest(s, request.id, "陈采购", "供应商 A");
    expect(() => convertRequest(s, request.id, "陈采购", "供应商 A")).toThrow();
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
    createRequest(s, s.plans[0]!.id);
    expect(analysis(s, s.plans[1]!)[0]!.usable).toBe(0);
    expect(analysis(s, s.plans[1]!)[0]!.shortage).toBe(2);
    createRequest(s, s.plans[1]!.id);
    expect(analysis(s, s.plans[0]!).every((r) => r.shortage === 0)).toBe(true);
    expect(() => createRequest(s, s.plans[0]!.id)).toThrow("无新增缺料");
  });
  it("校验采购必填、数量、仓库与库存不足", () => {
    const s = seed();
    const r = createRequest(s, s.plans[0]!.id);
    expect(() => convertRequest(s, r.id, "", "供应商")).toThrow("不能为空");
    expect(() => move(s, "BZ01", { material: "M001", qty: 3 }, "出库", "测试", "测试")).toThrow(
      "库存不足"
    );
    expect(() => move(s, "BZ01", { material: "M001", qty: -1 }, "入库", "测试", "测试")).toThrow();
    const o = convertRequest(s, r.id, "采购员", "供应商");
    expect(() => receive(s, o.id, "XC01")).toThrow("可用量");
    expect(o.status).toBe("待入库");
  });
});
