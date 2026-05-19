import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { PathBar } from '../components/PathBar'
import { PathBar } from '../components/PathBar'
import { SearchBar } from '../components/SearchBar'
import { GraphPanel } from '../components/graph/GraphPanel'
import { AppShell } from '../components/layout/AppShell'
import { getGraphByPanel, getHomeContent } from '../services/homeService'
import { useGraphStore } from '../store/graphStore'
import { usePathStore } from '../store/pathStore'
import { useAppStore } from '../store/useAppStore'
import type { GraphPanelId } from '../types/graph'

const content = getHomeContent()

const baseOrder: GraphPanelId[] = ['skill', 'job', 'company']

const panels: Record<
  GraphPanelId,
  {
    id: GraphPanelId
    title: string
    subtitle: string
  }
> = {
  skill: {
    id: 'skill',
    title: 'Skill Graph',
    subtitle: '展示知识工程、NLP、RAG 与知识图谱等能力节点，支撑岗位技能画像与学习路径分析。',
  },
  job: {
    id: 'job',
    title: 'Job Graph',
    subtitle: '承载岗位推荐主图，连接目标岗位、职责能力与职业发展路径，是默认中心区域。',
  },
  company: {
    id: 'company',
    title: 'Company Graph',
    subtitle: '用于展示企业类型、团队方向与岗位适配关系，为求职策略和公司推荐提供上下文。',
  },
}

export function Home() {
  const graphLayoutRef = useRef<HTMLDivElement | null>(null)
  const focusedPanel = useAppStore((state) => state.focusedPanel)
  const activeNodeIds = useAppStore((state) => state.activeNodeIds)
  const setFocusedPanel = useAppStore((state) => state.setFocusedPanel)
  const isGraphInteracting = useGraphStore((state) => state.isGraphInteracting)
  const clearSelection = useGraphStore((state) => state.clearSelection)
  const setActiveNodeId = useAppStore((state) => state.setActiveNodeId)
  const setPathPanelOpen = usePathStore((state) => state.setPathPanelOpen)
  const orderedPanels = getOrderedPanels(focusedPanel)
  const isFocusedLayout = focusedPanel !== null

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!focusedPanel || isGraphInteracting) {
        return
      }

      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (graphLayoutRef.current?.contains(target)) {
        return
      }

      if (
        target instanceof Element &&
        target.closest('[data-allow-focus-interaction="true"]')
      ) {
        return
      }

      clearSelection()
      setPathPanelOpen(false)
      setActiveNodeId('skill', '')
      setActiveNodeId('job', '')
      setActiveNodeId('company', '')
      setFocusedPanel(null)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
    }
  }, [
    clearSelection,
    focusedPanel,
    isGraphInteracting,
    setActiveNodeId,
    setFocusedPanel,
    setPathPanelOpen,
  ])

  function handlePanelFocus(panelId: GraphPanelId) {
    if (focusedPanel === panelId) {
      clearSelection()
      setPathPanelOpen(false)
      setActiveNodeId('skill', '')
      setActiveNodeId('job', '')
      setActiveNodeId('company', '')
      setFocusedPanel(null)
      return
    }

    clearSelection()
    setPathPanelOpen(false)
    setActiveNodeId('skill', '')
    setActiveNodeId('job', '')
    setActiveNodeId('company', '')
    setFocusedPanel(panelId)
  }

  return (
    <AppShell>
      <main className="flex flex-1 flex-col pb-24 md:pb-28 lg:pb-32">
        <section className="relative overflow-hidden px-6 pb-4 pt-6 md:px-8 md:pb-5 md:pt-7 lg:px-12 lg:pb-6 lg:pt-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,209,102,0.28),_transparent_38%)]" />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative z-10"
          >
            <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-ink-500">
              Knowledge Graph Career Planner
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight text-ink-950 md:text-5xl">
              {content.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-ink-700 md:text-lg">
              {content.subtitle}
            </p>
          </motion.div>
        </section>

        <section className="px-6 pb-4 md:px-8 md:pb-5 lg:px-12 lg:pb-6">
          <motion.div
            ref={graphLayoutRef}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="mx-auto flex w-full max-w-7xl min-h-[440px] min-w-0 flex-col gap-4 overflow-hidden lg:flex-row"
          >
            {orderedPanels.map((panelId, index) => {
              const panel = panels[panelId]
              const isCenterPanel = index === 1
              const isFocused = focusedPanel === panelId

              return (
                <motion.div
                  key={panel.id}
                  layout
                  animate={{
                    flexBasis: getPanelBasis(index, isFocusedLayout),
                  }}
                  transition={{ type: 'spring', stiffness: 240, damping: 32, mass: 0.9 }}
                  className="min-w-0 min-h-0 overflow-hidden lg:flex lg:min-h-[440px]"
                >
                  <GraphPanel
                    panelId={panel.id}
                    title={panel.title}
                    subtitle={panel.subtitle}
                    graph={getGraphByPanel(panel.id)}
                    isFocused={isFocused}
                    isCenter={isCenterPanel}
                    side={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
                    activeNodeId={activeNodeIds[panel.id]}
                    onFocus={() => handlePanelFocus(panel.id)}
                  />
                </motion.div>
              )
            })}
          </motion.div>
        </section>

        <section className="px-6 pb-8 md:px-8 md:pb-10 lg:px-12 lg:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
            className="mx-auto w-full max-w-7xl"
          >
            <SearchBar />
          </motion.div>
        </section>
      </main>
      <PathBar />
      <PathBar />
    </AppShell>
  )
}

function getOrderedPanels(focusedPanel: GraphPanelId | null) {
  if (focusedPanel === 'skill') {
    return ['job', 'skill', 'company'] as GraphPanelId[]
  }

  if (focusedPanel === 'company') {
    return ['skill', 'company', 'job'] as GraphPanelId[]
  }

  return baseOrder
}

function getPanelBasis(index: number, isFocusedLayout: boolean) {
  if (!isFocusedLayout) {
    if (index === 1) {
      return '34%'
    }

    return '33%'
  }

  if (index === 1) {
    return '56%'
  }

  return '22%'
}
