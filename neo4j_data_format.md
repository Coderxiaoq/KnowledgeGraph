# Neo4j 点边入库格式说明

本文档定义本项目写入 Neo4j 的标准数据格式，保证和现有查询代码一致。

## 1. 总体结构

统一采用一个 JSON 对象，包含 `nodes` 和 `edges` 两个数组。

```json
{
  "nodes": [
    {
      "label": "Skill",
      "id": "s1",
      "properties": {
        "name": "Python",
        "category": "编程语言",
        "description": "后端与AI主流语言"
      }
    }
  ],
  "edges": [
    {
      "relation": "REQUIRES",
      "source": "r1",
      "target": "s1",
      "properties": {
        "weight": 5,
        "is_core": true,
        "proficiency": "精通"
      }
    }
  ]
}
```

## 2. 节点格式

### 2.1 支持的节点标签

- Skill
- Role
- Company

### 2.2 节点字段

每个节点对象格式：

```json
{
  "label": "Skill | Role | Company",
  "id": "唯一ID字符串",
  "properties": {
    "任意业务属性": "值"
  }
}
```

### 2.3 入库时的唯一 ID 字段映射

为了兼容当前后端提取逻辑，入库后必须保留以下字段之一：

- Skill 节点使用 `skill_id`
- Role 节点使用 `role_id`
- Company 节点使用 `company_id`

说明：当前服务通过这三个字段识别节点 ID。

## 3. 边格式

### 3.1 支持的关系类型

- REQUIRES: `(Role)-[:REQUIRES]->(Skill)`
- RECRUITS: `(Company)-[:RECRUITS]->(Role)`

### 3.2 边字段

每条边对象格式：

```json
{
  "relation": "REQUIRES | RECRUITS",
  "source": "起点节点ID",
  "target": "终点节点ID",
  "properties": {
    "任意关系属性": "值"
  }
}
```

## 4. 推荐节点属性（可按业务扩展）

### 4.1 Skill

```json
{
  "name": "Python",
  "category": "编程语言",
  "description": "后端与AI主流语言"
}
```

### 4.2 Role

```json
{
  "name": "Python后端开发工程师",
  "industry": "互联网软件",
  "avg_salary": "12k-25k",
  "description": "负责系统后端API与核心逻辑开发"
}
```

### 4.3 Company

```json
{
  "name": "字节跳动",
  "scale": "大厂 (>10000人)",
  "salary": "20k",
  "location": "北京/上海/深圳",
  "tags": ["高薪", "节奏快", "技术大牛多"]
}
```

## 5. 推荐关系属性（可按业务扩展）

### 5.1 REQUIRES

```json
{
  "weight": 5,
  "is_core": true,
  "proficiency": "精通"
}
```

### 5.2 RECRUITS

```json
{
  "headcount": 10,
  "urgency": "极高"
}
```

## 6. 导入 Cypher 模板

### 6.1 导入 Skill 节点

```cypher
UNWIND $data AS item
MERGE (s:Skill {skill_id: item.id})
SET s += item.properties,
    s.name = coalesce(item.properties.name, s.name),
    s.description = coalesce(item.properties.description, s.description)
```

### 6.2 导入 Role 节点

```cypher
UNWIND $data AS item
MERGE (r:Role {role_id: item.id})
SET r += item.properties,
    r.name = coalesce(item.properties.name, r.name),
    r.description = coalesce(item.properties.description, r.description)
```

### 6.3 导入 Company 节点

```cypher
UNWIND $data AS item
MERGE (c:Company {company_id: item.id})
SET c += item.properties,
    c.name = coalesce(item.properties.name, c.name)
```

### 6.4 导入 REQUIRES 关系

```cypher
UNWIND $data AS item
MATCH (r:Role {role_id: item.source})
MATCH (s:Skill {skill_id: item.target})
MERGE (r)-[rel:REQUIRES]->(s)
SET rel += item.properties
```

