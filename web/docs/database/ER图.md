# WSN 数据库 ER 图

基于 [数据库设计](README.md) 与 [可执行表结构](schema.sql)。完整关系源文件为 [er.mmd](er.mmd)；下图拆成四部分便于阅读。

图中的关系仅表示真实 SQL 外键。库存流水的来源三元组以及打印、日志的跨类型引用由应用在事务内校验，不绘制成并不存在的外键。文档未指定供应商主档，本期供应商和客户采用文本快照。

## 主档、库存与生产

```mermaid
erDiagram
  material_categories {
    TEXT id PK
    TEXT name
    TEXT parent_id FK
  }
  accounting_categories {
    TEXT id PK
    TEXT name
  }
  warehouses {
    TEXT id PK
    TEXT name
  }
  materials {
    TEXT id PK
    TEXT name
    TEXT category_id FK
    TEXT accounting_category_id FK
    TEXT main_warehouse_id FK
  }
  inventory_balances {
    TEXT warehouse_id PK, FK
    TEXT material_id PK, FK
    INTEGER quantity
  }
  work_orders {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  production_plans {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT work_order_id FK
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  production_plan_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  material_categories |o--o{ material_categories : "parent_id"
  warehouses |o--o{ materials : "main_warehouse_id"
  accounting_categories |o--o{ materials : "accounting_category_id"
  material_categories |o--o{ materials : "category_id"
  materials ||--o{ inventory_balances : "material_id"
  warehouses ||--o{ inventory_balances : "warehouse_id"
  materials ||--o{ work_orders : "product_id"
  materials ||--o{ production_plans : "product_id"
  work_orders |o--o{ production_plans : "work_order_id"
  materials ||--o{ production_plan_lines : "material_id"
  production_plans ||--o{ production_plan_lines : "document_id"
```

## 需求、采购与收货

```mermaid
erDiagram
  production_plans {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT work_order_id FK
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  production_plan_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  purchase_drafts {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT plan_id FK
    TEXT product_id FK
    TEXT execution_status
  }
  purchase_draft_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT source_plan_line_id FK
  }
  requisitions {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT plan_id FK
    TEXT execution_status
  }
  requisition_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  purchase_orders {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT merged_into_id FK
  }
  purchase_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT source_draft_line_id FK
    TEXT source_requisition_line_id FK
    TEXT merged_from_line_id FK
  }
  receipts {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT purchase_order_id FK
    TEXT warehouse_id FK
    TEXT execution_status
  }
  receipt_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT purchase_line_id FK
  }
  inventory_inbounds {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT warehouse_id FK
    TEXT receipt_id FK
  }
  inventory_inbound_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT receipt_line_id FK
  }
  production_plans ||--o{ production_plan_lines : "document_id"
  production_plans |o--o{ purchase_drafts : "plan_id"
  production_plan_lines |o--o{ purchase_draft_lines : "source_plan_line_id"
  purchase_drafts ||--o{ purchase_draft_lines : "document_id"
  production_plans |o--o{ requisitions : "plan_id"
  requisitions ||--o{ requisition_lines : "document_id"
  purchase_orders |o--o{ purchase_orders : "merged_into_id"
  purchase_lines |o--o{ purchase_lines : "merged_from_line_id"
  requisition_lines |o--o{ purchase_lines : "source_requisition_line_id"
  purchase_draft_lines |o--o{ purchase_lines : "source_draft_line_id"
  purchase_orders ||--o{ purchase_lines : "document_id"
  purchase_orders ||--o{ receipts : "purchase_order_id"
  purchase_lines ||--o{ receipt_lines : "purchase_line_id"
  receipts ||--o{ receipt_lines : "document_id"
  receipts |o--o| inventory_inbounds : "receipt_id"
  receipt_lines |o--o{ inventory_inbound_lines : "receipt_line_id"
  inventory_inbounds ||--o{ inventory_inbound_lines : "document_id"
```

## 领料、成品入库与发货

```mermaid
erDiagram
  production_plans {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT work_order_id FK
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  production_plan_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  material_issues {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT plan_id FK
    TEXT scene_warehouse_id FK
  }
  material_issue_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT warehouse_id FK
    TEXT source_plan_line_id FK
  }
  work_orders {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  finished_inbounds {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT work_order_id FK
    TEXT warehouse_id FK
  }
  finished_inbound_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  shipments {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT work_order_id FK
    TEXT warehouse_id FK
  }
  shipment_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  finished_outbounds {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT shipment_id FK
    TEXT work_order_id FK
    TEXT warehouse_id FK
  }
  finished_outbound_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
    TEXT shipment_line_id FK
  }
  warehouses {
    TEXT id PK
    TEXT name
  }
  inventory_movements {
    TEXT id PK
    TEXT warehouse_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  work_orders |o--o{ production_plans : "work_order_id"
  production_plans ||--o{ production_plan_lines : "document_id"
  warehouses |o--o{ material_issues : "scene_warehouse_id"
  production_plans ||--o{ material_issues : "plan_id"
  production_plan_lines |o--o{ material_issue_lines : "source_plan_line_id"
  warehouses ||--o{ material_issue_lines : "warehouse_id"
  material_issues ||--o{ material_issue_lines : "document_id"
  warehouses ||--o{ finished_inbounds : "warehouse_id"
  work_orders ||--o{ finished_inbounds : "work_order_id"
  finished_inbounds ||--o{ finished_inbound_lines : "document_id"
  warehouses ||--o{ shipments : "warehouse_id"
  work_orders ||--o| shipments : "work_order_id"
  shipments ||--o{ shipment_lines : "document_id"
  warehouses ||--o{ finished_outbounds : "warehouse_id"
  work_orders ||--o{ finished_outbounds : "work_order_id"
  shipments ||--o| finished_outbounds : "shipment_id"
  shipment_lines |o--o{ finished_outbound_lines : "shipment_line_id"
  finished_outbounds ||--o{ finished_outbound_lines : "document_id"
  warehouses ||--o{ inventory_movements : "warehouse_id"
```

## 分析、版本、打印与日志（预留）

```mermaid
erDiagram
  production_plans {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT name
    TEXT work_order_id FK
    TEXT product_id FK
    INTEGER quantity
    TEXT execution_status
  }
  production_plan_lines {
    TEXT id PK
    TEXT document_id FK
    TEXT material_id FK
    INTEGER quantity
  }
  analysis_runs {
    TEXT id PK
    TEXT plan_id FK
  }
  analysis_run_lines {
    TEXT id PK
    TEXT run_id FK
    TEXT plan_line_id FK
  }
  purchase_orders {
    TEXT id PK
    TEXT document_no
    TEXT audit_status
    TEXT merged_into_id FK
  }
  purchase_order_revisions {
    TEXT id PK
    TEXT purchase_order_id FK
  }
  print_templates {
    TEXT id PK
    TEXT name
  }
  print_template_versions {
    TEXT id PK
    TEXT template_id FK
  }
  print_records {
    TEXT id PK
    TEXT template_version_id FK
  }
  operation_logs {
    TEXT id PK
  }
  production_plans ||--o{ production_plan_lines : "document_id"
  purchase_orders |o--o{ purchase_orders : "merged_into_id"
  production_plans ||--o{ analysis_runs : "plan_id"
  production_plan_lines ||--o{ analysis_run_lines : "plan_line_id"
  analysis_runs ||--o{ analysis_run_lines : "run_id"
  purchase_orders ||--o{ purchase_order_revisions : "purchase_order_id"
  print_templates ||--o{ print_template_versions : "template_id"
  print_template_versions ||--o{ print_records : "template_version_id"
```
