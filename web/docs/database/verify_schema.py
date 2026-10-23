"""校验参考数据库、基础 mock 外键、来源行及关键约束，不依赖外部数据库。"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "web/docs/database/schema.sql"
FIXTURE = ROOT / "web/src/demo/mock/database.json"


def expect_rejected(connection, sql, values):
    connection.execute("SAVEPOINT invalid_case")
    try:
        connection.execute(sql, values)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(f"非法数据未被约束拦截：{sql}")
    finally:
        connection.execute("ROLLBACK TO invalid_case")
        connection.execute("RELEASE invalid_case")


def verify():
    data = json.loads(FIXTURE.read_text(encoding="utf-8-sig"))
    connection = sqlite3.connect(":memory:")
    connection.executescript(SCHEMA.read_text(encoding="utf-8-sig"))
    names = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert set(data["tables"]) == names, "fixture 表与数据库结构未对齐"
    count = 0
    for table, rows in data["tables"].items():
        for row in rows:
            columns = list(row)
            # 表名、字段名仅来自仓库内 fixture，仍先校验合法标识符。
            assert all(name.replace("_", "").isalnum() for name in [table, *columns])
            connection.execute(
                f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                [row[column] for column in columns],
            )
            count += 1
    assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert connection.execute("SELECT quantity FROM inventory_balances WHERE warehouse_id='BZ01' AND material_id='M001'").fetchone()[0] == 2
    assert connection.execute("SELECT sum(quantity) FROM production_plan_lines WHERE document_id='PP202610001'").fetchone()[0] == 8
    assert connection.execute("SELECT amount_incl_tax_cents FROM purchase_lines").fetchone()[0] is None
    expect_rejected(connection, "INSERT INTO inventory_balances VALUES (?, ?, ?, ?)", ("不存在", "M001", 1, None))
    expect_rejected(connection, "INSERT INTO inventory_balances VALUES (?, ?, ?, ?)", ("BZ01", "M001", 1, None))
    expect_rejected(connection, "INSERT INTO warehouses (id,name,kind,included_in_available) VALUES (?,?,?,?)", (None,"无主键","存货仓",1))
    expect_rejected(connection, "UPDATE purchase_lines SET quantity=?", (0,))
    expect_rejected(connection, "UPDATE purchase_lines SET quantity=?", (1.5,))
    expect_rejected(connection, "UPDATE inventory_balances SET amount_cents=?", (1.5,))
    expect_rejected(connection, "UPDATE purchase_lines SET price_incl_tax_micro=?", (-1,))
    expect_rejected(connection, "UPDATE purchase_lines SET tax_rate_bp=?", (10001,))
    movement = data["tables"]["inventory_movements"][0]
    expect_rejected(connection,
        "INSERT INTO inventory_movements (id,movement_date,direction,warehouse_id,material_id,quantity,source_doc_type,source_doc_id,source_line_id) VALUES (?,?,?,?,?,?,?,?,?)",
        ("DUPLICATE",movement["movement_date"],movement["direction"],movement["warehouse_id"],movement["material_id"],1,movement["source_doc_type"],movement["source_doc_id"],movement["source_line_id"]))
    # 结构允许负数、超收；本轮前端仍保持原先业务拦截，不在 mock 重构中改变规则。
    connection.execute("UPDATE inventory_balances SET quantity=-1 WHERE warehouse_id='BZ01' AND material_id='M001'")
    connection.execute("UPDATE purchase_lines SET received_quantity=quantity+1")
    print(f"数据库验证通过：{len(names)} 张表，{count} 条基础记录；外键、金额空值、唯一性、数量、税率及流水幂等约束已验证。")
    connection.close()


if __name__ == "__main__":
    verify()
