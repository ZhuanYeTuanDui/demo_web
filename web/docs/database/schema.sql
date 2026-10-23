-- WSN 字段重构参考结构；SQLite 可执行验证版，生产数据库引擎尚未选定。
-- 金额：分；单价：百万分之一元；税率：基点；数量：整数；未知值保持 NULL。
PRAGMA foreign_keys = ON;
BEGIN;

-- 商品分类（旧编码，层级清单待定）
CREATE TABLE material_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES material_categories(id)
);

-- 会计分类（清单待定，不编造编码）
CREATE TABLE accounting_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);

-- 仓库
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  included_in_available INTEGER NOT NULL CHECK (included_in_available IN (0,1)) CHECK (included_in_available IS NULL OR typeof(included_in_available) = 'integer'),
  contact_name TEXT,
  phone TEXT,
  fax TEXT,
  address TEXT,
  inactive INTEGER NOT NULL DEFAULT 0 CHECK (inactive IN (0,1)) CHECK (inactive IS NULL OR typeof(inactive) = 'integer'),
  remark TEXT
);

-- 物料
CREATE TABLE materials (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  spec TEXT,
  stock_unit TEXT NOT NULL,
  shortcut TEXT,
  barcode TEXT,
  brand TEXT,
  texture TEXT,
  description TEXT,
  photo_url TEXT,
  category_id TEXT REFERENCES material_categories(id),
  accounting_category_id TEXT REFERENCES accounting_categories(id),
  material_attribute TEXT,
  abc_class TEXT,
  main_warehouse_id TEXT REFERENCES warehouses(id),
  source_type TEXT,
  supplier_name TEXT,
  force_main_supplier INTEGER CHECK (force_main_supplier IS NULL OR typeof(force_main_supplier) = 'integer'),
  purchase_unit TEXT,
  sales_unit TEXT,
  tax_rate_bp INTEGER CHECK (tax_rate_bp BETWEEN 0 AND 10000) CHECK (tax_rate_bp IS NULL OR typeof(tax_rate_bp) = 'integer'),
  cycle_count_code TEXT,
  storage_location TEXT,
  barcode_rule_code TEXT,
  low_level_code INTEGER CHECK (low_level_code IS NULL OR typeof(low_level_code) = 'integer'),
  safety_stock INTEGER CHECK (safety_stock IS NULL OR typeof(safety_stock) = 'integer'),
  maximum_stock INTEGER CHECK (maximum_stock IS NULL OR typeof(maximum_stock) = 'integer'),
  reorder_point INTEGER CHECK (reorder_point IS NULL OR typeof(reorder_point) = 'integer'),
  lead_days INTEGER CHECK (lead_days IS NULL OR typeof(lead_days) = 'integer'),
  min_order_qty INTEGER CHECK (min_order_qty IS NULL OR typeof(min_order_qty) = 'integer'),
  order_multiple INTEGER CHECK (order_multiple IS NULL OR typeof(order_multiple) = 'integer'),
  issue_multiple INTEGER CHECK (issue_multiple IS NULL OR typeof(issue_multiple) = 'integer'),
  mrp_driven INTEGER CHECK (mrp_driven IS NULL OR typeof(mrp_driven) = 'integer'),
  replenishment_method TEXT,
  economic_lot_qty INTEGER CHECK (economic_lot_qty IS NULL OR typeof(economic_lot_qty) = 'integer'),
  cost_method TEXT,
  reference_price_micro INTEGER CHECK (reference_price_micro >= 0) CHECK (reference_price_micro IS NULL OR typeof(reference_price_micro) = 'integer'),
  labor_alloc_weight NUMERIC,
  overhead_alloc_weight NUMERIC,
  inventory_accounted INTEGER CHECK (inventory_accounted IS NULL OR typeof(inventory_accounted) = 'integer'),
  production_department TEXT,
  inactive INTEGER NOT NULL DEFAULT 0 CHECK (inactive IS NULL OR typeof(inactive) = 'integer'),
  remark TEXT,
  source_file TEXT,
  source_sheet TEXT,
  source_rows TEXT,
  drawing_no TEXT,
  surface_treatment TEXT,
  weight_kg NUMERIC,
  process_route_code TEXT
);

-- 实时库存余额（金额未知时为 NULL）
CREATE TABLE inventory_balances (
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR typeof(amount_cents) = 'integer'),
  PRIMARY KEY (warehouse_id, material_id)
);

