"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { SchemaJSON, Table, Column } from "@/lib/types";
import { generateDDL, DB_TARGETS, DbTarget } from "@/lib/generateDDL";
import {
  SchemaDiff,
  hasDiff,
  getTableDiffStatus,
  getColumnDiffStatus,
  TableDiffStatus,
  ColumnDiffStatus,
} from "@/lib/schemaDiff";
import { validateSchema } from "@/lib/validateSchema";
import { ValidationView } from "./ValidationView";

// ERDView는 React Flow 포함 → SSR 제외, 클라이언트 전용 로드
const ERDView = dynamic(
  () => import("./ERDView").then((m) => ({ default: m.ERDView })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        ERD 로딩 중...
      </div>
    ),
  }
);

interface SchemaPanelProps {
  schema: SchemaJSON;
  lastDiff: SchemaDiff | null;
  canUndo: boolean;
  undoCount: number;
  onUndo: () => void;
  onParseDDL: (ddl: string) => Promise<void>;
  isLoading: boolean;
}

// ─── diff 색상 헬퍼 ────────────────────────────────────────────
const TABLE_STATUS_STYLE: Record<TableDiffStatus, string> = {
  added:    "border-green-400  bg-green-50",
  modified: "border-amber-400  bg-amber-50/40",
  removed:  "border-red-400    bg-red-50",
  none:     "border-gray-200   bg-white",
};

const TABLE_HEADER_BADGE: Record<TableDiffStatus, { label: string; cls: string } | null> = {
  added:    { label: "NEW",  cls: "bg-green-100 text-green-700" },
  modified: { label: "수정", cls: "bg-amber-100 text-amber-700" },
  removed:  { label: "삭제", cls: "bg-red-100   text-red-700"   },
  none:     null,
};

const COL_STATUS_STYLE: Record<ColumnDiffStatus, string> = {
  added:    "bg-green-50",
  modified: "bg-amber-50",
  removed:  "bg-red-50 opacity-60",
  none:     "",
};

const COL_STATUS_BADGE: Record<ColumnDiffStatus, { label: string; cls: string } | null> = {
  added:    { label: "+", cls: "text-green-600 font-bold" },
  modified: { label: "~", cls: "text-amber-600 font-bold" },
  removed:  { label: "−", cls: "text-red-500   font-bold" },
  none:     null,
};

// ─── SQL 키워드 하이라이팅 ────────────────────────────────────
function DDLHighlight({ sql }: { sql: string }) {
  const KW_RE =
    /\b(CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES|NOT\s+NULL|NOT|NULL|UNIQUE|DEFAULT|COMMENT|AUTO_INCREMENT|CONSTRAINT|VARCHAR|BIGINT|INT|TEXT|BOOLEAN|BOOL|TIMESTAMP|DATETIME|DATE|DECIMAL|FLOAT|DOUBLE|CHAR|SERIAL)\b/g;

  const lines = sql.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        if (line.trimStart().startsWith("--")) {
          return <span key={li} className="text-gray-500">{line}{"\n"}</span>;
        }
        const parts = line.split(KW_RE);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              pi % 2 === 1 ? (
                <span key={pi} className="text-blue-400 font-semibold">{part}</span>
              ) : (
                <span key={pi} className={/^'.*'$/.test(part.trim()) ? "text-amber-300" : ""}>{part}</span>
              )
            )}
            {"\n"}
          </span>
        );
      })}
    </>
  );
}

