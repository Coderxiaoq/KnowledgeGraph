import { AnimatePresence, motion } from 'framer-motion'
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useGraphStore } from '../store/graphStore'
import { resolvePathNodePanel, usePathStore } from '../store/pathStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphPathEdge, GraphPathNode, GraphPanelId } from '../types/graph'

const FLOATING_WINDOW_WIDTH = 860
const FLOATING_WINDOW_MARGIN = 20
const DEFAULT_POSITION = { x: 0, y: 0 }
const PANEL_ORDER: GraphPanelId[] = ['skill', 'job', 'company']
const MAX_NODES_PER_COLUMN = 5

const PANEL_META: Record<
  GraphPanelId,
  {
    title: string
    accent: string
    pill: string
  }
> = {
  skill: {
    title: 'Skill',
    accent: 'from-[#6fe5c1]/80 via-[#c8f5e7]/50 to-transparent',
    pill: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  },
  job: {
    title: 'Job',
    accent: 'from-[#7dd3fc]/75 via-[#e0f2fe]/60 to-transparent',
    pill: 'border-sky-200/80 bg-sky-50 text-sky-700',
  },
  company: {
    title: 'Company',
    accent: 'from-[#ffd166]/78 via-[#fff2c7]/55 to-transparent',
    pill: 'border-amber-200/80 bg-amber-50 text-amber-700',
  },
}

type PanelNode = GraphPathNode & {
  graphArea: GraphPanelId
  isPrimary: boolean
  relationCount: number
}

type PathPanel = {
  id: GraphPanelId
  title: string
  nodes: PanelNode[]
}

type NodeRect = {
  x: number
  y: number
  width: number
  height: number
}

type ConnectionPath = GraphPathEdge & {
  sourceNode: PanelNode
  targetNode: PanelNode
  sourceRect: NodeRect
  targetRect: NodeRect
  relationType: string
}

