import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import {
  parseProductionWorkbook,
  parseProductionExcel,
  importProductionPlans,
} from "./production-import";
import {
  auditPurchase,
  analysis,
  convertDraft,
  createDraft,
  finishPlan,
  issuePlan,
  receive,
  requirements,
  seed,
  stockKey,
} from "./model";

function workbook(rows: unknown[][], name = "物料清单") {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), name);
  return wb;
}
const simple = [
  ["名称", "型号/规格", "单位", "数量", "品牌"],
  ["测试传感器", "TEST-01", "个", 2, "测试品牌"],
];

describe("Excel 生产计划导入", () => {
  it("XLS 二进制文件的空白模板页不生成计划，电气明细识别为本次总需求", () => {
    const state = seed();
    // 在内存中生成真正的旧版 XLS，避免 CI 依赖本地业务文件或当前工作目录。
    const wb = workbook(
      [
        ["测试设备电气 BOM"],
        [],
        ["交接日期：2026.10.19"],
        ["序号", "名称", "型号/规格", "单位", "数量", "品牌", "备注"],
        [1, "PLC 控制器", "LX3V-3624MT-A", "PCS", 2, "", "中文备注"],
        [2, "触摸屏", "PI3070ig-O", "PCS", 3],
        [3],
        [4],
      ],
      "Sheet1"
    );
    wb.Sheets.Sheet1!["!merges"] = [utils.decode_range("A1:G2"), utils.decode_range("A3:G3")];
    utils.book_append_sheet(wb, utils.aoa_to_sheet([]), "Sheet2");
    utils.book_append_sheet(wb, utils.aoa_to_sheet([]), "Sheet3");
    const buffer: ArrayBuffer = write(wb, { type: "array", bookType: "biff8" });
    expect([...new Uint8Array(buffer).slice(0, 4)]).toEqual([0xd0, 0xcf, 0x11, 0xe0]);
    const preview = parseProductionExcel(buffer, "电气.xls", state.materials);
    expect(preview.errors).toEqual([]);
    expect(preview.sheets).toHaveLength(1);
    expect(preview.sheets[0]?.rows).toHaveLength(2);
    expect(preview.sheets[0]?.basis).toBe("total");
    expect(preview.sheets[0]?.rows.every((r) => r.materialId)).toBe(true);
    expect(preview.sheets[0]?.rows[0]?.remark).toBe("中文备注");
    expect(preview.ignored).toEqual(["Sheet2", "Sheet3"]);
    const plans = importProductionPlans(state, preview, "2026-10-19", "");
    expect(requirements(plans[0]!).reduce((n, l) => n + l.qty, 0)).toBe(5);
  });

  it("XLSX 二进制文件只导入三张指定表，保留分组并聚合跨部件的重复图号", () => {
    const state = seed();
    const headers = ["序号", "图号", "名称", "数量/台", "材质", "表面处理", "重量（Kg）", "备注"];
    const wb = workbook(
      [
        ["测试设备机加件"],
        [],
        ["项目号：TEST"],
        headers,
        ["A00000001-01测试部件"],
        [1, "TEST-JJ-001", "测试垫板", 2, "S45C", "镀铬", 0.2],
        ["以下空白"],
      ],
      "机加"
    );
    wb.Sheets["机加"]!["!merges"] = [utils.decode_range("A1:H2"), utils.decode_range("A5:H5")];
    const sheetMetal = utils.aoa_to_sheet([
      ["测试设备钣金件"],
      [],
      ["项目号：TEST"],
      headers,
      ["A00000001-01第一部件"],
      [1, "TEST-BJ-001", "测试支架", 4, "Q235", "烤漆", 0.1],
      ["A00000001-02第二部件"],
      [2, "TEST-BJ-001", "测试支架", 5, "Q235", "烤漆", 0.1],
      ["以下空白"],
    ]);
    sheetMetal["!merges"] = [
      utils.decode_range("A1:H2"),
      utils.decode_range("A5:H5"),
      utils.decode_range("A7:H7"),
    ];
    utils.book_append_sheet(wb, sheetMetal, "钣金");
    const standard = utils.aoa_to_sheet([
      ["测试设备标准件"],
      [],
      ["项目号：TEST"],
      ["序号", "名称", "型号/规格", "单位", "数量/台", "品牌", "备注"],
      ["A00000001-01测试部件"],
      [1, "测试弹性销", "TEST-PIN", "个", 1, "测试品牌", '=DISPIMG("TEST",1)'],
    ]);
    standard.G6!.f = '_xlfn.DISPIMG("TEST",1)';
    standard["!merges"] = [utils.decode_range("A1:G2"), utils.decode_range("A5:G5")];
    utils.book_append_sheet(wb, standard, "标准");
    for (const name of ["变更履历", "新增机加", "新增标准"])
      utils.book_append_sheet(wb, utils.aoa_to_sheet([["不应导入的内容"]]), name);
    utils.book_append_sheet(wb, utils.aoa_to_sheet([]), "Sheet2");
    const buffer: ArrayBuffer = write(wb, { type: "array", bookType: "xlsx" });
    expect([...new Uint8Array(buffer).slice(0, 2)]).toEqual([0x50, 0x4b]);
    const preview = parseProductionExcel(buffer, "测试设备.xlsx", state.materials);
    expect(preview.errors).toEqual([]);
    expect(preview.sheets.map((s) => [s.sheet, s.rows.length])).toEqual([
      ["机加", 1],
      ["钣金", 2],
      ["标准", 1],
    ]);
    expect(preview.ignored).toContain("新增机加");
    expect(preview.warnings.filter((w) => w.includes("图片"))).toHaveLength(1);
    expect(preview.sheets[0]?.rows[0]?.unit).toBe("个");
    preview.sheets[1]!.qty = 2;
    const plans = importProductionPlans(state, preview, "2026-10-19", "件");
    expect(plans).toHaveLength(3);
    const drawing = state.materials.find((m) => m.details?.drawingNo === "TEST-BJ-001")!;
    expect(requirements(plans[1]!).find((l) => l.material === drawing.id)?.qty).toBe(18);
    expect(
      plans[1]?.importSource?.rows.filter((r) => r.material === drawing.id).map((r) => r.qty)
    ).toEqual([4, 5]);
    expect(plans[1]?.importSource?.rows.map((r) => [r.row, r.part])).toEqual([
      [6, "A00000001-01第一部件"],
      [8, "A00000001-02第二部件"],
    ]);
    expect(requirements(JSON.parse(JSON.stringify(plans[1])))).toEqual(requirements(plans[1]!));
  });

  it("新物料自动建档、重复行合并，导入计划走完需求到完工闭环", () => {
    const state = seed();
    const wb = workbook([...simple, ["测试传感器", "TEST-01", "个", 3, "测试品牌"]]);
    const preview = parseProductionWorkbook(wb, "新设备.xlsx", state.materials);
    preview.sheets[0]!.basis = "perUnit";
    preview.sheets[0]!.qty = 2;
    const plan = importProductionPlans(state, preview, "2026-10-19", "")[0]!;
    expect(plan.importSource?.rows.every((r) => r.created)).toBe(true);
    const rows = requirements(plan);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.qty).toBe(10);
    expect(analysis(state, plan)[0]?.shortage).toBe(10);
    const draft = createDraft(state, plan.id);
    expect(() => createDraft(state, plan.id)).toThrow("无新增缺料");
    const order = convertDraft(state, draft.id, "采购员", "测试供应商");
    expect(() => issuePlan(state, plan.id)).toThrow("库存不足");
    auditPurchase(state, order.id);
    receive(state, order.id, "BZ01");
    issuePlan(state, plan.id);
    finishPlan(state, plan.id);
    expect(plan.status).toBe("已完工");
    expect(state.stocks[stockKey("CP01", plan.product)]).toBe(2);
    expect(state.stocks[stockKey("BZ01", rows[0]!.material)]).toBe(0);
  });

  it("导入多种缺料按生产计划生成一张底稿并保留物料明细", () => {
    const state = seed();
    const preview = parseProductionWorkbook(
      workbook([...simple, ["新增连接件", "NEW-CONNECT", "个", 3]]),
      "多物料.xlsx",
      state.materials
    );
    const plan = importProductionPlans(state, preview, "2026-10-20")[0]!;
    const draft = createDraft(state, plan.id);
    expect(state.drafts.filter((row) => row.plan === plan.id)).toEqual([draft]);
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines.map((line) => ({ material: line.material, qty: line.qty }))).toEqual(
      requirements(plan)
    );
    expect(new Set(draft.lines.map((line) => line.sourceLine)).size).toBe(2);
  });

  it("多表精确匹配四种名称，不支持的子表不会误生成计划", () => {
    const state = seed();
    const wb = workbook(simple, "电气");
    utils.book_append_sheet(wb, utils.aoa_to_sheet(simple), "机加备份");
    const preview = parseProductionWorkbook(wb, "多表.xlsx", state.materials);
    expect(preview.sheets.map((s) => s.sheet)).toEqual(["电气"]);
    expect(preview.ignored).toEqual(["机加备份"]);
    const unsupported = workbook(simple, "其他1");
    utils.book_append_sheet(unsupported, utils.aoa_to_sheet(simple), "其他2");
    expect(parseProductionWorkbook(unsupported, "其他.xlsx", state.materials).errors[0]).toContain(
      "没有可导入"
    );
  });

  it("错误数量、缺名称、数值公式和不识别表头均明确报错，不静默丢行", () => {
    const state = seed();
    for (const qty of [0, -1, 1.5, "待定"]) {
      const preview = parseProductionWorkbook(
        workbook([simple[0]!, ["零件", "X", "个", qty]]),
        "错误.xlsx",
        state.materials
      );
      expect(preview.errors.some((e) => e.includes("第 2 行"))).toBe(true);
    }
    const wb = workbook(simple);
    wb.Sheets["物料清单"]!["D2"].f = "1+1";
    expect(parseProductionWorkbook(wb, "公式.xlsx", state.materials).errors.join()).toContain(
      "包含公式"
    );
    expect(
      parseProductionWorkbook(
        workbook([["说明"], ["其他"]]),
        "空.xlsx",
        state.materials
      ).errors.join()
    ).toContain("未找到");
    expect(
      parseProductionWorkbook(
        workbook([simple[0]!, ["", "型号", "个", 1]]),
        "缺名称.xlsx",
        state.materials
      ).errors.join()
    ).toContain("名称缺失");
  });

  it("缺失单位和数量采用缺省值，已有库存单位和合法数量不被覆盖", () => {
    const state = seed();
    const preview = parseProductionWorkbook(
      workbook([
        ["名称", "型号/规格", "数量", "单位"],
        ["新零件", "NEW", "", ""],
        ["已有用量", "KEEP", 5, "米"],
        ["PLC 控制器", "LX3V-3624MT-A", "", ""],
      ]),
      "缺省.xlsx",
      state.materials
    );
    expect(preview.errors).toEqual([]);
    expect(preview.sheets[0]?.rows.map((r) => [r.qty, r.unit])).toEqual([
      [1, "个"],
      [5, "米"],
      [1, "PCS"],
    ]);
    const plan = importProductionPlans(state, preview, "2026-10-19")[0]!;
    expect(plan.qty).toBe(1);
    expect(requirements(plan).map((r) => r.qty)).toEqual([1, 5, 1]);
    const noColumns = parseProductionWorkbook(
      workbook([
        ["物料名称", "规格"],
        ["无单位数量列", "ONLY"],
      ]),
      "简单.xlsx",
      state.materials
    );
    expect(noColumns.errors).toEqual([]);
    expect(noColumns.sheets[0]?.rows[0]).toMatchObject({ unit: "个", qty: 1 });
  });

  it("物料匹配歧义须手动选择；无效日期、单位冲突及数量溢出不会部分落库", () => {
    const state = seed();
    state.materials.push(
      {
        id: "T1",
        name: "测试传感器",
        spec: "TEST-01",
        unit: "个",
        price: 1,
        details: { brand: "测试品牌" },
      },
      {
        id: "T2",
        name: "测试传感器",
        spec: "TEST-01",
        unit: "个",
        price: 2,
        details: { brand: "测试品牌" },
      }
    );
    const preview = parseProductionWorkbook(workbook(simple), "匹配.xlsx", state.materials);
    const before = JSON.stringify(state);
    expect(preview.sheets[0]!.rows[0]!.candidates).toEqual(["T1", "T2"]);
    expect(() => importProductionPlans(state, preview, "2026-10-19", "")).toThrow("多个匹配");
    preview.sheets[0]!.rows[0]!.materialId = "T1";
    preview.sheets[0]!.rows[0]!.unit = "套";
    expect(() => importProductionPlans(state, preview, "2026-10-19", "")).toThrow("单位");
    preview.sheets[0]!.rows[0]!.unit = "个";
    expect(() => importProductionPlans(state, preview, "2026-02-30", "")).toThrow("日期");
    preview.sheets[0]!.basis = "perUnit";
    preview.sheets[0]!.qty = 100000;
    expect(() => importProductionPlans(state, preview, "2026-10-19", "")).toThrow("数量");
    expect(JSON.stringify(state)).toBe(before);
    preview.sheets[0]!.qty = 1;
    preview.sheets[0]!.rows[0]!.materialId = "__new__";
    expect(importProductionPlans(state, preview, "2026-10-19", "")[0]?.bom?.[0]?.material).not.toBe(
      "T1"
    );
  });
});

