Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1800,1540
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F4F7FB'))
$fontName = 'Microsoft YaHei'
function Text($s,$x,$y,$size=24,$color='#24354B',$bold=$false) {
  $style = if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  $f = New-Object System.Drawing.Font $fontName,$size,$style,([System.Drawing.GraphicsUnit]::Pixel)
  $b = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
  $g.DrawString($s,$f,$b,[single]$x,[single]$y); $f.Dispose(); $b.Dispose()
}
function Box($x,$y,$w,$h,$fill='#FFFFFF') {
  $b = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($fill))
  $g.FillRectangle($b,$x,$y,$w,$h); $b.Dispose()
}
Text 'Web ERP 重建方案' 50 30 42 '#142C48' $true
Text '基于 15 张截图梳理  ·  Java / 若依 / 前后端分离  ·  建议采用模块化单体' 52 91 24
Box 50 145 810 56 '#DBE6F3'; Box 900 145 850 56 '#D7EDE8'
Text '现有功能｜截图中能看到什么' 70 155 28 '#183E65' $true
Text '重构后的菜单｜按业务办事' 920 155 28 '#165748' $true
$rows = @(
 @('基础与设置','公司、部门、仓库、客户、供应商、商品、批号；','各类参数、单据设置、人员与权限。','基础资料 + 配置中心','统一维护人、货、客商和仓库；','字典、字段、业务规则集中配置。'),
 @('采购','BOM 请购、询价核价、采购及变更、收货退货；','跟踪未到货、交期、价格及供应商表现。','采购管理','从申请、比价、下单到收货退货；','订单内看变更、到货进度和关联明细。'),
 @('仓库','出入库、调拨调整、组装拆解、借入借出；','报废、盘点、批号追踪、补货及期末结账。','库存管理','统一出入库与库存台账；','盘点、借还、报废、批次追踪作为子功能。'),
 @('生产与用料','BOM、生产计划、工单、领退补料、完工入库；','委外加工、返工；物料需求计算与发放。','计划与生产','产品配方/BOM → 缺料计算 → 采购或生产；','工单串起领料、委外、完工和返工。'),
 @('生产成本与报表','人工制造费用、生产成本计算；','产品、工单、返工及委外成本分析。','成本与经营报表','按产品和工单算材料、人工及制造费用；','业务页面看明细，报表中心看汇总与异常。'),
 @('销售与财务〔仅见入口〕','销售、应收应付、现金银行、会计总账；','截图未展示内部菜单与业务规则。','销售与财务〔范围待确认〕','规划销售订单、发货、收付款及往来对账；','完整总账是否自建，需确认后再定。')
)
$y=213
foreach($r in $rows){
 Box 50 $y 810 112; Box 900 $y 850 112
 Text $r[0] 70 ($y+8) 25 '#183E65' $true
 Text ($r[1]+"`n"+$r[2]) 70 ($y+43) 22
 Text '→' 864 ($y+36) 30 '#6E8197'
 Text $r[3] 920 ($y+8) 25 '#165748' $true
 Text ($r[4]+"`n"+$r[5]) 920 ($y+43) 22
 $y+=124
}
Box 50 968 1700 99 '#E7EDF5'
Text '菜单合并示例：配置中心 → 字典选项 / 字段配置 / 业务规则' 70 978 25 '#183E65' $true
Text '单位、类型、结算方式归字典；扩展字段归字段配置；税率、计价、审核与结账规则保留专门校验。' 70 1018 23
Text '底层技术架构｜若依提供通用底座，ERP 业务需开发' 50 1093 28 '#142C48' $true
$layers=@(
 @('访问层','PC 浏览器  →  Nginx / HTTPS  →  Vue 3 + Vite + Element Plus'),
 @('接口层','REST API  ·  Spring Security + JWT  ·  用户 / 角色 / 数据权限 / 操作日志'),
 @('业务层','Java 21 + Spring Boot 3  ·  RuoYi-Vue 后端 + Vue3 前端  ·  按采购 / 库存 / 生产 / 成本分模块'),
 @('数据层','MyBatis  →  MySQL（业务数据 / 库存流水 / 事务）  ｜  Redis（登录与缓存）  ｜  文件存储（附件）'),
 @('运行保障','Linux + Docker  ·  定时任务 / 日志 / 备份恢复  ·  审核过账 / 防重复提交 / 期间结账控制')
)
$y=1142
foreach($l in $layers){Box 50 $y 1700 58; Box 50 $y 145 58 '#DBE6F3'; Text $l[0] 70 ($y+13) 24 '#183E65' $true; Text $l[1] 216 ($y+15) 23; $y+=67}
Text '说明：目录出现代表可见功能，不等于已经验证可用。流程图中的 CRM、办公、人事、资产及检验等仅作线索，暂不纳入确认范围。' 50 1490 20 '#526579'
$g.Dispose()
$bmp.Save('D:\projects\WSN\erp-overview.png',[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
