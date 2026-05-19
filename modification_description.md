# 项目修改说明文档

## 修改概览

本次修改为知识图谱项目新增了**智能职业推荐系统**，包含3个核心算法、6个API接口、2个可视化组件和1个完整的推荐页面。

---

## 一、后端修改（Backend）

### 1.1 新增算法文件

#### 文件1：`backend/service/career_analyzer.py`
**功能：** 职业详情分析算法

**新增内容：**
- `CareerAnalyzer` 类
- `analyze_role_detail()` - 分析职业详情（技能、公司、统计）
- `get_role_skill_gap()` - 分析用户技能与目标职业的差距
- `_calculate_statistics()` - 计算统计信息
- `_urgency_score()` - 紧急度评分转换

**作用：** 为职业洞察功能提供数据支持，回答"一个职业需要什么技能、能去哪些公司"。

---

#### 文件2：`backend/service/skill_matcher.py`
**功能：** 智能职业推荐算法

**新增内容：**
- `SkillMatcher` 类
- `_clean_dict()` - 清理Neo4j DateTime等不可序列化对象
- `recommend_by_skills_and_salary()` - 基于技能和薪资推荐职业
- `_check_salary_fit()` - 检查薪资是否符合期望
- `_calculate_apply_probability()` - 计算应聘概率
- `get_skill_based_roles()` - 快速技能推荐（简化版）

**核心算法：**
```
匹配评分 = 技能匹配率 × 0.6 + 核心技能覆盖率 × 0.4
应聘概率 = 技能匹配 × 0.5 + 核心覆盖 × 0.3 + 公司紧急度 × 0.2
```

**作用：** 根据用户技能和期望薪资，推荐最匹配的职业。

---

#### 文件3：`backend/service/probability_calculator.py`
**功能：** 应聘概率计算算法

**新增内容：**
- `ProbabilityCalculator` 类
- `calculate_apply_probability()` - 计算应聘成功概率
- `_analyze_skills()` - 分析技能匹配情况
- `_get_company_urgency()` - 获取公司紧急度
- `_calculate_market_factor()` - 计算市场竞争因子
- `_generate_suggestions()` - 生成改进建议
- `batch_calculate_probability()` - 批量计算概率

**多维度评分体系：**
- 技能匹配度
- 核心技能覆盖：权重 
- 公司紧急度：权重 20%
- 市场竞争度：权重 10%

- 核心技能惩罚指数。
- 紧急度加成系数
- 竞争度减损系数
- Sigmoid斜率
- 录用门槛线

- 核心公式
- 个体实力得分 = 核心技能覆盖 ** 核心技能惩罚指数 * 技能匹配度
- 环境修正因子 = (1 + 紧急度加成系数 * 公司紧急度) / (1 + 竞争度减损系数 * 市场竞争度)
- 最终得分 = 个体实力得分 * 环境修正因子
- probability = 1 / (1 + math.exp(-Sigmoid斜率 * (最终得分 - 录用门槛线)))

**作用：** 综合多维度评估应聘成功概率，提供改进建议。

---

### 1.2 新增API接口

#### 文件4：`backend/api/recommend_api.py`
**功能：** 智能推荐API路由

**新增接口：**

| 接口路径 | 方法 | 功能 |
|---------|------|------|
| `/api/recommend/role/{role_id}/detail` | GET | 获取职业详情 |
| `/api/recommend/role/skill-gap` | POST | 分析技能差距 |
| `/api/recommend/career` | POST | 智能职业推荐 |
| `/api/recommend/quick` | GET | 快速技能推荐 |
| `/api/recommend/probability/apply` | POST | 计算应聘概率 |
| `/api/recommend/probability/batch` | POST | 批量概率计算 |

**请求/响应模型：**
- `CareerRecommendRequest` - 职业推荐请求
- `ApplyProbabilityRequest` - 概率计算请求
- `SkillGapRequest` - 技能差距请求
- `RoleDetailResponse` - 职业详情响应

---

### 1.3 修改主程序

#### 文件5：`backend/main.py`
**修改内容：**

```python
# 第5行：新增导入
from api import graph_api, recommend_api

# 第34行：新增路由注册
app.include_router(recommend_api.router, prefix="/api/recommend", tags=["智能推荐接口"])
```

**作用：** 将新的推荐API注册到FastAPI应用中。

---

## 二、前端修改（Frontend）

### 2.1 新增类型定义

#### 文件6：`frontend/src/types/recommendApi.ts`
**功能：** TypeScript类型定义

**新增类型：**
- `SkillInfo` - 技能信息
- `CompanyInfo` - 公司信息
- `RoleInfo` - 职业信息
- `RoleDetailResponse` - 职业详情响应
- `SkillGapAnalysis` - 技能差距分析
- `CareerRecommendation` - 职业推荐结果
- `CareerRecommendResponse` - 职业推荐响应
- `ProbabilityBreakdown` - 概率评分详情
- `ApplyProbabilityResponse` - 应聘概率响应
- `CareerRecommendRequest` - 推荐请求参数
- `ApplyProbabilityRequest` - 概率请求参数
- `SkillGapRequest` - 技能差距请求

**作用：** 为前端提供完整的类型检查和智能提示。

---

### 2.2 新增API调用

