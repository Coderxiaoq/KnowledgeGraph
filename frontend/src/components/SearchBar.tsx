import { useMemo, useState } from 'react'
import { rankSearchResults } from '../graph/preferenceEngine'
import { resolvePanelByLabel as resolvePanelByLabelFromGraph } from '../graph/data'
import { getGraphByPanel } from '../services/homeService'
import { searchNodes, clearFilters, addFilter, removeFilter, recommend2To1 } from '../services/graphApi'
import { useGraphStore } from '../store/graphStore'
import { usePathStore } from '../store/pathStore'
import type { GraphPanelId, SelectedGraphNode } from '../types/graph'
import type { GraphFilter, FilterOperator, FilterMode, GraphNode as RawGraphNode } from '../types/graphApi'

const FIELD_OPTIONS: { label: string; field: string; op: FilterOperator; placeholder: string; defaultMode: FilterMode; target: 'node' | 'edge' }[] = [
  { label: '薪资', field: 'salary', op: 'salary_in', placeholder: '预期薪资，如50000', defaultMode: 'positive', target: 'edge' },
  { label: '城市/地点', field: 'location', op: 'contains', placeholder: '如 北京', defaultMode: 'negative', target: 'node' },
  { label: '节点名称', field: 'name', op: 'contains', placeholder: '关键词', defaultMode: 'negative', target: 'node' },
]

