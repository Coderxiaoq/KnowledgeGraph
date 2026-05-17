import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useMemo } from 'react'
import { useGraphStore } from '../store/graphStore'
import { resolvePathNodePanel, usePathStore } from '../store/pathStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphPathNode, GraphPanelId } from '../types/graph'

export const PathBar = memo(function PathBar() {
  const currentPath = useGraphStore((state) => state.currentPath)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const setHighlightedNodes = useGraphStore((state) => state.setHighlightedNodes)
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode)
  const updatePathContext = useGraphStore((state) => state.updatePathContext)
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const hoveredPathNodeId = usePathStore((state) => state.hoveredPathNodeId)
  const activePathNodeId = usePathStore((state) => state.activePathNodeId)
  const setHoveredPathNodeId = usePathStore((state) => state.setHoveredPathNodeId)
  const requestNavigation = usePathStore((state) => state.requestNavigation)

  const pathNodes = currentPath?.nodes ?? []

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

  function handleNodeEnter(node: GraphPathNode) {
    const panelId = nodeAreaMap[node.id]
    setHoveredPathNodeId(node.id)
    setHighlightedNodes({
      ...highlightedNodes,
      [panelId]: Array.from(new Set([...highlightedNodes[panelId], node.id])),
    })
  }

  function handleNodeLeave() {
    setHoveredPathNodeId(null)
  }

  function handleNodeClick(node: GraphPathNode) {
    const panelId = nodeAreaMap[node.id]
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

  return (
    <div
      data-allow-focus-interaction="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-2 md:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="pointer-events-auto mx-auto max-w-7xl overflow-hidden rounded-t-[28px] rounded-b-[22px] border border-white/70 bg-white/82 shadow-[0_-10px_32px_rgba(19,26,34,0.09)] backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,231,199,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,209,102,0.14),transparent_28%)]" />
        <div className="relative flex items-center gap-4 border-b border-ink-900/6 px-5 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.36em] text-mint-500/80">
              Inference Trail
            </p>
            <p className="mt-1 text-sm text-ink-900">
              当前推理路径栏
            </p>
          </div>
          <motion.div
            className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-ink-900/6"
            initial={false}
          >
            <motion.div
              className="h-full w-14 bg-[linear-gradient(90deg,rgba(122,231,199,0.1),rgba(23,184,144,0.95),rgba(255,209,102,0.2))]"
              animate={{ x: ['-10%', '120%'] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.4, ease: 'linear' }}
            />
          </motion.div>
        </div>

        <div className="relative overflow-x-auto px-4 py-3">
          <AnimatePresence mode="wait">
            {pathNodes.length > 0 ? (
              <motion.div
                key="path"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-w-max items-center gap-2"
              >
                {pathNodes.map((node, index) => (
                  <div key={node.id} className="flex items-center gap-2">
                    <PathNode
                      node={node}
                      isHovered={hoveredPathNodeId === node.id}
                      isActive={activePathNodeId === node.id}
                      onHoverStart={() => handleNodeEnter(node)}
                      onHoverEnd={handleNodeLeave}
                      onClick={() => handleNodeClick(node)}
                    />
                    {index < pathNodes.length - 1 ? <PathEdge /> : null}
                  </div>
                ))}
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

type PathNodeProps = {
  node: GraphPathNode
  isHovered: boolean
  isActive: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
  onClick: () => void
}

function PathNode({
  node,
  isHovered,
  isActive,
  onHoverStart,
  onHoverEnd,
  onClick,
}: PathNodeProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92, y: 14 }}
      animate={{ opacity: 1, scale: isHovered || isActive ? 1.04 : 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onClick}
      className={`group relative rounded-2xl border px-4 py-3 text-left transition ${
        isHovered || isActive
          ? 'border-mint-500/45 bg-mint-500/10 text-ink-950 shadow-[0_10px_24px_rgba(23,184,144,0.12)]'
          : 'border-ink-900/8 bg-white/78 text-ink-900 hover:border-mint-500/30 hover:bg-paper-50'
      }`}
    >
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(122,231,199,0.16),transparent_62%)] opacity-0 transition group-hover:opacity-100" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-500">
          {node.category || 'Path Node'}
        </p>
        <p className="mt-1 whitespace-nowrap text-sm font-semibold">{node.label}</p>
      </div>
    </motion.button>
  )
}

function PathEdge() {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1 }}
      className="relative flex items-center"
    >
      <motion.div
        className="h-px w-12 bg-[linear-gradient(90deg,rgba(122,231,199,0.12),rgba(23,184,144,0.9),rgba(255,209,102,0.08))]"
        animate={{ backgroundPositionX: ['0%', '100%'] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: 'linear' }}
      />
      <motion.span
        className="ml-1 text-mint-500"
        animate={{ x: [0, 4, 0], opacity: [0.45, 1, 0.45] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: 'easeInOut' }}
      >
        →
      </motion.span>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="flex min-h-16 items-center justify-center rounded-2xl border border-dashed border-ink-900/10 bg-paper-50/70 px-4 py-4 text-sm text-ink-500"
    >
      开始探索后，这里会实时记录当前推理路径。
    </motion.div>
  )
}
