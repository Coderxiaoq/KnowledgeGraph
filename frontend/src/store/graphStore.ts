import { create } from 'zustand'
import {
  buildPreferenceHiddenIds,
  rankNodesByPreference,
  type RecommendationScore,
} from '../graph/preferenceEngine'
import { getGraphByPanel } from '../services/homeService'
import type {
  CytoscapeEdge,
  FilterState,
  GraphFilterState,
  GraphResponse,
} from '../types/graphApi'
import type {
  GraphData,
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
  backendFilterState: GraphFilterState
  filterMatchedNodes: Record<GraphPanelId, string[]>
  activeFilterKind: 'location' | 'salary' | null
  isFilterMode: boolean
  filterRefreshKey: number
  graphReloadKey: number
  focusedNode: SelectedGraphNode | null
  currentFocusColumn: GraphPanelId
  processedColumns: GraphPanelId[]
  pathContextNodes: SelectedGraphNode[]
  likedNodes: SelectedGraphNode[]
  likedNodeIds: string[]
  dislikedNodes: SelectedGraphNode[]
  dislikedNodeIds: string[]
  recommendedNodes: SelectedGraphNode[]
  recommendationScores: Record<string, RecommendationScore>
  currentPath: GraphPath | null
  currentExpandGraph: GraphResponse | null
}

