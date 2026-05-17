import { useMemo, useState } from 'react'
import { rankSearchResults } from '../graph/preferenceEngine'
import { resolvePanelByLabel as resolvePanelByLabelFromGraph } from '../graph/data'
import { getGraphByPanel } from '../services/homeService'
import { searchNodes } from '../services/graphApi'
import { useGraphStore } from '../store/graphStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphPanelId, SelectedGraphNode } from '../types/graph'
import type { GraphNode as RawGraphNode } from '../types/graphApi'

export function SearchBar() {
  const searchKeyword = useGraphStore((state) => state.searchKeyword)
  const setSearchKeyword = useGraphStore((state) => state.setSearchKeyword)
  const setSearchResults = useGraphStore((state) => state.setSearchResults)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setHiddenNodes = useGraphStore((state) => state.setHiddenNodes)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const setCurrentFocusColumn = useGraphStore((state) => state.setCurrentFocusColumn)
  const recalculateRecommendations = useGraphStore(
    (state) => state.recalculateRecommendations,
  )
  const likedNodeIds = useGraphStore((state) => state.likedNodeIds)
  const dislikedNodeIds = useGraphStore((state) => state.dislikedNodeIds)
  const selectedNodes = useGraphStore((state) => state.selectedNodes)
  const focusedNode = useGraphStore((state) => state.focusedNode)
  const hoveredNode = useGraphStore((state) => state.hoveredNode)
  const currentFocusColumn = useGraphStore((state) => state.currentFocusColumn)
  const pathContextNodes = useGraphStore((state) => state.pathContextNodes)
  const processedColumns = useGraphStore((state) => state.processedColumns)
  const searchResults = useGraphStore((state) => state.searchResults)
  const [isSearching, setIsSearching] = useState(false)
  const [activeNodeType, setActiveNodeType] = useState<'all' | GraphPanelId>('all')
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)

  const rankedResults = useMemo(() => {
    const filtered =
      activeNodeType === 'all'
        ? searchResults
        : searchResults.filter((node) => node.graphArea === activeNodeType)

    return rankSearchResults(filtered, {
      graphDataByPanel: {
        skill: getGraphByPanel('skill'),
        job: getGraphByPanel('job'),
        company: getGraphByPanel('company'),
      },
      likedNodeIds,
      dislikedNodeIds,
      selectedNodes,
      focusedNode,
      hoveredNode,
      currentFocusColumn,
      pathContextNodes,
      processedColumns,
    })
  }, [
    activeNodeType,
    currentFocusColumn,
    dislikedNodeIds,
    focusedNode,
    hoveredNode,
    likedNodeIds,
    pathContextNodes,
    processedColumns,
    searchResults,
    selectedNodes,
  ])

  async function handleSearch() {
    const keyword = searchKeyword.trim()

    if (!keyword) {
      return
    }

    setIsSearching(true)

    try {
      const graph = await searchNodes({
        keyword,
      })

      const results = mapSearchResults(graph.nodes)
      const focusNode = results[0]

      setSearchResults(results)

      if (!focusNode) {
        setFocusedNode(null)
        return
      }

      setFocusedNode(focusNode)
      setCurrentFocusColumn(focusNode.graphArea)
      setFocusedPanel(focusNode.graphArea)
      setActiveNodeId(focusNode.graphArea, focusNode.id)
      setHighlightedNodes(buildHighlightMap(results))
      setHiddenNodes(buildHiddenMap(results))
      recalculateRecommendations(results, { hideDisliked: true })
    } finally {
      setIsSearching(false)
    }
  }

  function focusSearchResult(node: SelectedGraphNode) {
    setFocusedNode(node)
    setCurrentFocusColumn(node.graphArea)
    setFocusedPanel(node.graphArea)
    setActiveNodeId(node.graphArea, node.id)
    setHighlightedNodes(buildHighlightMap([node]))
    setHiddenNodes(buildHiddenMap([node]))
  }

  return (
    <div className="relative z-10 mt-6 flex flex-col gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_16px_60px_rgba(19,26,34,0.08)] backdrop-blur xl:flex-row xl:items-center">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="Search node name..."
            className="h-11 flex-1 rounded-2xl border border-ink-900/10 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-mint-500"
          />

          <div className="flex items-center gap-2">
            {(['all', 'skill', 'job', 'company'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveNodeType(type)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  activeNodeType === type
                    ? 'bg-ink-950 text-white'
                    : 'bg-white text-ink-700 hover:bg-paper-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isSearching}
            className="h-11 rounded-2xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {rankedResults.length > 0 ? (
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-ink-900/8 bg-paper-50/70 p-2">
            {rankedResults.slice(0, 12).map((node) => (
              <button
                key={`${node.graphArea}:${node.id}`}
                type="button"
                onClick={() => focusSearchResult(node)}
                className="rounded-full border border-ink-900/10 bg-white px-3 py-2 text-left text-xs font-medium text-ink-800 transition hover:border-mint-500/40 hover:bg-mint-50"
              >
                <span className="mr-2 text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {node.graphArea}
                </span>
                {node.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function resolvePanelByLabel(label: string): GraphPanelId {
  return resolvePanelByLabelFromGraph(label) ?? 'job'
}

function mapSearchResults(nodes: RawGraphNode[]): SelectedGraphNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: String(node.properties.name ?? node.id),
    category: node.label,
    graphArea: resolvePanelByLabel(node.label),
  }))
}

function buildHighlightMap(results: SelectedGraphNode[]) {
  return {
    skill: results.filter((item) => item.graphArea === 'skill').map((item) => item.id),
    job: results.filter((item) => item.graphArea === 'job').map((item) => item.id),
    company: results.filter((item) => item.graphArea === 'company').map((item) => item.id),
  }
}

function buildHiddenMap(results: SelectedGraphNode[]) {
  return (['skill', 'job', 'company'] as const).reduce(
    (acc, area) => {
      const visible = new Set(
        results.filter((item) => item.graphArea === area).map((item) => item.id),
      )

      acc[area] = getGraphByPanel(area).nodes
        .map((node) => node.data.id)
        .filter((id) => visible.size > 0 && !visible.has(id))

      return acc
    },
    {
      skill: [] as string[],
      job: [] as string[],
      company: [] as string[],
    },
  )
}
