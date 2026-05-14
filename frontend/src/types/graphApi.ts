export type GraphPrimitive = string | number | boolean | null

export type GraphProperties = Record<
  string,
  GraphPrimitive | GraphPrimitive[] | Record<string, unknown>
>

export type GraphNode = {
  id: string
  label: string
  properties: GraphProperties
}

export type GraphEdge = {
  relation: string
  source: string
  target: string
  properties: GraphProperties
}

export type GraphResponse = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type FilterCondition = {
  area?: 'skill' | 'job' | 'company'
  field: string
  operator?: 'eq' | 'in' | 'contains' | 'gte' | 'lte'
  value: GraphPrimitive | GraphPrimitive[]
}

export type FilterState = {
  keyword?: string
  areas?: Array<'skill' | 'job' | 'company'>
  labels?: string[]
  conditions?: FilterCondition[]
}

export type SearchNodesParams = {
  keyword: string
  nodeType?: string
  label?: string
}

export type DualAreaSelection = {
  skillNodeIds?: string[]
  jobNodeIds?: string[]
  companyNodeIds?: string[]
}

export type Recommend2To1Params = {
  sourceAreas: Array<'skill' | 'job' | 'company'>
  targetArea: 'skill' | 'job' | 'company'
  selected: DualAreaSelection
  filters?: FilterState
  limit?: number
}

export type RecommendNodeScore = {
  node: GraphNode
  score: number
  reason?: string
}

export type InferencePathNode = {
  id: string
  label: string
  properties?: GraphProperties
}

export type InferencePathEdge = {
  source: string
  target: string
  relation: string
  properties?: GraphProperties
}

export type InferencePath = {
  nodes: InferencePathNode[]
  edges: InferencePathEdge[]
  summary?: string
}

export type RecommendResponse = {
  recommendedNodes: RecommendNodeScore[]
  highlightedNodeIds: string[]
  hiddenNodeIds: string[]
  currentPath: InferencePath | null
  graph?: GraphResponse
}

export type CytoscapeNode = {
  data: {
    id: string
    label: string
    type: string
    properties: GraphProperties
  }
}

export type CytoscapeEdge = {
  data: {
    id: string
    source: string
    target: string
    label: string
    properties: GraphProperties
  }
}

export type CytoscapeElements = Array<CytoscapeNode | CytoscapeEdge>
