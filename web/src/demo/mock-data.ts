import database from "./mock/database.json";
import { productMaterials } from "./product-materials";
import type { State } from "./model";

type Cell = string | number | boolean | null;
export type MockRow = Record<string, Cell>;
export interface MockDatabase {
  schemaVersion: number;
  tables: Record<string, MockRow[]>;
}

export const mockDatabase: MockDatabase = database;
const text = (row: MockRow, key: string) => {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`mock 字段 ${key} 必须为文本`);
  return value;
};
const integer = (row: MockRow, key: string) => {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error(`mock 字段 ${key} 必须为安全整数`);
  return value;
};
const optionalText = (row: MockRow, key: string) => row[key] == null ? undefined : text(row, key);
function enumeration<const T extends string>(row: MockRow, key: string, values: readonly T[]): T {
  const value = text(row, key);
  const result = values.find((candidate) => candidate === value);
  if (!result) throw new Error(`mock 字段 ${key} 不支持值 ${value}`);
  return result;
}

/** 从关系表构建现有页面模型；未知价格和历史审核人不编造。 */
export function createMockState(source: MockDatabase = mockDatabase, date?: string): State {
  if (source.schemaVersion !== 1) throw new Error("mock 数据结构版本不兼容");
  const rows = (table: string): MockRow[] => {
    const result = source.tables[table];
    if (!Array.isArray(result)) throw new Error(`mock 缺少表 ${table}`);
    return result;
  };
  const childRows = (table: string, documentId: string) => rows(table)
    .filter((row) => row.document_id === documentId)
    .sort((a, b) => integer(a, "line_no") - integer(b, "line_no"));
  // 初始化业务单据使用中国时区当天；期初流水保留其发生日期。
  const businessDate = date ?? new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  const materials = rows("materials").map((row) => ({
    id: text(row, "id"), name: text(row, "name"), spec: text(row, "spec"),
    unit: text(row, "stock_unit"),
    // 当前页面要求数字参考价；未提供价格仍兼容原来的 0 占位，不用于采购计价。
    price: row.reference_price_micro == null ? 0 : integer(row, "reference_price_micro") / 1_000_000,
    details: row.category_id == null ? undefined : { category: text(row, "category_id"), inactive: Boolean(row.inactive) },
  }));
  const materialIds = new Set(materials.map((material) => material.id));
  const extraMaterials = productMaterials().filter((material) => !materialIds.has(material.id));
  const state: State = {
    version: 1,
    warehouses: rows("warehouses").map((row) => ({
      id: text(row, "id"), name: text(row, "name"), kind: text(row, "kind"),
      available: Boolean(integer(row, "included_in_available")),
      inactive: Boolean(integer(row, "inactive")),
      phone: optionalText(row, "phone"), fax: optionalText(row, "fax"),
      address: optionalText(row, "address"), remark: optionalText(row, "remark"),
    })),
    materials: [...materials, ...extraMaterials],
    stocks: Object.fromEntries(rows("inventory_balances").map((row) => [
      `${text(row, "warehouse_id")}:${text(row, "material_id")}`, integer(row, "quantity"),
    ])),
    workOrders: rows("work_orders").map((row) => ({
      id: text(row, "id"), name: text(row, "name"), customer: text(row, "customer_name"),
      product: text(row, "product_id"), qty: integer(row, "quantity"), date: businessDate,
      status: enumeration(row, "execution_status", ["立项中", "采购中", "装配中", "待出货", "已发货"]),
      remark: optionalText(row, "remark"),
    })),
    plans: rows("production_plans").map((row) => ({
      id: text(row, "id"), name: text(row, "name"), workOrder: text(row, "work_order_id"),
      product: text(row, "product_id"), qty: integer(row, "quantity"), date: businessDate,
      auditStatus: enumeration(row, "audit_status", ["未审核", "已审核"]),
      status: enumeration(row, "execution_status", ["待分析", "待备料", "已领料", "已完工"]),
      bom: childRows("production_plan_lines", text(row, "id")).map((line) => ({
        material: text(line, "material_id"), qty: integer(line, "quantity"),
      })),
    })),
    requests: rows("requisitions").map((row) => ({
      id: text(row, "id"), plan: optionalText(row, "plan_id") ?? "",
      applicant: text(row, "applicant_name"), date: businessDate,
      status: enumeration(row, "execution_status", ["待采购", "已转采购"]),
      lines: childRows("requisition_lines", text(row, "id")).map((line) => ({
        material: text(line, "material_id"), qty: integer(line, "quantity"),
      })),
    })),
    purchases: rows("purchase_orders").map((row) => {
      const lines = childRows("purchase_lines", text(row, "id")).map((line) => {
        const sourceId = optionalText(line, "source_requisition_line_id");
        const requisition = sourceId ? rows("requisition_lines").find((candidate) => candidate.id === sourceId) : undefined;
        if (sourceId && !requisition) throw new Error(`mock 请购来源行不存在：${sourceId}`);
        if (line.source_draft_line_id != null)
          throw new Error("基础 mock 的底稿来源尚未映射，请使用业务场景生成器");
        return {
          id: text(line, "id"), material: text(line, "material_id"), qty: integer(line, "quantity"),
          received: integer(line, "received_quantity"),
          request: requisition ? text(requisition, "document_id") : undefined,
          requestLine: requisition ? String(integer(requisition, "line_no") - 1) : undefined,
          unitPrice: line.price_incl_tax_micro == null ? undefined : integer(line, "price_incl_tax_micro") / 1_000_000,
          amount: line.amount_incl_tax_cents == null ? undefined : integer(line, "amount_incl_tax_cents") / 100,
          dueDate: optionalText(line, "promise_date"), remark: optionalText(line, "remark"),
        };
      });
      return {
        id: text(row, "id"), request: lines[0]?.request ?? "", plan: "",
        buyer: text(row, "buyer_name"), supplier: text(row, "supplier_name"), date: businessDate,
        status: enumeration(row, "audit_status", ["未审核", "已审核"]),
        receiptStatus: enumeration(row, "receipt_status", ["未收货", "部分收货", "全部收货"]),
        amount: lines.some((line) => line.amount == null) ? null : lines.reduce((sum, line) => sum + (line.amount ?? 0), 0),
        lines,
      };
    }),
    movements: rows("inventory_movements").map((row) => ({
      id: text(row, "id"), date: text(row, "movement_date"),
      type: enumeration(row, "direction", ["入库", "出库"]),
      warehouse: text(row, "warehouse_id"), material: text(row, "material_id"),
      qty: integer(row, "quantity"), source: row.source_doc_type === "opening_balance" ? "期初建账" : text(row, "source_doc_id"),
      reason: text(row, "reason"),
    })),
    drafts: [], receipts: [], inbounds: [], issues: [], shipments: [], finishedInbounds: [], finishedOutbounds: [],
    deletedMaterialIds: [],
  };
  // 尚未适配的业务表必须为空，避免悄悄丢失 fixture 中的单据。
  for (const table of ["purchase_drafts", "purchase_draft_lines", "receipts", "receipt_lines", "inventory_inbounds",
    "inventory_inbound_lines", "material_issues", "material_issue_lines", "finished_inbounds", "finished_inbound_lines",
    "shipments", "shipment_lines", "finished_outbounds", "finished_outbound_lines",
    "analysis_runs", "analysis_run_lines", "purchase_order_revisions", "print_templates",
    "print_template_versions", "print_records", "operation_logs"])
    if (rows(table).length) throw new Error(`基础 mock 不支持非空 ${table}，请使用业务场景生成器`);
  validateReferences(state);
  return state;
}

