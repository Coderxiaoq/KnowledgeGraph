import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, StylesheetJson } from 'cytoscape'
import { useGraphStore } from '../../store/graphStore'
import type { GraphData, KnowledgeGraphNodeEvent } from '../../types/graph'
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
  layoutName?: 'breadthfirst' | 'grid' | 'circle' | 'concentric' | 'cose'
  onNodeClick?: (node: KnowledgeGraphNodeEvent) => void
  onNodeHover?: (node: KnowledgeGraphNodeEvent | null) => void
}

const knowledgeGraphStyles: StylesheetJson = [
  {
    selector: 'node',
    style: {
      width: 56,
      height: 56,
      label: 'data(label)',
      color: '#10202a',
      'font-size': 11,
      'font-weight': 700,
      'text-wrap': 'wrap',
      'text-max-width': '78px',
      'text-valign': 'bottom',
      'text-margin-y': 10,
      'background-color': '#7ae7c7',
      'border-width': 2,
      'border-color': '#17b890',
      'overlay-opacity': 0,
      'transition-property': 'background-color border-color width height',
      'transition-duration': 200,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      label: 'data(label)',
      color: '#556779',
      'font-size': 9,
      'line-color': '#8ea4b8',
      'target-arrow-color': '#8ea4b8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      opacity: 0,
    },
  },
  {
    selector: 'edge.bridge-edge',
    style: {
      opacity: 0.96,
      width: 4,
      label: 'data(label)',
      color: '#fff7ed',
      'font-size': 10,
      'font-weight': 700,
      'line-color': '#f97316',
      'target-arrow-color': '#f97316',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'underlay-color': '#fdba74',
      'underlay-opacity': 0.36,
      'underlay-padding': 4,
      'text-background-color': '#7c2d12',
      'text-background-opacity': 0.72,
      'text-background-shape': 'roundrectangle',
      'text-rotation': 'autorotate',
      'arrow-scale': 1.15,
    },
  },
  {
    selector: 'edge.bridge-edge.is-bridge-hovered',
    style: {
      width: 5,
      'line-color': '#fb7185',
      'target-arrow-color': '#fb7185',
      'underlay-opacity': 0.5,
    },
  },
  {
    selector: '.is-active',
    style: {
      'background-color': '#ffd166',
      'border-color': '#131a22',
      'border-width': 3,
      width: 64,
      height: 64,
    },
  },
  {
    selector: '.is-hovered',
    style: {
      'background-color': '#d9fff1',
      'border-color': '#0f766e',
      'border-width': 3,
    },
  },
  {
    selector: '.is-highlighted',
    style: {
      'background-color': '#ffd166',
      'border-color': '#111827',
      'border-width': 4,
      opacity: 1,
    },
  },
  {
    selector: '.is-liked',
    style: {
      'background-color': '#86efac',
      'border-color': '#166534',
      'border-width': 4,
    },
  },
  {
    selector: '.is-disliked',
    style: {
      'background-color': '#fecaca',
      'border-color': '#b91c1c',
      'border-width': 3,
      opacity: 0.2,
    },
  },
  {
    selector: '.is-focused-search',
    style: {
      'background-color': '#fbbf24',
      'border-color': '#7c2d12',
      'border-width': 5,
      width: 68,
      height: 68,
    },
  },
  {
    selector: '.is-dimmed',
    style: {
      opacity: 0.18,
    },
  },
  {
    selector: '.is-hidden',
    style: {
      opacity: 0.08,
    },
  },
  {
    selector: '.is-edge-visible',
    style: {
      opacity: 0.95,
      width: 3,
      'line-color': '#f59e0b',
      'target-arrow-color': '#f59e0b',
    },
  },
]

function toElements(data: GraphData): ElementDefinition[] {
  return [...data.nodes, ...data.edges]
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
  layoutName = 'breadthfirst',
  onNodeClick,
  onNodeHover,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const bridgeEdgeIdsRef = useRef<string[]>([])
  const interactionTimeoutRef = useRef<number | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeHoverRef = useRef(onNodeHover)
  const setGraphInteraction = useGraphStore((state) => state.setGraphInteraction)

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
      layout: {
        name: layoutName,
        directed: true,
        padding: 20,
        spacingFactor: 1.12,
        animate: true,
        animationDuration: 300,
      },
      minZoom: 0.45,
      maxZoom: 2.2,
      wheelSensitivity: 0.18,
      autoungrabify: false,
      autounselectify: false,
      boxSelectionEnabled: false,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    })

    cy.on('tap', 'node', (event) => {
      if (!onNodeClickRef.current) {
        return
      }

      onNodeClickRef.current(toNodeEvent(event.target))
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

    return () => {
      releaseInteraction(0)
      cy.destroy()
      cyRef.current = null
    }
  }, [layoutName, setGraphInteraction])

  useEffect(() => {
    const cy = cyRef.current

    if (!cy) {
      return
    }

    cy.batch(() => {
      cy.elements().remove()
      cy.add(toElements(data))
    })

    cy.layout({
      name: layoutName,
      directed: true,
      padding: 20,
      spacingFactor: 1.12,
      animate: true,
      animationDuration: 300,
    }).run()
  }, [data, layoutName])

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
