"use client";

import { useMemo } from "react";
import { SchemaJSON } from "@/lib/types";
import { validateSchema, ValidationIssue, IssueSeverity } from "@/lib/validateSchema";

// ── 아이콘 & 스타일 ────────────────────────────────────────────
const SEVERITY_CONFIG: Record<IssueSeverity, {
  icon: string;
  label: string;
  rowCls: string;
  badgeCls: string;
  iconCls: string;
}> = {
  error: {
    icon: "✕",
    label: "오류",
    rowCls: "border-red-200 bg-red-50",
    badgeCls: "bg-red-100 text-red-700",
    iconCls: "text-red-500",
  },
  warning: {
    icon: "!",
    label: "경고",
    rowCls: "border-amber-200 bg-amber-50",
    badgeCls: "bg-amber-100 text-amber-700",
    iconCls: "text-amber-500",
  },
  info: {
    icon: "i",
    label: "제안",
    rowCls: "border-blue-200 bg-blue-50/60",
    badgeCls: "bg-blue-100 text-blue-600",
    iconCls: "text-blue-500",
  },
};

function SeverityBadge({ count, severity }: { count: number; severity: IssueSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  if (count === 0) return null;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>
      {cfg.label} {count}
    </span>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const cfg = SEVERITY_CONFIG[issue.severity];
  return (
    <div className={`flex gap-2.5 px-4 py-3 border rounded-xl ${cfg.rowCls}`}>
      {/* 아이콘 */}
      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
        issue.severity === "error"   ? "border-red-400 text-red-500" :
        issue.severity === "warning" ? "border-amber-400 text-amber-500" :
                                       "border-blue-400 text-blue-500"
      }`}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        {/* 테이블/컬럼 */}
        {issue.table && (
          <p className="text-[11px] font-semibold text-gray-500 mb-0.5 font-mono">
            {issue.table}{issue.column ? ` › ${issue.column}` : ""}
          </p>
        )}
        {/* 메시지 */}
        <p className="text-xs text-gray-700 leading-relaxed">{issue.message}</p>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
interface Props {
  schema: SchemaJSON;
}

export function ValidationView({ schema }: Props) {
  const result = useMemo(() => validateSchema(schema), [schema]);

  if (schema.tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm">스키마를 생성한 후 검증할 수 있습니다</p>
      </div>
    );
  }

  const { issues, errorCount, warningCount, infoCount } = result;
  const total = errorCount + warningCount + infoCount;

  const errors   = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos    = issues.filter((i) => i.severity === "info");

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 요약 배너 */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        errorCount > 0   ? "bg-red-50 border-red-200" :
        warningCount > 0 ? "bg-amber-50 border-amber-200" :
                           "bg-green-50 border-green-200"
      }`}>
        <span className="text-xl">
          {errorCount > 0 ? "🚨" : warningCount > 0 ? "⚠️" : "✅"}
        </span>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${
            errorCount > 0 ? "text-red-700" : warningCount > 0 ? "text-amber-700" : "text-green-700"
          }`}>
            {errorCount > 0
              ? `${errorCount}개의 오류를 수정해야 합니다`
              : warningCount > 0
              ? "오류 없음 — 경고 사항을 검토하세요"
              : "검증 통과 — 스키마에 문제가 없습니다"}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {schema.tables.length}개 테이블 · {schema.tables.reduce((s, t) => s + t.columns.length, 0)}개 컬럼 검사 완료
          </p>
        </div>
        <div className="flex gap-1.5">
          <SeverityBadge count={errorCount}   severity="error"   />
          <SeverityBadge count={warningCount} severity="warning" />
          <SeverityBadge count={infoCount}    severity="info"    />
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          발견된 문제가 없습니다 🎉
        </div>
      )}

      {/* 오류 */}
      {errors.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
            오류 ({errors.length})
          </h3>
          <div className="space-y-2">
            {errors.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        </section>
      )}

      {/* 경고 */}
      {warnings.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block" />
            경고 ({warnings.length})
          </h3>
          <div className="space-y-2">
            {warnings.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        </section>
      )}

      {/* 제안 */}
      {infos.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full inline-block" />
            제안 ({infos.length})
          </h3>
          <div className="space-y-2">
            {infos.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        </section>
      )}
    </div>
  );
}
