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
  | 'salary_in'

export type FilterMode = 'positive' | 'negative'

export interface GraphFilter {
  target: FilterTarget
  field: string
  value: unknown
  op: FilterOperator
  mode?: FilterMode
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

export type RecommendPreferencePayload = {
  type: RecommendType
  primary_pos_list: string[]
  primary_neg_list: string[]
  secondary_pos_list: string[]
  secondary_neg_list: string[]
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

export type ChainNode = {
  id: string
  label: string
  properties: GraphProperties
}

export type ChainEdge = {
  source: string
  target: string
  relation: string
  properties?: GraphProperties
}

export type SingleChain = {
  score: number
  base_score?: number
  derivative?: number
  is_gradient?: boolean
  reason?: string
  nodes: { company: ChainNode; role: ChainNode; skill: ChainNode }
  edges: ChainEdge[]
}

export type ComboChain = {
  score: number
  total_score?: number
  base_score?: number
  preference_score?: number
  reason?: string
  nodes: ChainNode[]
  edges: ChainEdge[]
  member_chains?: SingleChain[]
  matched_positive_ids?: string[]
  matched_negative_ids?: string[]
  group_key?: { left_id: string; right_id: string }
}

export type RecommendResponse = {
  nodes?: GraphNode[]
  edges?: GraphEdge[]
  chains?: ComboChain[]
  single_chains?: SingleChain[]
  currentPath: InferencePath | null
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

export type ApiEnvelope<T> = {
  code: number
  msg: string
  data: T
}