-- 工单
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  name TEXT NOT NULL,
  customer_name TEXT,
  product_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  execution_status TEXT NOT NULL CHECK (execution_status IN ('立项中','采购中','装配中','待出货','已发货','已关闭','已取消')),
  start_date TEXT,
  delivery_date TEXT
);

-- 生产计划
CREATE TABLE production_plans (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  name TEXT NOT NULL,
  work_order_id TEXT REFERENCES work_orders(id),
  product_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  quantity_basis TEXT NOT NULL DEFAULT 'perUnit' CHECK (quantity_basis IN ('perUnit','total')),
  execution_status TEXT NOT NULL CHECK (execution_status IN ('待分析','待备料','已领料','已备料','已完工')),
  import_file TEXT,
  import_sheet TEXT,
  import_rows_json TEXT,
  plan_start_date TEXT,
  plan_end_date TEXT
);

-- 计划物料快照
CREATE TABLE production_plan_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES production_plans(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  source_row INTEGER CHECK (source_row IS NULL OR typeof(source_row) = 'integer'),
  source_part TEXT,
  source_material_label TEXT,
  created_material INTEGER CHECK (created_material IS NULL OR typeof(created_material) = 'integer'),
  UNIQUE (document_id, line_no)
);

-- 采购底稿
CREATE TABLE purchase_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  plan_id TEXT REFERENCES production_plans(id),
  product_id TEXT REFERENCES materials(id),
  execution_status TEXT NOT NULL DEFAULT '待采购',
  delivery_address TEXT,
  legacy INTEGER NOT NULL DEFAULT 0 CHECK (legacy IS NULL OR typeof(legacy) = 'integer')
);

-- 底稿需求及分析快照
CREATE TABLE purchase_draft_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES purchase_drafts(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  source_plan_line_id TEXT REFERENCES production_plan_lines(id),
  bom_quantity INTEGER CHECK (bom_quantity IS NULL OR typeof(bom_quantity) = 'integer'),
  stock_snapshot INTEGER CHECK (stock_snapshot IS NULL OR typeof(stock_snapshot) = 'integer'),
  reserved_snapshot INTEGER CHECK (reserved_snapshot IS NULL OR typeof(reserved_snapshot) = 'integer'),
  usable_snapshot INTEGER CHECK (usable_snapshot IS NULL OR typeof(usable_snapshot) = 'integer'),
  covered_snapshot INTEGER CHECK (covered_snapshot IS NULL OR typeof(covered_snapshot) = 'integer'),
  require_date TEXT,
  line_status TEXT NOT NULL DEFAULT '未结束',
  close_reason TEXT,
  closed_by TEXT,
  closed_at TEXT,
  UNIQUE (document_id, line_no)
);

-- 请购单
CREATE TABLE requisitions (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  applicant_name TEXT NOT NULL,
  plan_id TEXT REFERENCES production_plans(id),
  execution_status TEXT NOT NULL DEFAULT '待采购'
);

-- 请购需求
CREATE TABLE requisition_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES requisitions(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  require_date TEXT,
  line_status TEXT NOT NULL DEFAULT '未结束',
  close_reason TEXT,
  closed_by TEXT,
  closed_at TEXT,
  UNIQUE (document_id, line_no)
);

-- 采购单
CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  supplier_name TEXT NOT NULL,
  supplier_full_name TEXT,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT,
  currency TEXT NOT NULL DEFAULT 'CNY',
  exchange_rate NUMERIC,
  promise_date TEXT,
  delivery_address TEXT,
  project_name TEXT,
  receipt_status TEXT NOT NULL DEFAULT '未收货',
  merged_into_id TEXT REFERENCES purchase_orders(id),
  legacy_amount_cents INTEGER CHECK (legacy_amount_cents IS NULL OR typeof(legacy_amount_cents) = 'integer')
);

