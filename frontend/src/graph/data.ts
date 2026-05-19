import type { GraphPanelId } from '../types/graph'
import type { GraphEdge, GraphNode, GraphResponse } from '../types/graphApi'

export const NODE_SIZE = 54
export const NODE_LABEL_MAX_WIDTH = 46

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

const CATEGORY_COLOR_MAP: Record<
  string,
  {
    baseColor: string
    borderColor: string
    textColor: string
    shadowColor: string
    hoverColor: string
    hoverBorderColor: string
    highlightColor: string
    highlightBorderColor: string
  }
> = {
  skill: {
    baseColor: '#67B7FF',
    borderColor: '#3F8EF3',
    textColor: '#10233D',
    shadowColor: '#67B7FF',
    hoverColor: '#7CC4FF',
    hoverBorderColor: '#4B98FA',
    highlightColor: '#7CC4FF',
    highlightBorderColor: '#3F8EF3',
  },
  role: {
    baseColor: '#00BC7D',
    borderColor: '#00A06A',
    textColor: '#123019',
    shadowColor: '#00BC7D',
    hoverColor: '#00D18B',
    hoverBorderColor: '#00BC7D',
    highlightColor: '#22D39A',
    highlightBorderColor: '#00BC7D',
  },
  company: {
    baseColor: '#FFB84D',
    borderColor: '#F59E0B',
    textColor: '#3F2500',
    shadowColor: '#FFB84D',
    hoverColor: '#FFC76E',
    hoverBorderColor: '#F59E0B',
    highlightColor: '#FFC76E',
    highlightBorderColor: '#F59E0B',
  },
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
  if (typeof name === 'string' && name.trim()) {
    return name.length > 8 ? name.slice(0, 8) + '...' : name
  }
  return node.id
}

function getNodePalette(label: string) {
  return (
    CATEGORY_COLOR_MAP[normalizeGraphToken(label)] ?? CATEGORY_COLOR_MAP.role
  )
}

export function toCytoscapeNode(node: GraphNode) {
  const palette = getNodePalette(node.label)
  const name = node.properties.name
  return {
    data: {
      id: node.id,
      label: getNodeDisplayLabel(node), // 截断显示
      fullLabel: typeof name === 'string' && name.trim() ? name : node.id, // 全称
      type: node.label,
      category: node.label,
      baseColor: palette.baseColor,
      borderColor: palette.borderColor,
      textColor: palette.textColor,
      shadowColor: palette.shadowColor,
      hoverColor: palette.hoverColor,
      hoverBorderColor: palette.hoverBorderColor,
      highlightColor: palette.highlightColor,
      highlightBorderColor: palette.highlightBorderColor,
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
