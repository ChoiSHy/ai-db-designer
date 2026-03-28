import { SchemaJSON } from "./types";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  table?: string;
  column?: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

// ── 헬퍼 ──────────────────────────────────────────────────────
const SNAKE_RE = /^[a-z][a-z0-9_]*$/;
function isSnakeCase(s: string) { return SNAKE_RE.test(s); }

/** FK 관계 그래프에서 순환 참조 탐지 (DFS) */
function detectCircularFKs(schema: SchemaJSON): { from: string; to: string }[] {
  const graph = new Map<string, string[]>();
  for (const table of schema.tables) {
    const deps = table.columns
      .filter((c) => c.fk)
      .map((c) => c.fk as string)
      .filter((ref) => ref !== table.name); // self-ref 제외
    graph.set(table.name, deps);
  }

  const circular: { from: string; to: string }[] = [];
  const visited = new Set<string>();
  const stack   = new Set<string>();

  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      // 순환 발견: path에서 해당 노드 이후를 순환으로 기록
      const idx = path.indexOf(node);
      if (idx !== -1) {
        circular.push({ from: path[path.length - 1], to: node });
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const dep of graph.get(node) ?? []) {
      dfs(dep, [...path, node]);
    }
    stack.delete(node);
  }

  for (const name of graph.keys()) dfs(name, []);
  return circular;
}

// ── 메인 검증 함수 ─────────────────────────────────────────────
export function validateSchema(schema: SchemaJSON): ValidationResult {
  const issues: ValidationIssue[] = [];
  const tableNames = new Set(schema.tables.map((t) => t.name));

  if (schema.tables.length === 0) {
    return { issues, errorCount: 0, warningCount: 0, infoCount: 0 };
  }

  for (const table of schema.tables) {
    const t = table.name;

    // ── ERROR ───────────────────────────────────────────────
    // 빈 테이블
    if (table.columns.length === 0) {
      issues.push({ severity: "error", code: "EMPTY_TABLE", table: t,
        message: "컬럼이 하나도 없습니다." });
    }

    // PK 없음
    const hasPK = table.columns.some((c) => c.pk);
    if (!hasPK && table.columns.length > 0) {
      issues.push({ severity: "error", code: "NO_PK", table: t,
        message: "기본키(PK)가 없습니다. 모든 테이블에 PK가 필요합니다." });
    }

    // 중복 컬럼명
    const colNames = table.columns.map((c) => c.name);
    const dupCols  = colNames.filter((n, i) => colNames.indexOf(n) !== i);
    for (const dup of [...new Set(dupCols)]) {
      issues.push({ severity: "error", code: "DUPLICATE_COLUMN", table: t, column: dup,
        message: `컬럼명 "${dup}"이 중복됩니다.` });
    }

    // FK → 존재하지 않는 테이블 참조
    for (const col of table.columns.filter((c) => c.fk)) {
      if (!tableNames.has(col.fk!)) {
        issues.push({ severity: "error", code: "FK_INVALID_REF", table: t, column: col.name,
          message: `FK "${col.name}"이 존재하지 않는 테이블 "${col.fk}"를 참조합니다.` });
      }
    }

    // ── WARNING ─────────────────────────────────────────────
    // 타임스탬프 없음 (중간 테이블 등 제외 기준: 컬럼 3개 이상)
    if (table.columns.length >= 3) {
      const colNameSet = new Set(colNames);
      const hasCreated = colNameSet.has("created_at");
      const hasUpdated = colNameSet.has("updated_at");
      if (!hasCreated || !hasUpdated) {
        const missing = [!hasCreated && "created_at", !hasUpdated && "updated_at"].filter(Boolean).join(", ");
        issues.push({ severity: "warning", code: "MISSING_TIMESTAMPS", table: t,
          message: `${missing} 컬럼이 없습니다. 이력 추적을 위해 추가를 권장합니다.` });
      }
    }

    // 테이블명 snake_case 아님
    if (!isSnakeCase(t)) {
      issues.push({ severity: "warning", code: "TABLE_NOT_SNAKE", table: t,
        message: `테이블명 "${t}"이 snake_case(소문자+언더스코어)가 아닙니다.` });
    }

    for (const col of table.columns) {
      // 컬럼명 snake_case 아님
      if (!isSnakeCase(col.name)) {
        issues.push({ severity: "warning", code: "COLUMN_NOT_SNAKE", table: t, column: col.name,
          message: `컬럼명 "${col.name}"이 snake_case가 아닙니다.` });
      }

      // FK 컬럼에 notNull 없음
      if (col.fk && !col.notNull && !col.pk) {
        issues.push({ severity: "warning", code: "FK_NULLABLE", table: t, column: col.name,
          message: `FK 컬럼 "${col.name}"에 NOT NULL 제약이 없습니다. 의도적인 경우라면 무시하세요.` });
      }
    }

    // ── INFO ────────────────────────────────────────────────
    // FK 컬럼 인덱스 권장
    const fkCols = table.columns.filter((c) => c.fk && !c.pk);
    for (const col of fkCols) {
      issues.push({ severity: "info", code: "FK_INDEX_SUGGESTED", table: t, column: col.name,
        message: `FK 컬럼 "${col.name}"에 인덱스 추가를 권장합니다. (조회 성능 향상)` });
    }

    // 컬럼 1개짜리 테이블
    if (table.columns.length === 1) {
      issues.push({ severity: "info", code: "SINGLE_COLUMN", table: t,
        message: "컬럼이 1개뿐입니다. 설계 의도를 다시 확인해보세요." });
    }
  }

  // 순환 FK 참조
  const circles = detectCircularFKs(schema);
  for (const { from, to } of circles) {
    issues.push({ severity: "warning", code: "CIRCULAR_FK", table: from,
      message: `순환 참조 감지: "${from}" → "${to}". 데이터 삽입 순서에 주의하세요.` });
  }

  const errorCount   = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount    = issues.filter((i) => i.severity === "info").length;

  return { issues, errorCount, warningCount, infoCount };
}
