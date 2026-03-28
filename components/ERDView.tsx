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
import { applyDagreLayout, NODE_WIDTH, nodeHeight } from "@/lib/erdLayout";
import { ERDTableNode } from "./ERDTableNode";
import { ERDEdge } from "./ERDEdge";

/** 테이블 배열 → dagre 레이아웃 적용된 Node 배열 */
function buildNodes(tables: Table[], diff: SchemaDiff | null, edges: Edge[]): Node[] {
  const raw: Node[] = tables.map((table) => ({
    id: table.name,
    type: "erdTable",
    position: { x: 0, y: 0 },           // dagre가 덮어씀
    data: { table, diffStatus: getTableDiffStatus(diff, table.name) },
    width:  NODE_WIDTH,
    height: nodeHeight(table),
  }));
  return applyDagreLayout(raw, edges, tables);
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
  const edges = useMemo(() => buildEdges(schema.tables), [schema]);
  const nodes = useMemo(() => buildNodes(schema.tables, lastDiff, edges), [schema, lastDiff, edges]);

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
