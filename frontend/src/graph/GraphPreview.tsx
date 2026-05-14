import { useMemo, useState } from 'react'
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph'
import { getGraphByPanel } from '../services/homeService'
import { expandNode, expandNode2Hop, recommend2To1 } from '../services/graphApi'
import { useGraphStore, toSelectedGraphNode } from '../store/graphStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphData, GraphPanelId, GraphPath, SelectedGraphNode } from '../types/graph'
import type {
  CytoscapeEdge,
  GraphNode as RawGraphNode,
  GraphResponse,
  InferencePath,
  RecommendNodeScore,
} from '../types/graphApi'
import { transformEdges } from '../utils/graphTransform'

type GraphPreviewProps = {
  panelId: GraphPanelId
  graph: GraphData
}

export function GraphPreview({ panelId, graph }: GraphPreviewProps) {
  const activeNodeId = useAppStore((state) => state.activeNodeIds[panelId])
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const selectedNodes = useGraphStore((state) => state.selectedNodes)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const hiddenNodes = useGraphStore((state) => state.hiddenNodes)
  const hoveredNode = useGraphStore((state) => state.hoveredNode)
  const activeBridgeEdges = useGraphStore((state) => state.activeBridgeEdges)
  const likedNodes = useGraphStore((state) => state.likedNodes)
  const dislikedNodes = useGraphStore((state) => state.dislikedNodes)
  const focusedNode = useGraphStore((state) => state.focusedNode)
  const toggleSelectedNode = useGraphStore((state) => state.toggleSelectedNode)
  const setHoveredNode = useGraphStore((state) => state.setHoveredNode)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setHiddenNodes = useGraphStore((state) => state.setHiddenNodes)
  const setActiveBridgeEdges = useGraphStore((state) => state.setActiveBridgeEdges)
  const clearActiveBridgeEdges = useGraphStore((state) => state.clearActiveBridgeEdges)
  const setCurrentExpandGraph = useGraphStore((state) => state.setCurrentExpandGraph)
  const setRecommendedNodes = useGraphStore((state) => state.setRecommendedNodes)
  const updateCurrentPath = useGraphStore((state) => state.updateCurrentPath)
  const likeNode = useGraphStore((state) => state.likeNode)
  const dislikeNode = useGraphStore((state) => state.dislikeNode)
  const unlikeNode = useGraphStore((state) => state.unlikeNode)
  const undislikeNode = useGraphStore((state) => state.undislikeNode)
  const clearPreferences = useGraphStore((state) => state.clearPreferences)
  const [hoveredNodeLabel, setHoveredNodeLabel] = useState('')

  const selectedNodeIds = selectedNodes[panelId].map((node) => node.id)
  const activeSelectedNode =
    selectedNode?.graphArea === panelId ? selectedNode : null
  const isLiked = activeSelectedNode
    ? likedNodes.some((node) => node.id === activeSelectedNode.id)
    : false
  const isDisliked = activeSelectedNode
    ? dislikedNodes.some((node) => node.id === activeSelectedNode.id)
    : false
  const hasPreferences = likedNodes.length > 0 || dislikedNodes.length > 0

  const visibleEdgeIds = useMemo(() => {
    const selected = new Set(selectedNodeIds)
    const highlighted = new Set(highlightedNodes[panelId])

    return graph.edges
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
  }, [graph.edges, highlightedNodes, hoveredNode, panelId, selectedNodeIds])

  async function handleBridge(node: SelectedGraphNode, use2Hop: boolean) {
    const expandGraph = use2Hop ? await expandNode2Hop(node.id) : await expandNode(node.id)

    setCurrentExpandGraph(expandGraph)
    setActiveBridgeEdges(panelId, buildBridgeEdges(panelId, expandGraph))

    return expandGraph
  }

  async function handleLinkageClick(node: SelectedGraphNode) {
    setActiveNodeId(panelId, node.id)
    toggleSelectedNode(panelId, node)

    const nextSelected = upsertSelection(selectedNodes[panelId], node)
    const nextSelectedNodes = {
      ...selectedNodes,
      [panelId]: nextSelected,
    }

    const use2Hop = activeNodeId === node.id
    const expandGraph = await handleBridge(node, use2Hop)

    const expandHighlighted = buildHighlightedMap(expandGraph)
    const expandHidden = buildHiddenMap(expandGraph, nextSelectedNodes)

    setHighlightedNodes(expandHighlighted)
    setHiddenNodes(expandHidden)

    const targetArea = resolveRecommendTarget(nextSelectedNodes)

    if (!targetArea) {
      return
    }

    const recommendResult = await recommend2To1({
      sourceAreas: (['skill', 'job', 'company'] as const).filter(
        (area) => area !== targetArea && nextSelectedNodes[area].length > 0,
      ),
      targetArea,
      selected: {
        skillNodeIds: nextSelectedNodes.skill.map((item) => item.id),
        jobNodeIds: nextSelectedNodes.job.map((item) => item.id),
        companyNodeIds: nextSelectedNodes.company.map((item) => item.id),
      },
      limit: 10,
    })

    const recommended = recommendResult.recommendedNodes.map((item) =>
      toSelectedGraphNode(targetArea, {
        id: item.node.id,
        label: String(item.node.properties.name ?? item.node.id),
        category: item.node.label,
      }),
    )

    setRecommendedNodes(recommended)
    updateCurrentPath(toGraphPath(recommendResult.currentPath))

    setHighlightedNodes({
      ...expandHighlighted,
      [targetArea]: buildRecommendedIds(targetArea, recommendResult.recommendedNodes),
    })

    setHiddenNodes({
      ...expandHidden,
      [targetArea]: buildRecommendedHiddenIds(targetArea, recommendResult.recommendedNodes),
    })
  }

  return (
    <div className="space-y-3">
      <KnowledgeGraph
        data={graph}
        activeNodeId={activeNodeId}
        highlightedNodeIds={highlightedNodes[panelId]}
        hiddenNodeIds={hiddenNodes[panelId]}
        visibleEdgeIds={visibleEdgeIds}
        bridgeEdges={activeBridgeEdges[panelId]}
        hoveredNodeId={hoveredNode?.graphArea === panelId ? hoveredNode.id : null}
        likedNodeIds={likedNodes.map((node) => node.id)}
        dislikedNodeIds={dislikedNodes.map((node) => node.id)}
        focusedNodeId={focusedNode?.graphArea === panelId ? focusedNode.id : null}
        layoutName="breadthfirst"
        className="h-[320px] w-full rounded-3xl bg-paper-50/70"
        onNodeClick={async (node) => {
          await handleLinkageClick(toSelectedGraphNode(panelId, node))
        }}
        onNodeHover={(node) => {
          setHoveredNodeLabel(node?.label ?? '')
          setHoveredNode(node ? toSelectedGraphNode(panelId, node) : null)

          if (!node) {
            clearActiveBridgeEdges(panelId)
            return
          }

          void handleBridge(toSelectedGraphNode(panelId, node), false)
        }}
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
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isLiked) {
                    unlikeNode(activeSelectedNode.id)
                    return
                  }

                  likeNode(activeSelectedNode)
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
                  if (isDisliked) {
                    undislikeNode(activeSelectedNode.id)
                    return
                  }

                  dislikeNode(activeSelectedNode)
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
                  onClick={clearPreferences}
                  className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Clear Preferences
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-ink-900/8 bg-white/70 px-4 py-3 text-sm text-ink-700">
        {hoveredNodeLabel || 'Hover a node to inspect the current context.'}
      </div>
    </div>
  )
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function resolvePanelByLabel(label: string): GraphPanelId | null {
  const normalized = normalize(label)

  if (normalized.includes('skill')) {
    return 'skill'
  }

  if (normalized.includes('company')) {
    return 'company'
  }

  if (normalized.includes('job') || normalized.includes('role')) {
    return 'job'
  }

  return null
}