### 6.5 导入 RECRUITS 关系

```cypher
UNWIND $data AS item
MATCH (c:Company {company_id: item.source})
MATCH (r:Role {role_id: item.target})
MERGE (c)-[rel:RECRUITS]->(r)
SET rel += item.properties
```

## 7. 约束建议

建议在 Neo4j 中创建唯一约束，避免重复节点：

```cypher
CREATE CONSTRAINT skill_id_unique IF NOT EXISTS
FOR (s:Skill) REQUIRE s.skill_id IS UNIQUE;

CREATE CONSTRAINT role_id_unique IF NOT EXISTS
FOR (r:Role) REQUIRE r.role_id IS UNIQUE;

CREATE CONSTRAINT company_id_unique IF NOT EXISTS
FOR (c:Company) REQUIRE c.company_id IS UNIQUE;
```

## 8. 最小可用示例

```json
{
  "nodes": [
    {
      "label": "Role",
      "id": "r1",
      "properties": {
        "name": "Python后端开发工程师",
        "description": "负责系统后端API与核心逻辑开发"
      }
    },
    {
      "label": "Skill",
      "id": "s1",
      "properties": {
        "name": "Python",
        "description": "后端与AI主流语言"
      }
    }
  ],
  "edges": [
    {
      "relation": "REQUIRES",
      "source": "r1",
      "target": "s1",
      "properties": {
        "weight": 5,
        "is_core": true
      }
    }
  ]
}
```

## 9. 节点与边属性枚举（建议统一）

以下为推荐的枚举规范，便于前后端、导入脚本和查询逻辑统一。

### 9.1 节点 label 枚举

- Skill
- Role
- Company

### 9.2 边 relation 枚举

- REQUIRES
- RECRUITS

### 9.3 Skill 节点属性枚举

- name: string，技能名称（自由文本）
- category: enum
  - 编程语言
  - 前端框架
  - 后端框架
  - 数据库
  - 运维与部署
  - 云计算
  - AI/机器学习
  - 数据分析
  - 测试
  - 软技能
- description: string，技能说明（自由文本）

### 9.4 Role 节点属性枚举

- name: string，岗位名称（自由文本）
- industry: enum
  - 互联网软件
  - 人工智能
  - 金融科技
  - 游戏
  - 电商
  - 企业服务
  - 教育科技
  - 医疗健康
  - 智能制造
- avg_salary: string，建议格式 `数字k-数字k`，如 `12k-25k`
- description: string，岗位描述（自由文本）

### 9.5 Company 节点属性枚举

- name: string，公司名称（自由文本）
- scale: enum
  - 小型 (<100人)
  - 中型 (100-500人)
  - 大型 (500-10000人)
  - 大厂 (>10000人)
- location: string，建议格式 `城市/城市/...`，如 `北京/上海/深圳`
- tags: string[]，标签数组，单值建议来自以下集合：
  - 高薪
  - 福利好
  - 节奏快
  - 技术大牛多
  - 扁平管理
  - 期权激励
  - 弹性工作
  - 远程友好
  - 成长快

### 9.6 REQUIRES 边属性枚举

- weight: int，建议范围 1-5
- is_core: boolean
  - true: 核心技能
  - false: 非核心技能
- proficiency: enum
  - 了解
  - 熟悉
  - 掌握
  - 精通

### 9.7 RECRUITS 边属性枚举

- headcount: int，建议 >= 1
- salary: string，建议格式 `数字k-数字k`
- urgency: enum
  - 普通
  - 高
  - 极高

### 9.8 可选校验规则（导入前）

- 所有节点必须包含：label, id, properties
- 所有边必须包含：relation, source, target, properties
- relation=REQUIRES 时：source 应为 Role，target 应为 Skill
- relation=RECRUITS 时：source 应为 Company，target 应为 Role
- 不在枚举内的值建议先归一化再入库
