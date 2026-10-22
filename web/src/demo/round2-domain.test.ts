import { describe, expect, it } from "vitest";
import {
  assertWorkOrderReadyToShip,
  createFinishedInbound,
  createIssue,
  createPurchase,
  createReceipt,
  confirmReceipt,
  auditPurchase,
  createWorkOrder,
  finishedProducts,
  materialIsActive,
  migrateDrafts,
  requirements,
  seed,
  shipWorkOrder,
  stockKey,
  updatePlan,
  validateLines,
  workOrderShipmentLines,
} from "./model";
import {
  createMaterial,
  deleteMaterial,
  materialDraft,
  setMaterialInactive,
} from "./material-profile";
import { migrateProductMaterials } from "./product-materials";

function newMaterial(state: ReturnType<typeof seed>, id: string, category = "Y") {
  return createMaterial(state, id, {
    ...materialDraft({ id, name: "测试物料", spec: "A", unit: "个", price: 0 }),
    category,
  });
}

describe("第二轮物料生命周期", () => {
  it("新增校验失败不留半条数据，品号唯一且不编造价格", () => {
    const state = seed();
    const before = state.materials.length;
    expect(() => createMaterial(state, "NEW", { name: "" })).toThrow("品名");
    expect(state.materials).toHaveLength(before);
    newMaterial(state, " NEW ");
    expect(state.materials.find((material) => material.id === "NEW")?.price).toBe(0);
    expect(() => newMaterial(state, "NEW")).toThrow("已存在");
    expect(() => newMaterial(state, "BAD:ID")).toThrow("品号");
  });

  it("停用禁止新增业务，恢复后允许，历史资料保留", () => {
    const state = seed();
    setMaterialInactive(state, "M001", true);
    expect(materialIsActive(state.materials.find((material) => material.id === "M001")!)).toBe(
      false
    );
    expect(() => validateLines(state, [{ material: "M001", qty: 1 }])).toThrow("停用");
    expect(() =>
      createPurchase(state, {
        buyer: "采购",
        supplier: "供应商",
        lines: [{ material: "M001", qty: 1 }],
      })
    ).toThrow("停用");
    expect(state.plans[0]!.product).toBe("FG001");
    setMaterialInactive(state, "M001", false);
    expect(() => validateLines(state, [{ material: "M001", qty: 1 }])).not.toThrow();
  });

  it("删除检查库存、BOM和单据引用，已删除源表物料刷新不复活", () => {
    const state = seed();
    expect(() => deleteMaterial(state, "M001")).toThrow("库存");
    for (const key of Object.keys(state.stocks)) if (key.endsWith(":M001")) state.stocks[key] = 0;
    expect(() => deleteMaterial(state, "M001")).toThrow("引用");
    newMaterial(state, "REF");
    state.requests.push({
      id: "REF-PR",
      plan: "",
      applicant: "测试",
      date: "2026-10-22",
      status: "待采购",
      lines: [{ material: "REF", qty: 1 }],
    });
    expect(() => deleteMaterial(state, "REF")).toThrow("引用");
    const libraryMaterial = state.materials.find((material) => material.id.startsWith("MOCK-"))!;
    deleteMaterial(state, libraryMaterial.id);
    migrateProductMaterials(state);
    expect(state.materials.some((material) => material.id === libraryMaterial.id)).toBe(false);
  });

  it("停用不阻断已经建立的待收货单实际到货", () => {
    const state = seed();
    const order = createPurchase(state, {
      buyer: "采购",
      supplier: "供应商",
      lines: [{ material: "M001", qty: 1 }],
    });
    auditPurchase(state, order.id);
    const receipt = createReceipt(state, order.id, "BZ01", [
      { lineId: order.lines[0]!.id, qty: 1 },
    ]);
    setMaterialInactive(state, "M001", true);
    expect(() => confirmReceipt(state, receipt.id)).not.toThrow();
    expect(receipt.status).toBe("已收货");
  });
});

describe("第二轮计划物料编辑", () => {
  it("只修改本计划BOM，保持每台计算且拒绝重复、停用新增", () => {
    const state = seed();
    const plan = state.plans[0]!;
    plan.auditStatus = "未审核";
    const other = JSON.stringify(state.plans[1]);
    const lines = [{ material: "M002", qty: 3 }];
    updatePlan(state, plan.id, { ...plan, qty: 2, bom: lines });
    expect(requirements(plan)).toEqual([{ material: "M002", qty: 6 }]);
    lines[0]!.qty = 99;
    expect(plan.bom![0]!.qty).toBe(3);
    expect(JSON.stringify(state.plans[1])).toBe(other);
    expect(() =>
      updatePlan(state, plan.id, {
        ...plan,
        bom: [
          { material: "M002", qty: 1 },
          { material: "M002", qty: 2 },
        ],
      })
    ).toThrow("重复");
    newMaterial(state, "INACTIVE");
    setMaterialInactive(state, "INACTIVE", true);
    expect(() =>
      updatePlan(state, plan.id, { ...plan, bom: [{ material: "INACTIVE", qty: 1 }] })
    ).toThrow("停用");
    setMaterialInactive(state, "M002", true);
    expect(() => updatePlan(state, plan.id, { ...plan, name: "保留原有停用物料" })).not.toThrow();
  });

  it("总需求计划保持数量1，移除明细后不影响原导入来源", () => {
    const state = seed();
    const plan = state.plans[0]!;
    plan.auditStatus = "未审核";
    plan.qty = 1;
    plan.importSource = { file: "test.xlsx", sheet: "Sheet1", basis: "total", rows: [] };
    expect(() => updatePlan(state, plan.id, { ...plan, qty: 2 })).toThrow("总需求");
    updatePlan(state, plan.id, { ...plan, bom: [{ material: "M003", qty: 8 }] });
    expect(requirements(plan)).toEqual([{ material: "M003", qty: 8 }]);
    expect(plan.importSource.basis).toBe("total");
    expect(() => updatePlan(state, plan.id, { ...plan, bom: [] })).toThrow("BOM");
  });

  it("领料不能绕过BOM限制", () => {
    const state = seed();
    state.stocks[stockKey("BZ01", "M005")] = 10;
    expect(() =>
      createIssue(state, state.plans[0]!.id, [{ material: "M005", qty: 1, warehouse: "BZ01" }])
    ).toThrow("BOM");
  });
});

