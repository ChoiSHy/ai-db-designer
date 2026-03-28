import dagre from "@dagrejs/dagre";
import { Node, Edge } from "@xyflow/react";
import { Table } from "./types";

export const NODE_WIDTH   = 240;
const HEADER_HEIGHT = 48;
const COLUMN_HEIGHT = 30;

export function nodeHeight(table: Table): number {
  return HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT;
}

/**
 * dagre를 사용해 노드 위치를 자동 계산한다.
 * rankdir: TB (위→아래) — FK 부모가 위, 자식이 아래
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  tables: Table[],
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    const table = tables.find((t) => t.name === node.id);
    g.setNode(node.id, {
      width:  NODE_WIDTH,
      height: table ? nodeHeight(table) : 120,
    });
  });

  edges.forEach((edge) => {
    // 부모(참조 대상)가 위에 오도록 방향을 뒤집어 전달
    g.setEdge(edge.target, edge.source);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y, width, height } = g.node(node.id);
    return {
      ...node,
      position: {
        // dagre는 노드 중심 좌표를 반환하므로 절반씩 뺀다
        x: x - width  / 2,
        y: y - height / 2,
      },
    };
  });
}
