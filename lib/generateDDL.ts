import { SchemaJSON, Table, Column } from "./types";

// ─── DB 타겟 정의 ────────────────────────────────────────────
export type DbTarget = "mysql" | "postgresql" | "sqlite" | "sqlserver" | "oracle";

export interface DbTargetInfo {
  id: DbTarget;
  label: string;
  version: string;
}

export const DB_TARGETS: DbTargetInfo[] = [
  { id: "mysql",      label: "MySQL",      version: "8.0+"  },
  { id: "postgresql", label: "PostgreSQL", version: "14+"   },
  { id: "sqlite",     label: "SQLite",     version: "3.x"   },
  { id: "sqlserver",  label: "SQL Server", version: "2019+" },
  { id: "oracle",     label: "Oracle",     version: "19c+"  },
];

// ─── 타입 매핑 ───────────────────────────────────────────────
function mapType(type: string, db: DbTarget): string {
  const upper = type.toUpperCase().trim();

  // SERIAL / BIGSERIAL → INT / BIGINT (auto-inc 처리는 별도)
  const base = upper === "SERIAL" ? "INT"
    : upper === "BIGSERIAL" ? "BIGINT"
    : upper;

  switch (db) {
    case "mysql":
      if (base === "BOOLEAN" || base === "BOOL")      return "TINYINT(1)";
      if (base === "BYTEA")                            return "BLOB";
      if (base === "DATETIME2")                        return "DATETIME";
      if (base.startsWith("NVARCHAR"))                 return type.replace(/nvarchar/i, "VARCHAR");
      return type;

    case "postgresql":
      if (base === "TINYINT(1)" || base === "TINYINT") return "BOOLEAN";
      if (base === "DATETIME")                          return "TIMESTAMP";
      if (base === "BLOB")                              return "BYTEA";
      if (base.startsWith("NVARCHAR"))                  return type.replace(/nvarchar/i, "VARCHAR");
      return type;

    case "sqlite":
      if (base.includes("INT"))                                           return "INTEGER";
      if (base.startsWith("VARCHAR") || base.startsWith("CHAR")
        || base === "TEXT" || base.startsWith("NVARCHAR")
        || base === "CLOB" || base === "NTEXT")                           return "TEXT";
      if (base === "BOOLEAN" || base === "BOOL")                          return "INTEGER";
      if (base === "BLOB" || base === "BYTEA")                            return "BLOB";
      if (base === "FLOAT" || base === "DOUBLE" || base === "REAL")       return "REAL";
      if (base === "TIMESTAMP" || base === "DATETIME"
        || base === "DATE" || base === "TIME")                            return "TEXT";
      return "NUMERIC";

    case "sqlserver":
      if (base === "BOOLEAN" || base === "BOOL")       return "BIT";
      if (base === "DATETIME")                          return "DATETIME2";
      if (base === "TEXT")                              return "NVARCHAR(MAX)";
      if (base === "BLOB" || base === "BYTEA")          return "VARBINARY(MAX)";
      if (base.startsWith("VARCHAR"))                   return type.replace(/varchar/i, "NVARCHAR");
      return type;

    case "oracle":
      if (base === "INT" || base === "INTEGER" || base === "SMALLINT") return "NUMBER(10)";
      if (base === "BIGINT")                            return "NUMBER(19)";
      if (base === "BOOLEAN" || base === "BOOL")        return "NUMBER(1)";
      if (base === "TEXT" || base === "CLOB")           return "CLOB";
      if (base === "BLOB" || base === "BYTEA")          return "BLOB";
      if (base === "DATETIME")                          return "TIMESTAMP";
      if (base === "FLOAT" || base === "DOUBLE")        return "FLOAT";
      if (base.startsWith("VARCHAR"))                   return type.replace(/varchar/i, "VARCHAR2");
      return type;
  }
}

