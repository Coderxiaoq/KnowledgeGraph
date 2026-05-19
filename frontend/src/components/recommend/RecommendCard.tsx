import React from 'react'
import type { CareerRecommendation } from '../../types/recommendApi'
import './RecommendCard.css'

interface RecommendCardProps {
  recommendation: CareerRecommendation
  onRoleClick?: (roleId: string) => void
  onCompanyClick?: (companyId: string) => void
}

export function RecommendCard({ recommendation, onRoleClick, onCompanyClick }: RecommendCardProps) {
  const {
    role,
    match_score,
    matched_skills,
    missing_skills,
    skill_match_rate,
    core_skill_coverage,
    companies,
    salary_fit,
    apply_probability,
  } = recommendation

  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.7) return '#52c41a'
    if (prob >= 0.4) return '#faad14'
    return '#ff4d4f'
  }

  const getProbabilityText = (prob: number) => {
    if (prob >= 0.7) return '竞争力强'
    if (prob >= 0.4) return '有机会'
    return '需补强'
  }

  return (
    <div className="recommend-card">
      <div className="recommend-card-header">
        <h3 className="role-name" onClick={() => onRoleClick?.(role.role_id)}>
          {role.name}
        </h3>
        <div className="match-score">
          <div className="score-label">匹配度</div>
          <div className="score-value">{(match_score * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="recommend-card-body">
        <div className="salary-badge">
          💰 {role.salary_range || '面议'}
          {!salary_fit && <span className="salary-warn">⚠️ 不符合期望</span>}
        </div>

        <div className="skill-section">
          <div className="skill-stats">
            <span className="stat-item">
              ✅ 已匹配: {matched_skills.length}/{matched_skills.length + missing_skills.length}
            </span>
            <span className="stat-item">
              📊 匹配率: {(skill_match_rate * 100).toFixed(0)}%
            </span>
            <span className="stat-item">
              ⭐ 核心技能: {(core_skill_coverage * 100).toFixed(0)}%
            </span>
          </div>

          {matched_skills.length > 0 && (
            <div className="skill-tags matched">
              <span className="tag-label">已掌握:</span>
              {matched_skills.slice(0, 5).map((skill) => (
                <span key={skill.skill_id} className="skill-tag matched">
                  {skill.name}
                  {skill.is_core && <span className="core-badge">核心</span>}
                </span>
              ))}
              {matched_skills.length > 5 && (
                <span className="more-tag">+{matched_skills.length - 5}</span>
              )}
            </div>
          )}

          {missing_skills.length > 0 && (
            <div className="skill-tags missing">
              <span className="tag-label">需补充:</span>
              {missing_skills.slice(0, 3).map((skill) => (
                <span key={skill.skill_id} className="skill-tag missing">
                  {skill.name}
                  {skill.is_core && <span className="core-badge urgent">核心</span>}
                </span>
              ))}
              {missing_skills.length > 3 && (
                <span className="more-tag">+{missing_skills.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {companies.length > 0 && (
          <div className="company-section">
            <div className="section-title">招聘公司 ({companies.length})</div>
            <div className="company-list">
              {companies.slice(0, 4).map((company) => (
                <div
                  key={company.company_id}
                  className="company-item"
                  onClick={() => onCompanyClick?.(company.company_id)}
                >
                  <span className="company-name">{company.name}</span>
                  {company.urgency && (
                    <span className={`urgency-badge ${company.urgency}`}>
                      {company.urgency}
                    </span>
                  )}
                </div>
              ))}
              {companies.length > 4 && (
                <div className="more-companies">还有 {companies.length - 4} 家公司</div>
              )}
            </div>
          </div>
        )}

        <div className="probability-section">
          <div className="probability-header">
            <span className="probability-label">应聘成功率</span>
            <span className="probability-value" style={{ color: getProbabilityColor(apply_probability) }}>
              {(apply_probability * 100).toFixed(0)}%
            </span>
          </div>
          <div className="probability-bar">
            <div
              className="probability-fill"
              style={{
                width: `${apply_probability * 100}%`,
                backgroundColor: getProbabilityColor(apply_probability),
              }}
            />
          </div>
          <div className="probability-hint">{getProbabilityText(apply_probability)}</div>
        </div>
      </div>
    </div>
  )
}
