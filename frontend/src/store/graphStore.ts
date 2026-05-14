import { create } from 'zustand'
import type { CytoscapeEdge, FilterState, GraphResponse } from '../types/graphApi'
import type {
  GraphPanelId,
  GraphPath,
  KnowledgeGraphNodeEvent,
  SelectedGraphNode,
} from '../types/graph'

export type GraphStoreState = {
  focusArea: GraphPanelId
  selectedNode: SelectedGraphNode | null
  selectedNodes: Record<GraphPanelId, SelectedGraphNode[]>
  hoveredNode: SelectedGraphNode | null
  isGraphInteracting: boolean
  isDraggingGraph: boolean
  isZoomingGraph: boolean
  highlightedNodes: Record<GraphPanelId, string[]>
  hiddenNodes: Record<GraphPanelId, string[]>
  activeBridgeEdges: Record<GraphPanelId, CytoscapeEdge[]>
  searchKeyword: string
  searchResults: SelectedGraphNode[]
  activeFilters: FilterState
  focusedNode: SelectedGraphNode | null
  likedNodes: SelectedGraphNode[]
  dislikedNodes: SelectedGraphNode[]
  recommendedNodes: SelectedGraphNode[]
  currentPath: GraphPath | null
  currentExpandGraph: GraphResponse | null
}

export type GraphStoreActions = {
  setFocusArea: (area: GraphPanelId) => void
  selectNode: (node: SelectedGraphNode | null) => void
  toggleSelectedNode: (area: GraphPanelId, node: SelectedGraphNode) => void
  setHoveredNode: (node: SelectedGraphNode | null) => void
  setGraphInteraction: (state: {
    isGraphInteracting?: boolean
    isDraggingGraph?: boolean
    isZoomingGraph?: boolean
  }) => void
  setHighlightedNodes: (nodes: Record<GraphPanelId, string[]>) => void
  setHiddenNodes: (nodes: Record<GraphPanelId, string[]>) => void
  setActiveBridgeEdges: (panelId: GraphPanelId, edges: CytoscapeEdge[]) => void
  clearActiveBridgeEdges: (panelId?: GraphPanelId) => void
  setCurrentExpandGraph: (graph: GraphResponse | null) => void
  setSearchKeyword: (keyword: string) => void
  setSearchResults: (nodes: SelectedGraphNode[]) => void
  setActiveFilters: (filters: Partial<FilterState>) => void
  resetActiveFilters: () => void
  setFocusedNode: (node: SelectedGraphNode | null) => void
  likeNode: (node: SelectedGraphNode) => void
  dislikeNode: (node: SelectedGraphNode) => void
  unlikeNode: (nodeId: string) => void
  undislikeNode: (nodeId: string) => void
  setRecommendedNodes: (nodes: SelectedGraphNode[]) => void
  addRecommendedNode: (node: SelectedGraphNode) => void
  removeRecommendedNode: (nodeId: string) => void
  updateCurrentPath: (path: GraphPath | null) => void
  clearSelection: () => void
  clearPreferences: () => void
  resetGraphState: () => void
}

export type GraphStore = GraphStoreState & GraphStoreActions

const defaultActiveFilters: FilterState = {}

const initialGraphState: GraphStoreState = {
  focusArea: 'job',
  selectedNode: null,
  selectedNodes: {
    skill: [],
    job: [],
    company: [],
  },
  hoveredNode: null,
  isGraphInteracting: false,
  isDraggingGraph: false,
  isZoomingGraph: false,
  highlightedNodes: {
    skill: [],
    job: [],
    company: [],
  },
  hiddenNodes: {
    skill: [],
    job: [],
    company: [],
  },
  activeBridgeEdges: {
    skill: [],
    job: [],
    company: [],
  },
  searchKeyword: '',
  searchResults: [],
  activeFilters: defaultActiveFilters,
  focusedNode: null,
  likedNodes: [],
  dislikedNodes: [],
  recommendedNodes: [],
  currentPath: null,
  currentExpandGraph: null,
}

function isSameNode(left: SelectedGraphNode, right: SelectedGraphNode) {
  return left.id === right.id
}

function upsertNode(list: SelectedGraphNode[], node: SelectedGraphNode) {
  if (list.some((item) => isSameNode(item, node))) {
    return list
  }

  return [...list, node]
}

function removeNode(list: SelectedGraphNode[], nodeId: string) {
  return list.filter((item) => item.id !== nodeId)
}

