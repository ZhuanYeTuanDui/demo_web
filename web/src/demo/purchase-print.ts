import type { Material, Purchase } from "./model";

// 所有业务文字先转义，避免供应商名、物料规格被当作 HTML 执行。
function escape(value: string | number) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

const terms = [
  "一、接收到甲方采购订单后，乙方须于24小时内签章回传，否则视同接受此订单所有条款，乙方对本订单所作的任何变更均需甲方签章确认，否则变更部分不发生法律效力。",
  "二、交货期限：乙方必须准时交货，交期不能满足时须先征得甲方同意，否则造成的停线、空运、索赔等一切损失由乙方承担！乙方延迟交货第一天，乙方应支付订单总金额5%的违约金给甲方；第二天乙方应支付订单总金额10%的违约金给甲方；以此类推。如乙方每延迟一天交货，甲方将推迟一个月支付货款！同时甲方有权取消本订单。",
  "三、交货地点：东莞市寮步镇凫山村祥新街横巷1号一楼收货区并负责卸货，否则甲方有权拒收，一切责任由乙方承担。",
  "四、结算方式：票到120天。",
  "五、票据要求：含13%增值税专用发票，发票请在对账后单独邮寄至本公司，每月对账截止25号。",
  "六、包装及运输：合同中订购产品的产品包装一律采用制造商的原厂全新包装，但必须贴甲方物料标签（包括料号、图号、名称、规格、数量）具有品质检验报告等品质证明资料，否则一律拒收。运输途中需要的外包装费及运输费用由乙方承担。",
  "七、品质验收：乙方所提供的产品为甲方指定全新产品并质保一年，各项指标均需符合该产品制造商或双方约定的技术指标、工程图纸及国家标准，因乙方所供品质不良造成甲方的经济损失以及甲方客户的经济损均由乙方全部赔付，所有不良品需在甲方指定时间内100%补货，因品质问题导致的退货费用、特殊风险等一切损失由乙方承担，且甲方有权取消本订单（产品保修期内保质换）",
  "八、不良品处理：产品在使用过程中若发现有来料不良品，甲方通知乙方一天内取走并补货，如有超期未取走将收取保管费。",
  "九、违约责任：1、甲乙双方必须遵守本合同条款，如有违反严格按照《中华人民共和国民法典》的相关规定执行。2、甲乙双方由于不可抗力的原因，无法按本合同履行时，应及时以书面盖章形式通知对方，在提供有效证明的情况下，双方按本合同第十条执行。",
  "十、未尽事宜：甲乙双方共同协商，并签订补充协议，补充协议具同等法律效力。协商不成，可向甲方所在地的法院或仲裁机关提起诉讼或仲裁。",
  "十一、合同生效：本合同需甲乙双方签字盖章后生效，合同一式贰份，甲乙双方各执一份。本合同最终解释权归甲方所有。",
];

export function purchasePrintHtml(order: Purchase, materials: Material[]) {
  // 金额以分累计，保持行金额与合计一致。
  let total = 0;
  const rows = order.lines.map((line, index) => {
    const item = materials.find((m) => m.id === line.material);
    if (!item) throw new Error(`采购单物料不存在：${line.material}`);
    const cents = Math.round(line.qty * item.price * 100);
    total += cents;
    return `<tr><td>${String(index + 1).padStart(3, "0")}</td><td>${escape(item.id)}</td><td>${escape(item.name)}</td><td>${escape(item.spec)}</td><td>${escape(order.plan)}</td><td></td><td>${escape(line.qty)}</td><td>${escape(item.unit)}</td><td>${item.price.toFixed(4)}</td><td>${(cents / 100).toFixed(2)}</td><td></td><td></td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>采购合同-${escape(order.id)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; font: 12px/1.45 SimSun, "Songti SC", serif; background: #e8eaed; }
.paper { width: 190mm; min-height: 277mm; margin: 16px auto; padding: 0; background: white; }
header { display: flex; align-items: center; gap: 16px; padding: 10px 0 0; }
.brand { width: 145px; flex-shrink: 0; color: #187332; text-align: center; }
.brand b { font: 900 28px/1.2 Arial, sans-serif; letter-spacing: -1px; }
.brand span { display: block; letter-spacing: 12px; font-size: 16px; }
h1 { margin: 0; font-size: 29px; font-weight: normal; white-space: nowrap; }
.slogan { color: #16842a; font-size: 16px; letter-spacing: 5px; text-align: center; }
h2 { margin: 0 0 4px; font-size: 17px; font-weight: normal; text-align: center; }
.info { display: grid; grid-template-columns: 54% 46%; margin: 2px 0 8px; }
.info div { min-height: 21px; overflow-wrap: anywhere; }
.label { display: inline-block; width: 62px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #000; padding: 4px 2px; text-align: center; overflow-wrap: anywhere; font-weight: normal; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
.intro { margin: 4px 0 0; }
.terms { border: 1px solid #000; border-top: 0; }
.terms p { margin: 0; padding: 2px; border-bottom: 1px solid #000; break-inside: avoid; }
.terms p:last-child { border-bottom: 0; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px; padding-top: 4px; break-inside: avoid; }
.note { font-size: 10px; margin: 3px 0; }
@media print { body { background: white; } .paper { margin: 0; width: 100%; min-height: 0; } }
</style></head><body><main class="paper">
<header><div class="brand"><b>VAISANA</b><span>维 萨 娜</span></div><div><h1>维萨娜智能装备（广东）有限公司</h1><div class="slogan">让制造，更省钱、更简单！</div></div></header>
<h2>采购合同</h2>
<section class="info"><div><div><span class="label">甲方：</span>维萨娜智能装备（广东）有限公司</div><div><span class="label">地址：</span>东莞市寮步镇凫山祥新街横巷1号</div><div><span class="label">联系人：</span>${escape(order.buyer)}</div><div><span class="label">乙方：</span>${escape(order.supplier)}</div><div><span class="label">地址：</span></div><div><span class="label">联系人：</span></div></div><div><div><span class="label">合同编号：</span>${escape(order.id)}</div><div><span class="label">订单日期：</span>${escape(order.date)}</div><div><span class="label">电话：</span></div><div><span class="label">项目号：</span>${escape(order.plan)}</div><div><span class="label">电话：</span></div></div></section>
<p class="intro">甲乙双方本着平等协商、遵照国家相关法律法规的原则下签订本合同。</p>
<table><colgroup>${[4, 8, 10, 12, 9, 7, 7, 6, 9, 9, 10, 9].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr>${["序号", "品号", "品名", "规格/图号", "项目号", "品牌<br>材质", "数量", "单位", "含税单价 ¥", "价税合计 ¥", "交期", "备注"].map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${rows}<tr><td colspan="8" style="text-align:left">合计金额（人民币）</td><td colspan="3">¥ ${(total / 100).toFixed(2)}</td><td></td></tr></tbody></table>
<section class="terms">${terms.map((term) => `<p>${escape(term)}</p>`).join("")}</section>
<section class="sign"><div>甲方签字（盖章）：</div><div>乙方签字（盖章）：</div><div>制单：${escape(order.buyer)}　审核：</div><div>签字：</div><div>签字日期：</div><div>签字日期：</div></section>
<p class="note">当前为演示采购合同，单价采用物料参考价；交期、联系方式及品牌材质未配置。合同条款请在签署前核对。</p>
</main></body></html>`;
}