describe("导入档案与工单关联", () => {
  it("匹配已有物料不补写空属性，新物料记录新建标记，计划关联工单", () => {
    const state = seed();
    state.materials.push({
      id: "TEST-EXIST",
      name: "测试传感器",
      spec: "TEST-01",
      unit: "",
      price: 8,
      details: { brand: "测试品牌" },
    });
    const original = structuredClone(state.materials.find((m) => m.id === "TEST-EXIST"));
    const preview = parseProductionWorkbook(
      workbook([...simple, ["新零件", "NEW-01", "件", 1]]),
      "混合.xlsx",
      state.materials
    );
    const workOrder = state.workOrders[0]!;
    const plan = importProductionPlans(state, preview, "2026-10-20", "个", workOrder.id)[0]!;
    expect(state.materials.find((m) => m.id === "TEST-EXIST")).toEqual(original);
    expect(plan.workOrder).toBe(workOrder.id);
    expect(plan.importSource?.rows.map((r) => r.created)).toEqual([false, true]);
  });

  it("无效工单使导入失败且不留下新物料", () => {
    const state = seed();
    const preview = parseProductionWorkbook(workbook(simple), "新物料.xlsx", state.materials);
    const original = structuredClone(state);
    expect(() => importProductionPlans(state, preview, "2026-10-20", "个", "missing")).toThrow(
      "工单"
    );
    expect(state).toEqual(original);
  });
});

it("同批无规格图号物料仅新建一条档案并合并用量", () => {
  const state = seed();
  const preview = parseProductionWorkbook(
    workbook([
      ["名称", "单位", "数量"],
      ["待补规格零件", "个", 2],
      ["待补规格零件", "个", 3],
    ]),
    "无规格.xlsx",
    state.materials
  );
  const plan = importProductionPlans(state, preview, "2026-10-20")[0]!;
  expect(state.materials.filter((m) => m.name === "待补规格零件")).toHaveLength(1);
  expect(plan.bom).toHaveLength(1);
  expect(plan.bom?.[0]?.qty).toBe(5);
});
