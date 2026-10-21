import { read, utils, type WorkBook } from "xlsx";
import { id, validateLines, type Material, type Plan, type State } from "./model";

export type IdentifierSource = "drawingNo" | "spec" | "merged" | "none";

export interface ImportRow {
  row: number;
  part: string;
  name: string;
  spec: string;
  drawingNo: string;
  identifierSource: IdentifierSource;
  unit: string;
  qty: number;
  brand: string;
  texture: string;
  surfaceTreatment: string;
  weightKg: number | null;
  remark: string;
  category: string;
  materialId: string;
  candidates: string[];
}
export interface ImportSheet {
  sheet: string;
  name: string;
  qty: number;
  basis: "perUnit" | "total";
  rows: ImportRow[];
}
export interface ImportPreview {
  file: string;
  sheets: ImportSheet[];
  ignored: string[];
  errors: string[];
  warnings: string[];
}
const sheetCategories: Record<string, string> = { 机加: "JJ", 钣金: "BJ", 标准: "BZ", 电气: "DQ" };
const text = (v: unknown) => (v == null ? "" : String(v).trim());
const header = (v: unknown) =>
  text(v)
    .replace(/[／]/g, "/")
    .replace(/[\s（）()]/g, "")
    .toLowerCase();
const aliases = {
  name: ["名称", "品名", "物料名称", "零件名称", "部品名称", "产品名称"],
  spec: ["型号/规格", "规格/型号", "型号规格", "规格型号", "规格", "型号"],
  drawingNo: ["图号", "图纸编号", "零件号"],
  unit: ["单位", "库存单位"],
  qty: ["数量/台", "数量", "单台用量", "用量"],
  brand: ["品牌"],
  texture: ["材质"],
  surfaceTreatment: ["表面处理"],
  weightKg: ["重量kg", "重量", "单重kg"],
  remark: ["备注"],
  sequence: ["序号"],
};
const mergedIdentifierHeaders = ["图号/规格", "规格/图号", "图号规格"];

function indexesOf(headers: string[], values: string[]) {
  return headers.flatMap((value, index) => (values.includes(value) ? [index] : []));
}

function resolveIdentifierColumns(headers: string[]) {
  const drawingNo = indexesOf(headers, aliases.drawingNo);
  const spec = indexesOf(headers, aliases.spec);
  const merged = indexesOf(headers, mergedIdentifierHeaders);
  const errors: string[] = [];
  if (drawingNo.length > 1) errors.push("“图号”对应多个表头，请保留一列后重新导入。");
  if (spec.length > 1) errors.push("“规格/型号”对应多个表头，请保留一列后重新导入。");
  if (merged.length > 1) errors.push("“图号/规格”对应多个表头，请保留一列后重新导入。");
  return {
    drawingNo: drawingNo[0] ?? -1,
    spec: spec[0] ?? -1,
    merged: merged[0] ?? -1,
    errors,
  };
}

function parseQuantity(raw: unknown) {
  const value = text(raw);
  if (value === "") return { qty: 1, note: "" };
  if (typeof raw === "number") return { qty: raw, note: "" };
  const changed = value.match(/^(\d+)\s*(?:→|->|~|～)\s*(\d+)$/);
  if (changed)
    return { qty: Number(changed[2]), note: `数量“${value}”按变更后 ${changed[2]} 导入` };
  if (/^\d+$/.test(value)) return { qty: Number(value), note: "" };
  return { qty: NaN, note: "" };
}

function parseWeight(raw: unknown) {
  const value = text(raw);
  if (value === "") return { weight: null as number | null, note: "" };
  if (typeof raw === "number") return { weight: raw, note: "" };
  const multiDot = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (multiDot) {
    const fixed = `${multiDot[1]}.${multiDot[2]}${multiDot[3]}`;
    return { weight: Number(fixed), note: `重量“${value}”按 ${fixed} 导入` };
  }
  return { weight: Number(value), note: "" };
}

// 图号与加工属性共同识别加工件；采购件要求名称、规格及品牌一致，禁止仅凭同名关联库存。
export function matchingMaterials(row: ImportRow, materials: Material[]) {
  if (!row.drawingNo && !row.spec) return [];
  const useDrawing =
    row.identifierSource === "drawingNo" ||
    (row.identifierSource === "merged" && ["JJ", "BJ"].includes(row.category)) ||
    (row.identifierSource === "none" && !!row.drawingNo);
  const identifier = useDrawing ? row.drawingNo || row.spec : row.spec || row.drawingNo;
  return materials.filter((m) => {
    const d = m.details;
    if (
      ["JJ", "BJ", "BZ", "DQ"].includes(row.category) &&
      d?.category &&
      d.category !== row.category
    )
      return false;
    if (useDrawing)
      return (
        text(d?.drawingNo) === identifier &&
        m.name === row.name &&
        text(d?.texture) === row.texture &&
        text(d?.surfaceTreatment) === row.surfaceTreatment &&
        (!row.unit || !m.unit || row.unit === m.unit) &&
        (row.weightKg === null || d?.weightKg == null || d.weightKg === row.weightKg)
      );
    return (
      m.name === row.name &&
      m.spec === identifier &&
      text(d?.brand) === row.brand &&
      (!row.unit || !m.unit || row.unit === m.unit)
    );
  });
}

