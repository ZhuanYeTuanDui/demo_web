import {
  seed, createDraft, auditDraft, convertDraft, auditPurchase, createReceipt,
  confirmReceipt, receive, createIssue, createFinishedInbound, setWorkOrderStatus,
  shipWorkOrder, type State,
} from "./model";

export interface MockScenario {
  key: string;
  name: string;
  description: string;
  state: State;
}

/** 用真实业务方法生成彼此隔离的场景，不手填互相矛盾的库存与单据状态。 */
export function createMockScenarios(): MockScenario[] {
  const baseline = seed();
  const partial = seed();
  const purchase = partial.purchases[0]!;
  auditPurchase(partial, purchase.id);
  const receipt = createReceipt(partial, purchase.id, "BZ01", [
    { lineId: purchase.lines[0]!.id, qty: 2 },
  ], { carrier: "演示物流", tracking: "MOCK-RC-001" });
  confirmReceipt(partial, receipt.id);
  createReceipt(partial, purchase.id, "BZ01", [{ lineId: purchase.lines[0]!.id, qty: 2 }]);

  const production = seed();
  const plan = production.plans[0]!;
  const draft = createDraft(production, plan.id);
  auditDraft(production, draft.id);
  const order = convertDraft(production, draft.id, "演示采购员", "演示供应商");
  auditPurchase(production, order.id);
  receive(production, order.id, "BZ01");
  createIssue(production, plan.id);
  createFinishedInbound(production, {
    id: "FI-MOCK-001", workOrder: plan.workOrder!, warehouse: "CP01",
    lines: [{ material: plan.product, qty: plan.qty }], remark: "模拟工单成品入库",
  });

  const shipped: State = structuredClone(production);
  setWorkOrderStatus(shipped, plan.workOrder!, "待出货");
  shipWorkOrder(shipped, plan.workOrder!, { carrier: "演示物流", tracking: "MOCK-SH-001" });
  return [
    { key: "baseline", name: "基础待办", description: "已审核计划、待审核采购、未知价格及期初库存", state: baseline },
    { key: "partial-receipt", name: "分批到料", description: "实收 2 件、剩余 2 件已安排待收，不重复增加库存", state: partial },
    { key: "production", name: "领料与成品入库", description: "底稿采购收齐、生产领料、工单独立成品入库，计划不自动完工", state: production },
    { key: "shipped", name: "整单发货", description: "整单发货并生成成品出库凭证，库存只扣减一次", state: shipped },
  ];
}
