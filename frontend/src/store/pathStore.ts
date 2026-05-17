import { create } from 'zustand'
import type { GraphPanelId, GraphPathNode } from '../types/graph'

type PathStoreState = {
  hoveredPathNodeId: string | null
  activePathNodeId: string | null
  navigationRequest: {
    nodeId: string
    panelId: GraphPanelId
    timestamp: number
  } | null
}

type PathStoreActions = {
  setHoveredPathNodeId: (nodeId: string | null) => void
  setActivePathNodeId: (nodeId: string | null) => void
  requestNavigation: (payload: { nodeId: string; panelId: GraphPanelId }) => void
  clearNavigationRequest: () => void
}

export const usePathStore = create<PathStoreState & PathStoreActions>((set) => ({
  hoveredPathNodeId: null,
  activePathNodeId: null,
  navigationRequest: null,
  setHoveredPathNodeId: (hoveredPathNodeId) => set({ hoveredPathNodeId }),
  setActivePathNodeId: (activePathNodeId) => set({ activePathNodeId }),
  requestNavigation: ({ nodeId, panelId }) =>
    set({
      activePathNodeId: nodeId,
      navigationRequest: {
        nodeId,
        panelId,
        timestamp: Date.now(),
      },
    }),
  clearNavigationRequest: () => set({ navigationRequest: null }),
}))

export function resolvePathNodePanel(node: GraphPathNode): GraphPanelId {
  const category = node.category.trim().toLowerCase()
  const nodeId = node.id.trim().toLowerCase()

  if (category.includes('skill') || nodeId.startsWith('s')) {
    return 'skill'
  }

  if (category.includes('company') || nodeId.startsWith('c')) {
    return 'company'
  }

  return 'job'
}