// ─── 컬럼 행 ─────────────────────────────────────────────────
function ColumnRow({ col, diffStatus }: { col: Column; diffStatus: ColumnDiffStatus }) {
  const badge = COL_STATUS_BADGE[diffStatus];
  return (
    <tr className={`border-b border-gray-100 last:border-0 ${COL_STATUS_STYLE[diffStatus]}`}>
      <td className="py-2 px-3 text-xs font-mono text-gray-800">
        <div className="flex items-center gap-1.5">
          {badge && <span className={`text-[10px] w-3 ${badge.cls}`}>{badge.label}</span>}
          {col.pk && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">PK</span>
          )}
          {!col.pk && col.fk && (
            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">FK</span>
          )}
          {col.name}
        </div>
      </td>
      <td className="py-2 px-3 text-xs font-mono text-purple-600">{col.type}</td>
      <td className="py-2 px-3 text-xs text-gray-500">
        <div className="flex flex-wrap gap-1">
          {col.unique    && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">UQ</span>}
          {col.notNull   && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">NN</span>}
          {col.default !== undefined && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
              DEF: {col.default}
            </span>
          )}
          {col.fk && (
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">
              → {col.fk}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── 테이블 카드 ──────────────────────────────────────────────
function TableCard({
  table,
  diff,
}: {
  table: Table;
  diff: SchemaDiff | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const status = getTableDiffStatus(diff, table.name);
  const badge  = TABLE_HEADER_BADGE[status];

  return (
    <div className={`border rounded-xl overflow-hidden mb-4 shadow-sm ${TABLE_STATUS_STYLE[status]}`}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          <span className="font-semibold text-gray-800 text-sm font-mono">{table.name}</span>
          {table.comment && <span className="text-xs text-gray-500">{table.comment}</span>}
          <span className="text-xs text-gray-400">({table.columns.length}개 컬럼)</span>
        </div>
        <span className="text-gray-400 text-xs">{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-white/70">
              <th className="py-1.5 px-3 text-left text-[11px] text-gray-400 font-medium">컬럼명</th>
              <th className="py-1.5 px-3 text-left text-[11px] text-gray-400 font-medium">타입</th>
              <th className="py-1.5 px-3 text-left text-[11px] text-gray-400 font-medium">속성</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((col, i) => (
              <ColumnRow
                key={i}
                col={col}
                diffStatus={
                  status === "added" ? "added" : getColumnDiffStatus(diff, table.name, col.name)
                }
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── 변경 요약 배너 ───────────────────────────────────────────
function DiffBanner({ diff, onUndo }: { diff: SchemaDiff; onUndo: () => void }) {
  const parts: string[] = [];
  if (diff.addedTables.length)    parts.push(`+${diff.addedTables.length} 테이블`);
  if (diff.removedTables.length)  parts.push(`-${diff.removedTables.length} 테이블`);
  if (diff.modifiedTables.length) parts.push(`~${diff.modifiedTables.length} 테이블`);
  if (diff.addedColumns.length)   parts.push(`+${diff.addedColumns.length} 컬럼`);
  if (diff.removedColumns.length) parts.push(`-${diff.removedColumns.length} 컬럼`);
  if (diff.modifiedColumns.length) parts.push(`~${diff.modifiedColumns.length} 컬럼`);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
      <span className="text-indigo-400 text-sm">🔄</span>
      <span className="text-[11px] text-indigo-700 font-medium flex-1">
        마지막 변경:&nbsp;
        <span className="font-normal">{parts.join("  ·  ")}</span>
      </span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
        되돌리기
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
type ViewMode = "erd" | "table" | "json" | "ddl" | "validate";

export function SchemaPanel({
  schema,
  lastDiff,
  canUndo,
  undoCount,
  onUndo,
  onParseDDL,
  isLoading,
}: SchemaPanelProps) {
  const [viewMode,    setViewMode]    = useState<ViewMode>("erd");
  const [copied,      setCopied]      = useState(false);
  const [dbTarget,    setDbTarget]    = useState<DbTarget>("mysql");
  const [editingDDL,  setEditingDDL]  = useState(false);
  const [ddlDraft,    setDdlDraft]    = useState("");

  const isEmpty      = schema.tables.length === 0;
  const showDiff     = lastDiff !== null && hasDiff(lastDiff);
  const validation   = useMemo(() => validateSchema(schema), [schema]);
  const issueCount   = validation.errorCount + validation.warningCount;

  const tabs: { id: ViewMode; label: string; badge?: number }[] = [
    { id: "erd",      label: "ERD"   },
    { id: "table",    label: "테이블" },
    { id: "json",     label: "JSON"  },
    { id: "ddl",      label: "DDL"   },
    { id: "validate", label: "검증", badge: issueCount },
  ];

  function handleCopyDDL() {
    const ddl = generateDDL(schema, dbTarget);
    navigator.clipboard.writeText(ddl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadDDL() {
    const ddl  = generateDDL(schema, dbTarget);
    const blob = new Blob([ddl], { type: "text/sql;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `schema_${dbTarget}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">스키마</h2>
            <p className="text-xs text-gray-500">
              {isEmpty ? "아직 생성된 스키마가 없습니다" : `${schema.tables.length}개 테이블`}
            </p>
          </div>
          {/* Undo 버튼 */}
          {canUndo && (
            <button
              onClick={onUndo}
              title={`${undoCount}개 이전 버전 보유`}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              실행취소
              <span className="ml-0.5 px-1 py-0.5 bg-gray-100 rounded text-[9px] text-gray-400">
                {undoCount}
              </span>
            </button>
          )}
        </div>

        {!isEmpty && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`relative px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === tab.id
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 flex items-center justify-center text-[9px] font-bold rounded-full ${
                    validation.errorCount > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 변경사항 배너 (ERD / 테이블 뷰에서만) ── */}
      {!isEmpty && showDiff && (viewMode === "erd" || viewMode === "table") && (
        <DiffBanner diff={lastDiff!} onUndo={onUndo} />
      )}

      {/* ── 컨텐츠 ── */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-sm">AI와 대화하면 스키마가 여기에 표시됩니다</p>
        </div>

      ) : viewMode === "erd" ? (
        <div className="flex-1 min-h-0">
          <ERDView schema={schema} lastDiff={lastDiff} />
        </div>

      ) : viewMode === "table" ? (
        <div className="flex-1 overflow-y-auto p-4">
          {/* 삭제된 테이블 표시 (현재 스키마에 없으므로 별도 렌더링) */}
          {lastDiff?.removedTables.map((name) => (
            <div
              key={`removed-${name}`}
              className="border border-red-300 bg-red-50 rounded-xl mb-4 shadow-sm px-4 py-3 flex items-center gap-2"
            >
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">삭제</span>
              <span className="font-semibold text-red-700 text-sm font-mono line-through">{name}</span>
            </div>
          ))}
          {schema.tables.map((table, i) => (
            <TableCard key={i} table={table} diff={lastDiff} />
          ))}
        </div>

      ) : viewMode === "json" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono text-gray-700 bg-gray-50 rounded-xl p-4 overflow-x-auto border border-gray-200 leading-relaxed">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </div>

      ) : viewMode === "validate" ? (
        <ValidationView schema={schema} />

      ) : (
        /* DDL 뷰 */
        <div className="flex-1 flex flex-col min-h-0">
          {/* DB 선택 바 */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <span className="text-[11px] text-gray-400 font-medium mr-1">DB</span>
            {DB_TARGETS.map((db) => (
              <button
                key={db.id}
                onClick={() => setDbTarget(db.id)}
                title={`${db.label} ${db.version}`}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                  dbTarget === db.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {db.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-gray-400">
              {DB_TARGETS.find((d) => d.id === dbTarget)?.version}
            </span>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
            {editingDDL ? (
              /* 편집 모드 액션 */
              <>
                <button
                  onClick={async () => {
                    await onParseDDL(ddlDraft);
                    setEditingDDL(false);
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isLoading ? "분석 중..." : "스키마에 적용"}
                </button>
                <button
                  onClick={() => setEditingDDL(false)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
                <span className="ml-1 text-[10px] text-gray-400">AI가 DDL을 분석해 스키마를 업데이트합니다</span>
              </>
            ) : (
              /* 읽기 모드 액션 */
              <>
                <button
                  onClick={handleCopyDDL}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-600">복사됨!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      복사
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadDDL}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  schema_{dbTarget}.sql 다운로드
                </button>
                <button
                  onClick={() => {
                    setDdlDraft(generateDDL(schema, dbTarget));
                    setEditingDDL(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-gray-600 transition-colors ml-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  편집
                </button>
              </>
            )}
          </div>

          {/* SQL 코드 블록 / 편집기 */}
          <div className="flex-1 overflow-y-auto p-4">
            {editingDDL ? (
              <textarea
                value={ddlDraft}
                onChange={(e) => setDdlDraft(e.target.value)}
                spellCheck={false}
                className="w-full h-full text-xs font-mono bg-gray-950 text-gray-100 rounded-xl p-4 leading-relaxed resize-none outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <pre className="text-xs font-mono bg-gray-950 text-gray-100 rounded-xl p-4 overflow-x-auto leading-relaxed h-full">
                <DDLHighlight sql={generateDDL(schema, dbTarget)} />
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
