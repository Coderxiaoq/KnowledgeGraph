import { useMemo, useState } from 'react'
import { rankSearchResults } from '../graph/preferenceEngine'
import { resolvePanelByLabel as resolvePanelByLabelFromGraph } from '../graph/data'
import { useMemo, useState } from 'react'
import { rankSearchResults } from '../graph/preferenceEngine'
import { resolvePanelByLabel as resolvePanelByLabelFromGraph } from '../graph/data'
import { getGraphByPanel } from '../services/homeService'
import { searchNodes } from '../services/graphApi'
import { searchNodes } from '../services/graphApi'
import { useGraphStore } from '../store/graphStore'
import { useAppStore } from '../store/useAppStore'
import { usePathStore } from '../store/pathStore'
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
  const [searchCandidate, setSearchCandidate] = useState<SelectedGraphNode | null>(null)
  const [showMissingToast, setShowMissingToast] = useState(false)
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const requestNavigation = usePathStore((state) => state.requestNavigation)
  const setPathPanelOpen = usePathStore((state) => state.setPathPanelOpen)

  const rankedResults = useMemo(() => {
    return rankSearchResults(searchResults, {
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
      setSearchCandidate(null)
      setShowMissingToast(false)
      return
    }

    setIsSearching(true)
    setShowMissingToast(false)

    try {
      const graph = await searchNodes({
        keyword,
      })
      const graph = await searchNodes({
        keyword,
      })

      const results = mapSearchResults(graph.nodes)
      const focusNode = results[0]

      setSearchResults(results)

      if (!focusNode) {
        setSearchCandidate(null)
        setFocusedNode(null)
        setShowMissingToast(true)
        return
      }

      setSearchCandidate(focusNode)
      setShowMissingToast(false)
    } finally {
      setIsSearching(false)
    }
  }

  function activateSearchTask(node: SelectedGraphNode) {
    setPathPanelOpen(true)
    setFocusedNode(node)
    setCurrentFocusColumn(node.graphArea)
    setFocusedPanel(node.graphArea)
    setActiveNodeId(node.graphArea, node.id)
    setHighlightedNodes(buildHighlightMap([node]))
    setHiddenNodes(buildHiddenMap([node]))
    recalculateRecommendations([node], { hideDisliked: true })
    requestNavigation({
      nodeId: node.id,
      panelId: node.graphArea,
    })
  }

  function focusSearchResult(node: SelectedGraphNode) {
    setSearchCandidate(node)
    setShowMissingToast(false)
  }

  return (
    <div className="relative z-10 flex flex-col gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_16px_60px_rgba(19,26,34,0.08)] backdrop-blur">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="Search node name..."
            className="h-11 flex-1 rounded-2xl border border-ink-900/10 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-mint-500"
          />

          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isSearching}
            className="h-11 rounded-2xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60 md:w-auto"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>

          <button
            type="button"
            className="h-11 rounded-2xl bg-ink-950 px-4 text-sm font-semibold text-white transition hover:bg-ink-900 md:w-auto"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => {
              if (!searchCandidate) {
                return
              }

              activateSearchTask(searchCandidate)
            }}
            disabled={!searchCandidate}
            aria-label="Open inference task"
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition md:w-auto ${
              searchCandidate
                ? 'bg-ink-950 text-white hover:bg-ink-900'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            -&gt;
          </button>
        </div>

        {showMissingToast ? (
          <div className="w-fit rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            当前结点不存在
          </div>
        ) : null}

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
