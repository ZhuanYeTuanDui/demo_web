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
export type AuditStatus = "未审核" | "已审核";
export interface Plan {
  auditStatus?: AuditStatus;
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
  unitPrice?: number | null;
  dueDate?: string;
  remark?: string;
  requestLine?: string;
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
  auditStatus?: AuditStatus;
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
  status?: "待收货" | "已收货";
  auditStatus?: AuditStatus;
  carrier?: string;
  tracking?: string;
  id: string;
  purchase: string;
  warehouse: string;
  date: string;
  lines: ReceiptLine[];
}
export interface Inbound extends Omit<Receipt, "auditStatus"> {
  receipt: string;
}
export interface IssueLine extends Line {
  warehouse: string;
}
export interface Issue {
  auditStatus?: AuditStatus;
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
        auditStatus: "已审核",
      },
      {
        id: "PP202610002",
        name: "包装机备货计划",
        workOrder: "WO202610002",
        product: "FG002",
        qty: 2,
        date: today(),
        status: "待分析",
        auditStatus: "已审核",
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
          {
            id: "POL202610001",
            material: "M005",
            qty: 4,
            received: 0,
            request: "PR202610001",
            requestLine: "0",
          },
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
        .filter((d) => d.plan === planId)
        .flatMap((d) => d.lines)
        .filter(
          (l) =>
            l.material === line.material &&
            !state.purchases.some(
              (p) => !p.mergedInto && p.lines.some((pl) => pl.draftLine === l.id)
            )
        )
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
      .filter((r) => r.plan === plan.id)
      .flatMap((r) => r.lines)
      .filter(
        (l) =>
          l.material === line.material &&
          !state.purchases.some((p) => !p.mergedInto && p.lines.some((pl) => pl.draftLine === l.id))
      )
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
  if (!plan || plan.auditStatus !== "已审核" || !["待分析", "待备料"].includes(plan.status))
    throw new Error("仅已审核且未完工的计划可以生成采购底稿");
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
    if (draft.auditStatus === "已审核") throw new Error("已审核底稿不可追加，请先返审");
    // 同物料新增缺口追加独立行，保留已转数量和历史库存快照，不回写旧行。
    draft.lines.push(...lines);
    draft.status = "待采购";
  } else {
    draft = {
      id: id("DG"),
      plan: plan.id,
      product: plan.product,
      auditStatus: "未审核",
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

function getPlan(state: State, planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) throw new Error("生产计划不存在");
  return plan;
}
export function auditPlan(state: State, planId: string) {
  const plan = getPlan(state, planId);
  if (plan.auditStatus === "已审核") throw new Error("生产计划已审核");
  if (!plan.name.trim() || !plan.date) throw new Error("请填写计划名称和日期");
  positive(plan.qty);
  requirements(plan);
  plan.auditStatus = "已审核";
}
export function unauditPlan(state: State, planId: string) {
  const plan = getPlan(state, planId);
  if (plan.auditStatus !== "已审核") throw new Error("仅已审核生产计划可以返审");
  if (
    state.drafts.some((d) => d.plan === plan.id && d.auditStatus === "已审核") ||
    state.issues.some((i) => i.plan === plan.id && i.auditStatus === "已审核")
  )
    throw new Error("存在已审核的直接下游单据，不能返审");
  plan.auditStatus = "未审核";
}
export function updatePlan(
  state: State,
  planId: string,
  input: Pick<Plan, "name" | "product" | "qty" | "date"> & { workOrder?: string; bom?: Line[] }
) {
  const plan = getPlan(state, planId);
  if (plan.auditStatus === "已审核") throw new Error("已审核计划不可修改");
  if (plan.status === "已完工") throw new Error("已完工计划不可修改执行资料");
  if (!input.name.trim() || !input.date) throw new Error("请填写计划名称和日期");
  if (!state.materials.some((m) => m.id === input.product)) throw new Error("计划产品不存在");
  if (input.workOrder && !state.workOrders.some((w) => w.id === input.workOrder))
    throw new Error("关联工单不存在");
  const updated = { ...plan, ...input, name: input.name.trim() };
  positive(updated.qty);
  requirements(updated);
  Object.assign(plan, updated);
  return plan;
}
function editableDraft(state: State, draftId: string) {
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft || draft.auditStatus === "已审核") throw new Error("仅未审核底稿可以修改或删除");
  return draft;
}
export function createManualDraft(
  state: State,
  input: { plan?: string; product?: string; remark?: string; lines: Line[] }
) {
  validateLines(state, input.lines);
  const plan = input.plan ? getPlan(state, input.plan) : undefined;
  if (plan && plan.auditStatus !== "已审核") throw new Error("请选择已审核生产计划");
  const draft: PurchaseDraft = {
    id: id("DG"),
    plan: plan?.id || "",
    product: input.product || plan?.product || "",
    date: today(),
    createdAt: new Date().toISOString(),
    creator: "演示管理员",
    remark: input.remark?.trim() || "",
    status: "待采购",
    auditStatus: "未审核",
    lines: input.lines.map((line) => ({
      ...line,
      id: id("DL"),
      status: "待采购",
      bomQty: null,
      stock: null,
      reserved: null,
      usable: null,
      covered: null,
      dueDate: "",
      sourceLine: "",
    })),
  };
  state.drafts.unshift(draft);
  return draft;
}
export function updateDraft(
  state: State,
  draftId: string,
  input: { remark?: string; lines: (Line & { id?: string })[] }
) {
  const draft = editableDraft(state, draftId);
  input.lines.forEach((line) => validateLines(state, [line]));
  if (!input.lines.length) throw new Error("请至少保留一条物料");
  const ids = input.lines.filter((line) => line.id).map((line) => line.id);
  if (new Set(ids).size !== ids.length) throw new Error("底稿物料行重复");
  const lines: DraftLine[] = input.lines.map((line) => {
    const old = line.id ? draft.lines.find((row) => row.id === line.id) : undefined;
    if (line.id && !old) throw new Error("底稿物料行不存在");
    if (old && old.material !== line.material)
      throw new Error("已有底稿行物料不能替换，请另增一行");
    return old
      ? { ...old, qty: line.qty }
      : {
          ...line,
          id: id("DL"),
          status: "待采购",
          bomQty: null,
          stock: null,
          reserved: null,
          usable: null,
          covered: null,
          dueDate: "",
          sourceLine: "",
        };
  });
  for (const line of draft.lines) {
    if (
      !lines.some((row) => row.id === line.id) &&
      state.purchases.some((p) =>
        p.lines.some((row) => row.draft === draft.id && row.draftLine === line.id)
      )
    )
      throw new Error("底稿物料已有采购来源引用，不能删除");
  }
  draft.lines = lines;
  draft.remark = input.remark?.trim() ?? draft.remark;
  return draft;
}
export function deleteDraft(state: State, draftId: string) {
  const draft = editableDraft(state, draftId);
  if (state.purchases.some((p) => p.lines.some((line) => line.draft === draft.id)))
    throw new Error("底稿已有采购来源引用，不能删除");
  state.drafts = state.drafts.filter((d) => d.id !== draftId);
}
export function auditDraft(state: State, draftId: string) {
  const draft = editableDraft(state, draftId);
  draft.lines.forEach((line) => validateLines(state, [line]));
  if (!draft.lines.length) throw new Error("底稿没有物料");
  if (draft.plan && getPlan(state, draft.plan).auditStatus !== "已审核")
    throw new Error("来源生产计划未审核");
  draft.auditStatus = "已审核";
}
export function unauditDraft(state: State, draftId: string) {
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft || draft.auditStatus !== "已审核") throw new Error("仅已审核底稿可以返审");
  if (
    state.purchases.some(
      (p) =>
        !p.mergedInto && p.status === "已审核" && p.lines.some((line) => line.draft === draft.id)
    )
  )
    throw new Error("存在已审核的直接下游采购单，不能返审");
  draft.auditStatus = "未审核";
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
    const groupingKey = original.auditStatus ? original.id : original.plan;
    let group = groupingKey ? groups.get(groupingKey) : undefined;
    if (!group) {
      group = { ...original, lines: [] };
      grouped.push(group);
      if (groupingKey) groups.set(groupingKey, group);
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
        requestLine:
          line.requestLine ??
          (() => {
            const request = state.requests.find((r) => r.id === (line.request || purchase.request));
            const index = request?.lines.findIndex((l) => l.material === line.material) ?? -1;
            return index >= 0 ? String(index) : undefined;
          })(),
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
  for (const draft of state.drafts) {
    draft.auditStatus ??= state.purchases.some(
      (p) => !p.mergedInto && p.lines.some((l) => l.draft === draft.id)
    )
      ? "已审核"
      : "未审核";
  }
  for (const receipt of state.receipts) {
    receipt.status ??= "已收货";
    receipt.auditStatus ??= receipt.status === "已收货" ? "已审核" : "未审核";
  }
  // 入库单是收货执行凭证，不拥有独立审核状态；旧版本复制来的字段移除。
  for (const inbound of state.inbounds)
    delete (inbound as Inbound & { auditStatus?: AuditStatus }).auditStatus;
  for (const issue of state.issues) issue.auditStatus ??= "已审核";
  for (const plan of state.plans) {
    plan.auditStatus ??=
      plan.status !== "待分析" ||
      state.drafts.some((d) => d.plan === plan.id) ||
      state.issues.some((i) => i.plan === plan.id)
        ? "已审核"
        : "未审核";
  }
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
  requestLines?: { requestId: string; lineIndex: number }[];
  lineEdits?: Record<
    string,
    { qty?: number; unitPrice?: number | null; dueDate?: string; remark?: string }
  >;
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
// 单价和行合计以分计算，旧数据缺单价时仅显示其历史行金额。
export function purchaseLineAmount(line: {
  qty: number;
  unitPrice?: number | null;
  amount?: number | null;
}) {
  amountValid(line.unitPrice);
  if (line.unitPrice == null) {
    amountValid(line.amount);
    return line.amount ?? null;
  }
  const cents = Math.round(line.unitPrice * 100) * line.qty;
  if (!Number.isSafeInteger(cents)) throw new Error("采购金额超出支持范围");
  return cents / 100;
}
export function purchaseTotal(
  lines: { amount?: number | null; qty?: number; unitPrice?: number | null }[]
) {
  const values = lines.map((line) => purchaseLineAmount({ ...line, qty: line.qty ?? 1 }));
  if (!values.length || values.some((value) => value == null)) return null;
  const cents = values.reduce<number>((sum, value) => sum + Math.round(value! * 100), 0);
  if (!Number.isSafeInteger(cents)) throw new Error("采购金额合计超出支持范围");
  return cents / 100;
}
function editable(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "未审核") throw new Error("仅未审核采购单可以修改或合并");
  return order;
}
// 来源只记录关联，不占用、不扣减来源要求量；每次允许按完整来源量取用。
function sourceLines(state: State, input: PurchaseSources) {
  Object.values(input.lineAmounts || {}).forEach(amountValid);
  const selected = [...(input.draftLines || [])];
  for (const key of input.draftIds || []) {
    const draft = state.drafts.find((d) => d.id === key);
    if (!draft || draft.auditStatus !== "已审核") throw new Error("请选择已审核采购底稿");
    selected.push(...draft.lines.map((line) => ({ draftId: key, lineId: line.id })));
  }
  if (new Set(selected.map((row) => `${row.draftId}:${row.lineId}`)).size !== selected.length)
    throw new Error("来源物料行不能重复选择");
  const chosen = selected.map((row) => {
    const draft = state.drafts.find((d) => d.id === row.draftId);
    const index = draft?.lines.findIndex((line) => line.id === row.lineId) ?? -1;
    const line = draft?.lines[index];
    if (!draft || !line || draft.auditStatus !== "已审核") throw new Error("底稿不存在或未审核");
    return { draft, line, index };
  });
  const requestRows = [...(input.requestLines || [])];
  for (const key of input.requestIds || []) {
    const request = state.requests.find((r) => r.id === key);
    if (!request) throw new Error("请购单不存在");
    requestRows.push(...request.lines.map((_, lineIndex) => ({ requestId: key, lineIndex })));
  }
  if (
    new Set(requestRows.map((row) => `${row.requestId}:${row.lineIndex}`)).size !==
    requestRows.length
  )
    throw new Error("来源物料行不能重复选择");
  function row(line: Line, key: string, source: Partial<PurchaseLine>): PurchaseLine {
    const edit = input.lineEdits?.[key] || {};
    const value: PurchaseLine = {
      ...line,
      ...source,
      id: id("PL"),
      received: 0,
      amount: input.lineAmounts?.[key] ?? null,
      ...edit,
    };
    validateLines(state, [value]);
    amountValid(value.unitPrice);
    value.amount = purchaseLineAmount(value);
    return value;
  }
  const requests = requestRows.map(({ requestId, lineIndex }) => {
    const request = state.requests.find((r) => r.id === requestId);
    if (!request || !Number.isInteger(lineIndex) || !request.lines[lineIndex])
      throw new Error("请购来源物料不存在");
    return request;
  });
  const rows = [
    ...chosen.map(({ draft, line, index }) =>
      row(line, `draft:${draft.id}:${index}`, { draft: draft.id, draftLine: line.id })
    ),
    ...requestRows.map(({ requestId, lineIndex }) =>
      row(
        state.requests.find((r) => r.id === requestId)!.lines[lineIndex]!,
        `request:${requestId}:${lineIndex}`,
        { request: requestId, requestLine: String(lineIndex) }
      )
    ),
    ...(input.lines || []).map((line, index) => row(line, `manual:${index}`, {})),
  ];
  if (!rows.length) throw new Error("请至少添加一条商品明细");
  purchaseTotal(rows);
  return {
    rows,
    drafts: [...new Set(chosen.map((value) => value.draft))],
    requests: [...new Set(requests)],
    chosen,
  };
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
  state.purchases.unshift(order);
  return order;
}
export function appendPurchase(state: State, orderId: string, input: PurchaseSources) {
  const order = editable(state, orderId);
  const source = sourceLines(state, input);
  const amount = purchaseTotal([...order.lines, ...source.rows]);
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
    lines?: PurchaseLine[];
    sources?: PurchaseSources;
  }
) {
  const order = editable(state, orderId);
  if (!input.buyer.trim() || !input.supplier.trim()) throw new Error("采购人、供应商不能为空");
  const updates = input.lineAmounts || {};
  if (Object.keys(updates).some((key) => !order.lines.some((l) => l.id === key)))
    throw new Error("采购金额明细不存在");
  const base = input.lines ?? order.lines;
  if (new Set(base.map((line) => line.id)).size !== base.length)
    throw new Error("采购明细不能重复");
  const added = input.sources ? sourceLines(state, input.sources).rows : [];
  const lines: PurchaseLine[] = [
    ...base
      .map((l) => {
        const original = order.lines.find((row) => row.id === l.id);
        if (
          !original ||
          original.material !== l.material ||
          original.draft !== l.draft ||
          original.draftLine !== l.draftLine ||
          original.request !== l.request ||
          original.requestLine !== l.requestLine
        )
          throw new Error("采购明细来源不可修改");
        validateLines(state, [l]);
        if (l.received !== original.received) throw new Error("已收数量不可修改");
        return {
          ...l,
          amount:
            l.qty !== original.qty && l.unitPrice == null
              ? null
              : Object.hasOwn(updates, l.id)
                ? updates[l.id]!
                : (l.amount ?? null),
        };
      })
      .map((line) => ({ ...line, amount: purchaseLineAmount(line) })),
    ...added,
  ];
  if (!lines.length) throw new Error("请保留至少一条采购明细");
  // 未审核下游仍保留来源，禁止删除其引用或缩减到已收/待收量以下。
  for (const original of order.lines) {
    const reserved = state.receipts
      .filter((receipt) => receipt.purchase === order.id && receipt.status !== "已收货")
      .flatMap((receipt) => receipt.lines)
      .filter((line) => line.lineId === original.id)
      .reduce((sum, line) => sum + line.qty, 0);
    const replacement = lines.find((line) => line.id === original.id);
    if (
      (original.received > 0 || reserved > 0) &&
      (!replacement || replacement.qty < original.received + reserved)
    )
      throw new Error("采购明细已有收货单引用，数量不能低于已收与待收数量");
  }
  const amount = purchaseTotal(lines);
  Object.assign(order, {
    buyer: input.buyer.trim(),
    supplier: input.supplier.trim(),
    lines,
    amount,
  });
  return order;
}
export function purchaseDifferences(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order) throw new Error("采购单不存在");
  return order.lines.flatMap((line) => {
    const source = line.draft
      ? state.drafts.find((d) => d.id === line.draft)?.lines.find((l) => l.id === line.draftLine)
      : line.request
        ? state.requests.find((r) => r.id === line.request)?.lines[Number(line.requestLine)]
        : undefined;
    if ((line.draft || line.request) && !source) throw new Error("采购明细来源已缺失，不能审核");
    return source && source.qty !== line.qty
      ? [
          {
            material: line.material,
            source: line.draft || line.request || "",
            required: source.qty,
            qty: line.qty,
          },
        ]
      : [];
  });
}
export function auditPurchase(state: State, orderId: string, confirmDifferences = false) {
  const order = editable(state, orderId);
  if (!order.lines.length) throw new Error("采购单没有物料");
  for (const line of order.lines) {
    if (line.draft && state.drafts.find((d) => d.id === line.draft)?.auditStatus !== "已审核")
      throw new Error("来源底稿未审核，不能审核采购单");
  }
  if (purchaseDifferences(state, orderId).length && !confirmDifferences)
    throw new Error("采购数量与来源要求存在差异，请确认后继续审核");
  order.lines.forEach((l) => validateLines(state, [l]));
  const amount = purchaseTotal(order.lines);
  order.lines = order.lines.map((line) => ({ ...line, amount: purchaseLineAmount(line) }));
  order.amount = amount;
  order.status = "已审核";
}
export function unauditPurchase(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "已审核") throw new Error("仅已审核采购单可以反审核");
  if (state.receipts.some((r) => r.purchase === order.id && r.auditStatus === "已审核"))
    throw new Error("存在已审核的直接下游收货单，不能反审核");
  order.status = "未审核";
}
export function mergePurchases(state: State, orderIds: string[]) {
  if (orderIds.length < 2 || new Set(orderIds).size !== orderIds.length)
    throw new Error("请选择至少两张不同的采购单");
  const orders = orderIds.map((key) => editable(state, key));
  if (state.receipts.some((receipt) => orderIds.includes(receipt.purchase)))
    throw new Error("存在收货单引用的采购单不能合并");
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
function purchaseForReceipt(state: State, orderId: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order || order.status !== "已审核") throw new Error("请选择已审核采购单");
  return order;
}
function receiptWarehouse(state: State, warehouse: string) {
  if (!state.warehouses.some((w) => w.id === warehouse && w.available && !w.inactive))
    throw new Error("采购入库请选择参与可用量计算的仓库");
}
export function receiptRemaining(state: State, orderId: string, excludeReceiptId?: string) {
  const order = state.purchases.find((p) => p.id === orderId && !p.mergedInto);
  if (!order) throw new Error("采购单不存在");
  return order.lines.map((line) => ({
    lineId: line.id,
    material: line.material,
    qty: Math.max(
      0,
      line.qty -
        line.received -
        state.receipts
          .filter(
            (r) => r.purchase === order.id && r.id !== excludeReceiptId && r.status !== "已收货"
          )
          .flatMap((r) => r.lines)
          .filter((l) => l.lineId === line.id)
          .reduce((sum, l) => sum + l.qty, 0)
    ),
  }));
}
function plannedReceiptLines(
  state: State,
  orderId: string,
  input: { lineId: string; qty: number }[],
  exclude?: string
): ReceiptLine[] {
  const remaining = receiptRemaining(state, orderId, exclude);
  if (!input.length || new Set(input.map((row) => row.lineId)).size !== input.length)
    throw new Error("请选择不重复的收货物料");
  return input.map((row) => {
    positive(row.qty);
    const source = remaining.find((l) => l.lineId === row.lineId);
    if (!source || row.qty > source.qty) throw new Error("收货数量超过剩余应收数量");
    validateLines(state, [{ material: source.material, qty: row.qty }]);
    return { lineId: row.lineId, material: source.material, qty: row.qty };
  });
}
export function createReceipt(
  state: State,
  orderId: string,
  warehouse: string,
  input: { lineId: string; qty: number }[],
  logistics: { carrier?: string; tracking?: string } = {}
) {
  purchaseForReceipt(state, orderId);
  receiptWarehouse(state, warehouse);
  const lines = plannedReceiptLines(state, orderId, input);
  const receipt: Receipt = {
    id: id("RC"),
    purchase: orderId,
    warehouse,
    date: today(),
    lines,
    status: "待收货",
    auditStatus: "未审核",
    carrier: logistics.carrier?.trim() || "",
    tracking: logistics.tracking?.trim() || "",
  };
  state.receipts.unshift(receipt);
  return receipt;
}
export function updateReceipt(
  state: State,
  receiptId: string,
  input: { lineId: string; qty: number }[]
) {
  const receipt = state.receipts.find((r) => r.id === receiptId);
  if (!receipt || receipt.status === "已收货" || receipt.auditStatus === "已审核")
    throw new Error("仅待收货单可以修改数量");
  purchaseForReceipt(state, receipt.purchase);
  if (
    input.length !== receipt.lines.length ||
    input.some((row) => !receipt.lines.some((l) => l.lineId === row.lineId))
  )
    throw new Error("待收货单只能修改已有物料的数量");
  const lines = plannedReceiptLines(state, receipt.purchase, input, receipt.id);
  receipt.lines = lines;
  return receipt;
}
function refreshReceiptStatus(order: Purchase) {
  order.receiptStatus = order.lines.every((l) => l.received === l.qty)
    ? "全部收货"
    : order.lines.some((l) => l.received > 0)
      ? "部分收货"
      : "未收货";
}
export function confirmReceipt(
  state: State,
  receiptId: string,
  actual?: { lineId: string; qty: number }[]
) {
  const receipt = state.receipts.find((r) => r.id === receiptId);
  if (!receipt || receipt.status === "已收货" || receipt.auditStatus === "已审核")
    throw new Error("收货单已完成，不能重复入库");
  const order = purchaseForReceipt(state, receipt.purchase);
  receiptWarehouse(state, receipt.warehouse);
  const input = actual ?? receipt.lines;
  if (
    input.length !== receipt.lines.length ||
    new Set(input.map((row) => row.lineId)).size !== input.length
  )
    throw new Error("实收物料必须与待收货单一致");
  const lines: ReceiptLine[] = input.map((row) => {
    if (!Number.isSafeInteger(row.qty) || row.qty < 0 || row.qty > 100000)
      throw new Error("实收数量须为非负整数");
    const planned = receipt.lines.find((l) => l.lineId === row.lineId);
    const source = order.lines.find((l) => l.id === row.lineId);
    if (!planned || !source || row.qty > planned.qty || row.qty > source.qty - source.received)
      throw new Error("实收数量不能超过本单安排数量及剩余应收量");
    if (row.qty) validateLines(state, [{ material: planned.material, qty: row.qty }]);
    return { lineId: row.lineId, material: planned.material, qty: row.qty };
  });
  if (!lines.some((l) => l.qty > 0)) throw new Error("实收数量至少有一条大于零");
  const { auditStatus: _auditStatus, ...receiptData } = receipt;
  const inbound: Inbound = {
    ...receiptData,
    id: id("IN"),
    receipt: receipt.id,
    lines: lines.filter((l) => l.qty > 0),
    status: "已收货",
  };
  for (const line of inbound.lines) {
    move(
      state,
      receipt.warehouse,
      line,
      "入库",
      inbound.id,
      `采购收货 ${order.id} / ${receipt.id}`
    );
    order.lines.find((l) => l.id === line.lineId)!.received += line.qty;
  }
  receipt.lines = lines;
  receipt.status = "已收货";
  receipt.auditStatus = "已审核";
  state.inbounds.unshift(inbound);
  refreshReceiptStatus(order);
  return receipt;
}
export function unauditReceipt(state: State, receiptId: string) {
  const receipt = state.receipts.find((r) => r.id === receiptId);
  if (!receipt || receipt.auditStatus !== "已审核" || receipt.status !== "已收货")
    throw new Error("仅已审核收货单可以反审核");
  const order = state.purchases.find((p) => p.id === receipt.purchase);
  if (!order) throw new Error("来源采购单不存在");
  const inbounds = state.inbounds.filter((i) => i.receipt === receipt.id);
  if (!inbounds.length) throw new Error("历史收货缺少入库关联，无法安全反审核");
  const totals = new Map<string, number>();
  for (const line of receipt.lines) {
    const key = stockKey(receipt.warehouse, line.material);
    totals.set(key, (totals.get(key) || 0) + line.qty);
    const source = order.lines.find((l) => l.id === line.lineId);
    if (!source || source.received < line.qty) throw new Error("采购已收数量与收货记录不一致");
  }
  for (const [key, qty] of totals)
    if ((state.stocks[key] || 0) < qty) throw new Error("收货库存已被使用，库存不足，不能反审核");
  for (const [key, qty] of totals) state.stocks[key] = (state.stocks[key] || 0) - qty;
  for (const line of receipt.lines)
    order.lines.find((l) => l.id === line.lineId)!.received -= line.qty;
  const ids = new Set(inbounds.map((i) => i.id));
  state.movements = state.movements.filter((m) => !ids.has(m.source));
  state.inbounds = state.inbounds.filter((i) => i.receipt !== receipt.id);
  receipt.lines = receipt.lines.filter((l) => l.qty > 0);
  receipt.status = "待收货";
  receipt.auditStatus = "未审核";
  refreshReceiptStatus(order);
}
/** 兼容旧调用；新页面必须使用创建待单、确认实收两个独立步骤。 */
export function receive(
  state: State,
  orderId: string,
  warehouse: string,
  input?: { lineId: string; qty: number }[]
) {
  receiptWarehouse(state, warehouse);
  purchaseForReceipt(state, orderId);
  const rows = input ?? receiptRemaining(state, orderId).filter((l) => l.qty > 0);
  const receipt = createReceipt(state, orderId, warehouse, rows);
  return confirmReceipt(state, receipt.id);
}
function validateIssueLines(state: State, lines: IssueLine[]) {
  if (!lines.length) throw new Error("请至少保留一条领料物料");
  const totals = new Map<string, number>();
  for (const line of lines) {
    validateLines(state, [line]);
    if (!state.warehouses.some((w) => w.id === line.warehouse && !w.inactive))
      throw new Error("请选择正常使用的仓库");
    const key = stockKey(line.warehouse, line.material);
    totals.set(key, (totals.get(key) || 0) + line.qty);
  }
  for (const [key, qty] of totals)
    if ((state.stocks[key] || 0) < qty) throw new Error("该仓库库存不足，不能出库");
}
export function createIssue(state: State, planId: string, input?: IssueLine[]) {
  const plan = getPlan(state, planId);
  if (plan.auditStatus !== "已审核") throw new Error("请选择已审核生产计划");
  const lines =
    input?.map((l) => ({ ...l })) ??
    requirements(plan).map((line) => ({
      ...line,
      warehouse:
        state.warehouses.find(
          (w) => !w.inactive && (state.stocks[stockKey(w.id, line.material)] || 0) >= line.qty
        )?.id || "BZ01",
    }));
  validateIssueLines(state, lines);
  const issue: Issue = { id: id("IS"), plan: plan.id, date: today(), lines, auditStatus: "已审核" };
  for (const line of lines)
    move(state, line.warehouse, line, "出库", issue.id, `生产领料 ${plan.id}`);
  state.issues.unshift(issue);
  return issue;
}
export function auditIssue(state: State, issueId: string) {
  const issue = state.issues.find((i) => i.id === issueId);
  if (!issue || issue.auditStatus === "已审核") throw new Error("仅未审核领料单可以审核");
  if (getPlan(state, issue.plan).auditStatus !== "已审核") throw new Error("来源计划未审核");
  validateIssueLines(state, issue.lines);
  for (const line of issue.lines)
    move(state, line.warehouse, line, "出库", issue.id, `生产领料 ${issue.plan}`);
  issue.auditStatus = "已审核";
}
export function unauditIssue(state: State, issueId: string) {
  const issue = state.issues.find((i) => i.id === issueId);
  if (!issue || issue.auditStatus !== "已审核") throw new Error("仅已审核领料单可以反审核");
  // 领料执行状态不推导计划齐料，返审只撤销本单对应的实际出库。
  const totals = new Map<string, number>();
  for (const line of issue.lines) {
    const key = stockKey(line.warehouse, line.material);
    totals.set(key, (totals.get(key) || 0) + line.qty);
  }
  for (const [key, qty] of totals)
    if (!Number.isSafeInteger((state.stocks[key] || 0) + qty))
      throw new Error("回补库存超出支持范围");
  for (const [key, qty] of totals) state.stocks[key] = (state.stocks[key] || 0) + qty;
  state.movements = state.movements.filter((m) => m.source !== issue.id);
  issue.auditStatus = "未审核";
}
export function issuePlan(state: State, planId: string) {
  return createIssue(state, planId);
}
export function finishPlan(state: State, planId: string) {
  const plan = getPlan(state, planId);
  if (plan.auditStatus !== "已审核" || plan.status === "已完工")
    throw new Error("仅已审核且未完工计划可以完工，不能重复完工");
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
