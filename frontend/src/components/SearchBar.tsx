import { useState } from 'react'
import { getGraphByPanel } from '../services/homeService'
import { getNodesByCategory, searchNodes } from '../services/graphApi'
import { useGraphStore } from '../store/graphStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphPanelId, SelectedGraphNode } from '../types/graph'
import type { GraphNode as RawGraphNode } from '../types/graphApi'

const panelOptions: Array<{ label: string; value: '' | GraphPanelId }> = [
  { label: 'All Panels', value: '' },
  { label: 'Skill', value: 'skill' },
  { label: 'Job', value: 'job' },
  { label: 'Company', value: 'company' },
]

const labelOptions = [
  { label: 'All Labels', value: '' },
  { label: 'Skill', value: 'Skill' },
  { label: 'Job', value: 'Job' },
  { label: 'Company', value: 'Company' },
]

export function SearchBar() {
  const searchKeyword = useGraphStore((state) => state.searchKeyword)
  const activeFilters = useGraphStore((state) => state.activeFilters)
  const setSearchKeyword = useGraphStore((state) => state.setSearchKeyword)
  const setSearchResults = useGraphStore((state) => state.setSearchResults)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setHiddenNodes = useGraphStore((state) => state.setHiddenNodes)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const setActiveFilters = useGraphStore((state) => state.setActiveFilters)
  const [isSearching, setIsSearching] = useState(false)
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)

  async function handleSearch() {
    const keyword = searchKeyword.trim()

    if (!keyword && !activeFilters.labels?.[0]) {
      return
    }

    setIsSearching(true)

    try {
      const label = activeFilters.labels?.[0]
      const graph = label
        ? await getNodesByCategory(label)
        : await searchNodes({
            keyword,
            nodeType: activeFilters.areas?.[0],
            label: activeFilters.labels?.[0],
          })

      const results = mapSearchResults(graph.nodes)
      const focusNode = results[0]

      setSearchResults(results)

      if (!focusNode) {
        setFocusedNode(null)
        return
      }

      setFocusedNode(focusNode)
      setFocusedPanel(focusNode.graphArea)
      setActiveNodeId(focusNode.graphArea, focusNode.id)
      setHighlightedNodes(buildHighlightMap(results))
      setHiddenNodes(buildHiddenMap(results))
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="relative z-10 mt-6 flex flex-col gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_16px_60px_rgba(19,26,34,0.08)] backdrop-blur xl:flex-row xl:items-center">
      <input
        value={searchKeyword}
        onChange={(event) => setSearchKeyword(event.target.value)}
        placeholder="Search node name..."
        className="h-11 flex-1 rounded-2xl border border-ink-900/10 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-mint-500"
      />

      <select
        value={activeFilters.areas?.[0] ?? ''}
        onChange={(event) =>
          setActiveFilters({
            areas: event.target.value ? [event.target.value as GraphPanelId] : undefined,
          })
        }
        className="h-11 rounded-2xl border border-ink-900/10 bg-white px-4 text-sm text-ink-900 outline-none"
      >
        {panelOptions.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={activeFilters.labels?.[0] ?? ''}
        onChange={(event) =>
          setActiveFilters({
            labels: event.target.value ? [event.target.value] : undefined,
          })
        }
        className="h-11 rounded-2xl border border-ink-900/10 bg-white px-4 text-sm text-ink-900 outline-none"
      >
        {labelOptions.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => void handleSearch()}
        disabled={isSearching}
        className="h-11 rounded-2xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
    </div>
  )
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function resolvePanelByLabel(label: string): GraphPanelId {
  const normalized = normalize(label)

  if (normalized.includes('skill')) {
    return 'skill'
  }

  if (normalized.includes('company')) {
    return 'company'
  }

  return 'job'
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
