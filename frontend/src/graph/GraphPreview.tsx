import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph'
import {
  getGraphByPanel,
  getPanelGraphLoader,
  setGraphByPanel,
} from '../services/homeService'
import { expandNode, expandNode2Hop } from '../services/graphApi'
import { useGraphStore, toSelectedGraphNode } from '../store/graphStore'
import { usePathStore } from '../store/pathStore'
import { useAppStore } from '../store/useAppStore'
import type {
  GraphData,
  GraphPath,
  GraphPanelId,
  SelectedGraphNode,
} from '../types/graph'
import type { CytoscapeEdge, GraphNode as RawGraphNode, GraphResponse } from '../types/graphApi'
import {
  normalizeGraphToken,
  resolvePanelByLabel,
  toCytoscapeEdge,
} from './data'

type GraphPreviewProps = {
  panelId: GraphPanelId
  graph: GraphData
  isPanelFocused: boolean
}

const LAZY_RENDER_THRESHOLD = 500
const LAZY_RENDER_BATCH_SIZE = 160
const HOVER_BRIDGE_CLEAR_DELAY = 120

const DEFAULT_LAYOUT_MODE = 'fcose'
const DEFAULT_WHEEL_SENSITIVITY = 0.009

function shouldUseTwoHopExpand(panelId: GraphPanelId) {
  return panelId === 'skill' || panelId === 'company'
}

