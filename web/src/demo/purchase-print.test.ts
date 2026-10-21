import { describe, expect, it } from "vitest";
import { seed } from "./model";
import { purchasePrintHtml } from "./purchase-print";

describe("采购合同打印文档", () => {
  it("使用当前采购单的供应商、明细和合计", () => {
    const state = seed();
    state.purchases[0]!.lines[0]!.amount = 123.45;
    const html = purchasePrintHtml(state.purchases[0]!, state.materials);
    expect(html).toContain("东莞精工电气有限公司");
    expect(html).toContain("PO202610001");
    expect(html).toContain("温控模块");
    expect(html).toContain("123.45");
    expect(html).not.toContain("740.00");
  });

  it("未填金额在合同中保留未填写", () => {
    const state = seed();
    state.purchases[0]!.lines[0]!.amount = null;
    expect(purchasePrintHtml(state.purchases[0]!, state.materials)).toContain("未填写");
  });

  it("逐行显示金额，任一行未填时不伪造完整合计，也不分摊历史单头金额", () => {
    const state = seed();
    const order = state.purchases[0]!;
    order.lines[0]!.amount = 12.34;
    order.lines.push({ ...order.lines[0]!, id: "EXTRA", amount: null });
    order.legacyAmount = 88.8;
    const html = purchasePrintHtml(order, state.materials);
    expect(html).toContain("<td>12.34</td>");
    expect(html).toContain("<td>未填写</td>");
    expect(html).toContain("未填完整");
    expect(html).toContain("旧版单头历史金额：¥ 88.80");
  });

  it("打印逐行单价、价税合计、交期备注及物料属性，不使用旧行金额覆盖新单价", () => {
    const state = seed();
    const order = state.purchases[0]!;
    const line = order.lines[0]!;
    Object.assign(line, {
      qty: 3,
      unitPrice: 12.34,
      amount: 999,
      dueDate: "2026-11-02",
      remark: "独立包装 <检查>",
    });
    state.materials.find((item) => item.id === line.material)!.details = {
      drawingNo: "DRAW-001",
      brand: "品牌甲",
      texture: "不锈钢",
    };
    const html = purchasePrintHtml(order, state.materials);
    expect(html).toContain("<td>12.34</td>");
    expect(html).toContain("<td>37.02</td>");
    expect(html).toContain("2026-11-02");
    expect(html).toContain("独立包装 &lt;检查&gt;");
    expect(html).toContain("DRAW-001");
    expect(html).toContain("品牌甲 / 不锈钢");
    expect(html).not.toContain("999.00");
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
