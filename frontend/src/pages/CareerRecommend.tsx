import React, { useState, useEffect } from 'react'
import { RecommendCard } from '../components/recommend/RecommendCard'
import { ProbabilityGauge } from '../components/recommend/ProbabilityGauge'
import { recommendCareer, calculateApplyProbability } from '../services/recommendApi'
import { getNodesByCategory } from '../services/graphApi'
import type { CareerRecommendation } from '../types/recommendApi'
import type { GraphNode } from '../types/graphApi'
import './CareerRecommend.css'

export function CareerRecommend() {
  const [allSkills, setAllSkills] = useState<GraphNode[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [salaryMin, setSalaryMin] = useState<number | undefined>(undefined)
  const [salaryMax, setSalaryMax] = useState<number | undefined>(undefined)
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const [selectedRecommendation, setSelectedRecommendation] = useState<CareerRecommendation | null>(
    null,
  )
  const [probabilityDetail, setProbabilityDetail] = useState<any>(null)

  useEffect(() => {
    loadSkills()
  }, [])

  const loadSkills = async () => {
    try {
      const response = await getNodesByCategory('Skill', { limit: 100 })
      setAllSkills(response.nodes || [])
    } catch (error) {
      console.error('加载技能失败:', error)
    }
  }

  const handleRecommend = async () => {
    if (selectedSkills.length === 0) {
      alert('请至少选择一项技能')
      return
    }

    setLoading(true)
    try {
      const result = await recommendCareer({
        skill_ids: selectedSkills,
        salary_min: salaryMin,
        salary_max: salaryMax,
        limit: 10,
      })
      setRecommendations(result.recommendations || [])
      setSelectedRecommendation(null)
      setProbabilityDetail(null)
    } catch (error) {
      console.error('推荐失败:', error)
      alert('推荐失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleViewProbability = async (rec: CareerRecommendation) => {
    setSelectedRecommendation(rec)
    if (rec.companies.length > 0) {
      try {
        const result = await calculateApplyProbability({
          user_skill_ids: selectedSkills,
          role_id: rec.role.role_id,
          company_id: rec.companies[0].company_id,
        })
        setProbabilityDetail(result)
      } catch (error) {
        console.error('计算概率失败:', error)
      }
    }
  }

  const getSkillName = (skill: GraphNode): string => {
    const name = skill.properties?.name
    if (typeof name === 'string') return name
    if (typeof name === 'number') return String(name)
    return skill.id
  }

  const filteredSkills = allSkills.filter(
    (skill) => {
      const name = getSkillName(skill)
      return name.toLowerCase().includes(skillSearch.toLowerCase()) ||
             skill.id.toLowerCase().includes(skillSearch.toLowerCase())
    },
  )

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId],
    )
  }

  return (
    <div className="career-recommend-page">
      <div className="page-header">
        <h1>智能职业推荐</h1>
        <p>根据您的技能和期望薪资，为您推荐最匹配的职业</p>
      </div>

      <div className="recommend-container">
        <div className="input-section">
          <div className="section-card">
            <h2>选择您的技能</h2>
            <input
              type="text"
              placeholder="搜索技能..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="skill-search-input"
            />
            <div className="skills-grid">
              {filteredSkills.slice(0, 30).map((skill) => {
                const isSelected = selectedSkills.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    className={`skill-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    {getSkillName(skill)}
                  </button>
                )
              })}
            </div>
            {selectedSkills.length > 0 && (
              <div className="selected-skills">
                <span className="selected-label">已选择 {selectedSkills.length} 项技能：</span>
                {selectedSkills.map((skillId) => {
                  const skill = allSkills.find((s) => s.id === skillId)
                  return (
                    <span key={skillId} className="selected-skill-tag">
                      {skill ? getSkillName(skill) : skillId}
                      <button onClick={() => toggleSkill(skillId)} className="remove-btn">
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="section-card">
            <h2>期望薪资范围（可选）</h2>
            <div className="salary-inputs">
              <div className="salary-input-group">
                <label>最低薪资</label>
                <input
                  type="number"
                  placeholder="如: 15000"
                  value={salaryMin || ''}
                  onChange={(e) => setSalaryMin(Number(e.target.value) || undefined)}
                  className="salary-input"
                />
                <span className="unit">元</span>
              </div>
              <span className="range-separator">-</span>
              <div className="salary-input-group">
                <label>最高薪资</label>
                <input
                  type="number"
                  placeholder="如: 25000"
                  value={salaryMax || ''}
                  onChange={(e) => setSalaryMax(Number(e.target.value) || undefined)}
                  className="salary-input"
                />
                <span className="unit">元</span>
              </div>
            </div>
          </div>

          <button
            className="recommend-button"
            onClick={handleRecommend}
            disabled={loading || selectedSkills.length === 0}
          >
            {loading ? '推荐中...' : '开始推荐'}
          </button>
        </div>

        <div className="result-section">
          {recommendations.length > 0 ? (
            <>
              <div className="result-header">
                <h2>推荐结果 ({recommendations.length})</h2>
                <p>按匹配度排序</p>
              </div>
              <div className="recommendations-list">
                {recommendations.map((rec) => (
                  <div
                    key={rec.role.role_id}
                    className="recommendation-item"
                    onClick={() => handleViewProbability(rec)}
                  >
                    <RecommendCard recommendation={rec} />
                    {selectedRecommendation?.role.role_id === rec.role.role_id && probabilityDetail && (
                      <div className="probability-detail">
                        <h3>应聘概率详细分析</h3>
                        <ProbabilityGauge
                          probability={probabilityDetail.probability}
                          breakdown={probabilityDetail.breakdown}
                          suggestions={probabilityDetail.suggestions}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>选择技能后开始推荐</h3>
              <p>系统将根据您的技能匹配最适合的职业</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
