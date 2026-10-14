// Paths around the market, as a graph of waypoints. No drawing happens here.
// nodes: { name: [x, y] }   edges: [[nameA, nameB], ...]
export function buildGraph(nodes, edges) {
  const adjacency = {};
  Object.keys(nodes).forEach(id => { adjacency[id] = []; });
  edges.forEach(([a, b]) => {
    adjacency[a].push(b);
    adjacency[b].push(a);
  });
  return { nodes, adjacency };
}

export function pointOf(graph, id) {
  return { x: graph.nodes[id][0], y: graph.nodes[id][1] };
}

const distanceBetween = (graph, a, b) => {
  const p = pointOf(graph, a);
  const q = pointOf(graph, b);
  return Math.hypot(p.x - q.x, p.y - q.y);
};

// The shortest way between two waypoints, as a list of names including both ends.
// Returns null if there is no way.
export function findPath(graph, from, to) {
  const best = { [from]: 0 };
  const previous = { [from]: null };
  const open = new Set([from]);

  while (open.size > 0) {
    let current = null;
    open.forEach(id => { if (current === null || best[id] < best[current]) current = id; });
    open.delete(current);

    if (current === to) {
      const path = [];
      for (let id = to; id !== null; id = previous[id]) path.unshift(id);
      return path;
    }

    graph.adjacency[current].forEach(next => {
      const cost = best[current] + distanceBetween(graph, current, next);
      if (best[next] === undefined || cost < best[next]) {
        best[next] = cost;
        previous[next] = current;
        open.add(next);
      }
    });
  }

  return null;
}

// How far a path is, in pixels. Infinity if there is no path.
export function pathLength(graph, path) {
  if (!path) return Infinity;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceBetween(graph, path[i - 1], path[i]);
  return total;
}
