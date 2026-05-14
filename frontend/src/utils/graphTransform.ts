import type {
  CytoscapeEdge,
  CytoscapeElements,
  CytoscapeNode,
  GraphEdge,
  GraphNode,
  GraphResponse,
} from '../types/graphApi'

export function transformNodes(nodes: GraphNode[]): CytoscapeNode[] {
  return nodes.map((node) => ({
    data: {
      id: node.id,
      label: String(node.properties.name ?? node.id),
      type: node.label,
      properties: node.properties,
    },
  }))
}

export function transformEdges(edges: GraphEdge[]): CytoscapeEdge[] {
  return edges.map((edge) => ({
    data: {
      id: `${edge.source}-${edge.relation}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.relation,
      properties: edge.properties,
    },
  }))
}

export function transformGraphData(graph: GraphResponse): CytoscapeElements {
  return [...transformNodes(graph.nodes), ...transformEdges(graph.edges)]
}