export type GraphStoreActions = {
  setFocusArea: (area: GraphPanelId) => void
  selectNode: (node: SelectedGraphNode | null) => void
  toggleSelectedNode: (area: GraphPanelId, node: SelectedGraphNode) => void
  clearPanelSelection: (area: GraphPanelId) => void
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
  setBackendFilterState: (filters: GraphFilterState) => void
  setFilterMatchedNodes: (nodes: Record<GraphPanelId, string[]>) => void
  setActiveFilterKind: (kind: 'location' | 'salary' | null) => void
  setFilterMode: (enabled: boolean) => void
  bumpFilterRefreshKey: () => void
  bumpGraphReloadKey: () => void
  resetActiveFilters: () => void
  setFocusedNode: (node: SelectedGraphNode | null) => void
  setCurrentFocusColumn: (area: GraphPanelId) => void
  applyColumnContext: (area: GraphPanelId, nodes?: SelectedGraphNode[]) => void
  updatePathContext: (nodes: SelectedGraphNode[]) => void
  likeNode: (node: SelectedGraphNode) => Promise<void>
  dislikeNode: (node: SelectedGraphNode) => Promise<void>
  unlikeNode: (nodeId: string) => Promise<void>
  undislikeNode: (nodeId: string) => Promise<void>
  cycleNodePreference: (node: SelectedGraphNode) => Promise<'positive' | 'negative'>
  clearNodePreference: (nodeId: string) => Promise<void>
  recalculateRecommendations: (
    nodes?: SelectedGraphNode[],
    options?: { hideDisliked?: boolean },
  ) => SelectedGraphNode[]
  syncPreferenceState: (options?: { hideDisliked?: boolean }) => Promise<void>
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
  backendFilterState: {
    node_filters: [],
    edge_filters: [],
  },
  filterMatchedNodes: {
    skill: [],
    job: [],
    company: [],
  },
  activeFilterKind: null,
  isFilterMode: false,
  filterRefreshKey: 0,
  graphReloadKey: 0,
  focusedNode: null,
  currentFocusColumn: 'job',
  processedColumns: [],
  pathContextNodes: [],
  likedNodes: [],
  likedNodeIds: [],
  dislikedNodes: [],
  dislikedNodeIds: [],
  recommendedNodes: [],
  recommendationScores: {},
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

function toNodeIds(nodes: SelectedGraphNode[]) {
  return nodes.map((node) => node.id)
}

function toUniqueNodes(nodes: SelectedGraphNode[]) {
  return nodes.filter(
    (node, index, self) => self.findIndex((item) => item.id === node.id) === index,
  )
}

function toUniquePanels(panels: GraphPanelId[]) {
  return panels.filter((panel, index, self) => self.indexOf(panel) === index)
}

function toSelectedGraphNodeFromGraphData(
  area: GraphPanelId,
  node: GraphData['nodes'][number],
): SelectedGraphNode {
  return {
    id: node.data.id,
    label: node.data.label,
    category: node.data.category,
    graphArea: area,
  }
}

function getAllCandidateNodes() {
  return (['skill', 'job', 'company'] as GraphPanelId[]).flatMap((area) =>
    getGraphByPanel(area).nodes.map((node) =>
      toSelectedGraphNodeFromGraphData(area, node),
    ),
  )
}

function buildHiddenNodeMap(hiddenIds: string[]) {
  const hiddenSet = new Set(hiddenIds)

  return {
    skill: getGraphByPanel('skill').nodes
      .map((node) => node.data.id)
      .filter((id) => hiddenSet.has(id)),
    job: getGraphByPanel('job').nodes
      .map((node) => node.data.id)
      .filter((id) => hiddenSet.has(id)),
    company: getGraphByPanel('company').nodes
      .map((node) => node.data.id)
      .filter((id) => hiddenSet.has(id)),
  }
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

  clearPanelSelection: (area) =>
    set((state) => ({
      selectedNode:
        state.selectedNode?.graphArea === area ? null : state.selectedNode,
      selectedNodes: {
        ...state.selectedNodes,
        [area]: [],
      },
    })),

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

  setBackendFilterState: (filters) => set({ backendFilterState: filters }),

  setFilterMatchedNodes: (nodes) => set({ filterMatchedNodes: nodes }),

  setActiveFilterKind: (kind) => set({ activeFilterKind: kind }),

  setFilterMode: (enabled) => set({ isFilterMode: enabled }),

  bumpFilterRefreshKey: () =>
    set((state) => ({ filterRefreshKey: state.filterRefreshKey + 1 })),

  bumpGraphReloadKey: () =>
    set((state) => ({ graphReloadKey: state.graphReloadKey + 1 })),

  resetActiveFilters: () => set({ activeFilters: { ...defaultActiveFilters } }),

  setFocusedNode: (node) => set({ focusedNode: node }),

  setCurrentFocusColumn: (area) =>
    set((state) => ({
      currentFocusColumn: area,
      processedColumns: toUniquePanels([...state.processedColumns, area]),
    })),

  applyColumnContext: (area, nodes = []) =>
    set((state) => ({
      currentFocusColumn: area,
      selectedNodes: {
        ...state.selectedNodes,
        [area]: toUniqueNodes(nodes),
      },
    })),

  updatePathContext: (nodes) =>
    set({
      pathContextNodes: toUniqueNodes(nodes),
    }),

  likeNode: async (node) => {
    set((state) => {
      const likedNodes = upsertNode(state.likedNodes, node)
      const dislikedNodes = removeNode(state.dislikedNodes, node.id)

      return {
        likedNodes,
        likedNodeIds: toNodeIds(likedNodes),
        dislikedNodes,
        dislikedNodeIds: toNodeIds(dislikedNodes),
      }
    })
    await useGraphStore.getState().syncPreferenceState({ hideDisliked: true })
  },

  dislikeNode: async (node) => {
    set((state) => {
      const dislikedNodes = upsertNode(state.dislikedNodes, node)
      const likedNodes = removeNode(state.likedNodes, node.id)

      return {
        dislikedNodes,
        dislikedNodeIds: toNodeIds(dislikedNodes),
        likedNodes,
        likedNodeIds: toNodeIds(likedNodes),
      }
    })
    await useGraphStore.getState().syncPreferenceState({ hideDisliked: true })
  },

  unlikeNode: async (nodeId) => {
    const state = useGraphStore.getState()
    const node = state.likedNodes.find((item) => item.id === nodeId)

    set((current) => {
      const likedNodes = removeNode(current.likedNodes, nodeId)

      return {
        likedNodes,
        likedNodeIds: toNodeIds(likedNodes),
      }
    })

    if (node) {
      await useGraphStore.getState().syncPreferenceState({ hideDisliked: true })
    }
  },

  undislikeNode: async (nodeId) => {
    const state = useGraphStore.getState()
    const node = state.dislikedNodes.find((item) => item.id === nodeId)

    set((current) => {
      const dislikedNodes = removeNode(current.dislikedNodes, nodeId)

      return {
        dislikedNodes,
        dislikedNodeIds: toNodeIds(dislikedNodes),
      }
    })

    if (node) {
      await useGraphStore.getState().syncPreferenceState({ hideDisliked: true })
    }
  },

  cycleNodePreference: async (node) => {
    const state = useGraphStore.getState()
    const isPositive = state.likedNodeIds.includes(node.id)
    const isNegative = state.dislikedNodeIds.includes(node.id)

    if (!isPositive && !isNegative) {
      await useGraphStore.getState().likeNode(node)
      return 'positive'
    }

    if (isPositive) {
      await useGraphStore.getState().dislikeNode(node)
      return 'negative'
    }

    await useGraphStore.getState().likeNode(node)
    return 'positive'
  },

  clearNodePreference: async (nodeId) => {
    const state = useGraphStore.getState()
    const isPositive = state.likedNodeIds.includes(nodeId)
    const isNegative = state.dislikedNodeIds.includes(nodeId)

    if (isPositive) {
      await useGraphStore.getState().unlikeNode(nodeId)
    }

    if (isNegative) {
      await useGraphStore.getState().undislikeNode(nodeId)
    }
  },

  recalculateRecommendations: (nodes, options) => {
    const state = useGraphStore.getState()
    const inputNodes = nodes ?? getAllCandidateNodes()

    const { ranked, scores } = rankNodesByPreference({
      nodes: inputNodes,
      graphDataByPanel: {
        skill: getGraphByPanel('skill'),
        job: getGraphByPanel('job'),
        company: getGraphByPanel('company'),
      },
      likedNodeIds: state.likedNodeIds,
      dislikedNodeIds: state.dislikedNodeIds,
      selectedNodes: state.selectedNodes,
      focusedNode: state.focusedNode,
      hoveredNode: state.hoveredNode,
      currentFocusColumn: state.currentFocusColumn,
      pathContextNodes: state.pathContextNodes,
      processedColumns: state.processedColumns,
      hideDisliked: options?.hideDisliked,
    })

    set({
      recommendedNodes: ranked,
      recommendationScores: Object.fromEntries(scores.entries()),
    })

    return ranked
  },

  syncPreferenceState: async (options) => {
    const state = useGraphStore.getState()
    const candidateNodes = getAllCandidateNodes()

    const { ranked, scores } = rankNodesByPreference({
      nodes: candidateNodes,
      graphDataByPanel: {
        skill: getGraphByPanel('skill'),
        job: getGraphByPanel('job'),
        company: getGraphByPanel('company'),
      },
      likedNodeIds: state.likedNodeIds,
      dislikedNodeIds: state.dislikedNodeIds,
      selectedNodes: state.selectedNodes,
      focusedNode: state.focusedNode,
      hoveredNode: state.hoveredNode,
      currentFocusColumn: state.currentFocusColumn,
      pathContextNodes: state.pathContextNodes,
      processedColumns: state.processedColumns,
      hideDisliked: options?.hideDisliked,
    })

    const hiddenIds = buildPreferenceHiddenIds(candidateNodes, {
      graphDataByPanel: {
        skill: getGraphByPanel('skill'),
        job: getGraphByPanel('job'),
        company: getGraphByPanel('company'),
      },
      likedNodeIds: state.likedNodeIds,
      dislikedNodeIds: state.dislikedNodeIds,
      selectedNodes: state.selectedNodes,
      focusedNode: state.focusedNode,
      hoveredNode: state.hoveredNode,
      currentFocusColumn: state.currentFocusColumn,
      pathContextNodes: state.pathContextNodes,
      processedColumns: state.processedColumns,
      hideDisliked: options?.hideDisliked,
    })

    set({
      recommendedNodes: ranked,
      recommendationScores: Object.fromEntries(scores.entries()),
      hiddenNodes: buildHiddenNodeMap(hiddenIds),
    })

    return Promise.resolve()
  },

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
      currentFocusColumn: 'job',
      processedColumns: [],
      pathContextNodes: [],
      currentPath: null,
      currentExpandGraph: null,
    }),

  clearPreferences: async () => {
    set({
      likedNodes: [],
      likedNodeIds: [],
      dislikedNodes: [],
      dislikedNodeIds: [],
      recommendedNodes: [],
      recommendationScores: {},
    })
  },

  resetGraphState: () =>
    set({
      ...initialGraphState,
      activeFilters: { ...defaultActiveFilters },
      backendFilterState: {
        node_filters: [],
        edge_filters: [],
      },
      filterMatchedNodes: {
        skill: [],
        job: [],
        company: [],
      },
      activeFilterKind: null,
      isFilterMode: false,
      filterRefreshKey: 0,
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
