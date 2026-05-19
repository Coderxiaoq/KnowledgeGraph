import {
  PANEL_TO_CATEGORY_LABEL,
  toCytoscapeGraph,
} from '../graph/data'
import { getNodesByCategory } from './graphApi'
import {
  PANEL_TO_CATEGORY_LABEL,
  toCytoscapeGraph,
} from '../graph/data'
import { getNodesByCategory } from './graphApi'
import type { GraphData, GraphPanelId, HomeContent } from '../types/graph'

const graphCache = new Map<GraphPanelId, GraphData>()

const EMPTY_GRAPH: GraphData = {
  nodes: [],
  edges: [],
}

const graphCache = new Map<GraphPanelId, GraphData>()

const EMPTY_GRAPH: GraphData = {
  nodes: [],
  edges: [],
}

export function getHomeContent(): HomeContent {
  return {
    title: '知识工程就业规划推荐系统',
    subtitle:
      '面向职业目标、技能要求、课程路径和岗位推荐的知识图谱前端工作台，适合继续扩展推荐、画像和路径分析能力。',
    stack: ['Vite', 'React', 'TypeScript', 'TailwindCSS', 'Zustand', 'Framer Motion', 'Cytoscape.js'],
  }
}

async function getCategoryGraph(
  panelId: GraphPanelId,
  signal?: AbortSignal,
): Promise<GraphData> {
  const graph = await getNodesByCategory(PANEL_TO_CATEGORY_LABEL[panelId], {
    limit: 180,
    signal,
  })
  const transformed = toCytoscapeGraph(graph)
  graphCache.set(panelId, transformed)
  return transformed
}

export async function getSkillGraph(signal?: AbortSignal) {
  return getCategoryGraph('skill', signal)
}

export async function getRoleGraph(signal?: AbortSignal) {
  return getCategoryGraph('job', signal)
}

export async function getCompanyGraph(signal?: AbortSignal) {
  return getCategoryGraph('company', signal)
}

async function getCategoryGraph(
  panelId: GraphPanelId,
  signal?: AbortSignal,
): Promise<GraphData> {
  const graph = await getNodesByCategory(PANEL_TO_CATEGORY_LABEL[panelId], {
    limit: 180,
    signal,
  })
  const transformed = toCytoscapeGraph(graph)
  graphCache.set(panelId, transformed)
  return transformed
}

export async function getSkillGraph(signal?: AbortSignal) {
  return getCategoryGraph('skill', signal)
}

export async function getRoleGraph(signal?: AbortSignal) {
  return getCategoryGraph('job', signal)
}

export async function getCompanyGraph(signal?: AbortSignal) {
  return getCategoryGraph('company', signal)
}

export function getGraphByPanel(panelId: GraphPanelId): GraphData {
  return graphCache.get(panelId) ?? EMPTY_GRAPH
}

export function setGraphByPanel(panelId: GraphPanelId, graph: GraphData) {
  graphCache.set(panelId, graph)
}

export function setGraphsByPanels(graphs: Partial<Record<GraphPanelId, GraphData>>) {
  Object.entries(graphs).forEach(([panelId, graph]) => {
    if (!graph) {
      return
    }

    graphCache.set(panelId as GraphPanelId, graph)
  })
}

export function getPanelGraphLoader(panelId: GraphPanelId) {
  if (panelId === 'skill') {
    return getSkillGraph
    return getSkillGraph
  }

  if (panelId === 'company') {
    return getCompanyGraph
    return getCompanyGraph
  }

  return getRoleGraph
  return getRoleGraph
}
