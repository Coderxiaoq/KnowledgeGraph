import type { GraphData, GraphPanelId, SelectedGraphNode } from '../types/graph'

export type RecommendationScore = {
  finalScore: number
  likeBoost: number
  dislikePenalty: number
  contextWeight: number
  relationWeight: number
  pathWeight: number
}

export type PreferenceEngineInput = {
  nodes: SelectedGraphNode[]
  graphDataByPanel: Record<GraphPanelId, GraphData>
  likedNodeIds: string[]
  dislikedNodeIds: string[]
  selectedNodes: Record<GraphPanelId, SelectedGraphNode[]>
  focusedNode: SelectedGraphNode | null
  hoveredNode: SelectedGraphNode | null
  currentFocusColumn: GraphPanelId
  pathContextNodes: SelectedGraphNode[]
  processedColumns: GraphPanelId[]
  hideDisliked?: boolean
}

type NeighborMap = Map<string, Set<string>>

const neighborCache = new Map<string, NeighborMap>()

function buildGraphFingerprint(graphDataByPanel: Record<GraphPanelId, GraphData>) {
  return (['skill', 'job', 'company'] as GraphPanelId[])
    .map((panelId) => {
      const graph = graphDataByPanel[panelId]
      return [
        panelId,
        graph.nodes.length,
        graph.edges.length,
        graph.nodes.slice(0, 20).map((node) => node.data.id).join('|'),
        graph.edges.slice(0, 20).map((edge) => edge.data.id).join('|'),
      ].join(':')
    })
    .join('~')
}

function buildNeighborMap(graphDataByPanel: Record<GraphPanelId, GraphData>) {
  const fingerprint = buildGraphFingerprint(graphDataByPanel)
  const cached = neighborCache.get(fingerprint)

  if (cached) {
    return cached
  }

  const neighborMap: NeighborMap = new Map()

  Object.values(graphDataByPanel).forEach((graph) => {
    graph.edges.forEach((edge) => {
      const source = edge.data.source
      const target = edge.data.target

      if (!neighborMap.has(source)) {
        neighborMap.set(source, new Set())
      }

      if (!neighborMap.has(target)) {
        neighborMap.set(target, new Set())
      }

      neighborMap.get(source)?.add(target)
      neighborMap.get(target)?.add(source)
    })
  })

  neighborCache.set(fingerprint, neighborMap)
  return neighborMap
}

function getRelationWeight(
  nodeId: string,
  neighborMap: NeighborMap,
  likedNodeIds: Set<string>,
  dislikedNodeIds: Set<string>,
) {
  const neighbors = neighborMap.get(nodeId) ?? new Set<string>()
  let relationWeight = 0

  neighbors.forEach((neighborId) => {
    if (likedNodeIds.has(neighborId)) {
      relationWeight += 1.1
    }

    if (dislikedNodeIds.has(neighborId)) {
      relationWeight -= 1
    }
  })

  return relationWeight
}

function getContextWeight(
  node: SelectedGraphNode,
  selectedNodes: Record<GraphPanelId, SelectedGraphNode[]>,
  focusedNode: SelectedGraphNode | null,
  hoveredNode: SelectedGraphNode | null,
  currentFocusColumn: GraphPanelId,
  pathContextNodes: SelectedGraphNode[],
) {
  let contextWeight = 1

  if (focusedNode?.id === node.id) {
    contextWeight += 2
  }

  if (hoveredNode?.id === node.id) {
    contextWeight += 0.8
  }

  if (selectedNodes[node.graphArea].some((item) => item.id === node.id)) {
    contextWeight += 1.4
  }

  if (node.graphArea === currentFocusColumn) {
    contextWeight += 0.8
  }

  if (pathContextNodes.some((item) => item.id === node.id)) {
    contextWeight += 1.2
  }

  return contextWeight
}

export function calculateFinalRecommendationScore(
  node: SelectedGraphNode,
  context: Omit<PreferenceEngineInput, 'nodes'> & {
    neighborMap: Map<string, Set<string>>
  },
): RecommendationScore {
  const likedNodeIds = new Set(context.likedNodeIds)
  const dislikedNodeIds = new Set(context.dislikedNodeIds)

  const likeBoost =
    (likedNodeIds.has(node.id) ? 2.4 : 0) +
    getRelationWeight(node.id, context.neighborMap, likedNodeIds, new Set())

  const dislikePenalty =
    (dislikedNodeIds.has(node.id) ? 3 : 0) +
    Math.abs(
      Math.min(
        getRelationWeight(node.id, context.neighborMap, new Set(), dislikedNodeIds),
        0,
      ),
    )

  const contextWeight = getContextWeight(
    node,
    context.selectedNodes,
    context.focusedNode,
    context.hoveredNode,
    context.currentFocusColumn,
    context.pathContextNodes,
  )

  const relationWeight = getRelationWeight(
    node.id,
    context.neighborMap,
    likedNodeIds,
    dislikedNodeIds,
  )

  const pathWeight =
    context.pathContextNodes.length > 0 &&
    context.pathContextNodes.some((item) => item.id === node.id)
      ? 1.5
      : 0

  const finalScore =
    contextWeight + likeBoost + relationWeight + pathWeight - dislikePenalty

  return {
    finalScore,
    likeBoost,
    dislikePenalty,
    contextWeight,
    relationWeight,
    pathWeight,
  }
}

export function rankNodesByPreference(input: PreferenceEngineInput) {
  const neighborMap = buildNeighborMap(input.graphDataByPanel)
  const scores = new Map<string, RecommendationScore>()

  const ranked = input.nodes
    .filter((node) => !(input.hideDisliked && input.dislikedNodeIds.includes(node.id)))
    .map((node) => {
      const score = calculateFinalRecommendationScore(node, {
        ...input,
        neighborMap,
      })
      scores.set(node.id, score)
      return {
        node,
        score,
      }
    })
    .sort((left, right) => right.score.finalScore - left.score.finalScore)
    .map((item) => item.node)

  return {
    ranked,
    scores,
  }
}

export function rankSearchResults(
  nodes: SelectedGraphNode[],
  input: Omit<PreferenceEngineInput, 'nodes'>,
) {
  return rankNodesByPreference({
    ...input,
    nodes,
  }).ranked
}

export function buildPreferenceHiddenIds(
  nodes: SelectedGraphNode[],
  input: Omit<PreferenceEngineInput, 'nodes'> & {
    visibleRatio?: number
  },
) {
  const { ranked } = rankNodesByPreference({
    ...input,
    nodes,
  })

  const visibleRatio = input.visibleRatio ?? 0.55
  const visibleCount = Math.max(6, Math.ceil(ranked.length * visibleRatio))
  const visibleIds = new Set(ranked.slice(0, visibleCount).map((node) => node.id))

  return ranked
    .map((node) => node.id)
    .filter((nodeId) => !visibleIds.has(nodeId))
}
