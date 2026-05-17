export type GraphNode = {
  data: {
    id: string
    label: string
    displayLabel?: string
    category: string
    textMaxWidth?: number
    width?: number
    height?: number
  }
}

export type GraphEdge = {
  data: {
    id: string
    source: string
    target: string
    label?: string
  }
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type GraphPanelId = 'skill' | 'job' | 'company'

export type GraphLayoutMode =
  | 'fcose'
  | 'cose-bilkent'
  | 'concentric'
  | 'breadthfirst'

export type KnowledgeGraphNodeEvent = {
  id: string
  label: string
  category: string
}

export type GraphFilterValue = string | number | boolean | string[]

export type GraphFilters = {
  keyword: string
  categories: string[]
  onlyLiked: boolean
  onlyRecommended: boolean
  minMatchScore: number
  [key: string]: GraphFilterValue | undefined
}

export type SelectedGraphNode = {
  id: string
  label: string
  category: string
  graphArea: GraphPanelId
}

export type GraphPathNode = {
  id: string
  label: string
  category: string
}

export type GraphPathEdge = {
  id: string
  source: string
  target: string
  label?: string
}

export type GraphPath = {
  nodes: GraphPathNode[]
  edges: GraphPathEdge[]
  summary?: string
}

export type HomeContent = {
  title: string
  subtitle: string
  stack: string[]
}
