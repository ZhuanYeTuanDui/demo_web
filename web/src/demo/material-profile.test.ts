import { describe, expect, it } from "vitest";
import { seed } from "./model";
import { materialDraft, saveMaterial } from "./material-profile";

describe("物料基本档案", () => {
  it("兼容旧档案，未知字段留空，保存不改变品号、价格和库存", () => {
    const s = seed();
    const m = s.materials[0]!;
    const draft = materialDraft(m);
    expect(draft.brand).toBe("");
    expect(draft.taxRate).toBe(13);
    expect(draft.inventoryAccounting).toBe(false);
    const stocks = JSON.stringify(s.stocks);
    saveMaterial(s, m.id, {
      ...draft,
      name: " PLC 新名称 ",
      brand: "演示品牌",
      mainWarehouse: "BZ01",
    });
    expect(m.name).toBe("PLC 新名称");
    expect(m.id).toBe("M001");
    expect(m.price).toBe(860);
    expect(m.details?.brand).toBe("演示品牌");
    expect(JSON.stringify(s.stocks)).toBe(stocks);
  });
  it("拒绝无效资料，避免保存部分字段", () => {
    const s = seed();
    const m = s.materials[0]!;
    const original = JSON.stringify(m);
    expect(() => saveMaterial(s, m.id, { ...materialDraft(m), name: "" })).toThrow("品名");
    expect(() => saveMaterial(s, m.id, { ...materialDraft(m), taxRate: 101 })).toThrow("税率");
    expect(() => saveMaterial(s, m.id, { ...materialDraft(m), mainWarehouse: "不存在" })).toThrow(
      "仓库"
    );
    expect(JSON.stringify(m)).toBe(original);
  });
});
