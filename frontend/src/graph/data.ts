import type { GraphData } from '../types/graph'

export const skillGraph: GraphData = {
  nodes: [
    { data: { id: 'skill-map', label: '技能图谱', category: 'root' } },
    { data: { id: 'skill-nlp', label: 'NLP', category: 'skill' } },
    { data: { id: 'skill-llm', label: 'LLM 应用', category: 'skill' } },
    { data: { id: 'skill-rag', label: 'RAG', category: 'skill' } },
    { data: { id: 'skill-kg', label: '知识图谱', category: 'skill' } },
  ],
  edges: [
    { data: { id: 's1', source: 'skill-map', target: 'skill-nlp', label: '核心' } },
    { data: { id: 's2', source: 'skill-map', target: 'skill-llm', label: '前沿' } },
    { data: { id: 's3', source: 'skill-map', target: 'skill-rag', label: '方案' } },
    { data: { id: 's4', source: 'skill-map', target: 'skill-kg', label: '基础' } },
  ],
}

export const jobGraph: GraphData = {
  nodes: [
    { data: { id: 'job-role', label: '岗位图谱', category: 'root' } },
    { data: { id: 'job-pm', label: 'AI 产品经理', category: 'job' } },
    { data: { id: 'job-engineer', label: '算法工程师', category: 'job' } },
    { data: { id: 'job-analyst', label: '数据分析师', category: 'job' } },
    { data: { id: 'job-architect', label: '知识工程师', category: 'job' } },
  ],
  edges: [
    { data: { id: 'j1', source: 'job-role', target: 'job-pm', label: '推荐' } },
    { data: { id: 'j2', source: 'job-role', target: 'job-engineer', label: '匹配' } },
    { data: { id: 'j3', source: 'job-role', target: 'job-analyst', label: '衍生' } },
    { data: { id: 'j4', source: 'job-role', target: 'job-architect', label: '延伸' } },
  ],
}

export const companyGraph: GraphData = {
  nodes: [
    { data: { id: 'company-target', label: '企业图谱', category: 'root' } },
    { data: { id: 'company-a', label: '平台型企业', category: 'company' } },
    { data: { id: 'company-b', label: '大模型团队', category: 'company' } },
    { data: { id: 'company-c', label: '产业研究院', category: 'company' } },
    { data: { id: 'company-d', label: 'ToB 服务商', category: 'company' } },
  ],
  edges: [
    { data: { id: 'c1', source: 'company-target', target: 'company-a', label: '适配' } },
    { data: { id: 'c2', source: 'company-target', target: 'company-b', label: '优先' } },
    { data: { id: 'c3', source: 'company-target', target: 'company-c', label: '研究' } },
    { data: { id: 'c4', source: 'company-target', target: 'company-d', label: '落地' } },
  ],
}
