import { companyGraph, jobGraph, skillGraph } from '../graph/data'
import type { GraphData, GraphPanelId, HomeContent } from '../types/graph'

export function getHomeContent(): HomeContent {
  return {
    title: '知识工程就业规划推荐系统',
    subtitle:
      '面向职业目标、技能要求、课程路径和岗位推荐的知识图谱前端工作台，适合继续扩展推荐、画像和路径分析能力。',
    stack: ['Vite', 'React', 'TypeScript', 'TailwindCSS', 'Zustand', 'Framer Motion', 'Cytoscape.js'],
  }
}

export function getGraphByPanel(panelId: GraphPanelId): GraphData {
  if (panelId === 'skill') {
    return skillGraph
  }

  if (panelId === 'company') {
    return companyGraph
  }

  return jobGraph
}
