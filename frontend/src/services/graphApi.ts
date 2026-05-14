import type {
  FilterCondition,
  FilterState,
  GraphEdge,
  GraphNode,
  GraphResponse,
  Recommend2To1Params,
  RecommendResponse,
  SearchNodesParams,
} from '../types/graphApi'

const DEFAULT_TIMEOUT = 10000
const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
}

export const BASE_URL =
  import.meta.env.VITE_GRAPH_API_BASE_URL?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  timeout?: number
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${BASE_URL}${normalizedPath}`, window.location.origin)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

async function parseJsonSafely(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function request<T>(
  path: string,
  { timeout = DEFAULT_TIMEOUT, query, headers, body, ...init }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(buildUrl(path, query), {
      ...init,
      headers: {
        ...DEFAULT_HEADERS,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = await parseJsonSafely(response)

    if (!response.ok) {
      const message =
        (payload as { message?: string } | null)?.message ??
        `Request failed with status ${response.status}`

      throw new ApiError(message, response.status, payload)
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408)
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown network error',
      500,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

export function getAllNodes() {
  return request<GraphNode[]>('/api/graph/nodes', {
    method: 'GET',
  })
}

export function getAllEdges() {
  return request<GraphEdge[]>('/api/graph/edges', {
    method: 'GET',
  })
}

export function searchNodes({ keyword, nodeType, label }: SearchNodesParams) {
  return request<GraphResponse>('/api/graph/search', {
    method: 'GET',
    query: {
      keyword,
      nodeType,
      label,
    },
  })
}

export function expandNode(nodeId: string) {
  return request<GraphResponse>(`/api/graph/expand/${encodeURIComponent(nodeId)}`, {
    method: 'GET',
  })
}

export function expandNode2Hop(nodeId: string) {
  return request<GraphResponse>(
    `/api/graph/expand/2hop/${encodeURIComponent(nodeId)}`,
    {
      method: 'GET',
    },
  )
}

export function getNodesByCategory(label: string) {
  return request<GraphResponse>(`/api/graph/category/${encodeURIComponent(label)}`, {
    method: 'GET',
  })
}

export function recommend2To1(params: Recommend2To1Params) {
  return request<RecommendResponse>('/api/graph/recommend/2to1', {
    method: 'GET',
    query: {
      sourceAreas: params.sourceAreas.join(','),
      targetArea: params.targetArea,
      limit: params.limit,
      skillNodeIds: params.selected.skillNodeIds?.join(','),
      jobNodeIds: params.selected.jobNodeIds?.join(','),
      companyNodeIds: params.selected.companyNodeIds?.join(','),
      filters: params.filters ? JSON.stringify(params.filters) : undefined,
    },
  })
}

export function getFilters() {
  return request<FilterState>('/api/graph/filter', {
    method: 'GET',
  })
}

export function setFilters(filters: FilterState) {
  return request<FilterState>('/api/graph/filter', {
    method: 'POST',
    body: filters,
  })
}

export function addFilter(filter: FilterCondition) {
  return request<FilterState>('/api/graph/filter/add', {
    method: 'POST',
    body: filter,
  })
}

export function removeFilter(filter: FilterCondition) {
  return request<FilterState>('/api/graph/filter/remove', {
    method: 'POST',
    body: filter,
  })
}

export function clearFilters() {
  return request<FilterState>('/api/graph/filter/clear', {
    method: 'POST',
  })
}
