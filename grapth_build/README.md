# 招聘知识图谱构建

从招聘 CSV 数据中提取 `(岗位, REQUIRES, 技能)` 三元组，构建知识图谱。

## 项目结构

```
├── data/
│   └── data.csv                            # 原始招聘数据 (1096行)
├── src/                                    # 源码目录 
    └── csvTojson.py                        # 阶段1: 知识提取
    └── extract.py                          # 阶段2: 知识融合
    └── knowledge_graph.json                # 知识提取初始图谱
    └── knowledge_graph_optimized.json      # 知识融合最终图谱
├── requirements.txt                        # Python 依赖
        
└── README.md
```

## 数据格式

`data.csv` 包含6个字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| 岗位名称 | 招聘岗位 | `Java开发工程师` |
| 薪资 | 薪资范围 | `15000-20000` |
| 工作地址 | 工作地点 | `阿克苏-阿克苏市` |
| 工作年限 | 经验要求 | `1-3年` |
| 学历要求 | 学历要求 | `本科` |
| 专业学术术语 | 所需技能 | `Spring MySQL Redis` |

## 三元组 Schema

```
(Role) ──[REQUIRES]──▶ (Skill)
              │
              ├── weight: 同现次数
              └── proficiency: 了解 | 熟悉 | 精通
```

- **Role 节点**: 标准化岗位类别 (~70类)，含 salary 属性
- **Skill 节点**: 标准化技能名 (~1000个)

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 阶段1: 知识提取 (CSV → 原始图谱)
python csvTojson.py

# 阶段2: 知识融合 (消歧、去重、聚合)
python extract.py
```

## 两阶段流水线

### 阶段1: 知识提取 (`csvTojson.py`)

1. 从 CSV 按岗位名去重构建 Role 节点
2. 分割专业学术术语字段构建 Skill 节点 (保护多词技能: `SQL Server`、`C++`、`.NET` 等)
3. 按同现次数统计边权重
4. 输出 `knowledge_graph.json`

### 阶段2: 知识融合 (`extract.py`)

五阶段流水线：

| 阶段 | 任务 | 技术 |
|------|------|------|
| 1 | 技能消歧 | 别名映射(80+条) → 主流程表匹配 → SequenceMatcher模糊纠错 |
| 2 | 技能同名合并 | 标准化后的同名实体去重 |
| 2.5 | 技能格式归一化 | 去空格/标点/大小写后匹配合并 (`SQLServer` → `SQL Server`) |
| 3 | 岗位消歧 | 名称清洗 → 最长关键词优先级匹配(~27类) → TF-IDF余弦相似度兜底 |
| 4 | 边重定向+聚合 | 指向被合并实体的边重定向，权重累加，重算 proficiency |
| 5 | 输出 | 生成 `knowledge_graph_optimized.json` |

### 消歧策略

**技能消歧**:
- 别名映射: `k8s→Kubernetes`, `js→JavaScript`, `vuejs→Vue`
- 格式归一化: 去大小写+空白+标点后精确匹配
- 模糊纠错: SequenceMatcher 编辑距离匹配 (`pyhton→Python`)
- 短技能名 (≤4字符) 提高阈值到 0.90 防误匹配

**岗位消歧**:
- 名称清洗: 去括号内容、职位编号(`MJ000640`)、薪资广告语、公司名
- 关键词优先级: 按关键词长度打分，长词优先 (避免 `测试` 误匹配 `测试架构师`)
- TF-IDF 兜底: 余弦相似度阈值 0.30 归类

## 岗位分类体系 (27类)

架构师、嵌入式开发、C++开发、Java开发、Python开发、前端、后端、全栈、PHP、.NET、Golang、Android/iOS、算法、AI/人工智能、大数据、DBA/数据库、云计算、测试、安全、网络、硬件、运维、技术经理/总监、软件开发、产品经理、数据分析、讲师/培训、项目经理、销售/商务

## 输出示例

```json
{
  "nodes": [
    {"id": "r_1", "label": "Role", "properties": {"name": "Java开发工程师", "salary": "15000-80000"}},
    {"id": "s_1", "label": "Skill", "properties": {"name": "Spring"}}
  ],
  "edges": [
    {
      "source": "r_1",
      "target": "s_1",
      "label": "REQUIRES",
      "properties": {"weight": 12, "proficiency": "精通"}
    }
  ]
}
```
