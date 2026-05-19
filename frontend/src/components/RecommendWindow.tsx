import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useGraphStore } from '../store/graphStore'
import type { ComboChain } from '../types/graphApi'

const WINDOW_WIDTH = 1160
const WINDOW_MARGIN = 20
const CHAINS_PER_PAGE = 1

const NODE_STYLES = {
  skill: {
    ring: 'border-emerald-200 bg-emerald-50',
    text: 'text-emerald-800',
    tag: 'text-emerald-500',
  },
  role: {
    ring: 'border-sky-200 bg-sky-50',
    text: 'text-sky-800',
    tag: 'text-sky-400',
  },
  company: {
    ring: 'border-amber-200 bg-amber-50',
    text: 'text-amber-800',
    tag: 'text-amber-500',
  },
} as const

type NodeType = keyof typeof NODE_STYLES

function ChainNodeCircle({ label, type }: { label: string; type: NodeType }) {
  const s = NODE_STYLES[type]
  const short = label.length > 8 ? `${label.slice(0, 7)}…` : label
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div
        className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 ${s.ring}`}
      >
        <span className={`px-1 text-center text-[10px] font-semibold leading-tight ${s.text}`}>
          {short}
        </span>
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-wide ${s.tag}`}>{type}</span>
    </div>
  )
}

