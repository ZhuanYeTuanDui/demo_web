import { describe, expect, it } from "vitest";
import { seed } from "./model";
import { materialDraft, saveMaterial } from "./material-profile";
import { migrateProductMaterials, productBomLines, productMaterials } from "./product-materials";

describe("Excel 物料 mock 数据", () => {
  it("覆盖指定工作表，跨部件复用物料保留独立用量及来源", () => {
    const materials = productMaterials();
    expect(materials).toHaveLength(560);
    expect(new Set(materials.map((m) => m.id)).size).toBe(560);
    for (const [sheet, count] of [["Sheet1", 21], ["机加", 321], ["钣金", 97], ["标准", 217]] as const)
      expect(productBomLines.filter((line) => line.sheet === sheet)).toHaveLength(count);
    expect(productBomLines.every((line) => materials.some((m) => m.id === line.material))).toBe(true);
    const reused = materials.find((m) => m.details?.drawingNo === "A00000000-00001")!;
    const lines = productBomLines.filter((line) => line.material === reused.id);
    expect(lines.map((line) => line.qty)).toEqual([4, 5]);
    expect(new Set(lines.map((line) => line.part)).size).toBe(2);
    expect(reused.unit).toBe("");
    expect(reused.details?.weightKg).toBe(0.023);
    expect(materials.find((m) => m.name === "轴承" && m.spec === "6002")).toBeDefined();
  });

  it("旧数据追加可重复执行，保留已有编辑及业务数据", () => {
    const state = seed();
    const existing = state.materials.find((m) => m.id.startsWith("MOCK-"))!;
    existing.name = "用户已修改";
    state.materials = state.materials.filter((m) => !m.id.startsWith("MOCK-") || m.id === existing.id);
    const stocks = JSON.stringify(state.stocks);
    const plans = JSON.stringify(state.plans);
    migrateProductMaterials(state);
    migrateProductMaterials(state);
    expect(state.materials).toHaveLength(567);
    expect(state.materials.find((m) => m.id === existing.id)?.name).toBe("用户已修改");
    expect(JSON.stringify(state.stocks)).toBe(stocks);
    expect(JSON.stringify(state.plans)).toBe(plans);
  });

  it("保存物料资料后保留加工属性及来源，不让初始状态共享引用", () => {
    const state = seed();
    const m = state.materials.find((m) => m.details?.category === "JJ")!;
    const original = structuredClone(m);
    saveMaterial(state, m.id, { ...materialDraft(m), unit: "件", name: "修改名称" });
    expect(m.details?.drawingNo).toBe(original.details?.drawingNo);
    expect(m.details?.weightKg).toBe(original.details?.weightKg);
    expect(m.details?.sourceRows).toBe(original.details?.sourceRows);
    expect(seed().materials.find((item) => item.id === m.id)?.name).toBe(original.name);
  });
});