export const useGraphStore = create<GraphStore>((set) => ({
  ...initialGraphState,

  setFocusArea: (area) => set({ focusArea: area }),

  selectNode: (node) => set({ selectedNode: node }),

  toggleSelectedNode: (area, node) =>
    set((state) => {
      const exists = state.selectedNodes[area].some((item) => item.id === node.id)

      return {
        selectedNode: node,
        selectedNodes: {
          ...state.selectedNodes,
          [area]: exists
            ? state.selectedNodes[area].filter((item) => item.id !== node.id)
            : [...state.selectedNodes[area], node],
        },
      }
    }),

  setHoveredNode: (node) => set({ hoveredNode: node }),

  setGraphInteraction: (interactionState) =>
    set((state) => ({
      isGraphInteracting:
        interactionState.isGraphInteracting ?? state.isGraphInteracting,
      isDraggingGraph: interactionState.isDraggingGraph ?? state.isDraggingGraph,
      isZoomingGraph: interactionState.isZoomingGraph ?? state.isZoomingGraph,
    })),

  setHighlightedNodes: (nodes) => set({ highlightedNodes: nodes }),

  setHiddenNodes: (nodes) => set({ hiddenNodes: nodes }),

  setActiveBridgeEdges: (panelId, edges) =>
    set((state) => ({
      activeBridgeEdges: {
        ...state.activeBridgeEdges,
        [panelId]: edges,
      },
    })),

  clearActiveBridgeEdges: (panelId) =>
    set((state) => ({
      activeBridgeEdges: panelId
        ? {
            ...state.activeBridgeEdges,
            [panelId]: [],
          }
        : {
            skill: [],
            job: [],
            company: [],
          },
    })),

  setCurrentExpandGraph: (graph) => set({ currentExpandGraph: graph }),

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  setSearchResults: (nodes) => set({ searchResults: nodes }),

  setActiveFilters: (filters) =>
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        ...filters,
      },
    })),

  resetActiveFilters: () => set({ activeFilters: { ...defaultActiveFilters } }),

  setFocusedNode: (node) => set({ focusedNode: node }),

  likeNode: (node) =>
    set((state) => ({
      likedNodes: upsertNode(state.likedNodes, node),
      dislikedNodes: removeNode(state.dislikedNodes, node.id),
    })),

  dislikeNode: (node) =>
    set((state) => ({
      dislikedNodes: upsertNode(state.dislikedNodes, node),
      likedNodes: removeNode(state.likedNodes, node.id),
    })),

  unlikeNode: (nodeId) =>
    set((state) => ({
      likedNodes: removeNode(state.likedNodes, nodeId),
    })),

  undislikeNode: (nodeId) =>
    set((state) => ({
      dislikedNodes: removeNode(state.dislikedNodes, nodeId),
    })),

  setRecommendedNodes: (nodes) => set({ recommendedNodes: nodes }),

  addRecommendedNode: (node) =>
    set((state) => ({
      recommendedNodes: upsertNode(state.recommendedNodes, node),
    })),

  removeRecommendedNode: (nodeId) =>
    set((state) => ({
      recommendedNodes: removeNode(state.recommendedNodes, nodeId),
    })),

  updateCurrentPath: (path) => set({ currentPath: path }),

  clearSelection: () =>
    set({
      selectedNode: null,
      selectedNodes: {
        skill: [],
        job: [],
        company: [],
      },
      hoveredNode: null,
      isGraphInteracting: false,
      isDraggingGraph: false,
      isZoomingGraph: false,
      highlightedNodes: {
        skill: [],
        job: [],
        company: [],
      },
      hiddenNodes: {
        skill: [],
        job: [],
        company: [],
      },
      activeBridgeEdges: {
        skill: [],
        job: [],
        company: [],
      },
      searchResults: [],
      focusedNode: null,
      currentPath: null,
      currentExpandGraph: null,
    }),

  clearPreferences: () =>
    set({
      likedNodes: [],
      dislikedNodes: [],
      recommendedNodes: [],
    }),

  resetGraphState: () =>
    set({
      ...initialGraphState,
      activeFilters: { ...defaultActiveFilters },
    }),
}))

export function toSelectedGraphNode(
  area: GraphPanelId,
  node: KnowledgeGraphNodeEvent,
): SelectedGraphNode {
  return {
    id: node.id,
    label: node.label,
    category: node.category,
    graphArea: area,
  }
}