export function SearchBar() {
  const searchKeyword = useGraphStore((state) => state.searchKeyword)
  const setSearchKeyword = useGraphStore((state) => state.setSearchKeyword)
  const setSearchResults = useGraphStore((state) => state.setSearchResults)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setHiddenNodes = useGraphStore((state) => state.setHiddenNodes)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const likedNodeIds = useGraphStore((state) => state.likedNodeIds)
  const dislikedNodeIds = useGraphStore((state) => state.dislikedNodeIds)
  const selectedNodes = useGraphStore((state) => state.selectedNodes)
  const focusedNode = useGraphStore((state) => state.focusedNode)
  const hoveredNode = useGraphStore((state) => state.hoveredNode)
  const currentFocusColumn = useGraphStore((state) => state.currentFocusColumn)
  const pathContextNodes = useGraphStore((state) => state.pathContextNodes)
  const processedColumns = useGraphStore((state) => state.processedColumns)
  const searchResults = useGraphStore((state) => state.searchResults)
  const backendFilterState = useGraphStore((state) => state.backendFilterState)
  const setBackendFilterState = useGraphStore((state) => state.setBackendFilterState)
  const bumpFilterRefreshKey = useGraphStore((state) => state.bumpFilterRefreshKey)
  const likedNodes = useGraphStore((state) => state.likedNodes)
  const dislikedNodes = useGraphStore((state) => state.dislikedNodes)
  const setRecommendChains = useGraphStore((state) => state.setRecommendChains)

  const [isSearching, setIsSearching] = useState(false)
  const [isRecommending, setIsRecommending] = useState(false)
  const [showMissingToast, setShowMissingToast] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedField, setSelectedField] = useState(FIELD_OPTIONS[0])
  const [filterValue, setFilterValue] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>(FIELD_OPTIONS[0].defaultMode)
  const [isApplying, setIsApplying] = useState(false)

  const preferenceAreas = useMemo(() => {
    const areas = new Set<GraphPanelId>()
    for (const node of likedNodes) areas.add(node.graphArea)
    for (const node of dislikedNodes) areas.add(node.graphArea)
    return areas
  }, [likedNodes, dislikedNodes])

  const canActivateRecommend = likedNodes.length > 0 && preferenceAreas.size >= 2

  const setPathPanelOpen = usePathStore((state) => state.setPathPanelOpen)

  const activeNodeFilters = [
    ...backendFilterState.node_filters,
    ...backendFilterState.edge_filters,
  ]

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
      setShowMissingToast(false)
      setHighlightedNodes({ skill: [], job: [], company: [] })
      setHiddenNodes({ skill: [], job: [], company: [] })
      return
    }

    setIsSearching(true)
    setShowMissingToast(false)

    try {
      const graph = await searchNodes({ keyword })

      const results = mapSearchResults(graph.nodes)
      const focusNode = results[0]

      setSearchResults(results)

      if (!focusNode) {
        setFocusedNode(null)
        setShowMissingToast(true)
        setHighlightedNodes({ skill: [], job: [], company: [] })
        setHiddenNodes({ skill: [], job: [], company: [] })
        return
      }

      setShowMissingToast(false)
      setHighlightedNodes(buildHighlightMap(results))
      setHiddenNodes({ skill: [], job: [], company: [] })
    } finally {
      setIsSearching(false)
    }
  }

  async function handleAddFilter() {
    const value = filterValue.trim()
    if (!value) return

    setIsApplying(true)
    try {
      const option: GraphFilter = {
        target: selectedField.target,
        field: selectedField.field,
        value,
        op: selectedField.op,
        mode: filterMode,
      }
      const newState = await addFilter(option)
      setBackendFilterState(newState)
      setFilterValue('')
      bumpFilterRefreshKey()
    } finally {
      setIsApplying(false)
    }
  }

  async function handleRemoveFilter(filter: GraphFilter) {
    setIsApplying(true)
    try {
      const newState = await removeFilter(filter)
      setBackendFilterState(newState)
      bumpFilterRefreshKey()
    } finally {
      setIsApplying(false)
    }
  }

  async function handleClearFilters() {
    setIsApplying(true)
    try {
      const newState = await clearFilters()
      setBackendFilterState(newState)
      setHighlightedNodes({ skill: [], job: [], company: [] })
      setHiddenNodes({ skill: [], job: [], company: [] })
      bumpFilterRefreshKey()
    } finally {
      setIsApplying(false)
    }
  }

  async function handleRecommendClick() {
    if (!canActivateRecommend) return

    const hasSkill = preferenceAreas.has('skill')
    const hasJob = preferenceAreas.has('job')
    const hasCompany = preferenceAreas.has('company')

    let type: 'skill_to_role' | 'role_to_company' | 'company_to_role'
    let primaryArea: GraphPanelId
    let secondaryArea: GraphPanelId

    if (hasSkill && hasCompany) {
      type = 'skill_to_role'
      primaryArea = 'skill'
      secondaryArea = 'company'
    } else if (hasSkill && hasJob) {
      type = 'role_to_company'
      primaryArea = 'job'
      secondaryArea = 'skill'
    } else {
      type = 'company_to_role'
      primaryArea = 'company'
      secondaryArea = 'job'
    }

    const primaryPos = likedNodes.filter((n) => n.graphArea === primaryArea).map((n) => n.id)
    const primaryNeg = dislikedNodes.filter((n) => n.graphArea === primaryArea).map((n) => n.id)
    const secondaryPos = likedNodes.filter((n) => n.graphArea === secondaryArea).map((n) => n.id)
    const secondaryNeg = dislikedNodes.filter((n) => n.graphArea === secondaryArea).map((n) => n.id)

    setIsRecommending(true)
    try {
      const result = await recommend2To1({
        type,
        primary_pos_list: primaryPos,
        primary_neg_list: primaryNeg,
        secondary_pos_list: secondaryPos,
        secondary_neg_list: secondaryNeg,
      })
      setRecommendChains(result.chains ?? [])
      setPathPanelOpen(true)
    } finally {
      setIsRecommending(false)
    }
  }

  function focusSearchResult(_node: SelectedGraphNode) {
    setShowMissingToast(false)
  }

  return (
    <div className="relative z-10 flex flex-col gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_16px_60px_rgba(19,26,34,0.08)] backdrop-blur">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch() }}
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
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition md:w-auto ${
              isFilterOpen || activeNodeFilters.length > 0
                ? 'bg-mint-500 text-white'
                : 'bg-ink-950 text-white hover:bg-ink-900'
            }`}
            title="过滤器"
          >
            {activeNodeFilters.length > 0 ? `筛选 (${activeNodeFilters.length})` : '+'}
          </button>

          <button
            type="button"
            onClick={() => void handleRecommendClick()}
            disabled={!canActivateRecommend || isRecommending}
            aria-label="Open recommendation chains"
            title={canActivateRecommend ? '生成推荐链路' : '请在至少两个图谱中设置节点偏好（至少一个正向）'}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition md:w-auto ${
              canActivateRecommend
                ? 'bg-ink-950 text-white hover:bg-ink-900'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            {isRecommending ? '…' : '->'}
          </button>
        </div>

        {showMissingToast ? (
          <div className="w-fit rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            当前结点不存在
          </div>
        ) : null}

        {isFilterOpen ? (
          <div className="rounded-2xl border border-ink-900/8 bg-white/90 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">节点过滤器</p>
              {activeNodeFilters.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleClearFilters()}
                  disabled={isApplying}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  清空全部
                </button>
              ) : null}
            </div>

            {activeNodeFilters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeNodeFilters.map((filter, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                      filter.mode === 'positive'
                        ? 'border-mint-200 bg-mint-50 text-mint-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    <span>{filter.field}:{String(filter.value)}</span>
                    <span className="opacity-60">({filter.mode === 'positive' ? '保留' : '排除'})</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveFilter(filter)}
                      disabled={isApplying}
                      className="ml-1 rounded-full leading-none opacity-60 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <select
                value={selectedField.field}
                onChange={(e) => {
                  const found = FIELD_OPTIONS.find((o) => o.field === e.target.value)
                  if (found) {
                    setSelectedField(found)
                    setFilterMode(found.defaultMode)
                  }
                }}
                className="h-9 rounded-xl border border-ink-900/10 bg-white px-3 text-sm text-ink-900 outline-none focus:border-mint-500"
              >
                {FIELD_OPTIONS.map((o) => (
                  <option key={o.field} value={o.field}>{o.label}</option>
                ))}
              </select>

              <input
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddFilter() }}
                placeholder={selectedField.placeholder}
                className="h-9 w-36 rounded-xl border border-ink-900/10 bg-white px-3 text-sm text-ink-900 outline-none focus:border-mint-500"
              />

              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="h-9 rounded-xl border border-ink-900/10 bg-white px-3 text-sm text-ink-900 outline-none focus:border-mint-500"
              >
                <option value="negative">排除匹配</option>
                <option value="positive">仅保留匹配</option>
              </select>

              <button
                type="button"
                onClick={() => void handleAddFilter()}
                disabled={isApplying || !filterValue.trim()}
                className="h-9 w-36 rounded-xl bg-ink-950 px-4 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-50"
              >
                添加
              </button>
            </div>
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

