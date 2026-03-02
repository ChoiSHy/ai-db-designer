"use client";

import {
  EdgeProps,
  useInternalNode,
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
  Position,
} from "@xyflow/react";
import { Table } from "@/lib/types";

// ERDTableNode 의 CSS 값과 반드시 일치해야 함
const HEADER_HEIGHT = 42; // header px (py-2.5 + 1줄 텍스트)
const COL_HEIGHT = 29;    // column row px (py-[7px] + 텍스트)

interface ERDEdgeData {
  fkCol: string; // source 테이블의 FK 컬럼명
  pkCol: string; // target 테이블의 PK 컬럼명
}

export function ERDEdge({
  id,
  source,
  target,
  data,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode || !data) return null;

  const { fkCol, pkCol } = data as unknown as ERDEdgeData;

  const sourceTable = (sourceNode.data as { table: Table }).table;
  const targetTable = (targetNode.data as { table: Table }).table;

  const fkIdx = sourceTable.columns.findIndex((c) => c.name === fkCol);
  const pkIdx = targetTable.columns.findIndex((c) => c.name === pkCol);

  if (fkIdx === -1 || pkIdx === -1) return null;

  // 노드의 절대 좌표 + 크기
  const sx = sourceNode.internals.positionAbsolute.x;
  const sy = sourceNode.internals.positionAbsolute.y;
  const tx = targetNode.internals.positionAbsolute.x;
  const ty = targetNode.internals.positionAbsolute.y;
  const sw = sourceNode.measured?.width ?? 220;
  const tw = targetNode.measured?.width ?? 220;

  // ★ 중심 X 비교로 source가 왼쪽인지 오른쪽인지 판단
  const isSourceLeft = sx + sw / 2 < tx + tw / 2;

  // 엣지 시작점 (FK 컬럼 행 중앙)
  const sourceX = isSourceLeft ? sx + sw : sx;
  const sourceY = sy + HEADER_HEIGHT + fkIdx * COL_HEIGHT + COL_HEIGHT / 2;

  // 엣지 도착점 (PK 컬럼 행 중앙)
  const targetX = isSourceLeft ? tx : tx + tw;
  const targetY = ty + HEADER_HEIGHT + pkIdx * COL_HEIGHT + COL_HEIGHT / 2;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: isSourceLeft ? Position.Right : Position.Left,
    targetX,
    targetY,
    targetPosition: isSourceLeft ? Position.Left : Position.Right,
    borderRadius: 10,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "monospace",
              color: "#4f46e5",
              whiteSpace: "nowrap",
              pointerEvents: "all",
            }}
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