function ChainArrowSvg() {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      className="flex-shrink-0 self-center"
    >
      <path
        d="M1 6h14M11 1l5 5-5 5"
        stroke="rgba(148,163,184,0.7)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MemberChainRow({ member, index }: { member: any; index: number }) {
  const nodes = member.nodes || {}
  const nameOf = (node: any) => {
    if (!node) return ''
    const props = node.properties || {}
    return (typeof props.name === 'string' && props.name.trim()) ? props.name : (node.label || node.id || '')
  }

  const isGradient: boolean = !!member.is_gradient
  const edgeColor = isGradient ? 'bg-amber-400' : 'bg-emerald-400'
  const badgeBg = isGradient
    ? 'bg-amber-50 border-amber-200'
    : 'bg-emerald-50 border-emerald-200'

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${badgeBg}`}>
      <div className="flex flex-shrink-0 flex-col items-center gap-1 w-14">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 text-[10px] font-bold text-white">
          {index + 1}
        </div>
        <span className="tabular-nums text-[11px] font-bold text-mint-600">{(member.score ?? 0).toFixed(3)}</span>
        {isGradient && member.derivative != null ? (
          <span className="tabular-nums text-[10px] font-semibold text-amber-600" title="偏好改为正向后的得分增益">
            +{(member.derivative as number).toFixed(2)}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-40 items-center justify-center rounded-xl border-2 border-ink-100 bg-white text-sm font-semibold text-ink-900">
            {nameOf(nodes.skill)}
          </div>
          <span className="text-[10px] text-slate-400">Skill</span>
        </div>

        <div className="flex flex-col items-center">
          <div className={`h-2 w-28 ${edgeColor} rounded-md`} />
          <span className="text-[10px] text-slate-400">→</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-40 items-center justify-center rounded-xl border-2 border-ink-100 bg-white text-sm font-semibold text-ink-900">
            {nameOf(nodes.role)}
          </div>
          <span className="text-[10px] text-slate-400">Role</span>
        </div>

        <div className="flex flex-col items-center">
          <div className={`h-2 w-28 ${edgeColor} rounded-md`} />
          <span className="text-[10px] text-slate-400">→</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-40 items-center justify-center rounded-xl border-2 border-ink-100 bg-white text-sm font-semibold text-ink-900">
            {nameOf(nodes.company)}
          </div>
          <span className="text-[10px] text-slate-400">Company</span>
        </div>
      </div>

      {member.reason ? (
        <p className="line-clamp-3 max-w-[180px] flex-shrink-0 text-right text-[11px] leading-tight text-slate-400">
          {member.reason}
        </p>
      ) : null}
    </div>
  )
}

function ChainRow({ chain }: { chain: ComboChain }) {
  const members = chain.member_chains ?? []
  const topCount = members.filter((m) => !m.is_gradient).length
  const gradientCount = members.filter((m) => m.is_gradient).length

  const roleNode = chain.nodes?.find((n) => n.label === 'Role')
  const companyNode = chain.nodes?.find((n) => n.label === 'Company')
  const nameOf = (n?: { id: string; properties?: Record<string, unknown> }) =>
    n ? ((n.properties?.name as string) || n.id) : '—'

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-ink-900/8 bg-white/90 px-4 py-3">
        <div className="text-sm font-semibold text-ink-900">
          {nameOf(roleNode)}
          <span className="mx-1.5 text-slate-300">×</span>
          {nameOf(companyNode)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-slate-500">score {chain.score.toFixed(3)}</span>
          <span className="text-slate-200">|</span>
          <span className="text-[11px] font-medium text-emerald-600">高分 {topCount} 条</span>
          <span className="text-slate-200">+</span>
          <span className="text-[11px] font-medium text-amber-600">潜力 {gradientCount} 条</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m, idx) => (
          <MemberChainRow key={idx} member={m} index={idx} />
        ))}
      </div>
    </div>
  )
}

export const RecommendWindow = memo(function RecommendWindow() {
  const recommendChains = useGraphStore((state) => state.recommendChains)
  const setRecommendChains = useGraphStore((state) => state.setRecommendChains)
  const isRecommendWindowOpen = useGraphStore((state) => state.isRecommendWindowOpen)
  const setIsRecommendWindowOpen = useGraphStore((state) => state.setIsRecommendWindowOpen)

  const [page, setPage] = useState(0)
  const [position, setPosition] = useState(getDefaultPosition)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)

  const sortedChains = useMemo(
    () => [...recommendChains].sort((a, b) => b.score - a.score),
    [recommendChains],
  )

  const totalPages = Math.ceil(sortedChains.length / CHAINS_PER_PAGE)
  const pageChains = sortedChains.slice(page * CHAINS_PER_PAGE, (page + 1) * CHAINS_PER_PAGE)

  useEffect(() => {
    setPage(0)
    if (recommendChains.length > 0) {
      setPosition(getDefaultPosition())
    }
  }, [recommendChains])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[RecommendWindow] recommendChains', recommendChains)
    }
  }, [recommendChains])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current)
    }
  }, [])

  function handleClose() {
    setIsRecommendWindowOpen(false)
    setRecommendChains([])
    setPage(0)
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('button')) return
    const bounds = panelRef.current?.getBoundingClientRect()
    if (!bounds) return
    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOffsetRef.current) return
    const next = clampToViewport({
      x: event.clientX - dragOffsetRef.current.x,
      y: event.clientY - dragOffsetRef.current.y,
    })
    if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current)
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null
      setPosition(next)
    })
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div data-allow-focus-interaction="true" className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {isRecommendWindowOpen ? (
          <motion.div
            ref={panelRef}
            key="recommend-window"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: position.y,
              left: position.x,
              width: `min(${WINDOW_WIDTH}px, calc(100vw - 2rem))`,
            }}
            className="pointer-events-auto flex max-h-[85vh] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(238,252,247,0.92),rgba(255,255,255,0.97)_56%,rgba(248,248,255,0.94))] shadow-[0_24px_60px_rgba(19,26,34,0.14)] backdrop-blur-xl"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,231,199,0.10),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.08),transparent_30%)]" />

            {/* header */}
            <div
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              className="relative flex flex-shrink-0 cursor-grab select-none items-center gap-3 border-b border-ink-900/6 px-5 py-4 active:cursor-grabbing"
            >
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-mint-500/85">
                  Recommendation
                </p>
                <p className="mt-1 text-base font-semibold text-ink-950">
                  知识推理链路
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    共 {sortedChains.length} 条
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-ink-900/8 bg-white/90 px-3 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-white"
              >
                Close
              </button>
            </div>

            {/* chain list / loading / empty — scrollable */}
            <div className="relative flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
              {sortedChains.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-ink-900/10 bg-white/60 text-sm text-slate-400">
                  推荐计算中，若长时间无结果请检查偏好节点是否有效…
                </div>
              ) : (
                pageChains.map((chain, i) => (
                  <ChainRow key={`${page}-${i}`} chain={chain} />
                ))
              )}
            </div>

            {/* pagination — always visible, pinned to bottom */}
            {sortedChains.length > 0 ? (
              <div className="relative flex flex-shrink-0 items-center justify-between border-t border-ink-900/6 bg-white/60 px-5 py-3 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-full border border-ink-900/8 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  ← 上一页
                </button>
                <span className="text-xs font-medium text-slate-600">
                  第 {page + 1} / {totalPages} 页（共 {totalPages} 条推荐链路）
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="rounded-full border border-ink-900/8 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  下一页 →
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
})

function getDefaultPosition() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const w = Math.min(WINDOW_WIDTH, window.innerWidth - WINDOW_MARGIN * 2)
  return clampToViewport({
    x: Math.max(WINDOW_MARGIN, window.innerWidth / 2 - w / 2),
    y: 120,
  })
}

function clampToViewport(pos: { x: number; y: number }) {
  if (typeof window === 'undefined') return pos
  const w = Math.min(WINDOW_WIDTH, window.innerWidth - WINDOW_MARGIN * 2)
  return {
    x: Math.min(Math.max(WINDOW_MARGIN, pos.x), window.innerWidth - w - WINDOW_MARGIN),
    y: Math.min(Math.max(84, pos.y), window.innerHeight - 220),
  }
}
