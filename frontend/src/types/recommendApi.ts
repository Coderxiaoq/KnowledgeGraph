export type SkillInfo = {
  skill_id: string
  name: string
  category?: string
  importance?: number
  is_core?: boolean
}

export type CompanyInfo = {
  company_id: string
  name: string
  industry?: string
  salary_range?: string
  urgency?: string
  location?: string
}

export type RoleInfo = {
  role_id: string
  name: string
  description?: string
  salary_range?: string
}

export type RoleDetailResponse = {
  role: RoleInfo
  required_skills: Array<SkillInfo & { importance: number; is_core: boolean }>
  hiring_companies: Array<CompanyInfo>
  statistics: {
    skill_count: number
    core_skill_count: number
    avg_importance: number
    company_count: number
    high_urgency_count: number
  }
}

export type SkillGapAnalysis = {
  matched_skills: SkillInfo[]
  missing_skills: SkillInfo[]
  match_rate: number
  core_skill_coverage: number
  total_required: number
  total_matched: number
}

export type CareerRecommendation = {
  role: RoleInfo
  match_score: number
  matched_skills: SkillInfo[]
  missing_skills: SkillInfo[]
  skill_match_rate: number
  core_skill_coverage: number
  companies: CompanyInfo[]
  salary_fit: boolean
  apply_probability: number
  total_required: number
  total_matched: number
}

export type CareerRecommendResponse = {
  recommendations: CareerRecommendation[]
}

export type ProbabilityBreakdown = {
  skill_match: number
  core_skill_cover: number
  company_urgency: number
  market_competition: number
}

export type ApplyProbabilityResponse = {
  probability: number
  breakdown: ProbabilityBreakdown
  suggestions: string[]
  skill_analysis: SkillGapAnalysis
}

export type CareerRecommendRequest = {
  skill_ids: string[]
  salary_min?: number
  salary_max?: number
  limit?: number
}

export type ApplyProbabilityRequest = {
  user_skill_ids: string[]
  role_id: string
  company_id?: string
}

export type SkillGapRequest = {
  role_id: string
  user_skill_ids: string[]
}
