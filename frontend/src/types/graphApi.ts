export type GraphPrimitive = string | number | boolean | null

export type GraphJson =
  | GraphPrimitive
  | GraphJson[]
  | {
      [key: string]: GraphJson
    }

export type GraphProperties = Record<string, GraphJson>

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

export type FilterTarget = 'node' | 'edge'

export type FilterOperator =
  | 'eq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'

export interface GraphFilter {
  target: FilterTarget
  field: string
  value: unknown
  op: FilterOperator
}

export type GraphFilterState = {
  node_filters: GraphFilter[]
  edge_filters: GraphFilter[]
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

export type RecommendType = 'skill_to_role' | 'role_to_company' | 'company_to_role'

export type RecommendQuery = {
  type: RecommendType
  id1: string
  id2: string
  limit?: number
  signal?: AbortSignal
}

export type SearchNodesParams = {
  keyword: string
  nodeType?: string
  label?: string
  limit?: number
  debounceMs?: number
  signal?: AbortSignal
}

export type SearchNodesResponse = GraphResponse

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

export type LegacyDualAreaSelection = {
  skillNodeIds?: string[]
  jobNodeIds?: string[]
  companyNodeIds?: string[]
}

export type LegacyRecommend2To1Params = {
  sourceAreas: Array<'skill' | 'job' | 'company'>
  targetArea: 'skill' | 'job' | 'company'
  selected: LegacyDualAreaSelection
  filters?: FilterState
  limit?: number
  signal?: AbortSignal
}

export type Recommend2To1Params = RecommendQuery | LegacyRecommend2To1Params

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

export type ApiEnvelope<T> = {
  code: number
  msg: string
  data: T
}