#### 文件7：`frontend/src/services/recommendApi.ts`
**功能：** 推荐API调用封装

**新增函数：**
- `getRoleDetail()` - 获取职业详情
- `analyzeSkillGap()` - 分析技能差距
- `recommendCareer()` - 智能职业推荐
- `quickRecommendBySkills()` - 快速推荐
- `calculateApplyProbability()` - 计算应聘概率
- `batchCalculateProbability()` - 批量概率计算

**配置：**
```typescript
const API_BASE_URL = 'http://localhost:8000'
const RECOMMEND_API_URL = `${API_BASE_URL}/api/recommend`
```

---

### 2.3 新增可视化组件

#### 文件8：`frontend/src/components/recommend/RecommendCard.tsx`
**功能：** 推荐结果卡片组件

**组件特性：**
- 显示职业名称和匹配度
- 技能对比（已掌握/需补充）
- 公司列表展示
- 应聘概率进度条
- 颜色编码（绿/黄/红）

**Props接口：**
```typescript
interface RecommendCardProps {
  recommendation: CareerRecommendation
  onRoleClick?: (roleId: string) => void
  onCompanyClick?: (companyId: string) => void
}
```

---

#### 文件9：`frontend/src/components/recommend/RecommendCard.css`
**功能：** 推荐卡片样式

**样式特点：**
- 卡片悬停动画效果
- 渐变色匹配度显示
- 技能标签颜色区分
- 紧急度徽章
- 响应式布局

---

#### 文件10：`frontend/src/components/recommend/ProbabilityGauge.tsx`
**功能：** 概率仪表盘组件

**组件特性：**
- SVG圆形进度条
- 多维度评分展示
- 改进建议列表
- 颜色动态变化
- 三种尺寸（small/medium/large）

**Props接口：**
```typescript
interface ProbabilityGaugeProps {
  probability: number
  breakdown?: ProbabilityBreakdown
  suggestions?: string[]
  size?: 'small' | 'medium' | 'large'
}
```

---

#### 文件11：`frontend/src/components/recommend/ProbabilityGauge.css`
**功能：** 概率仪表盘样式

**样式特点：**
- 圆形仪表盘
- 评分条渐变色
- 建议列表样式
- 动画过渡效果

---

### 2.4 新增推荐页面

#### 文件12：`frontend/src/pages/CareerRecommend.tsx`
**功能：** 智能职业推荐页面

**页面功能：**
1. 技能多选器
2. 薪资范围输入
3. 推荐结果列表
4. 概率详情展示

**核心函数：**
- `loadSkills()` - 加载所有技能
- `handleRecommend()` - 执行推荐
- `handleViewProbability()` - 查看概率详情
- `getSkillName()` - 安全获取技能名称
- `toggleSkill()` - 切换技能选择

**状态管理：**
```typescript
const [allSkills, setAllSkills] = useState<GraphNode[]>([])
const [selectedSkills, setSelectedSkills] = useState<string[]>([])
const [salaryMin, setSalaryMin] = useState<number | undefined>(undefined)
const [salaryMax, setSalaryMax] = useState<number | undefined>(undefined)
const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([])
```

**修复的问题：**
- GraphJson类型安全处理（第77-82行）
- 避免toLowerCase()调用错误
- ReactNode类型兼容

---

#### 文件13：`frontend/src/pages/CareerRecommend.css`
**功能：** 推荐页面样式

**样式特点：**
- 双栏布局（输入区 + 结果区）
- 技能网格展示
- 技能标签悬停效果
- 薪资输入组件
- 空状态展示
- 响应式适配

---

### 2.5 修改应用入口

#### 文件14：`frontend/src/App.tsx`
**修改内容：**

**原代码：**
```typescript
import { Home } from './pages/Home'
export default function App() {
  return <Home />
}
```

**新代码：**
```typescript
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
import { CareerRecommend } from './pages/CareerRecommend'

export default function App() {
  return (
    <Router>
      <div>
        <nav style={{...}}> {/* 导航栏 */}
          <Link to="/">图谱浏览</Link>
          <Link to="/recommend">智能推荐</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recommend" element={<CareerRecommend />} />
        </Routes>
      </div>
    </Router>
  )
}
```

**作用：** 添加路由功能和导航栏，支持多页面切换。

---

### 2.6 修改依赖配置

#### 文件15：`frontend/package.json`
**修改内容：**

**第20行新增：**
```json
"react-router-dom": "^6.22.0"
```

**作用：** 添加路由依赖包。

## 三、文件概览
### 新增文件（15个）

**后端（4个）：**
- backend/service/career_analyzer.py
- backend/service/skill_matcher.py
- backend/service/probability_calculator.py
- backend/api/recommend_api.py

**前端（8个）：**
- frontend/src/types/recommendApi.ts
- frontend/src/services/recommendApi.ts
- frontend/src/components/recommend/RecommendCard.tsx
- frontend/src/components/recommend/RecommendCard.css
- frontend/src/components/recommend/ProbabilityGauge.tsx
- frontend/src/components/recommend/ProbabilityGauge.css
- frontend/src/pages/CareerRecommend.tsx
- frontend/src/pages/CareerRecommend.css

### 修改文件（3个）

- backend/main.py
- frontend/src/App.tsx
- frontend/package.json
