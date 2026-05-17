import type { GraphPanelId } from '../types/graph'
import type { GraphEdge, GraphNode, GraphResponse } from '../types/graphApi'

export const NODE_SIZE = 42
export const NODE_LABEL_MAX_WIDTH = 34

export const PANEL_TO_CATEGORY_LABEL: Record<GraphPanelId, 'Skill' | 'Role' | 'Company'> = {
  skill: 'Skill',
  job: 'Role',
  company: 'Company',
}

export const CATEGORY_LABEL_TO_PANEL: Record<string, GraphPanelId> = {
  skill: 'skill',
  role: 'job',
  company: 'company',
}

export function normalizeGraphToken(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function resolvePanelByLabel(label: string): GraphPanelId | null {
  const normalized = normalizeGraphToken(label)
  return CATEGORY_LABEL_TO_PANEL[normalized] ?? null
}

export function getNodeDisplayLabel(node: GraphNode) {
  const name = node.properties.name
  return typeof name === 'string' && name.trim() ? name : node.id
}

export function toCytoscapeNode(node: GraphNode) {
  return {
    data: {
      id: node.id,
      label: getNodeDisplayLabel(node),
      type: node.label,
      category: node.label,
      width: NODE_SIZE,
      height: NODE_SIZE,
      textMaxWidth: NODE_LABEL_MAX_WIDTH,
      ...node.properties,
    },
  }
}

export function toCytoscapeEdge(edge: GraphEdge) {
  return {
    data: {
      id: `${edge.source}-${edge.relation}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      label: edge.relation,
      ...edge.properties,
    },
  }
}

export function toCytoscapeGraph(graph: GraphResponse) {
  return {
    nodes: graph.nodes.map(toCytoscapeNode),
    edges: graph.edges.map(toCytoscapeEdge),
  }
}
