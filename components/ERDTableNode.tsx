"use client";

import { Handle, Position } from "@xyflow/react";
import { Table } from "@/lib/types";
import { TableDiffStatus } from "@/lib/schemaDiff";

interface ERDTableNodeData {
  table: Table;
  diffStatus?: TableDiffStatus;
}

// diff 상태별 헤더 그라디언트 & 테두리 색상
const HEADER_GRADIENT: Record<TableDiffStatus, string> = {
  added:    "from-green-600  to-green-500",
  modified: "from-amber-500  to-amber-400",
  removed:  "from-red-600    to-red-500",
  none:     "from-indigo-600 to-indigo-500",
};

const BORDER_COLOR: Record<TableDiffStatus, string> = {
  added:    "#86efac",   // green-300
  modified: "#fcd34d",   // amber-300
  removed:  "#fca5a5",   // red-300
  none:     "#e0e7ff",   // indigo-100
};

const DIFF_BADGE: Record<TableDiffStatus, { label: string; cls: string } | null> = {
  added:    { label: "NEW",  cls: "bg-green-200 text-green-800" },
  modified: { label: "수정", cls: "bg-amber-200 text-amber-800" },
  removed:  { label: "삭제", cls: "bg-red-200   text-red-800"   },
  none:     null,
};

export function ERDTableNode({ data }: { data: ERDTableNodeData }) {
  const { table, diffStatus = "none" } = data;
  const badge = DIFF_BADGE[diffStatus];

  return (
    <div
      className="bg-white rounded-xl shadow-lg overflow-visible"
      style={{ minWidth: 220, border: `1.5px solid ${BORDER_COLOR[diffStatus]}` }}
    >
      {/* 핸들 (투명 - 커스텀 ERDEdge가 직접 경로 계산) */}
      <Handle type="target" position={Position.Left}  style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />

      {/* 테이블 헤더 */}
      <div className={`px-3 py-2.5 bg-gradient-to-r ${HEADER_GRADIENT[diffStatus]} rounded-t-xl`}>
        <div className="flex items-center gap-1.5">
          <p className="text-white font-bold text-sm font-mono tracking-wide flex-1 truncate">
            {table.name}
          </p>
          {badge && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        {table.comment && (
          <p className="text-white/70 text-[10px] mt-0.5 truncate">{table.comment}</p>
        )}
      </div>

      {/* 컬럼 목록 */}
      <div className="divide-y divide-gray-100 rounded-b-xl overflow-hidden">
        {table.columns.map((col) => (
          <div
            key={col.name}
            className={`relative flex items-center gap-2 px-3 py-[7px] text-xs ${
              col.pk ? "bg-amber-50" : col.fk ? "bg-indigo-50/60" : "bg-white"
            }`}
          >
            {/* PK / FK 뱃지 */}
            <span className="w-6 flex-shrink-0 text-center">
              {col.pk && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-200 px-1 py-0.5 rounded">
                  PK
                </span>
              )}
              {!col.pk && col.fk && (
                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-200 px-1 py-0.5 rounded">
                  FK
                </span>
              )}
            </span>

            {/* 컬럼명 */}
            <span
              className={`font-mono flex-1 truncate ${
                col.pk ? "font-semibold text-gray-900" : "text-gray-700"
              }`}
            >
              {col.name}
            </span>

            {/* 타입 */}
            <span className="text-purple-600 font-mono text-[10px] flex-shrink-0">
              {col.type}
            </span>

            {/* NN / UQ */}
            <div className="flex gap-0.5 flex-shrink-0">
              {col.notNull && (
                <span className="text-[9px] text-orange-500 font-bold">N</span>
              )}
              {col.unique && (
                <span className="text-[9px] text-green-600 font-bold">U</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
