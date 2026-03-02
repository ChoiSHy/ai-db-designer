import { SchemaJSON } from "./types";

// ─── 타입 ────────────────────────────────────────────────────
export interface SchemaDiff {
  addedTables: string[];                            // 새로 추가된 테이블
  removedTables: string[];                          // 삭제된 테이블
  modifiedTables: string[];                         // 컬럼 변경이 있는 테이블
  addedColumns: { table: string; column: string }[];   // 추가된 컬럼
  removedColumns: { table: string; column: string }[]; // 삭제된 컬럼
  modifiedColumns: { table: string; column: string }[]; // 수정된 컬럼
}

export type TableDiffStatus = "added" | "modified" | "removed" | "none";
export type ColumnDiffStatus = "added" | "modified" | "removed" | "none";

// ─── diff 계산 ───────────────────────────────────────────────
export function computeSchemaDiff(prev: SchemaJSON, curr: SchemaJSON): SchemaDiff {
  const prevMap = new Map(prev.tables.map((t) => [t.name, t]));
  const currMap = new Map(curr.tables.map((t) => [t.name, t]));

  const addedTables: string[] = [];
  const removedTables: string[] = [];
  const modifiedTables: string[] = [];
  const addedColumns: { table: string; column: string }[] = [];
  const removedColumns: { table: string; column: string }[] = [];
  const modifiedColumns: { table: string; column: string }[] = [];

  // 추가된 테이블
  for (const name of currMap.keys()) {
    if (!prevMap.has(name)) addedTables.push(name);
  }

  // 삭제된 테이블
  for (const name of prevMap.keys()) {
    if (!currMap.has(name)) removedTables.push(name);
  }

  // 공통 테이블: 컬럼 diff
  for (const [name, currTable] of currMap.entries()) {
    const prevTable = prevMap.get(name);
    if (!prevTable) continue; // 신규 테이블은 위에서 처리

    const prevColMap = new Map(prevTable.columns.map((c) => [c.name, c]));
    const currColMap = new Map(currTable.columns.map((c) => [c.name, c]));

    let tableChanged = false;

    // 테이블 코멘트 변경
    if (prevTable.comment !== currTable.comment) tableChanged = true;

    // 추가된 컬럼
    for (const colName of currColMap.keys()) {
      if (!prevColMap.has(colName)) {
        addedColumns.push({ table: name, column: colName });
        tableChanged = true;
      }
    }

    // 삭제된 컬럼
    for (const colName of prevColMap.keys()) {
      if (!currColMap.has(colName)) {
        removedColumns.push({ table: name, column: colName });
        tableChanged = true;
      }
    }

    // 수정된 컬럼
    for (const [colName, currCol] of currColMap.entries()) {
      const prevCol = prevColMap.get(colName);
      if (prevCol && JSON.stringify(prevCol) !== JSON.stringify(currCol)) {
        modifiedColumns.push({ table: name, column: colName });
        tableChanged = true;
      }
    }

    if (tableChanged) modifiedTables.push(name);
  }

  return { addedTables, removedTables, modifiedTables, addedColumns, removedColumns, modifiedColumns };
}

/** diff에 실제 변경사항이 있는지 */
export function hasDiff(diff: SchemaDiff): boolean {
  return (
    diff.addedTables.length > 0 ||
    diff.removedTables.length > 0 ||
    diff.modifiedTables.length > 0 ||
    diff.addedColumns.length > 0 ||
    diff.removedColumns.length > 0 ||
    diff.modifiedColumns.length > 0
  );
}

/** 테이블별 diff 상태 조회 헬퍼 */
export function getTableDiffStatus(diff: SchemaDiff | null, tableName: string): TableDiffStatus {
  if (!diff) return "none";
  if (diff.addedTables.includes(tableName))    return "added";
  if (diff.removedTables.includes(tableName))  return "removed";
  if (diff.modifiedTables.includes(tableName)) return "modified";
  return "none";
}

/** 컬럼별 diff 상태 조회 헬퍼 */
export function getColumnDiffStatus(
  diff: SchemaDiff | null,
  tableName: string,
  columnName: string
): ColumnDiffStatus {
  if (!diff) return "none";
  if (diff.addedColumns.some((c)   => c.table === tableName && c.column === columnName)) return "added";
  if (diff.removedColumns.some((c) => c.table === tableName && c.column === columnName)) return "removed";
  if (diff.modifiedColumns.some((c) => c.table === tableName && c.column === columnName)) return "modified";
  return "none";
}