export function parseProductionWorkbook(
  workbook: WorkBook,
  file: string,
  materials: Material[]
): ImportPreview {
  const preview: ImportPreview = { file, sheets: [], ignored: [], errors: [], warnings: [] };
  // 空白模板页不算有效子表，兼容只有 Sheet1 有内容的旧 XLS。
  const populated = workbook.SheetNames.filter((name) => {
    const sheet = workbook.Sheets[name];
    return sheet && Object.keys(sheet).some((key) => !key.startsWith("!") && text(sheet[key]?.v));
  });
  const names =
    populated.length === 1 ? populated : populated.filter((name) => sheetCategories[name.trim()]);
  preview.ignored = workbook.SheetNames.filter((name) => !names.includes(name));
  if (!names.length)
    preview.errors.push("没有可导入的工作表：多表文件仅支持机加、标准、钣金、电气。");
  for (const name of names) {
    const ws = workbook.Sheets[name]!;
    const range = ws["!ref"] ? utils.decode_range(ws["!ref"]) : null;
    if (!range || range.e.r > 10000 || range.e.c > 200) {
      preview.errors.push(`${name}：工作表范围过大，最多支持 10000 行、200 列。`);
      continue;
    }
    const rows = utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      blankrows: true,
      range: 0,
    });
    const headerIndex = rows.findIndex((r) => r.some((v) => aliases.name.includes(header(v))));
    if (headerIndex < 0) {
      preview.errors.push(`${name}：未找到“名称/品名/物料名称/零件名称”表头。`);
      continue;
    }
    const headers = rows[headerIndex]!.map(header);
    const identifiers = resolveIdentifierColumns(headers);
    identifiers.errors.forEach((message) => preview.errors.push(`${name}：${message}`));
    const specIndex = identifiers.spec >= 0 ? identifiers.spec : identifiers.merged;
    const drawingIndex = identifiers.drawingNo >= 0 ? identifiers.drawingNo : identifiers.merged;
    const identifierSource: IdentifierSource =
      identifiers.drawingNo >= 0 && identifiers.spec >= 0
        ? "drawingNo"
        : identifiers.drawingNo >= 0
          ? "drawingNo"
          : identifiers.spec >= 0
            ? "spec"
            : identifiers.merged >= 0
              ? "merged"
              : "none";
    const columns = Object.fromEntries(
      Object.entries(aliases).map(([key, values]) => {
        const indices = headers.flatMap((h, i) => (values.includes(h) ? [i] : []));
        if (indices.length > 1)
          preview.errors.push(`${name}：“${values[0]}”对应多个表头，请保留一列后重新导入。`);
        return [key, indices[0] ?? -1];
      })
    ) as Record<keyof typeof aliases, number>;
    const get = (r: unknown[], key: keyof typeof aliases) =>
      columns[key] < 0 ? "" : r[columns[key]];
    const title = rows
      .slice(0, headerIndex)
      .map((r) => text(r[0]))
      .find((v) => v && !/项目号|制作|交件人/.test(v));
    const category =
      sheetCategories[name.trim()] ||
      Object.entries(sheetCategories).find(([label]) =>
        `${title || ""} ${file}`.includes(label)
      )?.[1] ||
      "YL";
    const sheet: ImportSheet = {
      sheet: name,
      name: `${(title || file.replace(/\.[^.]+$/, "")).replace(/\s+/g, " ")} - ${name}`,
      qty: 1,
      basis: ["数量/台", "单台用量"].includes(headers[columns.qty]!) ? "perUnit" : "total",
      rows: [],
    };
    let part = "";
    let defaultQuantities = 0;
    let defaultUnits = 0;
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const r = rows[i]!;
      const nonempty = r.map(text).filter(Boolean);
      if (!nonempty.length || text(r[0]) === "以下空白") continue;
      // 分组只接受单个文本的合并行或部件编码标题，避免把缺少数量的物料吞掉。
      const mergedGroup = (ws["!merges"] || []).some(
        (m) => m.s.r === i && m.e.r === i && m.e.c > m.s.c
      );
      if (
        nonempty.length === 1 &&
        !/^\d+$/.test(nonempty[0]!) &&
        (mergedGroup || /^A[\d-]+.*(?:部件|机构|模组|装配图|输送带)/.test(nonempty[0]!))
      ) {
        part = nonempty[0]!;
        continue;
      }
      if (
        nonempty.length === 1 &&
        columns.sequence >= 0 &&
        text(get(r, "sequence")) &&
        !text(get(r, "name"))
      )
        continue;
      if (r.map(header).join("|") === headers.join("|")) continue;
      const itemName = text(get(r, "name"));
      const rawQty = get(r, "qty");
      const missingQty = text(rawQty) === "";
      const parsedQty = parseQuantity(rawQty);
      if (
        !itemName ||
        !Number.isSafeInteger(parsedQty.qty) ||
        parsedQty.qty <= 0 ||
        parsedQty.qty > 100000
      ) {
        preview.errors.push(
          `${name} 第 ${i + 1} 行：${!itemName ? "物料名称缺失" : "数量须为 1～100000 的整数"}。`
        );
        continue;
      }
      if (parsedQty.note) preview.warnings.push(`${name} 第 ${i + 1} 行：${parsedQty.note}。`);
      const numericColumns = [columns.qty, columns.weightKg].filter((c) => c >= 0);
      if (numericColumns.some((c) => ws[utils.encode_cell({ r: i, c })]?.f)) {
        preview.errors.push(
          `${name} 第 ${i + 1} 行：数量或重量包含公式，请转换为数值后导入，避免使用过期缓存。`
        );
        continue;
      }
      const parsedWeight = parseWeight(get(r, "weightKg"));
      if (
        parsedWeight.weight !== null &&
        (!Number.isFinite(parsedWeight.weight) || parsedWeight.weight < 0)
      ) {
        preview.errors.push(`${name} 第 ${i + 1} 行：重量不是有效的非负数。`);
        continue;
      }
      if (parsedWeight.note)
        preview.warnings.push(`${name} 第 ${i + 1} 行：${parsedWeight.note}。`);
      const remarkCell =
        columns.remark < 0 ? undefined : ws[utils.encode_cell({ r: i, c: columns.remark })];
      const picture = /DISPIMG/.test(text(remarkCell?.f) + text(get(r, "remark")));
      const item: ImportRow = {
        row: i + 1,
        part,
        name: itemName,
        spec: specIndex >= 0 ? text(r[specIndex]) : "",
        drawingNo: drawingIndex >= 0 ? text(r[drawingIndex]) : "",
        identifierSource,
        unit: text(get(r, "unit")),
        qty: parsedQty.qty,
        brand: text(get(r, "brand")),
        texture: text(get(r, "texture")),
        surfaceTreatment: text(get(r, "surfaceTreatment")),
        weightKg: parsedWeight.weight,
        remark: picture ? "源表备注含图片，图片未导入" : text(get(r, "remark")),
        category,
        materialId: "",
        candidates: [],
      };
      item.candidates = matchingMaterials(item, materials).map((m) => m.id);
      item.materialId = item.candidates.length === 1 ? item.candidates[0]! : "";
      if (missingQty) defaultQuantities++;
      if (!item.unit) {
        const existingUnit = materials.find((m) => m.id === item.materialId)?.unit;
        item.unit = existingUnit || "个";
        if (!existingUnit) defaultUnits++;
      }
      if (picture) preview.warnings.push(`${name} 第 ${i + 1} 行：图片备注未导入。`);
      sheet.rows.push(item);
    }
    if (!sheet.rows.length) preview.errors.push(`${name}：没有有效物料明细。`);
    if (defaultQuantities || defaultUnits)
      preview.warnings.push(
        `${name}：已为 ${defaultUnits} 条明细补充单位“个”，为 ${defaultQuantities} 条明细补充数量 1，请核对。`
      );
    if (sheet.basis === "total")
      preview.warnings.push(
        `${name}：数量列未注明单台用量，默认作为本次总需求，生成数量为 1 的计划。`
      );
    preview.sheets.push(sheet);
  }
  return preview;
}