-- 采购行及来源追踪
CREATE TABLE purchase_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES purchase_orders(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  source_draft_line_id TEXT REFERENCES purchase_draft_lines(id),
  source_requisition_line_id TEXT REFERENCES requisition_lines(id),
  merged_from_line_id TEXT REFERENCES purchase_lines(id),
  price_incl_tax_micro INTEGER CHECK (price_incl_tax_micro >= 0) CHECK (price_incl_tax_micro IS NULL OR typeof(price_incl_tax_micro) = 'integer'),
  tax_rate_bp INTEGER CHECK (tax_rate_bp BETWEEN 0 AND 10000) CHECK (tax_rate_bp IS NULL OR typeof(tax_rate_bp) = 'integer'),
  amount_excl_tax_cents INTEGER CHECK (amount_excl_tax_cents IS NULL OR typeof(amount_excl_tax_cents) = 'integer'),
  tax_amount_cents INTEGER CHECK (tax_amount_cents IS NULL OR typeof(tax_amount_cents) = 'integer'),
  amount_incl_tax_cents INTEGER CHECK (amount_incl_tax_cents IS NULL OR typeof(amount_incl_tax_cents) = 'integer'),
  promise_date TEXT,
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0) CHECK (received_quantity IS NULL OR typeof(received_quantity) = 'integer'),
  CHECK (source_draft_line_id IS NULL OR source_requisition_line_id IS NULL),
  UNIQUE (document_id, line_no)
);

-- 采购收货单
CREATE TABLE receipts (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  execution_status TEXT NOT NULL DEFAULT '待收货',
  carrier_name TEXT,
  tracking_no TEXT,
  supplier_name_snapshot TEXT,
  currency TEXT,
  exchange_rate NUMERIC,
  delivery_address TEXT
);

-- 收货计划与实收分离
CREATE TABLE receipt_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES receipts(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  purchase_line_id TEXT NOT NULL REFERENCES purchase_lines(id),
  actual_quantity INTEGER CHECK (actual_quantity >= 0) CHECK (actual_quantity IS NULL OR typeof(actual_quantity) = 'integer'),
  price_incl_tax_micro INTEGER CHECK (price_incl_tax_micro IS NULL OR typeof(price_incl_tax_micro) = 'integer'),
  tax_rate_bp INTEGER CHECK (tax_rate_bp IS NULL OR typeof(tax_rate_bp) = 'integer'),
  amount_excl_tax_cents INTEGER CHECK (amount_excl_tax_cents IS NULL OR typeof(amount_excl_tax_cents) = 'integer'),
  tax_amount_cents INTEGER CHECK (tax_amount_cents IS NULL OR typeof(tax_amount_cents) = 'integer'),
  amount_incl_tax_cents INTEGER CHECK (amount_incl_tax_cents IS NULL OR typeof(amount_incl_tax_cents) = 'integer'),
  storage_location TEXT,
  is_gift INTEGER NOT NULL DEFAULT 0 CHECK (is_gift IS NULL OR typeof(is_gift) = 'integer'),
  UNIQUE (document_id, line_no)
);

-- 其他入库及采购入库凭证
CREATE TABLE inventory_inbounds (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  receipt_id TEXT UNIQUE REFERENCES receipts(id),
  category_code TEXT,
  category_name TEXT,
  project_name TEXT
);

-- 入库凭证明细
CREATE TABLE inventory_inbound_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES inventory_inbounds(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  receipt_line_id TEXT REFERENCES receipt_lines(id),
  storage_location TEXT,
  UNIQUE (document_id, line_no)
);

-- 生产领料单
CREATE TABLE material_issues (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  plan_id TEXT NOT NULL REFERENCES production_plans(id),
  scene_warehouse_id TEXT REFERENCES warehouses(id)
);

-- 领料明细
CREATE TABLE material_issue_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES material_issues(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  source_plan_line_id TEXT REFERENCES production_plan_lines(id),
  UNIQUE (document_id, line_no)
);

-- 独立工单成品入库（沿用第二轮流程）
CREATE TABLE finished_inbounds (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id)
);

-- 成品入库行
CREATE TABLE finished_inbound_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES finished_inbounds(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  UNIQUE (document_id, line_no)
);

-- 整单发货（审核流程仅预留）
CREATE TABLE shipments (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  work_order_id TEXT NOT NULL UNIQUE REFERENCES work_orders(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  customer_name_snapshot TEXT,
  delivery_address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  carrier_name TEXT NOT NULL,
  tracking_no TEXT NOT NULL
);

-- 发货行
CREATE TABLE shipment_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES shipments(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  UNIQUE (document_id, line_no)
);

-- 发货生成的成品出库凭证
CREATE TABLE finished_outbounds (
  id TEXT PRIMARY KEY NOT NULL,
  document_no TEXT NOT NULL UNIQUE,
  document_date TEXT NOT NULL,
  nature TEXT,
  department TEXT,
  handler_name TEXT,
  remark TEXT,
  audit_status TEXT NOT NULL DEFAULT '未审核' CHECK (audit_status IN ('未审核','已审核')),
  auditor_name TEXT,
  audited_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0) CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  shipment_id TEXT NOT NULL UNIQUE REFERENCES shipments(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id)
);