/** 基础数据损坏时立即报错，避免在页面操作时才出现不明缺料。 */
function validateReferences(state: State) {
  const materialIds = new Set(state.materials.map((row) => row.id));
  const warehouseIds = new Set(state.warehouses.map((row) => row.id));
  const workOrderIds = new Set(state.workOrders.map((row) => row.id));
  for (const collection of [state.materials, state.warehouses, state.workOrders, state.plans, state.requests, state.purchases])
    if (new Set(collection.map((row) => row.id)).size !== collection.length) throw new Error("mock 存在重复主键");
  for (const plan of state.plans) {
    if (!materialIds.has(plan.product) || !workOrderIds.has(plan.workOrder ?? "")) throw new Error("mock 计划来源不存在");
    for (const line of plan.bom ?? [])
      if (!materialIds.has(line.material) || line.qty <= 0) throw new Error("mock 计划物料无效");
  }
  for (const row of state.workOrders)
    if (!materialIds.has(row.product)) throw new Error("mock 工单产品不存在");
  for (const row of [...state.requests, ...state.purchases])
    for (const line of row.lines)
      if (!materialIds.has(line.material) || line.qty <= 0) throw new Error("mock 单据物料无效");
  for (const row of state.movements)
    if (!materialIds.has(row.material) || !warehouseIds.has(row.warehouse)) throw new Error("mock 库存流水引用不存在");
  for (const key of Object.keys(state.stocks)) {
    const [warehouse, material] = key.split(":");
    if (!warehouseIds.has(warehouse ?? "") || !materialIds.has(material ?? "")) throw new Error("mock 库存余额引用不存在");
  }
}

