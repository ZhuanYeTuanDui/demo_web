import { productMaterials } from "./product-materials";

export interface Warehouse {
  id: string;
  name: string;
  kind: string;
  available: boolean;
  phone?: string;
  fax?: string;
  postcode?: string;
  address?: string;
  inactive?: boolean;
  remark?: string;
}
export interface Material {
  id: string;
  name: string;
  spec: string;
  unit: string;
  price: number;
  details?: Record<string, string | number | boolean | null>;
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
  workOrder?: string;
  bom?: Line[];
  importSource?: {
    file: string;
    sheet: string;
    basis?: "perUnit" | "total";
    rows: { row: number; part: string; material: string; qty: number; created?: boolean }[];
  };
}
export interface Requisition {
  id: string;
  plan: string;
  applicant: string;
  date: string;
  lines: Line[];
  status: "待采购" | "已转采购";
}
export interface PurchaseLine extends Line {
  amount?: number | null;
  id: string;
  draft?: string;
  draftLine?: string;
  request?: string;
  received: number;
}
export interface Purchase {
  id: string;
  request: string;
  draft?: string;
  plan: string;
  buyer: string;
  supplier: string;
  date: string;
  lines: PurchaseLine[];
  amount: number | null;
  legacyAmount?: number | null;
  status: "未审核" | "已审核";
  receiptStatus: "未收货" | "部分收货" | "全部收货";
  mergedInto?: string;
}
export interface DraftLine extends Line {
  id: string;
  status: "待采购" | "已转采购";
  bomQty: number | null;
  stock: number | null;
  reserved: number | null;
  usable: number | null;
  covered: number | null;
  dueDate: string;
  sourceLine: string;
}
export interface PurchaseDraft {
  id: string;
  plan: string;
  product: string;
  date: string;
  createdAt: string;
  creator: string;
  remark: string;
  lines: DraftLine[];
  status: "待采购" | "已转采购";
  legacy?: boolean;
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
export interface ReceiptLine extends Line {
  lineId: string;
}
export interface Receipt {
  id: string;
  purchase: string;
  warehouse: string;
  date: string;
  lines: ReceiptLine[];
}
export interface Inbound extends Receipt {
  receipt: string;
}
export interface IssueLine extends Line {
  warehouse: string;
}
export interface Issue {
  id: string;
  plan: string;
  date: string;
  lines: IssueLine[];
}
export type WorkOrderStatus = "立项中" | "采购中" | "装配中" | "待出货" | "已发货";
export interface WorkOrder {
  id: string;
  name: string;
  customer: string;
  product: string;
  qty: number;
  date: string;
  status: WorkOrderStatus;
  remark?: string;
}
export interface Shipment {
  id: string;
  workOrder: string;
  date: string;
  carrier: string;
  tracking: string;
  warehouse: string;
  lines: Line[];
}
export interface State {
  version: 1;
  warehouses: Warehouse[];
  materials: Material[];
  stocks: Record<string, number>;
  plans: Plan[];
  requests: Requisition[];
  drafts: PurchaseDraft[];
  purchases: Purchase[];
  movements: Movement[];
  receipts: Receipt[];
  inbounds: Inbound[];
  issues: Issue[];
  workOrders: WorkOrder[];
  shipments: Shipment[];
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
      ...productMaterials(),
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
        workOrder: "WO202610001",
        product: "FG001",
        qty: 5,
        date: today(),
        status: "待分析",
      },
      {
        id: "PP202610002",
        name: "包装机备货计划",
        workOrder: "WO202610002",
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
    drafts: [],
    receipts: [],
    inbounds: [],
    issues: [],
    shipments: [],
    workOrders: [
      {
        id: "WO202610001",
        name: "十月成型机交付工单",
        customer: "演示客户",
        product: "FG001",
        qty: 5,
        date: today(),
        status: "立项中",
      },
      {
        id: "WO202610002",
        name: "包装机备货工单",
        customer: "",
        product: "FG002",
        qty: 2,
        date: today(),
        status: "立项中",
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
        lines: [
          { id: "POL202610001", material: "M005", qty: 4, received: 0, request: "PR202610001" },
        ],
        amount: null,
        receiptStatus: "未收货",
        status: "未审核",
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
export function planBom(plan: Plan): Line[] {
  const product = products.find((p) => p.id === plan.product);
  const bom = plan.bom ?? product?.bom;
  if (!bom?.length) throw new Error("该计划未配置 BOM");
  return bom;
}
export function requirements(plan: Plan): Line[] {
  return planBom(plan).map((l) => {
    const qty = l.qty * plan.qty;
    positive(qty);
    return { material: l.material, qty };
  });
}
export function available(state: State, material: string) {
  return state.warehouses
    .filter((w) => w.available && !w.inactive)
    .reduce((sum, w) => sum + (state.stocks[stockKey(w.id, material)] || 0), 0);
}
// 已确认备料的计划优先占用库存；底稿和在途采购仅覆盖其关联计划。
export function analysis(state: State, plan: Plan) {
  // 底稿按新到旧保存；按首次生成先后排队，后续计划不能挤占先前计划。
  const queue = [
    ...new Set(
      [...state.drafts]
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
    const coverage = (planId: string) => {
      const pending = state.drafts
        .filter((d) => d.plan === planId && d.status === "待采购")
        .flatMap((d) => d.lines)
        .filter((l) => l.status === "待采购" && l.material === line.material)
        .reduce((n, l) => n + l.qty, 0);
      const incoming = state.purchases
        .filter((p) => !p.mergedInto)
        .flatMap((p) => p.lines)
        .filter(
          (l) =>
            l.material === line.material &&
            state.drafts.some((d) => d.id === l.draft && d.plan === planId)
        )
        .reduce((n, l) => n + l.qty - l.received, 0);
      return pending + incoming;
    };
    const queued = state.plans.filter((p) => p.id !== plan.id && p.status === "待备料");
    const earlier = queued
      .filter((p) => priority(p.id) < priority(plan.id))
      .reduce(
        (sum, p) =>
          sum +
          Math.max(
            0,
            (requirements(p).find((l) => l.material === line.material)?.qty || 0) - coverage(p.id)
          ),
        0
      );
    // 后序计划的定向到货仍归其自身，不能被前序计划领走后再重复生成缺料。
    const laterIds = new Set(
      queued.filter((p) => priority(p.id) > priority(plan.id)).map((p) => p.id)
    );
    const laterReceived = state.purchases
      .filter((p) => !p.mergedInto)
      .flatMap((p) => p.lines)
      .filter(
        (l) =>
          l.material === line.material &&
          state.drafts.some((d) => d.id === l.draft && laterIds.has(d.plan))
      )
      .reduce((sum, l) => sum + l.received, 0);
    const reserved = earlier + laterReceived;
    const stock = available(state, line.material);
    const usable = Math.max(0, stock - reserved);
    const pendingDraft = state.drafts
      .filter((r) => r.plan === plan.id && r.status === "待采购")
      .flatMap((r) => r.lines)
      .filter((l) => l.status === "待采购" && l.material === line.material)
      .reduce((n, l) => n + l.qty, 0);
    const incoming = state.purchases
      .filter((p) => !p.mergedInto)
      .flatMap((p) => p.lines)
      .filter(
        (l) =>
          l.material === line.material &&
          state.drafts.some((d) => d.id === l.draft && d.plan === plan.id)
      )
      .reduce((n, l) => n + l.qty - l.received, 0);
    return {
      ...line,
      stock,
      reserved,
      usable,
      pending: pendingDraft + incoming,
      shortage: Math.max(0, line.qty - usable - pendingDraft - incoming),
    };
  });
}
function refreshDraftStatus(draft: PurchaseDraft) {
  draft.status =
    draft.lines.length > 0 && draft.lines.every((l) => l.status === "已转采购")
      ? "已转采购"
      : "待采购";
}
export function createDraft(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || !["待分析", "待备料"].includes(plan.status))
    throw new Error("该计划当前不能生成采购底稿");
  const rows = analysis(state, plan);
  if (!rows.some((l) => l.shortage > 0)) throw new Error("当前无新增缺料，不需要重复生成底稿");
  validateLines(
    state,
    rows.filter((l) => l.shortage > 0).map((l) => ({ material: l.material, qty: l.shortage }))
  );
  let draft = state.drafts.find((d) => d.plan === plan.id);
  const lines: DraftLine[] = rows
    .filter((l) => l.shortage > 0)
    .map((l, i) => ({
      id: id("DL"),
      status: "待采购",
      material: l.material,
      qty: l.shortage,
      bomQty: l.qty,
      stock: l.stock,
      reserved: l.reserved,
      usable: l.usable,
      covered: l.pending,
      dueDate: plan.date,
      sourceLine: `${plan.id}-${String((draft?.lines.length || 0) + i + 1).padStart(3, "0")}`,
    }));
  if (draft) {
    // 同物料新增缺口追加独立行，保留已转数量和历史库存快照，不回写旧行。
    draft.lines.push(...lines);
    draft.status = "待采购";
  } else {
    draft = {
      id: id("DG"),
      plan: plan.id,
      product: plan.product,
      creator: "演示管理员",
      createdAt: new Date().toISOString(),
      remark: "由物料需求计算生成",
      date: today(),
      lines,
      status: "待采购",
    };
    state.drafts.unshift(draft);
  }
  plan.status = "待备料";
  return draft;
}

export function convertDraft(state: State, draftId: string, buyer: string, supplier: string) {
  return createPurchase(state, { buyer, supplier, draftIds: [draftId] });
}

// 将旧 demo 自动生成的计划请购迁为底稿；缺失历史计算快照时明确留空。
export function migrateDrafts(state: State) {
  if (state.drafts !== undefined && !Array.isArray(state.drafts))
    throw new Error("采购底稿数据格式错误");
  state.drafts ??= [];
  const mapping = new Map<string, string>();
  for (const r of state.requests.filter((r) => !!r.plan)) {
    const draftId = r.id.replace(/^PR/, "DG");
    if (!state.drafts.some((d) => d.id === draftId))
      state.drafts.push({
        id: draftId,
        plan: r.plan,
        product: state.plans.find((p) => p.id === r.plan)?.product || "",
        date: r.date,
        createdAt: "",
        creator: r.applicant,
        remark: "旧版计划请购迁移；历史库存和 BOM 计算快照缺失",
        legacy: true,
        status: r.status,
        lines: r.lines.map((l, i) => ({
          ...l,
          id: `${draftId}-L${i + 1}`,
          status: r.status,
          bomQty: null,
          stock: null,
          reserved: null,
          usable: null,
          covered: null,
          dueDate: "",
          sourceLine: `${r.plan}-${String(i + 1).padStart(3, "0")}`,
        })),
      });
    mapping.set(r.id, draftId);
  }
  for (const p of state.purchases)
    if (mapping.has(p.request)) {
      p.draft = mapping.get(p.request)!;
      p.request = "";
    }
  state.requests = state.requests.filter((r) => !mapping.has(r.id));
  for (const purchase of state.purchases) {
    if (purchase.plan && !purchase.draft && !purchase.lines.some((l) => l.draft)) {
      const draftId = `DG-${purchase.id}`;
      if (!state.drafts.some((d) => d.id === draftId))
        state.drafts.push({
          id: draftId,
          plan: purchase.plan,
          product: state.plans.find((p) => p.id === purchase.plan)?.product || "",
          date: purchase.date,
          createdAt: "",
          creator: purchase.buyer,
          remark: "旧采购计划关联迁移；历史计算快照缺失",
          legacy: true,
          status: "已转采购",
          lines: purchase.lines.map((l, i) => ({
            id: `${draftId}-L${i + 1}`,
            status: "已转采购",
            material: l.material,
            qty: l.qty,
            bomQty: null,
            stock: null,
            reserved: null,
            usable: null,
            covered: null,
            dueDate: "",
            sourceLine: `${purchase.id}-${i + 1}`,
          })),
        });
      purchase.draft = draftId;
    }
  }
  // 旧版单物料底稿按计划归并；每行保留原快照和原始来源行，不把整单状态覆盖到其他底稿行。
  const originalQueue = [
    ...new Set(
      [...state.drafts]
        .reverse()
        .map((d) => d.plan)
        .filter(Boolean)
    ),
  ];
  const origins = new Map<string, { draft: PurchaseDraft; lines: DraftLine[] }>();
  const groups = new Map<string, PurchaseDraft>();
  const grouped: PurchaseDraft[] = [];
  for (const original of state.drafts) {
    const lines = original.lines
      .filter((l) => l.qty > 0)
      .map((l, index) => ({
        ...l,
        id: l.id || `${original.id}-L${index + 1}`,
        status: l.status || original.status,
      }));
    let group = original.plan ? groups.get(original.plan) : undefined;
    if (!group) {
      group = { ...original, lines: [] };
      grouped.push(group);
      if (original.plan) groups.set(original.plan, group);
    }
    group.lines.push(...lines);
    origins.set(original.id, { draft: group, lines });
  }
  state.drafts = grouped.sort(
    (a, b) => originalQueue.indexOf(b.plan) - originalQueue.indexOf(a.plan)
  );
  state.receipts ??= [];
  state.inbounds ??= [];
  state.issues ??= [];
  state.shipments ??= [];
  state.workOrders ??= [];
  for (const purchase of state.purchases) {
    const oldStatus = purchase.status as string;
    purchase.lines = purchase.lines.map((line, index) => {
      const source = origins.get(line.draft || purchase.draft || "");
      const originLine = source?.lines.find((l) =>
        line.draftLine ? l.id === line.draftLine : l.material === line.material
      );
      if (originLine) originLine.status = "已转采购";
      return {
        ...line,
        id: line.id || `${purchase.id}-L${index + 1}`,
        received: line.received ?? (oldStatus === "已入库" ? line.qty : 0),
        draft: source?.draft.id || line.draft,
        draftLine: originLine?.id || line.draftLine,
        request: line.request || purchase.request || undefined,
      };
    });
    if (purchase.lines.some((l) => l.amount === undefined) && purchase.legacyAmount === undefined)
      purchase.legacyAmount = purchase.amount ?? null;
    purchase.lines.forEach((l) => {
      l.amount ??= null;
    });
    purchase.amount = purchaseTotal(purchase.lines);
    purchase.status = ["待入库", "已入库"].includes(oldStatus) ? "已审核" : purchase.status;
    purchase.receiptStatus = purchase.lines.every((l) => l.received === l.qty)
      ? "全部收货"
      : purchase.lines.some((l) => l.received > 0)
        ? "部分收货"
        : "未收货";
    purchase.plan = "";
    if (purchase.draft && origins.has(purchase.draft))
      purchase.draft = origins.get(purchase.draft)!.draft.id;
  }
  state.drafts.forEach(refreshDraftStatus);
  // 旧计划补建对应工单，不改变历史库存、采购和生产执行状态。
  for (const plan of state.plans) {
    if (!plan.workOrder) {
      const workOrderId = `WO-${plan.id}`;
      if (!state.workOrders.some((w) => w.id === workOrderId))
        state.workOrders.push({
          id: workOrderId,
          name: plan.name,
          customer: "",
          product: plan.product,
          qty: plan.qty,
          date: plan.date,
          status:
            plan.status === "已完工" ? "待出货" : plan.status === "已领料" ? "装配中" : "立项中",
        });
      plan.workOrder = workOrderId;
    }
  }
}
export function convertRequest(state: State, requestId: string, buyer: string, supplier: string) {
  return createPurchase(state, { buyer, supplier, requestIds: [requestId] });
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
  if (!state.warehouses.some((w) => w.id === warehouse && !w.inactive))
    throw new Error("仓库不存在或已失效，请选择正常使用的仓库");
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
export interface PurchaseSources {
  draftLines?: { draftId: string; lineId: string }[];
  lineAmounts?: Record<string, number | null>;
  draftIds?: string[];
  requestIds?: string[];
  lines?: Line[];
}
export interface PurchaseInput extends PurchaseSources {
  buyer: string;
  supplier: string;
  amount?: number | null;
}
function amountValid(value: number | null | undefined) {
  if (value == null) return;
  const cents = Math.round(value * 100);
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(value * 100 - cents) > 0.000001
  )
    throw new Error("物料金额须为空或最多两位小数的非负数字");
}
// 逐行金额按分合计；任何行未填时，单据合计明确保持未填写状态。
export function purchaseTotal(lines: { amount?: number | null }[]) {
  lines.forEach((line) => amountValid(line.amount));
  if (!lines.length || lines.some((line) => line.amount == null)) return null;
  const cents = lines.reduce((sum, line) => sum + Math.round(line.amount! * 100), 0);
  if (!Number.isSafeInteger(cents)) throw new Error("采购金额合计超出支持范围");
  return cents / 100;
}
function editable(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "未审核") throw new Error("仅未审核采购单可以修改或合并");
  return order;
}
// 先解析和校验全部来源，再修改占用标记，避免直接调用时出现半张单据。
function sourceLines(state: State, input: PurchaseSources) {
  Object.values(input.lineAmounts || {}).forEach(amountValid);
  const draftIds = input.draftIds || [];
  const requestIds = input.requestIds || [];
  if (new Set(draftIds).size !== draftIds.length || new Set(requestIds).size !== requestIds.length)
    throw new Error("来源单据不能重复选择");
  const selected = [...(input.draftLines || [])];
  for (const key of draftIds) {
    const draft = state.drafts.find((d) => d.id === key);
    if (!draft || !draft.lines.some((l) => l.status === "待采购"))
      throw new Error("采购底稿已转采购或不存在");
    selected.push(
      ...draft.lines
        .filter((l) => l.status === "待采购")
        .map((l) => ({ draftId: key, lineId: l.id }))
    );
  }
  if (new Set(selected.map((l) => `${l.draftId}:${l.lineId}`)).size !== selected.length)
    throw new Error("来源物料行不能重复选择");
  const chosen = selected.map((row) => {
    const draft = state.drafts.find((d) => d.id === row.draftId);
    const index = draft?.lines.findIndex((l) => l.id === row.lineId) ?? -1;
    const line = draft?.lines[index];
    if (!draft || !line || line.status !== "待采购") throw new Error("底稿物料已转采购或不存在");
    return { draft, line, index };
  });
  const drafts = [...new Set(chosen.map((row) => row.draft))];
  const requests = requestIds.map((key) => {
    const value = state.requests.find((r) => r.id === key && r.status === "待采购");
    if (!value) throw new Error("请购单已转采购或不存在");
    return value;
  });
  const rows: PurchaseLine[] = [
    ...chosen.map(({ draft, line, index }) => ({
      amount: input.lineAmounts?.[`draft:${draft.id}:${index}`] ?? null,
      material: line.material,
      qty: line.qty,
      id: id("PL"),
      received: 0,
      draft: draft.id,
      draftLine: line.id,
    })),
    ...requests.flatMap((r) =>
      r.lines.map((l, index) => ({
        ...l,
        amount: input.lineAmounts?.[`request:${r.id}:${index}`] ?? null,
        id: id("PL"),
        received: 0,
        request: r.id,
      }))
    ),
    ...(input.lines || []).map((l, index) => ({
      ...l,
      amount: input.lineAmounts?.[`manual:${index}`] ?? null,
      id: id("PL"),
      received: 0,
    })),
  ];
  if (!rows.length) throw new Error("请至少添加一条商品明细");
  rows.forEach((l) => validateLines(state, [l]));
  purchaseTotal(rows);
  return { rows, drafts, requests, chosen };
}
export function createPurchase(state: State, input: PurchaseInput) {
  if (!input.buyer.trim() || !input.supplier.trim()) throw new Error("采购人、供应商不能为空");
  const source = sourceLines(state, input);
  const order: Purchase = {
    id: id("PO"),
    plan: "",
    request: source.requests.length === 1 ? source.requests[0]!.id : "",
    draft: source.drafts.length === 1 ? source.drafts[0]!.id : undefined,
    buyer: input.buyer.trim(),
    supplier: input.supplier.trim(),
    date: today(),
    lines: source.rows,
    amount: purchaseTotal(source.rows),
    status: "未审核",
    receiptStatus: "未收货",
  };
  source.chosen.forEach(({ line }) => {
    line.status = "已转采购";
  });
  source.drafts.forEach(refreshDraftStatus);
  source.requests.forEach((r) => (r.status = "已转采购"));
  state.purchases.unshift(order);
  return order;
}
export function appendPurchase(state: State, orderId: string, input: PurchaseSources) {
  const order = editable(state, orderId);
  const source = sourceLines(state, input);
  const amount = purchaseTotal([...order.lines, ...source.rows]);
  source.chosen.forEach(({ line }) => {
    line.status = "已转采购";
  });
  source.drafts.forEach(refreshDraftStatus);
  source.requests.forEach((r) => (r.status = "已转采购"));
  order.lines.push(...source.rows);
  order.amount = amount;
  return order;
}
export function updatePurchase(
  state: State,
  orderId: string,
  input: {
    buyer: string;
    supplier: string;
    amount?: number | null;
    lineAmounts?: Record<string, number | null>;
  }
) {
  const order = editable(state, orderId);
  if (!input.buyer.trim() || !input.supplier.trim()) throw new Error("采购人、供应商不能为空");
  const updates = input.lineAmounts || {};
  if (Object.keys(updates).some((key) => !order.lines.some((l) => l.id === key)))
    throw new Error("采购金额明细不存在");
  const lines = order.lines.map((l) => ({
    ...l,
    amount: Object.hasOwn(updates, l.id) ? updates[l.id]! : (l.amount ?? null),
  }));
  const amount = purchaseTotal(lines);
  Object.assign(order, {
    buyer: input.buyer.trim(),
    supplier: input.supplier.trim(),
    lines,
    amount,
  });
  return order;
}
export function auditPurchase(state: State, orderId: string) {
  const order = editable(state, orderId);
  if (!order.lines.length) throw new Error("采购单没有物料");
  order.lines.forEach((l) => validateLines(state, [l]));
  const amount = purchaseTotal(order.lines);
  order.amount = amount;
  order.status = "已审核";
}
export function unauditPurchase(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "已审核") throw new Error("仅已审核采购单可以反审核");
  if (
    order.lines.some((l) => l.received > 0) ||
    state.receipts.some((r) => r.purchase === order.id)
  )
    throw new Error("发生收货后不能反审核");
  order.status = "未审核";
}
export function mergePurchases(state: State, orderIds: string[]) {
  if (orderIds.length < 2 || new Set(orderIds).size !== orderIds.length)
    throw new Error("请选择至少两张不同的采购单");
  const orders = orderIds.map((key) => editable(state, key));
  if (orders.some((p) => p.supplier !== orders[0]!.supplier))
    throw new Error("仅同供应商采购单可以合并");
  const result: Purchase = {
    ...orders[0]!,
    id: id("PO"),
    date: today(),
    plan: "",
    request: "",
    draft: undefined,
    lines: orders.flatMap((p) => p.lines.map((l) => ({ ...l }))),
    amount: purchaseTotal(orders.flatMap((p) => p.lines)),
    legacyAmount: undefined,
    status: "未审核",
    receiptStatus: "未收货",
  };
  orders.forEach((p) => (p.mergedInto = result.id));
  state.purchases.unshift(result);
  return result;
}
export function receive(
  state: State,
  orderId: string,
  warehouse: string,
  input?: { lineId: string; qty: number }[]
) {
  if (!state.warehouses.some((w) => w.id === warehouse && w.available && !w.inactive))
    throw new Error("采购入库请选择参与可用量计算的仓库");
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "已审核" || order.receiptStatus === "全部收货")
    throw new Error("请选择已审核且未全部收货的采购单");
  const rows =
    input ??
    order.lines
      .filter((l) => l.qty > l.received)
      .map((l) => ({ lineId: l.id, qty: l.qty - l.received }));
  if (!rows.length || new Set(rows.map((l) => l.lineId)).size !== rows.length)
    throw new Error("请选择不重复的收货物料");
  const lines = rows.map((r) => {
    positive(r.qty);
    const line = order.lines.find((l) => l.id === r.lineId);
    if (!line || r.qty > line.qty - line.received) throw new Error("收货数量超过剩余应收数量");
    validateLines(state, [{ material: line.material, qty: r.qty }]);
    return { lineId: line.id, material: line.material, qty: r.qty };
  });
  const receipt: Receipt = { id: id("RC"), purchase: order.id, warehouse, date: today(), lines };
  const inbound: Inbound = { ...receipt, id: id("IN"), receipt: receipt.id };
  lines.forEach((l) => {
    move(state, warehouse, l, "入库", inbound.id, `采购收货 ${order.id} / ${receipt.id}`);
    order.lines.find((row) => row.id === l.lineId)!.received += l.qty;
  });
  order.receiptStatus = order.lines.every((l) => l.received === l.qty) ? "全部收货" : "部分收货";
  state.receipts.unshift(receipt);
  state.inbounds.unshift(inbound);
  return receipt;
}
export function createIssue(state: State, planId: string, input?: IssueLine[]) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || !["待分析", "待备料"].includes(plan.status)) throw new Error("该计划不能重复领料");
  const needs = requirements(plan);
  if (analysis(state, plan).some((r) => r.usable < r.qty))
    throw new Error("可用库存不足，请先完成采购入库；其他已备料计划优先占用库存");
  const lines: IssueLine[] = input
    ? input.map((l) => ({ ...l }))
    : needs.flatMap((line) => {
        let remaining = line.qty;
        return state.warehouses
          .filter((w) => w.available && !w.inactive)
          .flatMap((w) => {
            const qty = Math.min(remaining, state.stocks[stockKey(w.id, line.material)] || 0);
            remaining -= qty;
            return qty ? [{ warehouse: w.id, material: line.material, qty }] : [];
          });
      });
  // 领料是一次覆盖整份计划，逐仓汇总校验后再扣减，重复仓行也不能穿透库存校验。
  const totals = new Map<string, number>();
  const warehouseTotals = new Map<string, number>();
  lines.forEach((l) => {
    validateLines(state, [l]);
    if (!state.warehouses.some((w) => w.id === l.warehouse && w.available && !w.inactive))
      throw new Error("请选择参与可用量计算的有效仓库");
    totals.set(l.material, (totals.get(l.material) || 0) + l.qty);
    const key = stockKey(l.warehouse, l.material);
    warehouseTotals.set(key, (warehouseTotals.get(key) || 0) + l.qty);
  });
  if (totals.size !== needs.length || needs.some((l) => totals.get(l.material) !== l.qty))
    throw new Error("领料明细必须与计划全部需求一致");
  for (const [key, qty] of warehouseTotals)
    if ((state.stocks[key] || 0) < qty) throw new Error("该仓库库存不足，不能出库");
  const issue: Issue = { id: id("IS"), plan: plan.id, date: today(), lines };
  lines.forEach((l) => move(state, l.warehouse, l, "出库", issue.id, `生产领料 ${plan.id}`));
  state.issues.unshift(issue);
  plan.status = "已领料";
  return issue;
}
export function issuePlan(state: State, planId: string) {
  return createIssue(state, planId);
}
export function finishPlan(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || plan.status !== "已领料") throw new Error("请先完成领料，且不能重复完工");
  move(state, "CP01", { material: plan.product, qty: plan.qty }, "入库", plan.id, "生产完工");
  plan.status = "已完工";
}
export function createWorkOrder(
  state: State,
  input: {
    name: string;
    customer?: string;
    product: string;
    qty: number;
    date?: string;
    remark?: string;
  }
) {
  if (!input.name.trim()) throw new Error("请填写工单名称");
  positive(input.qty);
  if (!products.some((p) => p.id === input.product)) throw new Error("请选择有效成品");
  const order: WorkOrder = {
    id: id("WO"),
    name: input.name.trim(),
    customer: input.customer?.trim() || "",
    product: input.product,
    qty: input.qty,
    date: input.date || today(),
    status: "立项中",
    remark: input.remark?.trim() || "",
  };
  state.workOrders.unshift(order);
  return order;
}
export function setWorkOrderStatus(state: State, orderId: string, status: WorkOrderStatus) {
  const order = state.workOrders.find((w) => w.id === orderId);
  if (!order || order.status === "已发货") throw new Error("工单不存在或已发货");
  if (!["立项中", "采购中", "装配中", "待出货"].includes(status))
    throw new Error("已发货仅能由发货操作触发");
  order.status = status;
}
export const updateWorkOrderStatus = setWorkOrderStatus;
export function shipWorkOrder(
  state: State,
  workOrderId: string,
  input: { carrier: string; tracking: string; warehouse?: string }
) {
  const order = state.workOrders.find((w) => w.id === workOrderId);
  if (!order || order.status !== "待出货") throw new Error("仅待出货工单允许发货");
  if (!input.carrier.trim() || !input.tracking.trim()) throw new Error("请填写物流公司和物流单号");
  const plans = state.plans.filter((p) => p.workOrder === order.id);
  if (!plans.length || plans.some((p) => p.status !== "已完工"))
    throw new Error("工单全部关联计划须先完工入库");
  const quantities = new Map<string, number>();
  plans.forEach((p) => quantities.set(p.product, (quantities.get(p.product) || 0) + p.qty));
  const lines = [...quantities].map(([material, qty]) => ({ material, qty }));
  validateLines(state, lines);
  const warehouse = input.warehouse || "CP01";
  if (!state.warehouses.some((w) => w.id === warehouse && !w.inactive && w.id === "CP01"))
    throw new Error("请选择有效成品仓库");
  if (lines.some((l) => (state.stocks[stockKey(warehouse, l.material)] || 0) < l.qty))
    throw new Error("成品库存不足，不能发货");
  const shipment: Shipment = {
    id: id("SH"),
    workOrder: order.id,
    date: today(),
    carrier: input.carrier.trim(),
    tracking: input.tracking.trim(),
    warehouse,
    lines,
  };
  lines.forEach((l) => move(state, warehouse, l, "出库", shipment.id, `成品发货 ${order.id}`));
  state.shipments.unshift(shipment);
  order.status = "已发货";
  return shipment;
}
export const approvePurchase = auditPurchase;
export const purchaseAmount = purchaseTotal;
