export interface Warehouse {
  id: string;
  name: string;
  kind: string;
  available: boolean;
}
export interface Material {
  id: string;
  name: string;
  spec: string;
  unit: string;
  price: number;
}
export interface Line {
  material: string;
  qty: number;
}
export interface Plan {
  id: string;
  name: string;
  product: string;
  qty: number;
  date: string;
  status: "待分析" | "待备料" | "已领料" | "已完工";
}
export interface Requisition {
  id: string;
  plan: string;
  applicant: string;
  date: string;
  lines: Line[];
  status: "待采购" | "已转采购";
}
export interface Purchase {
  id: string;
  request: string;
  plan: string;
  buyer: string;
  supplier: string;
  date: string;
  lines: Line[];
  status: "待入库" | "已入库";
}
export interface Movement {
  id: string;
  date: string;
  type: "入库" | "出库";
  warehouse: string;
  material: string;
  qty: number;
  source: string;
  reason: string;
}
export interface State {
  version: 1;
  warehouses: Warehouse[];
  materials: Material[];
  stocks: Record<string, number>;
  plans: Plan[];
  requests: Requisition[];
  purchases: Purchase[];
  movements: Movement[];
}
export const products = [
  {
    id: "FG001",
    name: "C0173 自动成型机",
    spec: "VSN-LZQ350",
    bom: [
      { material: "M001", qty: 1 },
      { material: "M002", qty: 1 },
      { material: "M003", qty: 4 },
      { material: "M004", qty: 2 },
    ],
  },
  {
    id: "FG002",
    name: "C0252 三封切包装机",
    spec: "VSN-C0252",
    bom: [
      { material: "M001", qty: 1 },
      { material: "M002", qty: 1 },
      { material: "M003", qty: 6 },
      { material: "M005", qty: 2 },
    ],
  },
];
export const today = () => new Date().toLocaleDateString("sv-SE");
export const stockKey = (warehouse: string, material: string) => `${warehouse}:${material}`;
export function seed(): State {
  return {
    version: 1,
    warehouses: [
      { id: "BZ01", name: "标准件仓库", kind: "存货仓", available: true },
      { id: "XC01", name: "生产现场仓", kind: "现场仓", available: false },
      { id: "CP01", name: "成品仓库", kind: "存货仓", available: false },
    ],
    materials: [
      { id: "M001", name: "PLC 控制器", spec: "LX3V-3624MT-A", unit: "PCS", price: 860 },
      { id: "M002", name: "触摸屏", spec: "PI3070ig-O", unit: "PCS", price: 520 },
      { id: "M003", name: "交流接触器", spec: "NXC-25", unit: "PCS", price: 48 },
      { id: "M004", name: "漏电开关", spec: "DZ47S / C100", unit: "PCS", price: 65 },
      { id: "M005", name: "温控模块", spec: "TM4-N2SB", unit: "PCS", price: 185 },
      ...products.map((p) => ({ id: p.id, name: p.name, spec: p.spec, unit: "台", price: 0 })),
    ],
    stocks: {
      "BZ01:M001": 2,
      "BZ01:M002": 3,
      "BZ01:M003": 12,
      "BZ01:M004": 4,
      "BZ01:M005": 8,
      "XC01:M001": 1,
      "CP01:FG001": 2,
    },
    plans: [
      {
        id: "PP202610001",
        name: "十月成型机交付计划",
        product: "FG001",
        qty: 5,
        date: today(),
        status: "待分析",
      },
      {
        id: "PP202610002",
        name: "包装机备货计划",
        product: "FG002",
        qty: 2,
        date: today(),
        status: "待分析",
      },
    ],
    requests: [
      {
        id: "PR202610001",
        plan: "",
        applicant: "仓库管理员",
        date: today(),
        lines: [{ material: "M005", qty: 4 }],
        status: "已转采购",
      },
    ],
    purchases: [
      {
        id: "PO202610001",
        request: "PR202610001",
        plan: "",
        buyer: "陈采购",
        supplier: "东莞精工电气有限公司",
        date: today(),
        lines: [{ material: "M005", qty: 4 }],
        status: "待入库",
      },
    ],
    movements: [
      {
        id: "IO202610001",
        date: "2026-10-18",
        type: "入库",
        warehouse: "BZ01",
        material: "M001",
        qty: 2,
        source: "期初建账",
        reason: "期初库存",
      },
      {
        id: "IO202610002",
        date: "2026-10-18",
        type: "入库",
        warehouse: "CP01",
        material: "FG001",
        qty: 2,
        source: "期初建账",
        reason: "期初库存",
      },
    ],
  };
}
export function id(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function positive(qty: number) {
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 100000)
    throw new Error("数量须为 1～100000 的整数");
}
export function validateLines(state: State, lines: Line[]) {
  if (!lines.length) throw new Error("请至少添加一条商品明细");
  const seen = new Set<string>();
  for (const line of lines) {
    positive(line.qty);
    if (!state.materials.some((m) => m.id === line.material)) throw new Error("请选择有效商品");
    if (seen.has(line.material)) throw new Error("同一单据的商品不能重复，请合并数量");
    seen.add(line.material);
  }
}
export function requirements(plan: Plan): Line[] {
  const product = products.find((p) => p.id === plan.product);
  if (!product) throw new Error("未配置该产品的演示 BOM");
  return product.bom.map((l) => ({ material: l.material, qty: l.qty * plan.qty }));
}
export function available(state: State, material: string) {
  return state.warehouses
    .filter((w) => w.available)
    .reduce((sum, w) => sum + (state.stocks[stockKey(w.id, material)] || 0), 0);
}
// 已确认备料的计划优先占用库存；在途采购和请购只计入其关联计划，防止重复覆盖。
export function analysis(state: State, plan: Plan) {
  // 请购单按新到旧保存；按首次请购时间排队，后续计划不能挤占先前计划。
  const queue = [
    ...new Set(
      [...state.requests]
        .reverse()
        .map((r) => r.plan)
        .filter(Boolean)
    ),
  ];
  const priority = (planId: string) => {
    const index = queue.indexOf(planId);
    return index < 0 ? Infinity : index;
  };
  return requirements(plan).map((line) => {
    const reserved = state.plans
      .filter(
        (p) => p.id !== plan.id && p.status === "待备料" && priority(p.id) < priority(plan.id)
      )
      .reduce(
        (sum, p) => sum + (requirements(p).find((l) => l.material === line.material)?.qty || 0),
        0
      );
    const stock = available(state, line.material);
    const usable = Math.max(0, stock - reserved);
    const pendingRequest = state.requests
      .filter((r) => r.plan === plan.id && r.status === "待采购")
      .flatMap((r) => r.lines)
      .filter((l) => l.material === line.material)
      .reduce((n, l) => n + l.qty, 0);
    const incoming = state.purchases
      .filter((p) => p.plan === plan.id && p.status === "待入库")
      .flatMap((p) => p.lines)
      .filter((l) => l.material === line.material)
      .reduce((n, l) => n + l.qty, 0);
    return {
      ...line,
      stock,
      reserved,
      usable,
      pending: pendingRequest + incoming,
      shortage: Math.max(0, line.qty - usable - pendingRequest - incoming),
    };
  });
}
export function createRequest(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || !["待分析", "待备料"].includes(plan.status))
    throw new Error("该计划当前不能生成请购单");
  const lines = analysis(state, plan)
    .filter((l) => l.shortage > 0)
    .map((l) => ({ material: l.material, qty: l.shortage }));
  if (!lines.length) throw new Error("当前无新增缺料，不需要重复请购");
  const request: Requisition = {
    id: id("PR"),
    plan: plan.id,
    applicant: "计划员",
    date: today(),
    lines,
    status: "待采购",
  };
  state.requests.unshift(request);
  plan.status = "待备料";
  return request;
}
export function convertRequest(state: State, requestId: string, buyer: string, supplier: string) {
  const request = state.requests.find((r) => r.id === requestId);
  if (!request || request.status !== "待采购") throw new Error("请购单已转采购或不存在");
  if (!buyer.trim() || !supplier.trim()) throw new Error("采购人、供应商不能为空");
  const order: Purchase = {
    id: id("PO"),
    request: request.id,
    plan: request.plan,
    buyer: buyer.trim(),
    supplier: supplier.trim(),
    date: today(),
    lines: request.lines.map((l) => ({ ...l })),
    status: "待入库",
  };
  state.purchases.unshift(order);
  request.status = "已转采购";
  return order;
}
export function move(
  state: State,
  warehouse: string,
  line: Line,
  type: Movement["type"],
  source: string,
  reason: string
) {
  validateLines(state, [line]);
  if (!state.warehouses.some((w) => w.id === warehouse)) throw new Error("请选择有效仓库");
  const key = stockKey(warehouse, line.material);
  const current = state.stocks[key] || 0;
  if (type === "出库" && current < line.qty) throw new Error("该仓库库存不足，不能出库");
  state.stocks[key] = current + (type === "入库" ? line.qty : -line.qty);
  state.movements.unshift({
    id: id("IO"),
    date: today(),
    type,
    warehouse,
    ...line,
    source,
    reason,
  });
}
export function receive(state: State, orderId: string, warehouse: string) {
  const order = state.purchases.find((p) => p.id === orderId);
  if (!order || order.status !== "待入库") throw new Error("采购单已入库或不存在");
  if (!state.warehouses.some((w) => w.id === warehouse && w.available))
    throw new Error("采购入库请选择参与可用量计算的仓库");
  order.lines.forEach((l) => move(state, warehouse, l, "入库", order.id, "采购收货"));
  order.status = "已入库";
}
export function issuePlan(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || !["待分析", "待备料"].includes(plan.status)) throw new Error("该计划不能重复领料");
  const rows = analysis(state, plan);
  if (rows.some((r) => r.usable < r.qty))
    throw new Error("可用库存不足，请先完成采购入库；其他已备料计划优先占用库存");
  for (const line of requirements(plan)) {
    let remaining = line.qty;
    for (const w of state.warehouses.filter((w) => w.available)) {
      const qty = Math.min(remaining, state.stocks[stockKey(w.id, line.material)] || 0);
      if (qty) {
        move(state, w.id, { material: line.material, qty }, "出库", plan.id, "生产领料");
        remaining -= qty;
      }
    }
  }
  plan.status = "已领料";
}
export function finishPlan(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || plan.status !== "已领料") throw new Error("请先完成领料，且不能重复完工");
  move(state, "CP01", { material: plan.product, qty: plan.qty }, "入库", plan.id, "生产完工");
  plan.status = "已完工";
}