// ─── DEFAULT 값 포맷 ─────────────────────────────────────────
function fmtDefault(value: string, db: DbTarget): string {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;  // 숫자

  const upper = value.toUpperCase();

  if (upper === "NULL") return "NULL";

  if (upper === "TRUE" || upper === "FALSE") {
    if (db === "sqlserver" || db === "oracle") return upper === "TRUE" ? "1" : "0";
    return upper;
  }

  if (upper === "CURRENT_TIMESTAMP" || upper === "NOW()") {
    return db === "sqlserver" ? "GETDATE()" : "CURRENT_TIMESTAMP";
  }
  if (upper === "GETDATE()") {
    return db === "sqlserver" ? "GETDATE()" : "CURRENT_TIMESTAMP";
  }
  if (upper === "SYSDATE") {
    return db === "oracle" ? "SYSDATE" : "CURRENT_TIMESTAMP";
  }

  // 문자열: SQL Server는 '' 이스케이프, 나머지는 \'
  const escaped = db === "sqlserver"
    ? value.replace(/'/g, "''")
    : value.replace(/'/g, "\\'");
  return `'${escaped}'`;
}

// ─── PK 정수형 → auto-increment 여부 ────────────────────────
function isAutoIncrement(col: Column): boolean {
  const t = col.type.toUpperCase();
  return !!col.pk && (
    t === "INT" || t === "INTEGER" || t === "BIGINT" || t === "SMALLINT" ||
    t === "SERIAL" || t === "BIGSERIAL"
  );
}

// ─── 참조 테이블의 PK 컬럼명 ────────────────────────────────
function findRefPk(tables: Table[], tableName: string): string {
  const t = tables.find((t) => t.name === tableName);
  return t?.columns.find((c) => c.pk)?.name ?? "id";
}

// ─── 단일 테이블 → CREATE TABLE 구문 ────────────────────────
function tableToSQL(table: Table, allTables: Table[], db: DbTarget): string {
  const colLines: string[] = [];
  const constraintLines: string[] = [];
  const postStatements: string[] = [];  // COMMENT ON ... (PostgreSQL / Oracle)

  for (const col of table.columns) {
    const autoInc    = isAutoIncrement(col);
    const mappedType = mapType(col.type, db);
    const parts: string[] = [];

    switch (db) {
      /* ── MySQL ──────────────────────────────────────────────── */
      case "mysql": {
        parts.push(`  ${col.name}`, mappedType);
        if (col.pk || col.notNull)           parts.push("NOT NULL");
        if (autoInc)                         parts.push("AUTO_INCREMENT");
        if (col.unique && !col.pk)           parts.push("UNIQUE");
        if (col.default !== undefined && !autoInc)
          parts.push(`DEFAULT ${fmtDefault(col.default, db)}`);
        if (col.comment)
          parts.push(`COMMENT '${col.comment.replace(/'/g, "\\'")}'`);
        break;
      }

      /* ── PostgreSQL ─────────────────────────────────────────── */
      case "postgresql": {
        const pgType = autoInc
          ? (col.type.toUpperCase().includes("BIG") ? "BIGSERIAL" : "SERIAL")
          : mappedType;
        parts.push(`  ${col.name}`, pgType);
        if ((col.pk || col.notNull) && !autoInc) parts.push("NOT NULL");
        if (col.unique && !col.pk)               parts.push("UNIQUE");
        if (col.default !== undefined && !autoInc)
          parts.push(`DEFAULT ${fmtDefault(col.default, db)}`);
        if (col.comment)
          postStatements.push(
            `COMMENT ON COLUMN ${table.name}.${col.name} IS '${col.comment.replace(/'/g, "''")}';`
          );
        break;
      }

      /* ── SQLite ─────────────────────────────────────────────── */
      case "sqlite": {
        if (autoInc) {
          // INTEGER PRIMARY KEY AUTOINCREMENT 인라인 (별도 PK 제약 불필요)
          parts.push(`  ${col.name}`, "INTEGER", "PRIMARY KEY", "AUTOINCREMENT");
        } else {
          parts.push(`  ${col.name}`, mappedType);
          if (col.pk || col.notNull) parts.push("NOT NULL");
          if (col.unique && !col.pk) parts.push("UNIQUE");
          if (col.default !== undefined)
            parts.push(`DEFAULT ${fmtDefault(col.default, db)}`);
        }
        break;
      }

      /* ── SQL Server ─────────────────────────────────────────── */
      case "sqlserver": {
        parts.push(`  ${col.name}`, mappedType);
        if (autoInc)                         parts.push("IDENTITY(1,1)");
        if (col.pk || col.notNull)           parts.push("NOT NULL");
        if (col.unique && !col.pk)           parts.push("UNIQUE");
        if (col.default !== undefined && !autoInc)
          parts.push(`DEFAULT ${fmtDefault(col.default, db)}`);
        break;
      }

      /* ── Oracle ─────────────────────────────────────────────── */
      case "oracle": {
        parts.push(`  ${col.name}`, mappedType);
        if (autoInc)                               parts.push("GENERATED ALWAYS AS IDENTITY");
        if ((col.pk || col.notNull) && !autoInc)   parts.push("NOT NULL");
        if (col.unique && !col.pk)                 parts.push("UNIQUE");
        if (col.default !== undefined && !autoInc)
          parts.push(`DEFAULT ${fmtDefault(col.default, db)}`);
        if (col.comment)
          postStatements.push(
            `COMMENT ON COLUMN ${table.name}.${col.name} IS '${col.comment.replace(/'/g, "''")}';`
          );
        break;
      }
    }

    colLines.push(parts.join(" "));
  }

  // PRIMARY KEY 제약
  const pkCols = table.columns.filter((c) => c.pk);
  // SQLite auto-inc PK는 인라인 처리했으므로 별도 제약 불필요
  const skipPkConstraint =
    db === "sqlite" && pkCols.length === 1 && isAutoIncrement(pkCols[0]);
  if (pkCols.length > 0 && !skipPkConstraint) {
    constraintLines.push(
      `  PRIMARY KEY (${pkCols.map((c) => c.name).join(", ")})`
    );
  }

  // FOREIGN KEY 제약
  const fkCols = table.columns.filter((c) => c.fk);
  for (const col of fkCols) {
    const refPk = findRefPk(allTables, col.fk!);
    constraintLines.push(
      `  FOREIGN KEY (${col.name}) REFERENCES ${col.fk} (${refPk})`
    );
  }

  const allLines = [...colLines, ...constraintLines].join(",\n");

  // ── CREATE TABLE 조합 ──────────────────────────────────────
  let sql = "";
  if (table.comment) sql += `-- ${table.comment}\n`;

  if (db === "mysql") {
    sql += `CREATE TABLE ${table.name} (\n${allLines}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    if (table.comment) sql += ` COMMENT='${table.comment.replace(/'/g, "\\'")}'`;
    sql += ";";
  } else {
    sql += `CREATE TABLE ${table.name} (\n${allLines}\n);`;
    if (table.comment && (db === "postgresql" || db === "oracle")) {
      postStatements.unshift(
        `COMMENT ON TABLE ${table.name} IS '${table.comment.replace(/'/g, "''")}';`
      );
    }
  }

  if (postStatements.length > 0) {
    sql += "\n" + postStatements.join("\n");
  }

  return sql;
}

// ─── 전체 DDL 생성 ───────────────────────────────────────────
export function generateDDL(schema: SchemaJSON, db: DbTarget = "mysql"): string {
  if (schema.tables.length === 0) return "";

  const dbInfo = DB_TARGETS.find((d) => d.id === db)!;

  const header = [
    "-- =============================================",
    "-- Generated by AI DB 설계 툴",
    `-- Target : ${dbInfo.label} ${dbInfo.version}`,
    `-- Date   : ${new Date().toLocaleString("ko-KR")}`,
    "-- =============================================",
    "",
  ].join("\n");

  const body = schema.tables
    .map((t) => tableToSQL(t, schema.tables, db))
    .join("\n\n");

  return header + body;
}