function matchPanelNodeIds(panelId: GraphPanelId, rawNodes: RawGraphNode[]) {
  const panelGraph = getGraphByPanel(panelId)
  const rawTokens = new Set(
    rawNodes.flatMap((node) => [normalize(node.id), normalize(String(node.properties.name ?? ''))]),
  )

  return panelGraph.nodes
    .filter(
      (node) =>
        rawTokens.has(normalize(node.data.id)) || rawTokens.has(normalize(node.data.label)),
    )
    .map((node) => node.data.id)
}

function buildRawToLocalNodeLookup(panelId: GraphPanelId, rawNodes: RawGraphNode[]) {
  const panelGraph = getGraphByPanel(panelId)
  const lookup = new Map<string, string>()

  rawNodes.forEach((node) => {
    const rawId = normalize(node.id)
    const rawName = normalize(String(node.properties.name ?? ''))
    const matched = panelGraph.nodes.find(
      (item) =>
        normalize(item.data.id) === rawId ||
        normalize(item.data.label) === rawId ||
        normalize(item.data.label) === rawName,
    )

    if (!matched) {
      return
    }

    lookup.set(rawId, matched.data.id)

    if (rawName) {
      lookup.set(rawName, matched.data.id)
    }
  })

  return lookup
}

function buildHighlightedMap(response: GraphResponse) {
  const grouped: Record<GraphPanelId, RawGraphNode[]> = {
    skill: [],
    job: [],
    company: [],
  }

  response.nodes.forEach((node) => {
    const area = resolvePanelByLabel(node.label)

    if (area) {
      grouped[area].push(node)
    }
  })

  return {
    skill: matchPanelNodeIds('skill', grouped.skill),
    job: matchPanelNodeIds('job', grouped.job),
    company: matchPanelNodeIds('company', grouped.company),
  }
}

