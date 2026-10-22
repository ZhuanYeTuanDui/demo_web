import data from "./product-materials.json";
import type { Material, State } from "./model";

// 源表没有价格，0 仅为演示模型占位；未提供的单位保持空白，不推定为“个”。
export function productMaterials(): Material[] {
  return structuredClone(data.materials);
}

// 保留全部部件用量及来源行，供核对；当前不接入固定示例产品的 BOM。
export const productBomLines = data.bomLines;

// 旧浏览器数据只追加缺少的档案，不覆盖用户编辑，也不修改库存、计划和采购单。
export function migrateProductMaterials(state: State) {
  const existing = new Set(state.materials.map((m) => m.id));
  const deleted = new Set(state.deletedMaterialIds || []);
  state.materials.push(
    ...productMaterials().filter((m) => !existing.has(m.id) && !deleted.has(m.id))
  );
}
