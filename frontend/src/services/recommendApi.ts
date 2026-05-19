import axios from 'axios'
import type {
  RoleDetailResponse,
  SkillGapAnalysis,
  CareerRecommendResponse,
  ApplyProbabilityResponse,
  CareerRecommendRequest,
  ApplyProbabilityRequest,
  SkillGapRequest,
} from '../types/recommendApi'

const API_BASE_URL = import.meta.env.VITE_GRAPH_API_BASE_URL || 'http://localhost:8000'
const RECOMMEND_API_URL = `${API_BASE_URL}/api/recommend`

const recommendApi = axios.create({
  baseURL: RECOMMEND_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function getRoleDetail(roleId: string): Promise<RoleDetailResponse> {
  const response = await recommendApi.get(`/role/${roleId}/detail`)
  return response.data.data
}

export async function analyzeSkillGap(request: SkillGapRequest): Promise<SkillGapAnalysis> {
  const response = await recommendApi.post('/role/skill-gap', request)
  return response.data.data
}

export async function recommendCareer(
  request: CareerRecommendRequest,
): Promise<CareerRecommendResponse> {
  const response = await recommendApi.post('/career', request)
  return response.data.data
}

export async function quickRecommendBySkills(
  skillIds: string[],
  limit: number = 20,
): Promise<{ roles: Array<any> }> {
  const response = await recommendApi.get('/recommend/quick', {
    params: {
      skill_ids: skillIds.join(','),
      limit,
    },
  })
  return response.data.data
}

export async function calculateApplyProbability(
  request: ApplyProbabilityRequest,
): Promise<ApplyProbabilityResponse> {
  const response = await recommendApi.post('/probability/apply', request)
  return response.data.data
}

export async function batchCalculateProbability(
  userSkillIds: string[],
  roleCompanyPairs: Array<{ role_id: string; company_id?: string }>,
): Promise<{ results: Array<any> }> {
  const response = await recommendApi.post('/probability/batch', {
    user_skill_ids: userSkillIds,
    role_company_pairs: roleCompanyPairs,
  })
  return response.data.data
}

export {
  type RoleDetailResponse,
  type SkillGapAnalysis,
  type CareerRecommendResponse,
  type ApplyProbabilityResponse,
  type CareerRecommendRequest,
  type ApplyProbabilityRequest,
  type SkillGapRequest,
}
