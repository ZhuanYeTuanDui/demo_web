import { describe, expect, it } from "vitest";
import { seed } from "./model";
import { purchasePrintHtml } from "./purchase-print";

describe("采购合同打印文档", () => {
  it("使用当前采购单的供应商、明细和合计", () => {
    const state = seed();
    const html = purchasePrintHtml(state.purchases[0]!, state.materials);
    expect(html).toContain("东莞精工电气有限公司");
    expect(html).toContain("PO202610001");
    expect(html).toContain("温控模块");
    expect(html).toContain("740.00");
  });

  it("转义用户数据，物料缺失时明确报错", () => {
    const state = seed();
    const order = state.purchases[0]!;
    order.supplier = '<img src=x onerror="alert(1)">';
    const html = purchasePrintHtml(order, state.materials);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(() => purchasePrintHtml(order, [])).toThrow("采购单物料不存在");
  });
});
