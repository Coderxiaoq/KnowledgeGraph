import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'
import type {
  ApiEnvelope,
  GraphEdge,
  GraphFilter,
  GraphFilterState,
  GraphNode,
  GraphResponse,
  RecommendPreferencePayload,
  RecommendResponse,
  RecommendType,
  SearchNodesParams,
  SearchNodesResponse,
} from '../types/graphApi'

function normalizeApiBaseUrl(rawBaseUrl: string | undefined) {
  const fallback = 'http://localhost:8000/api/graph'

  if (!rawBaseUrl?.trim()) {
    return fallback
  }

  const normalized = rawBaseUrl.trim().replace(/\/$/, '')

  if (normalized.endsWith('/api/graph')) {
    return normalized
  }

  return `${normalized}/api/graph`
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_GRAPH_API_BASE_URL)

const REQUEST_TIMEOUT = 10000
const searchTimers = new Map<string, number>()

export class GraphApiError extends Error {
  status: number
  code?: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown, code?: number) {
    super(message)
    this.name = 'GraphApiError'
    this.status = status
    this.details = details
    this.code = code
  }
}

const graphApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

graphApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (axios.isCancel(error)) {
      return Promise.reject(
        new GraphApiError('Request cancelled', 499, error.response?.data),
      )
    }

    const payload = error.response?.data as Partial<ApiEnvelope<unknown>> | undefined
    const message =
      payload?.msg ??
      error.message ??
      `Request failed with status ${error.response?.status ?? 500}`

    return Promise.reject(
      new GraphApiError(
        message,
        error.response?.status ?? 500,
        error.response?.data,
        payload?.code,
      ),
    )
  },
)

async function unwrapData<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await graphApi.request<ApiEnvelope<T>>(config)
  return response.data.data
}

async function unwrapDirect<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await graphApi.request<T>(config)
  return response.data
}

function withOptionalSignal(
  signal?: AbortSignal,
): Pick<AxiosRequestConfig, 'signal'> | Record<string, never> {
  return signal ? { signal } : {}
}

function debouncePromise<T>(
  key: string,
  waitMs: number,
  factory: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const existing = searchTimers.get(key)

    if (existing) {
      window.clearTimeout(existing)
    }

    const timer = window.setTimeout(() => {
      searchTimers.delete(key)
      void factory().then(resolve).catch(reject)
    }, waitMs)

    searchTimers.set(key, timer)
  })
}

export const RecommendTypeEnum = {
  SkillToRole: 'skill_to_role',
  RoleToCompany: 'role_to_company',
  CompanyToRole: 'company_to_role',
} as const

export type {
  GraphNode,
  GraphEdge,
  GraphResponse,
  GraphFilter,
  GraphFilterState,
  RecommendResponse,
  RecommendType,
}

export async function getAllNodes(signal?: AbortSignal): Promise<GraphNode[]> {
  return unwrapData<GraphNode[]>({
    method: 'GET',
    url: '/nodes',
    ...withOptionalSignal(signal),
  })
}

export async function getAllEdges(signal?: AbortSignal): Promise<GraphEdge[]> {
  return unwrapData<GraphEdge[]>({
    method: 'GET',
    url: '/edges',
    ...withOptionalSignal(signal),
  })
}

export async function searchNodes({
  keyword,
  debounceMs = 250,
  signal,
}: SearchNodesParams): Promise<SearchNodesResponse> {
  const normalizedKeyword = keyword.trim()

  if (!normalizedKeyword) {
    return {
      nodes: [],
      edges: [],
    }
  }

  return debouncePromise(`search:${normalizedKeyword.toLowerCase()}`, debounceMs, () =>
    unwrapData<GraphResponse>({
      method: 'GET',
      url: '/search',
      params: {
        keyword: normalizedKeyword,
      },
      ...withOptionalSignal(signal),
    }),
  )
}

export async function expandNode(
  nodeId: string,
  signal?: AbortSignal,
): Promise<GraphResponse> {
  return unwrapData<GraphResponse>({
    method: 'GET',
    url: `/expand/${encodeURIComponent(nodeId)}`,
    ...withOptionalSignal(signal),
  })
}

export async function expandNode2Hop(
  nodeId: string,
  options?: {
    limit?: number
    signal?: AbortSignal
  },
): Promise<GraphResponse> {
  return unwrapData<GraphResponse>({
    method: 'GET',
    url: `/expand/2hop/${encodeURIComponent(nodeId)}`,
    params: {
      limit: options?.limit,
    },
    ...withOptionalSignal(options?.signal),
  })
}

export async function getNodesByCategory(
  label: string,
  options?: {
    limit?: number
    signal?: AbortSignal
  },
): Promise<GraphResponse> {
  return unwrapData<GraphResponse>({
    method: 'GET',
    url: `/category/${encodeURIComponent(label)}`,
    params: {
      limit: options?.limit,
    },
    ...withOptionalSignal(options?.signal),
  })
}

export async function recommend2To1(
  params: RecommendPreferencePayload,
): Promise<RecommendResponse> {
  const response = await unwrapData<Record<string, unknown>>({
    method: 'POST',
    url: '/recommend/2to1',
    data: {
      type: params.type,
      primary_pos_list: params.primary_pos_list,
      primary_neg_list: params.primary_neg_list,
      secondary_pos_list: params.secondary_pos_list,
      secondary_neg_list: params.secondary_neg_list,
      limit: params.limit,
    },
    ...withOptionalSignal(params.signal),
  })

  return {
    nodes: Array.isArray(response.nodes) ? (response.nodes as RecommendResponse['nodes']) : [],
    edges: Array.isArray(response.edges) ? (response.edges as RecommendResponse['edges']) : [],
    chains: Array.isArray(response.chains)
      ? (response.chains as RecommendResponse['chains'])
      : [],
    single_chains: Array.isArray(response.single_chains)
      ? (response.single_chains as RecommendResponse['single_chains'])
      : [],
    currentPath: null,
  }
}

export async function getFilters(signal?: AbortSignal): Promise<GraphFilterState> {
  return unwrapDirect<GraphFilterState>({
    method: 'GET',
    url: '/filter',
    ...withOptionalSignal(signal),
  })
}

export async function setFilters(
  filters: GraphFilterState,
  signal?: AbortSignal,
): Promise<GraphFilterState> {
  return unwrapDirect<GraphFilterState>({
    method: 'POST',
    url: '/filter',
    data: filters,
    ...withOptionalSignal(signal),
  })
}

export async function addFilter(
  filter: GraphFilter,
  signal?: AbortSignal,
): Promise<GraphFilterState> {
  return unwrapDirect<GraphFilterState>({
    method: 'POST',
    url: '/filter/add',
    data: filter,
    ...withOptionalSignal(signal),
  })
}

export async function removeFilter(
  filter: GraphFilter,
  signal?: AbortSignal,
): Promise<GraphFilterState> {
  return unwrapDirect<GraphFilterState>({
    method: 'POST',
    url: '/filter/remove',
    data: filter,
    ...withOptionalSignal(signal),
  })
}

export async function clearFilters(signal?: AbortSignal): Promise<GraphFilterState> {
  return unwrapDirect<GraphFilterState>({
    method: 'POST',
    url: '/filter/clear',
    ...withOptionalSignal(signal),
  })
}

export async function syncDislikeFilters(
  filters: GraphFilter[],
  signal?: AbortSignal,
): Promise<GraphFilterState> {
  if (filters.length === 0) {
    return clearFilters(signal)
  }

  return setFilters(
    {
      node_filters: filters,
      edge_filters: [],
    },
    signal,
  )
}