function buildHiddenMap(
  response: GraphResponse,
  selected: Record<GraphPanelId, SelectedGraphNode[]>,
) {
  const highlighted = buildHighlightedMap(response)

  return (['skill', 'job', 'company'] as const).reduce(
    (acc, area) => {
      const panelGraph = getGraphByPanel(area)
      const keepIds = new Set([
        ...highlighted[area],
        ...selected[area].map((item) => item.id),
      ])

      acc[area] = panelGraph.nodes
        .map((node) => node.data.id)
        .filter((nodeId) => !keepIds.has(nodeId))

      return acc
    },
    {
      skill: [] as string[],
      job: [] as string[],
      company: [] as string[],
    },
  )
}

function buildBridgeEdges(panelId: GraphPanelId, response: GraphResponse): CytoscapeEdge[] {
  const localNodeIds = new Set(getGraphByPanel(panelId).nodes.map((node) => node.data.id))
  const rawLookup = buildRawToLocalNodeLookup(panelId, response.nodes)

  return transformEdges(
    response.edges.filter((edge) => {
      const source = rawLookup.get(normalize(edge.source))
      const target = rawLookup.get(normalize(edge.target))

      return Boolean(source && target && localNodeIds.has(source) && localNodeIds.has(target))
    }),
  ).map((edge) => ({
    data: {
      ...edge.data,
      id: `bridge:${panelId}:${edge.data.id}`,
      source: rawLookup.get(normalize(edge.data.source)) ?? edge.data.source,
      target: rawLookup.get(normalize(edge.data.target)) ?? edge.data.target,
    },
  }))
}

function resolveRecommendTarget(selected: Record<GraphPanelId, SelectedGraphNode[]>) {
  const activeAreas = (['skill', 'job', 'company'] as const).filter(
    (area) => selected[area].length > 0,
  )

  if (activeAreas.length !== 2) {
    return null
  }

  if (!activeAreas.includes('skill')) {
    return 'skill'
  }

  if (!activeAreas.includes('job')) {
    return 'job'
  }

  return 'company'
}

function upsertSelection(nodes: SelectedGraphNode[], node: SelectedGraphNode) {
  if (nodes.some((item) => item.id === node.id)) {
    return nodes
  }

  return [...nodes, node]
}

function buildRecommendedIds(targetArea: GraphPanelId, nodes: RecommendNodeScore[]) {
  return matchPanelNodeIds(
    targetArea,
    nodes.map((item) => item.node),
  )
}

function buildRecommendedHiddenIds(targetArea: GraphPanelId, nodes: RecommendNodeScore[]) {
  const highlightIds = new Set(buildRecommendedIds(targetArea, nodes))
  const panelGraph = getGraphByPanel(targetArea)

  return panelGraph.nodes
    .map((node) => node.data.id)
    .filter((nodeId) => !highlightIds.has(nodeId))
}

function toGraphPath(path: InferencePath | null): GraphPath | null {
  if (!path) {
    return null
  }

  return {
    nodes: path.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      category: '',
    })),
    edges: path.edges.map((edge) => ({
      id: `${edge.source}-${edge.relation}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.relation,
    })),
    summary: path.summary,
  }
}
