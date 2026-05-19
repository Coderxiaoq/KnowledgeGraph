import React from 'react'
import type { ProbabilityBreakdown } from '../../types/recommendApi'
import './ProbabilityGauge.css'

interface ProbabilityGaugeProps {
  probability: number
  breakdown?: ProbabilityBreakdown
  suggestions?: string[]
  size?: 'small' | 'medium' | 'large'
}

export function ProbabilityGauge({
  probability,
  breakdown,
  suggestions,
  size = 'medium',
}: ProbabilityGaugeProps) {
  const getColor = (value: number) => {
    if (value >= 0.7) return { main: '#52c41a', light: '#95de64' }
    if (value >= 0.4) return { main: '#faad14', light: '#ffc53d' }
    return { main: '#ff4d4f', light: '#ff7875' }
  }

  const getLevel = (value: number) => {
    if (value >= 0.7) return '优秀'
    if (value >= 0.6) return '良好'
    if (value >= 0.4) return '一般'
    return '较弱'
  }

  const colors = getColor(probability)
  const percentage = Math.round(probability * 100)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference * (1 - probability)

  return (
    <div className={`probability-gauge ${size}`}>
      <div className="gauge-circle">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="#f0f0f0"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={colors.main}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="gauge-value">
          <span className="value-number" style={{ color: colors.main }}>
            {percentage}
          </span>
          <span className="value-unit">%</span>
        </div>
      </div>

      <div className="gauge-label" style={{ color: colors.main }}>
        {getLevel(probability)}
      </div>

      {breakdown && (
        <div className="breakdown-section">
          <div className="breakdown-title">评分详情</div>
          <div className="breakdown-items">
            <BreakdownItem label="技能匹配" value={breakdown.skill_match} weight={40} />
            <BreakdownItem label="核心覆盖" value={breakdown.core_skill_cover} weight={30} />
            <BreakdownItem label="公司紧急度" value={breakdown.company_urgency} weight={20} />
            <BreakdownItem
              label="市场竞争"
              value={breakdown.market_competition}
              weight={10}
            />
          </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="suggestions-section">
          <div className="suggestions-title">建议</div>
          <ul className="suggestions-list">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <li key={index} className="suggestion-item">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BreakdownItem({ label, value, weight }: { label: string; value: number; weight: number }) {
  const getColor = (val: number) => {
    if (val >= 0.7) return '#52c41a'
    if (val >= 0.4) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div className="breakdown-item">
      <div className="breakdown-header">
        <span className="breakdown-label">{label}</span>
        <span className="breakdown-weight">(权重 {weight}%)</span>
      </div>
      <div className="breakdown-bar-container">
        <div className="breakdown-bar">
          <div
            className="breakdown-fill"
            style={{
              width: `${value * 100}%`,
              backgroundColor: getColor(value),
            }}
          />
        </div>
        <span className="breakdown-value">{Math.round(value * 100)}%</span>
      </div>
    </div>
  )
}