describe("工单独立成品入库与发货闭环", () => {
  it("新成品分类可用于工单，停用后不再可选", () => {
    const state = seed();
    newMaterial(state, "CUSTOM-FG", "D");
    expect(finishedProducts(state).some((material) => material.id === "CUSTOM-FG")).toBe(true);
    const order = createWorkOrder(state, { name: "新成品工单", product: "CUSTOM-FG", qty: 1 });
    expect(order.product).toBe("CUSTOM-FG");
    setMaterialInactive(state, "CUSTOM-FG", true);
    expect(() =>
      createWorkOrder(state, { name: "停用成品工单", product: "CUSTOM-FG", qty: 1 })
    ).toThrow("启用");
  });

  it("独立入库原子增加库存流水，重复单号拒绝且不改变计划执行状态", () => {
    const state = seed();
    const plan = state.plans[0]!;
    const beforeStatus = plan.status;
    const stock = state.stocks[stockKey("CP01", "FG001")] || 0;
    const input = {
      id: "FI-TEST",
      workOrder: plan.workOrder!,
      warehouse: "CP01",
      date: "2026-10-21",
      lines: [{ material: "FG001", qty: 2 }],
    };
    const document = createFinishedInbound(state, input);
    expect(state.stocks[stockKey("CP01", "FG001")]).toBe(stock + 2);
    expect(state.movements[0]).toMatchObject({ source: document.id, qty: 2, date: "2026-10-21" });
    expect(plan.status).toBe(beforeStatus);
    const snapshot = JSON.stringify(state);
    expect(() => createFinishedInbound(state, input)).toThrow("重复");
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(() =>
      createFinishedInbound(state, {
        ...input,
        id: "FI-BAD",
        lines: [
          { material: "FG001", qty: 1 },
          { material: "M001", qty: 1 },
        ],
      })
    ).toThrow("成品分类");
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(() => deleteMaterial(state, "FG001")).toThrow();
  });

  it("旧数据迁移补空集合并保留已有入库，不允许错误格式伪成功", () => {
    const state = seed();
    delete state.finishedInbounds;
    migrateDrafts(state);
    expect(state.finishedInbounds).toEqual([]);
    createFinishedInbound(state, {
      workOrder: state.workOrders[0]!.id,
      warehouse: "CP01",
      lines: [{ material: "FG001", qty: 1 }],
    });
    const loaded = JSON.parse(JSON.stringify(state));
    migrateDrafts(loaded);
    expect(loaded.finishedInbounds).toHaveLength(1);
    loaded.finishedInbounds = {};
    expect(() => migrateDrafts(loaded)).toThrow("格式");
  });

  it("计划不必标记完工，足量工单入库后可按既有一次发货规则发货", () => {
    const state = seed();
    const order = state.workOrders[0]!;
    order.status = "待出货";
    const lines = workOrderShipmentLines(state, order.id);
    expect(() => assertWorkOrderReadyToShip(state, order.id)).toThrow("足量入库");
    createFinishedInbound(state, { workOrder: order.id, warehouse: "CP01", lines });
    expect(assertWorkOrderReadyToShip(state, order.id)).toEqual(lines);
    const shipment = shipWorkOrder(state, order.id, { carrier: "测试物流", tracking: "TEST001" });
    expect(shipment.lines).toEqual(lines);
    expect(state.plans[0]!.status).toBe("待分析");
    expect(order.status).toBe("已发货");
    expect(() =>
      shipWorkOrder(state, order.id, { carrier: "测试物流", tracking: "TEST001" })
    ).toThrow("待出货");
  });

  it("没有计划的工单使用工单成品数量，入库其他工单不能覆盖", () => {
    const state = seed();
    const order = createWorkOrder(state, { name: "无计划工单", product: "FG002", qty: 3 });
    order.status = "待出货";
    createFinishedInbound(state, {
      workOrder: state.workOrders.find((workOrder) => workOrder.id !== order.id)!.id,
      warehouse: "CP01",
      lines: [{ material: "FG002", qty: 3 }],
    });
    expect(() => assertWorkOrderReadyToShip(state, order.id)).toThrow("足量入库");
    expect(workOrderShipmentLines(state, order.id)).toEqual([{ material: "FG002", qty: 3 }]);
    createFinishedInbound(state, {
      workOrder: order.id,
      warehouse: "CP01",
      lines: [{ material: "FG002", qty: 3 }],
    });
    expect(() => assertWorkOrderReadyToShip(state, order.id)).not.toThrow();
  });
});