-- 成品出库行
CREATE TABLE finished_outbound_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES finished_outbounds(id),
  line_no INTEGER NOT NULL CHECK (line_no > 0) CHECK (line_no IS NULL OR typeof(line_no) = 'integer'),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  unit TEXT NOT NULL,
  material_name_snapshot TEXT,
  spec_snapshot TEXT,
  remark TEXT,
  shipment_line_id TEXT REFERENCES shipment_lines(id),
  UNIQUE (document_id, line_no)
);

-- 不可重复记账的库存流水
CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY NOT NULL,
  movement_date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('入库','出库')),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0) CHECK (quantity IS NULL OR typeof(quantity) = 'integer'),
  source_doc_type TEXT NOT NULL,
  source_doc_id TEXT NOT NULL,
  source_line_id TEXT NOT NULL,
  reason TEXT,
  operator_name TEXT,
  remark TEXT,
  UNIQUE (source_doc_type, source_doc_id, source_line_id, direction)
);

-- 缺料分析批次（不启用新算法）
CREATE TABLE analysis_runs (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES production_plans(id),
  formula_code TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

-- 分析结果快照
CREATE TABLE analysis_run_lines (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id),
  plan_line_id TEXT NOT NULL REFERENCES production_plan_lines(id),
  demand_quantity INTEGER NOT NULL CHECK (demand_quantity IS NULL OR typeof(demand_quantity) = 'integer'),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity IS NULL OR typeof(stock_quantity) = 'integer'),
  reserved_quantity INTEGER NOT NULL CHECK (reserved_quantity IS NULL OR typeof(reserved_quantity) = 'integer'),
  usable_quantity INTEGER NOT NULL CHECK (usable_quantity IS NULL OR typeof(usable_quantity) = 'integer'),
  incoming_quantity INTEGER NOT NULL CHECK (incoming_quantity IS NULL OR typeof(incoming_quantity) = 'integer'),
  suggested_quantity INTEGER NOT NULL CHECK (suggested_quantity IS NULL OR typeof(suggested_quantity) = 'integer'),
  supplier_name TEXT
);

-- 采购修改版本（预留，未接页面）
CREATE TABLE purchase_order_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  revision INTEGER NOT NULL CHECK (revision IS NULL OR typeof(revision) = 'integer'),
  snapshot_json TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  change_reason TEXT,
  UNIQUE (purchase_order_id, revision)
);

-- 打印模板（预留）
CREATE TABLE print_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  template_kind TEXT NOT NULL CHECK (template_kind IN ('standard','custom')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IS NULL OR typeof(is_default) = 'integer'),
  inactive INTEGER NOT NULL DEFAULT 0 CHECK (inactive IS NULL OR typeof(inactive) = 'integer')
);

-- 模板不可变版本（预留）
CREATE TABLE print_template_versions (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES print_templates(id),
  version INTEGER NOT NULL CHECK (version IS NULL OR typeof(version) = 'integer'),
  layout_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (template_id, version)
);

-- 打印记录及数据快照（预留）
CREATE TABLE print_records (
  id TEXT PRIMARY KEY NOT NULL,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  template_version_id TEXT NOT NULL REFERENCES print_template_versions(id),
  data_snapshot_json TEXT NOT NULL,
  printed_by TEXT NOT NULL,
  printed_at TEXT NOT NULL
);

-- 操作记录（预留，不伪造既往操作）
CREATE TABLE operation_logs (
  id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL,
  document_type TEXT,
  document_id TEXT,
  actor_name TEXT,
  occurred_at TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT
);

CREATE INDEX idx_material_search ON materials(name, spec);
CREATE INDEX idx_plan_work_order ON production_plans(work_order_id);
CREATE INDEX idx_purchase_draft_source ON purchase_lines(source_draft_line_id);
CREATE INDEX idx_purchase_request_source ON purchase_lines(source_requisition_line_id);
CREATE INDEX idx_receipt_order ON receipts(purchase_order_id, audit_status);
CREATE INDEX idx_purchase_delivery ON purchase_lines(promise_date, document_id);
CREATE INDEX idx_movements_material_date ON inventory_movements(material_id, warehouse_id, movement_date);
CREATE UNIQUE INDEX idx_default_print_template ON print_templates(document_type) WHERE is_default = 1 AND inactive = 0;
COMMIT;
