interface GraphNode {
  id: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

const DISTANCES = [320, 260, 210, 175, 150];

export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  const childrenOf: Record<string, string[]> = {};
  const parentOf: Record<string, string> = {};

  for (const edge of edges) {
    if (!childrenOf[edge.source]) childrenOf[edge.source] = [];
    childrenOf[edge.source].push(edge.target);
    parentOf[edge.target] = edge.source;
  }

  const root = nodes.find((n) => !parentOf[n.id]);
  if (!root) return {};

  const positions: Record<string, { x: number; y: number }> = {};
  const angles: Record<string, number> = {};
  const depths: Record<string, number> = {};

  positions[root.id] = { x: 0, y: 0 };
  angles[root.id] = 0;
  depths[root.id] = 0;

  const queue: string[] = [root.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenOf[current] || [];
    if (children.length === 0) continue;

    const depth = depths[current];
    const parentAngle = angles[current];
    const parentPos = positions[current];
    const dist = DISTANCES[Math.min(depth + 1, DISTANCES.length - 1)];
    const childAngles = getChildAngles(depth, children.length, parentAngle);

    children.forEach((childId, i) => {
      const angle = childAngles[i];
      positions[childId] = {
        x: parentPos.x + Math.cos(angle) * dist,
        y: parentPos.y + Math.sin(angle) * dist,
      };
      angles[childId] = angle;
      depths[childId] = depth + 1;
      queue.push(childId);
    });
  }

  return positions;
}

function getChildAngles(parentDepth: number, count: number, parentAngle: number): number[] {
  if (count === 0) return [];

  if (parentDepth === 0) {
    // 루트에서는 360° 균등 분배
    return Array.from(
      { length: count },
      (_, i) => (i / count) * 2 * Math.PI - Math.PI / 2
    );
  }

  // 자식 노드는 부모 방향에서 ±55° 범위로 퍼짐
  const spread = (Math.PI * 11) / 18; // ~110°
  if (count === 1) return [parentAngle];
  return Array.from(
    { length: count },
    (_, i) => parentAngle - spread / 2 + (i / (count - 1)) * spread
  );
}
