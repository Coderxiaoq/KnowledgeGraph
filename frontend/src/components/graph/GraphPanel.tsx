import { motion } from 'framer-motion'
import type { MouseEvent } from 'react'
import { GraphPreview } from '../../graph/GraphPreview'
import type { GraphData, GraphPanelId } from '../../types/graph'

type GraphPanelProps = {
  panelId: GraphPanelId
  title: string
  subtitle: string
  graph: GraphData
  isFocused: boolean
  isCenter: boolean
  side: 'left' | 'center' | 'right'
  activeNodeId: string
  onFocus: () => void
}

export function GraphPanel({
  panelId,
  title,
  subtitle: _subtitle,
  graph,
  isFocused,
  isCenter,
  side,
  activeNodeId,
  onFocus,
}: GraphPanelProps) {
  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onFocus()
  }

  return (
    <motion.div
      layout
      className="group relative flex h-full min-h-[440px] w-full min-w-0 min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/78 text-left shadow-[0_24px_80px_rgba(19,26,34,0.12)] backdrop-blur-xl"
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(122,231,199,0.24),_transparent_65%)]" />

      <div className="relative z-10 flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-ink-500">
            {side} panel
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink-950">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] ${
              isFocused
                ? 'bg-amber-500 text-ink-950'
                : isCenter
                  ? 'bg-ink-900 text-mint-300'
                  : 'bg-ink-900 text-mint-300'
            }`}
          >
            {activeNodeId}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em] transition ${
              isFocused
                ? 'bg-white text-ink-900 shadow-[0_10px_24px_rgba(19,26,34,0.12)]'
                : 'bg-ink-950 text-white hover:bg-ink-900'
            }`}
            aria-label={isFocused ? `Collapse ${title}` : `Focus ${title}`}
          >
            {isFocused ? 'Collapse' : 'Focus'}
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-1 flex-1 min-h-0 px-4 pb-4">
        <div className="h-full min-h-0 overflow-hidden rounded-[24px] border border-ink-900/8 bg-paper-50/70 p-3 [contain:layout_paint_size]">
          <GraphPreview panelId={panelId} graph={graph} isPanelFocused={isFocused} />
        </div>
      </div>
    </motion.div>
  )
}