export const GraphPreview = memo(function GraphPreview({
  panelId,
  isPanelFocused,
}: GraphPreviewProps) {
  const focusedPanel = useAppStore((state) => state.focusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const navigationRequest = usePathStore((state) => state.navigationRequest)
  const clearNavigationRequest = usePathStore((state) => state.clearNavigationRequest)
  const isPathPanelOpen = usePathStore((state) => state.isPathPanelOpen)
  const setPathPanelOpen = usePathStore((state) => state.setPathPanelOpen)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const selectedNodes = useGraphStore((state) => state.selectedNodes)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const hiddenNodes = useGraphStore((state) => state.hiddenNodes)
  const hoveredNode = useGraphStore((state) => state.hoveredNode)
  const activeBridgeEdges = useGraphStore((state) => state.activeBridgeEdges)
  const likedNodes = useGraphStore((state) => state.likedNodes)
  const dislikedNodes = useGraphStore((state) => state.dislikedNodes)
  const focusedNode = useGraphStore((state) => state.focusedNode)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const currentFocusColumn = useGraphStore((state) => state.currentFocusColumn)
  const setHoveredNode = useGraphStore((state) => state.setHoveredNode)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setHiddenNodes = useGraphStore((state) => state.setHiddenNodes)
  const setActiveBridgeEdges = useGraphStore((state) => state.setActiveBridgeEdges)
  const clearActiveBridgeEdges = useGraphStore((state) => state.clearActiveBridgeEdges)
  const setCurrentExpandGraph = useGraphStore((state) => state.setCurrentExpandGraph)
  const updateCurrentPath = useGraphStore((state) => state.updateCurrentPath)
  const setCurrentFocusColumn = useGraphStore((state) => state.setCurrentFocusColumn)
  const bumpGraphReloadKey = useGraphStore((state) => state.bumpGraphReloadKey)
  const applyColumnContext = useGraphStore((state) => state.applyColumnContext)
  const cycleNodePreference = useGraphStore((state) => state.cycleNodePreference)
  const syncPreferenceState = useGraphStore((state) => state.syncPreferenceState)
  const clearPreferences = useGraphStore((state) => state.clearPreferences)
  const filterMatchedNodes = useGraphStore((state) => state.filterMatchedNodes)
  const setFilterMatchedNodes = useGraphStore((state) => state.setFilterMatchedNodes)
  const backendFilterState = useGraphStore((state) => state.backendFilterState)
  const filterRefreshKey = useGraphStore((state) => state.filterRefreshKey)
  const graphReloadKey = useGraphStore((state) => state.graphReloadKey)
  const [graphData, setGraphData] = useState<GraphData>(() => getGraphByPanel(panelId))
  const [loading, setLoading] = useState(graphData.nodes.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [hoveredNodeLabel, setHoveredNodeLabel] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const frameRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const hoverClearTimerRef = useRef<number | null>(null)
  const initialGraphRef = useRef<GraphData | null>(null)
  const focusSessionRef = useRef(0)
  const focusSnapshotRef = useRef<{
    graphData: GraphData
    activeNodeId: string
    selectedNode: SelectedGraphNode | null
    selectedNodes: Record<GraphPanelId, SelectedGraphNode[]>
    focusedNode: SelectedGraphNode | null
    currentFocusColumn: GraphPanelId
    hoveredNode: SelectedGraphNode | null
    highlightedNodes: Record<GraphPanelId, string[]>
    hiddenNodes: Record<GraphPanelId, string[]>
    activeBridgeEdges: Record<GraphPanelId, CytoscapeEdge[]>
    currentExpandGraph: GraphResponse | null
    currentPath: GraphPath | null
    hoveredNodeLabel: string
  } | null>(null)
  const hasRestoredFocusRef = useRef(false)

  const captureFocusSnapshot = useCallback(() => {
    const state = useGraphStore.getState()

    focusSnapshotRef.current = {
      graphData: {
        nodes: [...graphData.nodes],
        edges: [...graphData.edges],
      },
      activeNodeId: useAppStore.getState().activeNodeIds[panelId],
      selectedNode: state.selectedNode,
      selectedNodes: {
        skill: [...state.selectedNodes.skill],
        job: [...state.selectedNodes.job],
        company: [...state.selectedNodes.company],
      },
      focusedNode: state.focusedNode,
      currentFocusColumn: state.currentFocusColumn,
      hoveredNode: state.hoveredNode,
      highlightedNodes: {
        skill: [...state.highlightedNodes.skill],
        job: [...state.highlightedNodes.job],
        company: [...state.highlightedNodes.company],
      },
      hiddenNodes: {
        skill: [...state.hiddenNodes.skill],
        job: [...state.hiddenNodes.job],
        company: [...state.hiddenNodes.company],
      },
      activeBridgeEdges: {
        skill: [...state.activeBridgeEdges.skill],
        job: [...state.activeBridgeEdges.job],
        company: [...state.activeBridgeEdges.company],
      },
      currentExpandGraph: state.currentExpandGraph,
      currentPath: state.currentPath,
      hoveredNodeLabel,
    }
  }, [graphData.edges, graphData.nodes, hoveredNodeLabel, panelId])

  const selectedNodeIds = selectedNodes[panelId].map((node) => node.id)
  const activeSelectedNode = selectedNode?.graphArea === panelId ? selectedNode : null
  const activeVisualNodeId =
    selectedNode?.graphArea === panelId ? selectedNode.id : undefined
  const panelSelectedNodes = selectedNodes[panelId]
  const isLiked = activeSelectedNode
    ? likedNodes.some((node) => node.id === activeSelectedNode.id)
    : false
  const isDisliked = activeSelectedNode
    ? dislikedNodes.some((node) => node.id === activeSelectedNode.id)
    : false
  const hasPreferences = likedNodes.length > 0 || dislikedNodes.length > 0

  useEffect(() => {
    void syncPreferenceState({
      hideDisliked: false,
    })
  }, [
    activeSelectedNode,
    currentFocusColumn,
    panelId,
    syncPreferenceState,
    likedNodes,
    dislikedNodes,
  ])

  useEffect(() => {
    if (!isPanelFocused) {
      focusSessionRef.current += 1
      hasRestoredFocusRef.current = false
    }
  }, [isPanelFocused])

  useEffect(() => {
    setHiddenNodes({
      skill: [],
      job: [],
      company: [],
    })
    setHighlightedNodes({
      skill: [],
      job: [],
      company: [],
    })
  }, [isPanelFocused, panelId, setHiddenNodes, setHighlightedNodes])

  useEffect(() => {
    if (focusedPanel !== null || !focusSnapshotRef.current || hasRestoredFocusRef.current) {
      return
    }

    const snapshot = focusSnapshotRef.current
    setGraphData(snapshot.graphData)
    setGraphByPanel(panelId, snapshot.graphData)

    useGraphStore.setState((state) => ({
      selectedNode:
        state.selectedNode?.graphArea === panelId ? null : state.selectedNode,
      selectedNodes: {
        ...state.selectedNodes,
        [panelId]: [],
      },
      highlightedNodes: {
        ...state.highlightedNodes,
        [panelId]: [],
      },
      hiddenNodes: {
        ...state.hiddenNodes,
        [panelId]: [],
      },
      activeBridgeEdges: {
        ...state.activeBridgeEdges,
        [panelId]: [],
      },
      focusedNode:
        state.focusedNode?.graphArea === panelId ? null : state.focusedNode,
      currentExpandGraph: panelId === currentFocusColumn ? null : state.currentExpandGraph,
      currentPath: panelId === currentFocusColumn ? null : state.currentPath,
    }))

    setHoveredNodeLabel('')
    setActiveNodeId(panelId, '')
    hasRestoredFocusRef.current = true
    void syncPreferenceState({ hideDisliked: false })
  }, [currentFocusColumn, focusedPanel, panelId, setActiveNodeId, syncPreferenceState])

  const loadGraph = useCallback(async () => {
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const nextGraph = await getPanelGraphLoader(panelId)(controllerRef.current.signal)
      if (controllerRef.current.signal.aborted) {
        return
      }

      initialGraphRef.current = nextGraph
      focusSnapshotRef.current = null

      await applyGraphDataIncrementally(nextGraph, setGraphData, frameRef)
      setGraphByPanel(panelId, nextGraph)

      if (useGraphStore.getState().backendFilterState.node_filters.length > 0) {
        const matchedIds = nextGraph.nodes.map((n) => n.data.id)
        setFilterMatchedNodes({
          ...useGraphStore.getState().filterMatchedNodes,
          [panelId]: matchedIds,
        })
      }
    } catch (loadError) {
      if (controllerRef.current?.signal.aborted) {
        return
      }

      setError(loadError instanceof Error ? loadError.message : 'Failed to load graph')
    } finally {
      if (!controllerRef.current?.signal.aborted) {
        setLoading(false)
      }
    }
  }, [panelId])

  useEffect(() => {
    void loadGraph()

    return () => {
      controllerRef.current?.abort()
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
      if (hoverClearTimerRef.current) {
        window.clearTimeout(hoverClearTimerRef.current)
      }
    }
  }, [filterRefreshKey, loadGraph, loadVersion])

  useEffect(() => {
    void loadGraph()
  }, [graphReloadKey, loadGraph])

  const visibleEdgeIds = useMemo(() => {
    const selected = new Set(selectedNodeIds)
    const highlighted = new Set(highlightedNodes[panelId])

    return graphData.edges
      .filter((edge) => {
        const source = edge.data.source
        const target = edge.data.target

        if (hoveredNode?.graphArea === panelId && hoveredNode) {
          return source === hoveredNode.id || target === hoveredNode.id
        }

        const sourceActive = selected.has(source) || highlighted.has(source)
        const targetActive = selected.has(target) || highlighted.has(target)

        return sourceActive && targetActive
      })
      .map((edge) => edge.data.id)
  }, [graphData.edges, highlightedNodes, hoveredNode, panelId, selectedNodeIds])

  const syncPanelsFromExpand = useCallback(
    (expandedGraph: GraphResponse, sessionId: number) => {
      if (focusSessionRef.current !== sessionId) {
        return
      }

      const highlighted = buildHighlightedMap(expandedGraph)
      const nextHidden = buildHiddenMap(expandedGraph, selectedNodes, dislikedNodes)

      setHighlightedNodes(highlighted)
      setHiddenNodes(nextHidden)
      setCurrentExpandGraph(expandedGraph)
      updateCurrentPath(buildGraphPath(expandedGraph))
    },
    [
      dislikedNodes,
      selectedNodes,
      setCurrentExpandGraph,
      setHiddenNodes,
      setHighlightedNodes,
      updateCurrentPath,
    ],
  )

  const handleBridge = useCallback(
    async (node: SelectedGraphNode, use2Hop: boolean, sessionId: number) => {
      const expandedGraph = use2Hop
        ? await expandNode2Hop(node.id, { limit: 160 })
        : await expandNode(node.id)

      if (focusSessionRef.current !== sessionId) {
        return null
      }

      setActiveBridgeEdges(panelId, buildBridgeEdges(expandedGraph))
      syncPanelsFromExpand(expandedGraph, sessionId)

      return expandedGraph
    },
    [panelId, setActiveBridgeEdges, syncPanelsFromExpand],
  )

  useEffect(() => {
    if (!navigationRequest || navigationRequest.panelId !== panelId) {
      return
    }

    const targetNode = graphData.nodes.find(
      (node) => node.data.id === navigationRequest.nodeId,
    )

    if (!targetNode) {
      clearNavigationRequest()
      return
    }

    const nextNode: SelectedGraphNode = {
      id: targetNode.data.id,
      label: targetNode.data.label,
      category: targetNode.data.category,
      graphArea: panelId,
    }

    captureFocusSnapshot()
    setCurrentFocusColumn(panelId)
    applyColumnContext(panelId, [...selectedNodes[panelId], nextNode])
    setActiveNodeId(panelId, nextNode.id)
    useGraphStore.setState({
      selectedNode: nextNode,
      focusedNode: nextNode,
    })
    const sessionId = ++focusSessionRef.current

    clearNavigationRequest()
    void handleBridge(nextNode, shouldUseTwoHopExpand(panelId), sessionId)
  }, [
    clearNavigationRequest,
    graphData.nodes,
    handleBridge,
    navigationRequest,
    panelId,
    applyColumnContext,
    captureFocusSnapshot,
    selectedNodes,
    setActiveNodeId,
    setCurrentFocusColumn,
  ])

  const handleNodeClick = useCallback(
    async (node: SelectedGraphNode) => {
      if (!isPanelFocused) return;

      const isFilterActive = backendFilterState.node_filters.length > 0;
      const matchedIds = filterMatchedNodes[panelId] || [];
      const isSameFocusedNode = focusedNode?.graphArea === panelId && focusedNode.id === node.id;

      if (isFilterActive) {
        if (isSameFocusedNode) {
          setHighlightedNodes({
            skill: [],
            job: [],
            company: [],
          });
          const allIds = {
            skill: filterMatchedNodes.skill || [],
            job: filterMatchedNodes.job || [],
            company: filterMatchedNodes.company || [],
          };
          const allGraphIds = {
            skill: graphData.nodes.map(n => n.data.id),
            job: getGraphByPanel('job').nodes.map(n => n.data.id),
            company: getGraphByPanel('company').nodes.map(n => n.data.id),
          };
          setHiddenNodes({
            skill: allGraphIds.skill.filter(id => !allIds.skill.includes(id)),
            job: allGraphIds.job.filter(id => !allIds.job.includes(id)),
            company: allGraphIds.company.filter(id => !allIds.company.includes(id)),
          });
          setFocusedNode(null);
          useGraphStore.getState().clearSelection();
          setPathPanelOpen(false);
          setActiveNodeId('skill', '');
          setActiveNodeId('job', '');
          setActiveNodeId('company', '');
          bumpGraphReloadKey();
          await syncPreferenceState({ hideDisliked: false });
          return;
        }

        const relatedIds = new Set([node.id]);
        graphData.edges.forEach(edge => {
          if (edge.data.source === node.id && matchedIds.includes(edge.data.target)) relatedIds.add(edge.data.target);
          if (edge.data.target === node.id && matchedIds.includes(edge.data.source)) relatedIds.add(edge.data.source);
        });

        setHighlightedNodes({
          skill: panelId === 'skill' ? Array.from(relatedIds) : [],
          job: panelId === 'job' ? Array.from(relatedIds) : [],
          company: panelId === 'company' ? Array.from(relatedIds) : [],
        });
        setHiddenNodes({
          skill: panelId === 'skill' ? matchedIds.filter(id => !relatedIds.has(id)) : [],
          job: panelId === 'job' ? matchedIds.filter(id => !relatedIds.has(id)) : [],
          company: panelId === 'company' ? matchedIds.filter(id => !relatedIds.has(id)) : [],
        });
        setFocusedNode(node);
        setActiveNodeId(panelId, node.id);
        useGraphStore.setState({ selectedNode: node, focusedNode: node });
        return;
      }

      if (isSameFocusedNode) {
        focusSnapshotRef.current = null;
        hasRestoredFocusRef.current = true;
        setFocusedNode(null);
        useGraphStore.getState().clearSelection();
        setPathPanelOpen(false);
        setActiveNodeId('skill', '');
        setActiveNodeId('job', '');
        setActiveNodeId('company', '');
        bumpGraphReloadKey();
        await syncPreferenceState({ hideDisliked: false });
        setHighlightedNodes({ skill: [], job: [], company: [] });
        setHiddenNodes({ skill: [], job: [], company: [] });
        return;
      }

      captureFocusSnapshot();
      setCurrentFocusColumn(panelId);
      applyColumnContext(panelId, [node]);
      setActiveNodeId(panelId, node.id);
      useGraphStore.setState({ selectedNode: node, focusedNode: node });
      const sessionId = ++focusSessionRef.current;
      await handleBridge(node, shouldUseTwoHopExpand(panelId), sessionId);
    },
    [
      applyColumnContext,
      captureFocusSnapshot,
      handleBridge,
      panelId,
      focusedNode,
      selectedNode,
      selectedNodes,
      isPanelFocused,
      setActiveNodeId,
      setCurrentFocusColumn,
      setFocusedNode,
      setPathPanelOpen,
      bumpGraphReloadKey,
      syncPreferenceState,
      highlightedNodes,
      hiddenNodes,
      activeBridgeEdges,
      updateCurrentPath,
      setCurrentExpandGraph,
      backendFilterState,
      filterMatchedNodes,
      graphData,
      setHighlightedNodes,
      setHiddenNodes,
    ],
  );

  const handleNodeHover = useCallback(
    (node: { id: string; label: string; category: string } | null) => {
      if (hoverClearTimerRef.current) {
        window.clearTimeout(hoverClearTimerRef.current)
        hoverClearTimerRef.current = null
      }

      setHoveredNodeLabel(node?.label ?? '')
      setHoveredNode(node ? toSelectedGraphNode(panelId, node) : null)

      if (!node) {
        hoverClearTimerRef.current = window.setTimeout(() => {
          clearActiveBridgeEdges(panelId)
        }, HOVER_BRIDGE_CLEAR_DELAY)
        return
      }
    },
    [clearActiveBridgeEdges, panelId, setHoveredNode],
  )

  if (loading && graphData.nodes.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-3xl border border-ink-900/8 bg-white/70 text-sm text-ink-600">
        Loading graph...
      </div>
    )
  }

  if (error && graphData.nodes.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-rose-200 bg-rose-50/70 px-4 text-center">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => setLoadVersion((version) => version + 1)}
          className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-0 overflow-hidden space-y-3">
      <KnowledgeGraph
        data={graphData}
        activeNodeId={activeVisualNodeId}
        highlightedNodeIds={
          backendFilterState.node_filters.length > 0
            ? filterMatchedNodes[panelId]
            : highlightedNodes[panelId]
        }
        hiddenNodeIds={hiddenNodes[panelId]}
        visibleEdgeIds={visibleEdgeIds}
        bridgeEdges={isPathPanelOpen ? activeBridgeEdges[panelId] : []}
        hoveredNodeId={hoveredNode?.graphArea === panelId ? hoveredNode.id : null}
        likedNodeIds={likedNodes.map((node) => node.id)}
        dislikedNodeIds={dislikedNodes.map((node) => node.id)}
        focusedNodeId={focusedNode?.graphArea === panelId ? focusedNode.id : null}
        layoutName={DEFAULT_LAYOUT_MODE}
        wheelSensitivity={DEFAULT_WHEEL_SENSITIVITY}
        className="h-[320px] min-h-0 w-full overflow-hidden rounded-3xl bg-paper-50/70"
        onNodeClick={(node) => void handleNodeClick(toSelectedGraphNode(panelId, node))}
        onNodeRightClick={(node) => {
          const nextNode = toSelectedGraphNode(panelId, node)
          void (async () => {
            await cycleNodePreference(nextNode)
            await syncPreferenceState({ hideDisliked: true })
          })()
        }}
        onNodeHover={handleNodeHover}
      />
      {activeSelectedNode ? (
        <div className="rounded-2xl border border-ink-900/8 bg-white/78 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                Preference
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-950">
                {activeSelectedNode.label}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                当前栏位已选 {panelSelectedNodes.length} 个节点
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void cycleNodePreference(activeSelectedNode)
                }}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  isLiked
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {isLiked ? 'Liked' : 'Like'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void cycleNodePreference(activeSelectedNode)
                }}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  isDisliked
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                {isDisliked ? 'Disliked' : 'Dislike'}
              </button>
              {hasPreferences ? (
                <button
                  type="button"
                  onClick={() => void clearPreferences()}
                  className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Clear Preferences
                </button>
              ) : null}
            </div>
          </div>
          {panelSelectedNodes.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {panelSelectedNodes.map((node) => {
                const nodeLiked = likedNodes.some((item) => item.id === node.id)
                const nodeDisliked = dislikedNodes.some((item) => item.id === node.id)

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => useGraphStore.setState({ selectedNode: node })}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      activeSelectedNode?.id === node.id
                        ? 'bg-ink-950 text-white'
                        : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
                    }`}
                  >
                    <span>{node.label}</span>
                    {nodeLiked ? <span className="ml-2 text-emerald-500">Like</span> : null}
                    {nodeDisliked ? <span className="ml-2 text-rose-500">Dislike</span> : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-2xl border border-ink-900/8 bg-white/70 px-4 py-3 text-sm text-ink-700">
        {loading
          ? 'Syncing graph data...'
          : hoveredNodeLabel || 'Hover a node to inspect the current context.'}
      </div>
    </div>
  )
})

async function applyGraphDataIncrementally(
  nextGraph: GraphData,
  setGraphData: (graph: GraphData) => void,
  frameRef: React.MutableRefObject<number | null>,
) {
  if (nextGraph.nodes.length <= LAZY_RENDER_THRESHOLD) {
    setGraphData(nextGraph)
    return
  }

  let cursor = 0
  const accumulatedNodes = [] as GraphData['nodes']
  const edges = nextGraph.edges

  await new Promise<void>((resolve) => {
    const pump = () => {
      accumulatedNodes.push(
        ...nextGraph.nodes.slice(cursor, cursor + LAZY_RENDER_BATCH_SIZE),
      )
      cursor += LAZY_RENDER_BATCH_SIZE

      setGraphData({
        nodes: [...accumulatedNodes],
        edges,
      })

      if (cursor >= nextGraph.nodes.length) {
        resolve()
        return
      }

      frameRef.current = window.requestAnimationFrame(pump)
    }

    frameRef.current = window.requestAnimationFrame(pump)
  })
}

function buildHighlightedMap(response: GraphResponse) {
  const highlighted: Record<GraphPanelId, string[]> = {
    skill: [],
    job: [],
    company: [],
  }

  response.nodes.forEach((node) => {
    const area = resolvePanelByLabel(node.label)
    if (!area) {
      return
    }

    highlighted[area].push(node.id)
  })

  return highlighted
}

function buildHiddenMap(
  response: GraphResponse,
  selected: Record<GraphPanelId, SelectedGraphNode[]>,
  dislikedNodes: SelectedGraphNode[],
) {
  const highlighted = buildHighlightedMap(response)
  const dislikedIds = new Set(dislikedNodes.map((node) => node.id))

  return (['skill', 'job', 'company'] as const).reduce(
    (acc, area) => {
      const panelGraph = getGraphByPanel(area)
      const keepIds = new Set([
        ...highlighted[area],
        ...selected[area].map((item) => item.id),
      ])

      acc[area] = panelGraph.nodes
        .map((node) => node.data.id)
        .filter((nodeId) => !keepIds.has(nodeId) && dislikedIds.has(nodeId))

      return acc
    },
    {
      skill: [] as string[],
      job: [] as string[],
      company: [] as string[],
    },
  )
}

function buildGraphPath(response: GraphResponse): GraphPath {
  return {
    nodes: response.nodes.map((node) => ({
      id: node.id,
      label: String(node.properties.name ?? node.id),
      category: node.label,
    })),
    edges: response.edges.map((edge) => ({
      id: `${edge.source}-${edge.relation}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.relation,
    })),
  }
}

function buildBridgeEdges(response: GraphResponse): CytoscapeEdge[] {
  return response.edges.map((edge) => ({
    data: {
      ...toCytoscapeEdge(edge).data,
      id: `bridge:${edge.source}-${edge.relation}-${edge.target}`,
      properties: edge.properties,
    },
  }))
}

function _matchPanelNodeIds(panelId: GraphPanelId, rawNodes: RawGraphNode[]) {
  const panelGraph = getGraphByPanel(panelId)
  const rawTokens = new Set(
    rawNodes.flatMap((node) => [
      normalizeGraphToken(node.id),
      normalizeGraphToken(String(node.properties.name ?? '')),
    ]),
  )

  return panelGraph.nodes
    .filter(
      (node) =>
        rawTokens.has(normalizeGraphToken(node.data.id)) ||
        rawTokens.has(normalizeGraphToken(String(node.data.label))),
    )
    .map((node) => node.data.id)
}

void _matchPanelNodeIds
