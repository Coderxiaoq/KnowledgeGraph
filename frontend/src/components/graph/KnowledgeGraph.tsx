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
}

function toElements(data: GraphData): ElementDefinition[] {
  return [...data.nodes, ...data.edges].map((element) => ({
    ...element,
    data: {
      ...element.data,
      degree:
        'source' in element.data
          ? 0
          : 0,
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
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const bridgeEdgeIdsRef = useRef<string[]>([])
  const interactionTimeoutRef = useRef<number | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeHoverRef = useRef(onNodeHover)
  const previousDataSizeRef = useRef(0)
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
    return () => {
      if (interactionTimeoutRef.current) {
        window.clearTimeout(interactionTimeoutRef.current)
      }
    }
  }, [])

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
      minZoom: 0.4,
      maxZoom: 2,
      wheelSensitivity,
      autoungrabify: false,
      autounselectify: false,
      boxSelectionEnabled: false,
      userZoomingEnabled: true,
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

    cy.on('dbltap', 'node', (event) => {
      const neighborhood = event.target.closedNeighborhood()
      cy.fit(neighborhood, 80)
    })

    cy.on('mouseover', 'node', (event) => {
      event.target.addClass('is-hovered')
      onNodeHoverRef.current?.(toNodeEvent(event.target))
    })

    cy.on('mouseout', 'node', (event) => {
      event.target.removeClass('is-hovered')
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

    if (!cy || !focusedNodeId) {
      return
    }

    const focusedNode = cy.getElementById(focusedNodeId)

    if (!focusedNode.nonempty()) {
      return
    }

    window.requestAnimationFrame(() => {
      focusedNode.select()
      cy.fit(focusedNode, 100)
      cy.center(focusedNode)
    })
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
      onMouseDown={blockEvent}
      onWheel={(event) => {
        blockEvent(event)
        setGraphInteraction({
          isGraphInteracting: true,
          isZoomingGraph: true,
        })
        releaseInteraction(180)
      }}
      className={className ?? 'h-[260px] min-h-[260px] w-full rounded-3xl bg-paper-50/70'}
    />
  )
}
