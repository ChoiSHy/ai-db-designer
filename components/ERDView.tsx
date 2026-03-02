"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SchemaJSON, Table } from "@/lib/types";
import { SchemaDiff, getTableDiffStatus } from "@/lib/schemaDiff";
import { ERDTableNode } from "./ERDTableNode";
import { ERDEdge } from "./ERDEdge";

// ─── 레이아웃 상수 ───────────────────────────────────────
const NODE_WIDTH = 230;
const HEADER_HEIGHT = 48;
const COLUMN_HEIGHT = 30;
const H_GAP = 160;
const V_GAP = 80;
const COLS_PER_ROW = 3;

function estimateNodeHeight(table: Table): number {
  return HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT;
}

/** 테이블 배열 → React Flow Node 배열 (그리드 자동 배치) */
function buildNodes(tables: Table[], diff: SchemaDiff | null): Node[] {
  const rowMaxHeights: number[] = [];
  tables.forEach((t, i) => {
    const row = Math.floor(i / COLS_PER_ROW);
    const h = estimateNodeHeight(t);
    rowMaxHeights[row] = Math.max(rowMaxHeights[row] ?? 0, h);
  });

  const rowY: number[] = [];
  rowMaxHeights.forEach((h, r) => {
    rowY[r] = r === 0 ? 0 : rowY[r - 1] + rowMaxHeights[r - 1] + V_GAP;
  });

  return tables.map((table, i) => ({
    id: table.name,
    type: "erdTable",
    position: {
      x: (i % COLS_PER_ROW) * (NODE_WIDTH + H_GAP),
      y: rowY[Math.floor(i / COLS_PER_ROW)],
    },
    data: { table, diffStatus: getTableDiffStatus(diff, table.name) },
  }));
}

/** 테이블의 PK 컬럼명 반환 */
function findPkCol(tables: Table[], tableName: string): string {
  const table = tables.find((t) => t.name === tableName);
  return table?.columns.find((c) => c.pk)?.name ?? "id";
}

/** FK 관계 → React Flow Edge 배열 */
function buildEdges(tables: Table[]): Edge[] {
  const tableSet = new Set(tables.map((t) => t.name));
  const edges: Edge[] = [];

  tables.forEach((table) => {
    table.columns.forEach((col) => {
      if (!col.fk || !tableSet.has(col.fk)) return;

      edges.push({
        id: `${table.name}.${col.name}→${col.fk}`,
        source: table.name,
        target: col.fk,
        type: "erdEdge",                         // ★ 커스텀 엣지 사용
        label: col.name,
        data: {
          fkCol: col.name,                       // ERDEdge 가 경로 계산에 사용
          pkCol: findPkCol(tables, col.fk),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#6366f1",
          width: 14,
          height: 14,
        },
        style: { stroke: "#818cf8", strokeWidth: 1.5 },
      });
    });
  });

  return edges;
}

const nodeTypes: NodeTypes = { erdTable: ERDTableNode };
const edgeTypes: EdgeTypes = { erdEdge: ERDEdge };   // ★ 커스텀 엣지 등록

interface ERDViewProps {
  schema: SchemaJSON;
  lastDiff: SchemaDiff | null;
}

export function ERDView({ schema, lastDiff }: ERDViewProps) {
  const nodes = useMemo(() => buildNodes(schema.tables, lastDiff), [schema, lastDiff]);
  const edges = useMemo(() => buildEdges(schema.tables), [schema]);

  const flowKey = schema.tables.map((t) => t.name).join("|");

  if (schema.tables.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <div className="text-4xl mb-3">🔗</div>
        <p className="text-sm">AI와 대화하면 ERD가 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <ReactFlow
      key={flowKey}
      defaultNodes={nodes}
      defaultEdges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#d1d5db"
      />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor="#6366f1"
        maskColor="rgba(0,0,0,0.04)"
        style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        pannable
        zoomable
      />
    </ReactFlow>
  );
}
