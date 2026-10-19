import type { Material, State } from "./model";

export type Value = string | number | boolean | null;
export type Draft = Record<string, Value>;
export interface Field {
  key: string;
  label: string;
  type?: "number" | "select" | "switch";
  options?: string[];
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
}
export const categories = [
  { id: "Y", name: "原材料" },
  { id: "G", name: "工具" },
  { id: "F", name: "辅材" },
  { id: "D", name: "成品" },
  { id: "C", name: "客户" },
  { id: "B", name: "半品" },
  { id: "M", name: "模具" },
  { id: "YM", name: "模具零配件" },
  { id: "YL", name: "零件" },
  { id: "J", name: "夹具" },
  { id: "YJ", name: "夹具零配件" },
  { id: "L", name: "零件 BOM" },
];
export const groups: { title: string; fields: Field[] }[] = [
  {
    title: "基本标识",
    fields: [
      { key: "name", label: "品名", required: true },
      { key: "spec", label: "规格" },
      { key: "unit", label: "库存单位", required: true },
      { key: "shortcut", label: "快捷码" },
    ],
  },
  {
    title: "分类与属性",
    fields: [
      { key: "category", label: "商品分类", type: "select" },
      { key: "accountingCategory", label: "会计分类" },
      { key: "brand", label: "品牌" },
      { key: "texture", label: "材质" },
    ],
  },
  {
    title: "仓储与条码",
    fields: [
      { key: "mainWarehouse", label: "主要仓库", type: "select" },
      { key: "location", label: "存放位置" },
      { key: "barcodeFormat", label: "条码格式编号" },
      { key: "barcode", label: "条码编号" },
      { key: "cycleCode", label: "循环盘点码" },
      { key: "lowLevelCode", label: "低阶码" },
    ],
  },
  {
    title: "采购与生产",
    fields: [
      { key: "source", label: "主要来源", type: "select", options: ["采购件", "厂内生产件"] },
      { key: "designatedSupplier", label: "指定主供应商", type: "switch" },
      { key: "supplier", label: "主供应商" },
      { key: "purchaseUnit", label: "采购单位" },
      { key: "salesUnit", label: "销售单位" },
      { key: "processRoute", label: "工艺路线编号" },
      { key: "bom", label: "指定 BOM" },
      { key: "leadDays", label: "前置天数", type: "number", min: 0, max: 36500, integer: true },
    ],
  },
  {
    title: "补货控制",
    fields: [
      { key: "safetyStock", label: "安全存量", type: "number", min: 0 },
      { key: "minimumReplenishment", label: "最低补量", type: "number", min: 0 },
      { key: "replenishmentMultiple", label: "补货倍量", type: "number", min: 0.0001 },
      { key: "demandReplenishment", label: "按需求补货", type: "switch" },
    ],
  },
  {
    title: "核算与领料",
    fields: [
      { key: "costMethod", label: "成本计价方式", type: "select", options: ["月加权平均"] },
      { key: "taxRate", label: "税率（%）", type: "number", min: 0, max: 100 },
      { key: "laborWeight", label: "人工分摊权数", type: "number", min: 0 },
      { key: "overheadWeight", label: "制造分摊权数", type: "number", min: 0 },
      { key: "issueMultiple", label: "领料倍量", type: "number", min: 0.0001 },
      { key: "department", label: "部门" },
    ],
  },
  {
    title: "管理状态",
    fields: [
      { key: "batchManaged", label: "批号管理", type: "switch" },
      { key: "inventoryAccounting", label: "存货核算", type: "switch" },
      { key: "inactive", label: "失效", type: "switch" },
    ],
  },
];

// 这些是截图中新建表单的示例默认值，仅补齐旧版 mock 档案，不参与需求或成本算法。
export function materialDraft(m: Material): Draft {
  const defaults: Draft = Object.fromEntries(
    groups.flatMap((g) =>
      g.fields.map((f) => [f.key, f.type === "number" ? null : f.type === "switch" ? false : ""])
    )
  );
  return {
    ...defaults,
    category: m.id.startsWith("FG") ? "D" : "Y",
    costMethod: "月加权平均",
    taxRate: 13,
    laborWeight: 1,
    overheadWeight: 1,
    issueMultiple: 1,
    replenishmentMultiple: 1,
    leadDays: 0,
    safetyStock: 0,
    minimumReplenishment: 0,
    demandReplenishment: true,
    ...m.details,
    name: m.name,
    spec: m.spec,
    unit: m.unit,
    remark: m.details?.remark || "",
  };
}
export function materialCategory(m: Material) {
  return String(materialDraft(m).category || "");
}
export function categoryName(code: string) {
  return categories.find((c) => c.id === code)?.name || "未分类";
}
export function saveMaterial(state: State, materialId: string, draft: Draft) {
  const m = state.materials.find((m) => m.id === materialId);
  if (!m) throw new Error("物料不存在，请返回档案列表");
  const details: Draft = {};
  for (const field of groups.flatMap((g) => g.fields)) {
    const value = draft[field.key];
    if (field.required && (typeof value !== "string" || !value.trim()))
      throw new Error(`请填写${field.label}`);
    if (field.type === "number" && value !== null && value !== undefined) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < (field.min ?? 0) ||
        value > (field.max ?? 1000000) ||
        (field.integer && !Number.isInteger(value))
      )
        throw new Error(`${field.label}超出允许范围`);
    }
    if (field.type === "switch" && typeof value !== "boolean")
      throw new Error(`请检查${field.label}`);
    if (field.options && value && !field.options.includes(String(value)))
      throw new Error(`请选择有效的${field.label}`);
    details[field.key] = typeof value === "string" ? value.trim() : (value ?? null);
  }
  if (details.category && !categories.some((c) => c.id === details.category))
    throw new Error("请选择有效的商品分类");
  if (details.mainWarehouse && !state.warehouses.some((w) => w.id === details.mainWarehouse))
    throw new Error("请选择有效的主要仓库");
  details.remark = String(draft.remark || "").trim();
  // 品号是所有业务的关联键，参考价格保留，避免基本资料编辑改变报价数据。
  m.name = String(details.name);
  m.spec = String(details.spec || "");
  m.unit = String(details.unit);
  delete details.name;
  delete details.spec;
  delete details.unit;
  m.details = details;
}
