import dagre from '@dagrejs/dagre';

interface GraphNode {
  id: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 200;

export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 24 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const { x, y } = g.node(node.id);
    positions[node.id] = {
      x: x - NODE_WIDTH / 2,
      y: y - NODE_HEIGHT / 2,
    };
  }

  return positions;
}