export const PathBar = memo(function PathBar() {
  const currentPath = useGraphStore((state) => state.currentPath)
  const focusedNode = useGraphStore((state) => state.focusedNode)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const resetGraphState = useGraphStore((state) => state.resetGraphState)
  const updatePathContext = useGraphStore((state) => state.updatePathContext)
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const hoveredPathNodeId = usePathStore((state) => state.hoveredPathNodeId)
  const activePathNodeId = usePathStore((state) => state.activePathNodeId)
  const isPathPanelOpen = usePathStore((state) => state.isPathPanelOpen)
  const setHoveredPathNodeId = usePathStore((state) => state.setHoveredPathNodeId)
  const setPathPanelOpen = usePathStore((state) => state.setPathPanelOpen)
  const requestNavigation = usePathStore((state) => state.requestNavigation)

  const [position, setPosition] = useState(DEFAULT_POSITION)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [nodeRects, setNodeRects] = useState<Record<string, NodeRect>>({})
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const panelRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const nodeElementRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const pathNodes = currentPath?.nodes ?? []
  const pathEdges = currentPath?.edges ?? []

  useEffect(() => {
    updatePathContext(
      pathNodes.map((node) => ({
        id: node.id,
        label: node.label,
        category: node.category,
        graphArea: resolvePathNodePanel(node),
      })),
    )
  }, [pathNodes, updatePathContext])

  const nodeAreaMap = useMemo(
    () =>
      pathNodes.reduce<Record<string, GraphPanelId>>((acc, node) => {
        acc[node.id] = resolvePathNodePanel(node)
        return acc
      }, {}),
    [pathNodes],
  )

  const panels = useMemo(
    () => buildPanels(pathNodes, pathEdges, focusedNode, nodeAreaMap),
    [focusedNode, nodeAreaMap, pathEdges, pathNodes],
  )

  const nodeMap = useMemo(() => {
    const map = new Map<string, PanelNode>()
    for (const panel of panels) {
      for (const node of panel.nodes) {
        map.set(node.id, node)
      }
    }
    return map
  }, [panels])

  const connections = useMemo(
    () => buildConnections(pathEdges, nodeMap, nodeRects),
    [nodeMap, nodeRects, pathEdges],
  )

  useEffect(() => {
    if (!currentPath || !isPathPanelOpen) {
      return
    }

    setPosition(getDefaultPosition())
  }, [currentPath, isPathPanelOpen])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    if (!isPathPanelOpen || !currentPath) {
      return
    }

    function measure() {
      const contentRect = contentRef.current?.getBoundingClientRect()

      if (!contentRect) {
        return
      }

      const nextRects: Record<string, NodeRect> = {}

      for (const [nodeId, element] of Object.entries(nodeElementRefs.current)) {
        if (!element) {
          continue
        }

        const rect = element.getBoundingClientRect()
        nextRects[nodeId] = {
          x: rect.left - contentRect.left,
          y: rect.top - contentRect.top,
          width: rect.width,
          height: rect.height,
        }
      }

      setNodeRects(nextRects)
      setCanvasSize({
        width: contentRect.width,
        height: contentRect.height,
      })
    }

    const rafId = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', measure)
    }
  }, [currentPath, isPathPanelOpen, panels, position])

  if (!currentPath || !isPathPanelOpen) {
    return null
  }

  function handleNodeEnter(node: PanelNode) {
    const panelId = node.graphArea
    setHoveredPathNodeId(node.id)
    setHighlightedNodes({
      ...highlightedNodes,
      [panelId]: Array.from(new Set([...highlightedNodes[panelId], node.id])),
    })
  }

  function handleNodeLeave() {
    setHoveredPathNodeId(null)
  }

  function handleNodeClick(node: PanelNode) {
    const panelId = node.graphArea
    setFocusedPanel(panelId)
    setActiveNodeId(panelId, node.id)
    setFocusedNode({
      id: node.id,
      label: node.label,
      category: node.category,
      graphArea: panelId,
    })
    requestNavigation({
      nodeId: node.id,
      panelId,
    })
  }

  function handleClose(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setPathPanelOpen(false)
    resetGraphState()
    setFocusedNode(null)
    setFocusedPanel(null)
    setActiveNodeId('skill', '')
    setActiveNodeId('job', '')
    setActiveNodeId('company', '')
    setHoveredPathNodeId(null)
    setHoveredEdgeId(null)
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button')) {
      return
    }

    const bounds = panelRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }

    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOffsetRef.current) {
      return
    }

    const nextPosition = clampToViewport({
      x: event.clientX - dragOffsetRef.current.x,
      y: event.clientY - dragOffsetRef.current.y,
    })

    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current)
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null
      setPosition(nextPosition)
    })
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      data-allow-focus-interaction="true"
      className="pointer-events-none fixed inset-0 z-40"
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.97, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          opacity: { duration: 0.26, ease: 'easeOut' },
          scale: { duration: 0.26, ease: 'easeOut' },
          y: { duration: 0.26, ease: 'easeOut' },
        }}
        style={{
          position: 'absolute',
          top: position.y,
          left: position.x,
          width: `min(${FLOATING_WINDOW_WIDTH}px, calc(100vw - 2rem))`,
        }}
        className="pointer-events-auto overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(238,252,247,0.9),rgba(255,255,255,0.96)_56%,rgba(255,248,235,0.92))] shadow-[0_24px_60px_rgba(19,26,34,0.14)] backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,231,199,0.13),transparent_36%),radial-gradient(circle_at_top_right,rgba(255,209,102,0.1),transparent_28%)]" />

        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className="relative flex cursor-grab select-none items-start gap-3 border-b border-ink-900/6 px-5 py-4 active:cursor-grabbing"
        >
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-mint-500/85">
              Inference Trail
            </p>
            <p className="mt-2 text-base font-semibold text-ink-950">当前知识推荐链路</p>
          </div>

          <div className="mt-1 hidden h-3 w-24 overflow-hidden rounded-full bg-white/60 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)] md:block">
            <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.55)_28%,rgba(35,211,166,0.88)_76%,rgba(255,209,102,0.42)_100%)]" />
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="relative z-10 rounded-full border border-ink-900/8 bg-white/90 px-3 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-white"
          >
            Close
          </button>
        </div>

        <div className="relative px-4 py-4">
          <AnimatePresence mode="wait">
            {panels.some((panel) => panel.nodes.length > 0) ? (
              <motion.div
                key="knowledge-lane"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                ref={contentRef}
                className="relative overflow-hidden rounded-[22px] border border-white/70 bg-white/56 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(122,231,199,0.05),rgba(255,255,255,0)_25%,rgba(125,211,252,0.05)_62%,rgba(255,209,102,0.06)_100%)]" />

                {canvasSize.width > 0 && canvasSize.height > 0 ? (
                  <svg
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
                    viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="knowledge-edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(111,229,193,0.16)" />
                        <stop offset="45%" stopColor="rgba(35,211,166,0.92)" />
                        <stop offset="100%" stopColor="rgba(125,211,252,0.74)" />
                      </linearGradient>
                      <filter id="knowledge-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3.6" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <marker
                        id="knowledge-edge-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(35,211,166,0.95)" />
                      </marker>
                    </defs>

                    {connections.map((edge) => (
                      <ConnectionArrow
                        key={edge.id}
                        edge={edge}
                        isHovered={hoveredEdgeId === edge.id}
                        onHover={setHoveredEdgeId}
                      />
                    ))}
                  </svg>
                ) : null}

                <div className="relative z-10 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
                  {panels.map((panel) => (
                    <section
                      key={panel.id}
                      className="min-h-[290px] rounded-[18px] border border-white/65 bg-white/42 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-500">
                            {panel.title}
                          </p>
                          <div className={`mt-2 h-1.5 w-14 rounded-full bg-gradient-to-r ${PANEL_META[panel.id].accent}`} />
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${PANEL_META[panel.id].pill}`}
                        >
                          {panel.nodes.length}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-2.5">
                        {panel.nodes.length > 0 ? (
                          panel.nodes.map((node) => (
                            <NodeCard
                              key={node.id}
                              node={node}
                              isHovered={hoveredPathNodeId === node.id}
                              isActive={activePathNodeId === node.id}
                              nodeRef={(element) => {
                                nodeElementRefs.current[node.id] = element
                              }}
                              onHoverStart={() => handleNodeEnter(node)}
                              onHoverEnd={handleNodeLeave}
                              onClick={() => handleNodeClick(node)}
                            />
                          ))
                        ) : (
                          <EmptyColumn label={panel.title} />
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </motion.div>
            ) : (
              <EmptyState key="empty" />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
})

type NodeCardProps = {
  node: PanelNode
  isHovered: boolean
  isActive: boolean
  nodeRef: (element: HTMLButtonElement | null) => void
  onHoverStart: () => void
  onHoverEnd: () => void
  onClick: () => void
}

function NodeCard({
  node,
  isHovered,
  isActive,
  nodeRef,
  onHoverStart,
  onHoverEnd,
  onClick,
}: NodeCardProps) {
  return (
    <motion.button
      ref={nodeRef}
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onClick}
      className={`group relative rounded-[18px] border px-3 py-3 text-left transition ${
        node.isPrimary
          ? 'border-[#cfeee4] bg-[linear-gradient(135deg,rgba(220,247,239,0.95),rgba(255,255,255,0.98))] shadow-[0_16px_34px_rgba(122,231,199,0.14)]'
          : isHovered || isActive
            ? 'border-[#d5e9e2] bg-white/94 shadow-[0_12px_28px_rgba(21,128,106,0.08)]'
            : 'border-[#e5ece9] bg-white/86 shadow-[0_8px_22px_rgba(15,23,42,0.04)] hover:border-[#d7e6e1]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_top_left,rgba(122,231,199,0.08),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.06),transparent_34%)] opacity-0 transition group-hover:opacity-100" />
      <div className="relative min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,#46d7ab,#7dd3fc)] shadow-[0_0_0_3px_rgba(111,229,193,0.14)]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-slate-500">
            {PANEL_META[node.graphArea].title}
          </p>
          {node.isPrimary ? (
            <span className="rounded-full border border-mint-500/16 bg-mint-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-mint-700">
              Primary
            </span>
          ) : null}
        </div>

        <p className="mt-2.5 line-clamp-2 text-[16px] font-semibold leading-[1.25] tracking-[-0.02em] text-slate-800">
          {node.label}
        </p>

        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
          <span className="truncate uppercase tracking-[0.14em]">{node.category}</span>
          <span>{node.relationCount} links</span>
        </div>
      </div>
    </motion.button>
  )
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-ink-900/10 bg-white/52 px-4 py-6 text-center text-sm text-ink-500">
      暂无可展示的 {label} 关联节点
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="flex min-h-24 items-center justify-center rounded-[24px] border border-dashed border-ink-900/10 bg-white/55 px-4 py-5 text-sm text-ink-500"
    >
      开始搜索后，这里会展示当前节点的实时推理链路。
    </motion.div>
  )
}

function ConnectionArrow({
  edge,
  isHovered,
  onHover,
}: {
  edge: ConnectionPath
  isHovered: boolean
  onHover: (edgeId: string | null) => void
}) {
  const startX = edge.sourceRect.x + edge.sourceRect.width
  const startY = edge.sourceRect.y + edge.sourceRect.height / 2
  const endX = edge.targetRect.x
  const endY = edge.targetRect.y + edge.targetRect.height / 2
  const deltaX = endX - startX
  const curveOffset = Math.max(32, Math.min(84, Math.abs(deltaX) * 0.35))
  const controlX1 = startX + curveOffset
  const controlX2 = endX - curveOffset
  const path = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`

  return (
    <g onMouseEnter={() => onHover(edge.id)} onMouseLeave={() => onHover(null)}>
      <path
        d={path}
        fill="none"
        stroke="rgba(111,229,193,0.16)"
        strokeWidth={isHovered ? 10 : 8}
        strokeLinecap="round"
        filter="url(#knowledge-edge-glow)"
      />
      <path
        d={path}
        fill="none"
        stroke="url(#knowledge-edge-gradient)"
        strokeWidth={isHovered ? 2.6 : 2.1}
        strokeLinecap="round"
        markerEnd="url(#knowledge-edge-arrow)"
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="18"
      />
      <text
        x={(startX + endX) / 2}
        y={(startY + endY) / 2 - 10}
        textAnchor="middle"
        fontSize="10"
        letterSpacing="0.22em"
        fill={isHovered ? 'rgba(35,211,166,0.95)' : 'rgba(100,116,139,0.82)'}
      >
        {edge.relationType.toUpperCase()}
      </text>
    </g>
  )
}

function buildPanels(
  nodes: GraphPathNode[],
  edges: GraphPathEdge[],
  focusedNode: ReturnType<typeof useGraphStore.getState>['focusedNode'],
  nodeAreaMap: Record<string, GraphPanelId>,
): PathPanel[] {
  const grouped = PANEL_ORDER.reduce<Record<GraphPanelId, PanelNode[]>>(
    (acc, panelId) => {
      acc[panelId] = []
      return acc
    },
    {
      skill: [],
      job: [],
      company: [],
    },
  )

  const relationCounts = countRelations(edges)

  for (const node of nodes) {
    const graphArea = nodeAreaMap[node.id]
    grouped[graphArea].push({
      ...node,
      graphArea,
      isPrimary: focusedNode
        ? focusedNode.graphArea === graphArea && focusedNode.id === node.id
        : grouped[graphArea].length === 0,
      relationCount: relationCounts.get(node.id) ?? 0,
    })
  }

  for (const panelId of PANEL_ORDER) {
    grouped[panelId] = selectColumnNodes(grouped[panelId], focusedNode?.id ?? null)
  }

  return PANEL_ORDER.map((panelId) => ({
    id: panelId,
    title: PANEL_META[panelId].title,
    nodes: grouped[panelId],
  }))
}

function selectColumnNodes(nodes: PanelNode[], focusedNodeId: string | null) {
  const sorted = [...nodes].sort((left, right) => {
    if (left.id === focusedNodeId) {
      return -1
    }

    if (right.id === focusedNodeId) {
      return 1
    }

    if (left.isPrimary && !right.isPrimary) {
      return -1
    }

    if (right.isPrimary && !left.isPrimary) {
      return 1
    }

    if (right.relationCount !== left.relationCount) {
      return right.relationCount - left.relationCount
    }

    return left.label.localeCompare(right.label)
  })

  if (sorted.length <= MAX_NODES_PER_COLUMN) {
    return sorted
  }

  const primaryNode = sorted.find((node) => node.isPrimary) ?? sorted[0]
  const relatedNodes = sorted.filter((node) => node.id !== primaryNode.id)

  return [
    primaryNode,
    ...shuffleNodes(relatedNodes).slice(0, MAX_NODES_PER_COLUMN - 1),
  ]
}

function shuffleNodes(nodes: PanelNode[]) {
  const next = [...nodes]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next.sort((left, right) => right.relationCount - left.relationCount)
}

function countRelations(edges: GraphPathEdge[]) {
  const relationCounts = new Map<string, number>()

  for (const edge of edges) {
    relationCounts.set(edge.source, (relationCounts.get(edge.source) ?? 0) + 1)
    relationCounts.set(edge.target, (relationCounts.get(edge.target) ?? 0) + 1)
  }

  return relationCounts
}

function buildConnections(
  edges: GraphPathEdge[],
  nodeMap: Map<string, PanelNode>,
  nodeRects: Record<string, NodeRect>,
) {
  return edges
    .map((edge) => {
      const sourceNode = nodeMap.get(edge.source)
      const targetNode = nodeMap.get(edge.target)
      const sourceRect = nodeRects[edge.source]
      const targetRect = nodeRects[edge.target]

      if (!sourceNode || !targetNode || !sourceRect || !targetRect) {
        return null
      }

      const allowedDirection =
        (sourceNode.graphArea === 'skill' && targetNode.graphArea === 'job') ||
        (sourceNode.graphArea === 'job' && targetNode.graphArea === 'company')

      if (!allowedDirection) {
        return null
      }

      return {
        ...edge,
        sourceNode,
        targetNode,
        sourceRect,
        targetRect,
        relationType: edge.label || 'related_to',
      }
    })
    .filter((edge): edge is ConnectionPath => edge !== null)
}

function getDefaultPosition() {
  if (typeof window === 'undefined') {
    return DEFAULT_POSITION
  }

  const width = Math.min(FLOATING_WINDOW_WIDTH, window.innerWidth - FLOATING_WINDOW_MARGIN * 2)
  return clampToViewport({
    x: Math.max(FLOATING_WINDOW_MARGIN, window.innerWidth / 2 - width / 2),
    y: 104,
  })
}

function clampToViewport(position: { x: number; y: number }) {
  if (typeof window === 'undefined') {
    return position
  }

  const actualWidth = Math.min(FLOATING_WINDOW_WIDTH, window.innerWidth - FLOATING_WINDOW_MARGIN * 2)
  const maxX = Math.max(
    FLOATING_WINDOW_MARGIN,
    window.innerWidth - actualWidth - FLOATING_WINDOW_MARGIN,
  )
  const maxY = Math.max(FLOATING_WINDOW_MARGIN, window.innerHeight - 220)

  return {
    x: Math.min(Math.max(FLOATING_WINDOW_MARGIN, position.x), maxX),
    y: Math.min(Math.max(84, position.y), maxY),
  }
}
