import { create } from 'zustand'
import type { GraphPanelId } from '../types/graph'

type AppState = {
  focusedPanel: GraphPanelId | null
  activeNodeIds: Record<GraphPanelId, string>
  setFocusedPanel: (panelId: GraphPanelId | null) => void
  setActiveNodeId: (panelId: GraphPanelId, nodeId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  focusedPanel: null,
  activeNodeIds: {
    skill: 'skill-map',
    job: 'job-role',
    company: 'company-target',
  },
  setFocusedPanel: (focusedPanel) => set({ focusedPanel }),
  setActiveNodeId: (panelId, nodeId) =>
    set((state) => ({
      activeNodeIds: {
        ...state.activeNodeIds,
        [panelId]: nodeId,
      },
    })),
}))