export function parseProductionExcel(buffer: ArrayBuffer, file: string, materials: Material[]) {
  return parseProductionWorkbook(
    read(buffer, { type: "array", cellFormula: true }),
    file,
    materials
  );
}

// 在副本中完成全部匹配、去重和校验，任何一张表失败都不留下部分档案或计划。
export function importProductionPlans(
  state: State,
  preview: ImportPreview,
  date: string,
  missingUnit = "个",
  workOrderId?: string
) {
  if (preview.errors.length) throw new Error("请修正 Excel 解析错误后重新上传");
  if (!preview.sheets.length) throw new Error("没有可生成计划的工作表");
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    throw new Error("请填写有效的计划日期");
  if (workOrderId && !state.workOrders.some((w) => w.id === workOrderId && w.status !== "已发货"))
    throw new Error("请选择有效的未发货工单");
  const staged = structuredClone(state);
  const initialMaterialIds = new Set(state.materials.map((m) => m.id));
  const plans: Plan[] = [];
  const importedMaterials = new Map<string, Material>();
  for (const sheet of preview.sheets) {
    if (!sheet.name.trim() || !sheet.rows.length)
      throw new Error(`${sheet.sheet}：请填写计划名称并保留物料明细`);
    const planQty = sheet.qty ?? 1;
    if (!Number.isSafeInteger(planQty) || planQty <= 0 || planQty > 100000)
      throw new Error(`${sheet.sheet}：计划数量须为 1～100000 的整数`);
    if (sheet.basis === "total" && planQty !== 1)
      throw new Error(`${sheet.sheet}：总需求模式下计划数量须为 1`);
    const bom = new Map<string, number>();
    const sourceRows: NonNullable<Plan["importSource"]>["rows"] = [];
    for (const row of sheet.rows) {
      const rowQty = row.qty ?? 1;
      const forceNew = row.materialId === "__new__";
      // 仅在本批新建记录中按完整字段去重，规格缺失时也不重复建档；不凭同名关联历史库存。
      const importKey = JSON.stringify([
        row.name,
        row.spec,
        row.drawingNo,
        row.unit,
        row.brand,
        row.texture,
        row.surfaceTreatment,
        row.weightKg,
        row.category,
      ]);
      let m: Material | undefined =
        row.materialId && !forceNew
          ? staged.materials.find((item) => item.id === row.materialId)
          : undefined;
      if (row.materialId && !forceNew && !m)
        throw new Error(`${sheet.sheet} 第 ${row.row} 行：关联物料已不存在`);
      if (!m && !forceNew && row.candidates.length > 1)
        throw new Error(
          `${sheet.sheet} 第 ${row.row} 行：存在多个匹配物料，请选择关联物料或明确新建`
        );
      if (!m && row.materialId !== "__new__") {
        const candidates = matchingMaterials(row, staged.materials);
        if (candidates.length > 1)
          throw new Error(`${sheet.sheet} 第 ${row.row} 行：存在多个匹配物料`);
        m = candidates[0];
      }
      if (!m) m = importedMaterials.get(importKey);
      const unit = row.unit.trim() || (m && m.unit) || missingUnit.trim() || "个";
      if (m && m.unit && m.unit !== unit)
        throw new Error(`${sheet.sheet} 第 ${row.row} 行：单位与关联物料不一致`);
      if (!Number.isSafeInteger(rowQty) || rowQty <= 0 || rowQty > 100000 || !row.name.trim())
        throw new Error(`${sheet.sheet} 第 ${row.row} 行：物料名称或数量无效`);
      if (!m) {
        const mergedAsDrawing =
          row.identifierSource === "merged" && ["JJ", "BJ"].includes(row.category);
        const materialDrawingNo =
          row.identifierSource === "merged" && !mergedAsDrawing ? "" : row.drawingNo;
        m = {
          id: id("IMP"),
          name: row.name,
          spec: mergedAsDrawing ? "" : row.spec,
          unit,
          price: 0,
          details: {
            category: row.category,
            drawingNo: materialDrawingNo,
            brand: row.brand,
            texture: row.texture,
            surfaceTreatment: row.surfaceTreatment,
            weightKg: row.weightKg,
            remark: row.remark,
            sourceFile: preview.file,
            sourceSheet: sheet.sheet,
            sourceRows: String(row.row),
            sourceParts: row.part,
            priceStatus: "源表未提供价格",
            weightBasis: "原表重量，未确认单件或整行口径",
          },
        };
        staged.materials.push(m);
        importedMaterials.set(importKey, m);
      }
      bom.set(m.id, (bom.get(m.id) || 0) + rowQty);
      sourceRows.push({
        row: row.row,
        part: row.part,
        material: m.id,
        qty: rowQty,
        created: !initialMaterialIds.has(m.id),
      });
    }
    const lines = [...bom].map(([material, qty]) => ({ material, qty }));
    validateLines(
      staged,
      lines.map((l) => ({ ...l, qty: l.qty * planQty }))
    );
    const product = id("FGIMP");
    staged.materials.push({
      id: product,
      name: sheet.name.trim(),
      spec: `${preview.file} / ${sheet.sheet}`,
      unit: "台",
      price: 0,
      details: { category: "D", sourceFile: preview.file, sourceSheet: sheet.sheet },
    });
    plans.push({
      id: id("PP"),
      name: sheet.name.trim(),
      product,
      workOrder: workOrderId,
      qty: planQty,
      date,
      status: "待分析",
      auditStatus: "未审核",
      bom: lines,
      importSource: {
        file: preview.file,
        sheet: sheet.sheet,
        basis: sheet.basis,
        rows: sourceRows,
      },
    });
  }
  state.materials = staged.materials;
  state.plans.unshift(...plans);
  return plans;
}
