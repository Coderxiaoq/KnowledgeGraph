import { useEffect, useMemo, useRef } from 'react'
import type { Core, ElementDefinition, LayoutOptions } from 'cytoscape'
import { cytoscape } from '../../graph/cytoscape'
import { buildGraphLayoutOptions, getGraphLayoutMode } from '../../graph/layout'
import { knowledgeGraphStyles } from '../../graph/styles'
import { useGraphStore } from '../../store/graphStore'
import type { GraphData, GraphLayoutMode, KnowledgeGraphNodeEvent } from '../../types/graph'
import type { CytoscapeEdge } from '../../types/graphApi'

export type KnowledgeGraphProps = {
  data: GraphData
  className?: string
  activeNodeId?: string
  highlightedNodeIds?: string[]
  hiddenNodeIds?: string[]
  visibleEdgeIds?: string[]
  bridgeEdges?: CytoscapeEdge[]
  hoveredNodeId?: string | null
  likedNodeIds?: string[]
  dislikedNodeIds?: string[]
  focusedNodeId?: string | null
  layoutName?: GraphLayoutMode
  wheelSensitivity?: number
  onNodeClick?: (node: KnowledgeGraphNodeEvent) => void
  onNodeHover?: (node: KnowledgeGraphNodeEvent | null) => void
  onNodeRightClick?: (node: KnowledgeGraphNodeEvent) => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const BASE_NODE_SIZE = 54
const BASE_FONT_SIZE = 11
const BASE_EDGE_WIDTH = 1.8
const BASE_EDGE_FONT_SIZE = 8
const HOVER_SCALE = 1.12
const FOCUS_ZOOM_LEVEL = 1.6
const CORE_NODE_DEGREE_THRESHOLD = 4
const ZOOM_STEP = 0.18
const ZOOM_ANIMATION_MS = 140

function toElements(data: GraphData): ElementDefinition[] {
  return [...data.nodes, ...data.edges].map((element) => ({
    ...element,
    data: {
      ...element.data,
      degree: 'source' in element.data ? 0 : 0,
    },
  }))
}

function toNodeEvent(node: cytoscape.NodeSingular): KnowledgeGraphNodeEvent {
  return {
    id: node.id(),
    label: String(node.data('label') ?? ''),
    category: String(node.data('category') ?? ''),
  }
}

export function KnowledgeGraph({
  data,
  className,
  activeNodeId,
  highlightedNodeIds = [],
  hiddenNodeIds = [],
  visibleEdgeIds = [],
  bridgeEdges = [],
  hoveredNodeId = null,
  likedNodeIds = [],
  dislikedNodeIds = [],
  focusedNodeId = null,
  layoutName = 'fcose',
  wheelSensitivity = 0.009,
  onNodeClick,
  onNodeHover,
  onNodeRightClick,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const bridgeEdgeIdsRef = useRef<string[]>([])
  const interactionTimeoutRef = useRef<number | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeHoverRef = useRef(onNodeHover)
  const previousDataSizeRef = useRef(0)
  const previousFocusedNodeIdRef = useRef<string | null>(null)
  const preFocusViewportRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(
    null,
  )
  const wheelZoomFrameRef = useRef<number | null>(null)
  const pendingZoomLevelRef = useRef<number | null>(null)
  const pendingRenderedPositionRef = useRef<{ x: number; y: number } | null>(null)
  const zoomStyleFrameRef = useRef<number | null>(null)
  const isPointerInsideRef = useRef(false)
  const setGraphInteraction = useGraphStore((state) => state.setGraphInteraction)

  const layoutMode = useMemo(
    () => getGraphLayoutMode(layoutName, data.nodes.length),
    [data.nodes.length, layoutName],
  )

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
    onNodeHoverRef.current = onNodeHover
  }, [onNodeClick, onNodeHover])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (!isPointerInsideRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const cy = cyRef.current

      if (!cy) {
        return
      }

      setGraphInteraction({
        isGraphInteracting: true,
        isZoomingGraph: true,
      })
      const direction = event.deltaY > 0 ? -1 : 1
      const nextLevel = clampZoom(
        (pendingZoomLevelRef.current ?? cy.zoom()) * Math.exp(direction * ZOOM_STEP),
      )

      pendingZoomLevelRef.current = nextLevel
      pendingRenderedPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }

      if (!wheelZoomFrameRef.current) {
        wheelZoomFrameRef.current = window.requestAnimationFrame(() => {
          wheelZoomFrameRef.current = null

          const level = pendingZoomLevelRef.current
          const renderedPosition = pendingRenderedPositionRef.current

          pendingZoomLevelRef.current = null
          pendingRenderedPositionRef.current = null

          if (level === null || !renderedPosition) {
            return
          }

          cy.stop()
          cy.animate(
            {
              zoom: {
                level,
                renderedPosition,
              },
            },
            {
              duration: ZOOM_ANIMATION_MS,
            },
          )
        })
      }

      releaseInteraction(180)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [setGraphInteraction])

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        window.clearTimeout(interactionTimeoutRef.current)
      }
      if (wheelZoomFrameRef.current) {
        window.cancelAnimationFrame(wheelZoomFrameRef.current)
      }
      if (zoomStyleFrameRef.current) {
        window.cancelAnimationFrame(zoomStyleFrameRef.current)
      }
    }
  }, [])

  function clampZoom(level: number) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level))
  }

  function updateZoomStyles(cy: Core) {
    const zoom = cy.zoom()
    const nodeScale = Math.pow(zoom, 0.35)
    const fontScale = Math.pow(zoom, 0.2)
    const edgeScale = Math.pow(zoom, 0.15)
    const nodeSize = BASE_NODE_SIZE * nodeScale
    const fontSize = BASE_FONT_SIZE * fontScale
    const edgeWidth = BASE_EDGE_WIDTH * edgeScale
    const edgeFontSize = BASE_EDGE_FONT_SIZE * Math.pow(zoom, 0.14)
    const edgeOpacity = Math.min(0.98, Math.max(0.36, 0.62 * Math.pow(zoom, 0.18)))
    const showAllLabels = zoom >= 1
    const showCoreLabels = zoom >= 0.7

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const degree = node.connectedEdges().length
        const shouldShowLabel =
          showAllLabels || (showCoreLabels && degree >= CORE_NODE_DEGREE_THRESHOLD)

        node.style({
          width: node.hasClass('is-hovered') ? nodeSize * HOVER_SCALE : nodeSize,
          height: node.hasClass('is-hovered') ? nodeSize * HOVER_SCALE : nodeSize,
          'font-size': fontSize,
          'text-opacity': shouldShowLabel ? 1 : 0,
          'text-max-width': Math.max(34, nodeSize * 1.05),
          'shadow-blur': node.hasClass('is-hovered') ? 22 : undefined,
          'shadow-opacity': node.hasClass('is-hovered') ? 0.34 : undefined,
        })
      })

      cy.edges().forEach((edge) => {
        edge.style({
          width: edge.hasClass('bridge-edge') ? edgeWidth * 1.6 : edgeWidth,
          opacity: edge.hasClass('bridge-edge')
            ? Math.min(1, edgeOpacity + 0.18)
            : edgeOpacity,
          'font-size': edgeFontSize,
          'text-opacity': zoom > 1.05 ? 1 : 0,
        })
      })
    })
  }

  function scheduleZoomStyleUpdate(cy: Core) {
    if (zoomStyleFrameRef.current) {
      return
    }

    zoomStyleFrameRef.current = window.requestAnimationFrame(() => {
      zoomStyleFrameRef.current = null
      updateZoomStyles(cy)
    })
  }

  function blockEvent(event: React.SyntheticEvent<HTMLDivElement>) {
    event.stopPropagation()
  }

  function releaseInteraction(delay = 140) {
    if (interactionTimeoutRef.current) {
      window.clearTimeout(interactionTimeoutRef.current)
    }

    interactionTimeoutRef.current = window.setTimeout(() => {
      setGraphInteraction({
        isGraphInteracting: false,
        isDraggingGraph: false,
        isZoomingGraph: false,
      })
    }, delay)
  }

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: toElements(data),
      style: knowledgeGraphStyles,
      layout: buildGraphLayoutOptions(layoutMode, {
        nodeCount: data.nodes.length,
        incremental: false,
      }) as unknown as LayoutOptions,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      wheelSensitivity,
      autoungrabify: false,
      autounselectify: false,
      boxSelectionEnabled: false,
      userZoomingEnabled: false,
      userPanningEnabled: true,
      motionBlur: true,
      motionBlurOpacity: 0.12,
      textureOnViewport: true,
      hideEdgesOnViewport: data.nodes.length > 1000,
      hideLabelsOnViewport: data.nodes.length > 700,
    })

    cy.on('tap', 'node', (event) => {
      onNodeClickRef.current?.(toNodeEvent(event.target))
    })

    cy.on('cxttap', 'node', (event) => {
      event.preventDefault()
      onNodeRightClick?.(toNodeEvent(event.target))
    })

    cy.on('dbltap', 'node', (event) => {
      const neighborhood = event.target.closedNeighborhood()
      cy.fit(neighborhood, 80)
      scheduleZoomStyleUpdate(cy)
    })

    cy.on('mouseover', 'node', (event) => {
      event.target.addClass('is-hovered')
      scheduleZoomStyleUpdate(cy)
      onNodeHoverRef.current?.(toNodeEvent(event.target))
    })

    cy.on('mouseout', 'node', (event) => {
      event.target.removeClass('is-hovered')
      scheduleZoomStyleUpdate(cy)
      onNodeHoverRef.current?.(null)
    })

    cy.on('mouseover', 'edge.bridge-edge', (event) => {
      event.target.addClass('is-bridge-hovered')
    })

    cy.on('mouseout', 'edge.bridge-edge', (event) => {
      event.target.removeClass('is-bridge-hovered')
    })

    cy.on('dragfree', 'node', () => {
      releaseInteraction(120)
    })

    cy.on('dragpan', () => {
      setGraphInteraction({
        isGraphInteracting: true,
        isDraggingGraph: true,
      })
      releaseInteraction(180)
    })

    cy.on('zoom', () => {
      setGraphInteraction({
        isGraphInteracting: true,
        isZoomingGraph: true,
      })
      scheduleZoomStyleUpdate(cy)
      releaseInteraction(180)
    })

    cy.on('pan', () => {
      setGraphInteraction({
        isGraphInteracting: true,
        isDraggingGraph: true,
      })
      releaseInteraction(180)
    })

    cyRef.current = cy
    previousDataSizeRef.current = data.nodes.length
    scheduleZoomStyleUpdate(cy)

    return () => {
      releaseInteraction(0)
      cy.destroy()
      cyRef.current = null
    }
  }, [layoutMode, setGraphInteraction])

  useEffect(() => {
    const cy = cyRef.current

    if (!cy) {
      return
    }

    const prevSize = previousDataSizeRef.current
    const nextSize = data.nodes.length
    const incremental = nextSize > prevSize

    cy.batch(() => {
      cy.elements().remove()
      cy.add(toElements(data))
    })

    cy
      .layout(
        buildGraphLayoutOptions(layoutMode, {
          nodeCount: nextSize,
          incremental,
        }) as unknown as LayoutOptions,
      )
      .run()

    previousDataSizeRef.current = nextSize
    scheduleZoomStyleUpdate(cy)
  }, [data, layoutMode])

  useEffect(() => {
    const cy = cyRef.current

    if (!cy) {
      return
    }

    cy.batch(() => {
      if (bridgeEdgeIdsRef.current.length > 0) {
        bridgeEdgeIdsRef.current.forEach((edgeId) => {
          cy.getElementById(edgeId).remove()
        })
      }

      bridgeEdgeIdsRef.current = []

      if (bridgeEdges.length === 0) {
        return
      }

      const nextBridgeEdges = bridgeEdges
        .filter((edge) => {
          const sourceExists = cy.getElementById(edge.data.source).nonempty()
          const targetExists = cy.getElementById(edge.data.target).nonempty()

          return sourceExists && targetExists
        })
        .map((edge) => ({
          ...edge,
          classes: 'bridge-edge',
        }))

      if (nextBridgeEdges.length === 0) {
        return
      }

      const added = cy.add(nextBridgeEdges)
      bridgeEdgeIdsRef.current = added.map((item) => item.id())
    })

    cy.edges('.bridge-edge').forEach((edge) => {
      edge.animate(
        {
          style: {
            opacity: 1,
            width: 4,
          },
        },
        {
          duration: 220,
        },
      )
    })

    return () => {
      const currentCy = cyRef.current

      if (!currentCy || bridgeEdgeIdsRef.current.length === 0) {
        return
      }

      currentCy.batch(() => {
        bridgeEdgeIdsRef.current.forEach((edgeId) => {
          currentCy.getElementById(edgeId).remove()
        })
        bridgeEdgeIdsRef.current = []
      })
    }
  }, [bridgeEdges])

  useEffect(() => {
    const cy = cyRef.current

    if (!cy) {
      return
    }

    cy.nodes().removeClass(
      'is-active is-highlighted is-dimmed is-hidden is-hovered is-liked is-disliked is-focused-search',
    )
    cy.edges().removeClass('is-edge-visible')

    const highlighted = new Set(highlightedNodeIds)
    const hidden = new Set(hiddenNodeIds)
    const visibleEdges = new Set(visibleEdgeIds)
    const liked = new Set(likedNodeIds)
    const disliked = new Set(dislikedNodeIds)

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const nodeId = node.id()

        node.data('degree', node.connectedEdges().length)

        if (disliked.has(nodeId)) {
          node.addClass('is-disliked')
        }

        if (hidden.has(nodeId)) {
          node.addClass('is-hidden')
          return
        }

        if (liked.has(nodeId)) {
          node.addClass('is-liked')
        }

        if (highlighted.has(nodeId)) {
          node.addClass('is-highlighted')
        } else if (highlighted.size > 0) {
          node.addClass('is-dimmed')
        }

        if (hoveredNodeId && nodeId === hoveredNodeId) {
          node.addClass('is-hovered')
        }

        if (focusedNodeId && nodeId === focusedNodeId) {
          node.addClass('is-focused-search')
        }
      })

      cy.edges().forEach((edge) => {
        if (edge.hasClass('bridge-edge')) {
          return
        }

        if (visibleEdges.has(edge.id())) {
          edge.addClass('is-edge-visible')
        }
      })
    })

    if (!activeNodeId) {
      return
    }

    const activeNode = cy.getElementById(activeNodeId)

    if (activeNode.nonempty()) {
      activeNode.addClass('is-active')
    }
    scheduleZoomStyleUpdate(cy)
  }, [
    activeNodeId,
    dislikedNodeIds,
    focusedNodeId,
    highlightedNodeIds,
    hiddenNodeIds,
    hoveredNodeId,
    likedNodeIds,
    visibleEdgeIds,
  ])

  useEffect(() => {
    const cy = cyRef.current

    if (!cy) {
      return
    }

    const previousFocusedNodeId = previousFocusedNodeIdRef.current

    if (!focusedNodeId) {
      if (previousFocusedNodeId && preFocusViewportRef.current) {
        const viewport = preFocusViewportRef.current

        window.requestAnimationFrame(() => {
          cy.stop()
          cy.animate(
            {
              zoom: viewport.zoom,
              pan: viewport.pan,
            },
            {
              duration: 220,
            },
          )
        })
      }

      previousFocusedNodeIdRef.current = null
      preFocusViewportRef.current = null
      return
    }

    const focusedNode = cy.getElementById(focusedNodeId)

    if (!focusedNode.nonempty()) {
      return
    }

    window.requestAnimationFrame(() => {
      cy.stop()
      if (!previousFocusedNodeId) {
        preFocusViewportRef.current = {
          zoom: cy.zoom(),
          pan: cy.pan(),
        }
      }

      focusedNode.select()
      cy.animate(
        {
          center: {
            eles: focusedNode,
          },
          zoom: Math.max(cy.zoom(), FOCUS_ZOOM_LEVEL),
        },
        {
          duration: 300,
        },
      )
    })

    previousFocusedNodeIdRef.current = focusedNodeId
  }, [focusedNodeId])

  return (
    <div
      ref={containerRef}
      onClick={blockEvent}
      onPointerDown={(event) => {
        blockEvent(event)
        setGraphInteraction({
          isGraphInteracting: true,
          isDraggingGraph: true,
        })
      }}
      onPointerUp={(event) => {
        blockEvent(event)
        releaseInteraction()
      }}
      onPointerCancel={(event) => {
        blockEvent(event)
        releaseInteraction()
      }}
      onPointerEnter={(event) => {
        blockEvent(event)
        isPointerInsideRef.current = true
      }}
      onPointerLeave={(event) => {
        blockEvent(event)
        isPointerInsideRef.current = false
      }}
      onMouseDown={blockEvent}
      onWheel={(event) => {
        blockEvent(event)
        event.preventDefault()
        event.stopPropagation()
      }}
      style={{
        overscrollBehavior: 'contain',
        touchAction: 'none',
        contain: 'layout paint size',
      }}
      className={className ?? 'h-[260px] min-h-[260px] w-full rounded-3xl bg-paper-50/70'}
    />
  )
}
