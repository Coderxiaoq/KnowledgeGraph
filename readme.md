# 知识图谱构建
## 环境准备
```bash
pip install -r requirements.txt
```
## 提取实体
### APIkeys导入
```bash
python
$env:ZAI_API_KEY="自己的api_key"
```

## 打开neo4j
下载Neo4j Desktop
创建实例，点击左侧···图标，点击plugins，下载APOC插件，启动实例
打开web界连接
```bash
http://localhost:7474
```

## API

### 导入Neo4j的数据格式示例
```json
{
  "entities": [
    {
      "id": "Apple_Inc",
      "type": "公司",
      "description": "苹果公司，美国跨国科技公司",
      "kg_id": "LOCAL_be1e8ef1",
      "name": "Apple_Inc"
    }
  ],
  "relations": [
    {
      "source": "Apple_Inc",
      "target": "USA",
      "relation_type": "位于",
      "source_kg_id": "LOCAL_be1e8ef1",
      "target_kg_id": "LOCAL_e3c1628d"
    }
  ]
}
```

---

### 字段说明

**Entities (实体)**
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | String | 唯一标识符 |
| `type` | String | 实体类型（如：公司、人物） |
| `description` | String | 详细描述信息 |
| `kg_id` | String | 知识图谱内部 ID |
| `name` | String | 实体名称 |

**Relations (关系)**
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `source` | String | 源实体 ID |
| `target` | String | 目标实体 ID |
| `relation_type` | String | 关系类型 |
| `source_kg_id` | String | 源实体在图谱中的 ID |
| `target_kg_id` | String | 目标实体在图谱中的 ID |

---

---

# 知识图谱后端 API 接口规范 (v1.0.0)

- **Base URL:** `http://127.0.0.1:8000`
- **Swagger UI:** [/docs](http://127.0.0.1:8000/docs)

---

###  1. 实体检索接口 (Search)
通过关键字模糊搜索实体的 `kg_id`。

- **URL:** `/api/v1/search`
- **Method:** `GET`
- **Parameters:**
  | 参数 | 类型 | 必选 | 说明 |
  | :--- | :--- | :--- | :--- |
  | `keyword` | string | 是 | 实体名称或关键字 |

- **Response:**
```json
[
  {
    "kg_id": "Q19837",
    "name": "史蒂夫·乔布斯",
    "type": "Person",
    "description": "美国企业家，苹果公司联合创始人"
  }
]
```

---

### 2. 图谱可视化接口 (Visualization)
获取节点与关系数据，用于前端 Echarts/G6 等组件绘图。

- **URL:** `/api/v1/graph/all`
- **Method:** `GET`
- **Parameters:**
  | 参数 | 类型 | 必选 | 默认值 | 说明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `limit` | int | 否 | 100 | 返回的关系上限数量 |

- **Response:**
```json
{
  "nodes": [
    { "kg_id": "Q19837", "name": "史蒂夫·乔布斯", "type": "Person" },
    { "kg_id": "Q312", "name": "苹果公司", "type": "Organization" }
  ],
  "edges": [
    { "source_kg_id": "Q19837", "target_kg_id": "Q312", "relation_type": "FOUNDER_OF" }
  ]
}
```

---

### 3. GraphRAG 增强接口 (Context)
获取实体的“一度关系邻居”，并转换为自然语言句子，供大模型作为提示词上下文。

- **URL:** `/api/v1/graphrag/{kg_id}/context`
- **Method:** `GET`
- **Parameters:**
  | 参数 | 类型 | 必选 | 说明 |
  | :--- | :--- | :--- | :--- |
  | `kg_id` | string | 是 | 实体的唯一标识符 |

- **Response:**
```json
{
  "entity_name": "史蒂夫·乔布斯",
  "kg_id": "Q19837",
  "context_sentences": [
    "史蒂夫·乔布斯 是/有 FOUNDER_OF 于 苹果公司。",
    "史蒂夫·乔布斯 是/有 CREATOR_OF 于 第一代iPhone。"
  ]
}
```

---

### 状态码说明
| 状态码 | 说明 |
| :--- | :--- |
| `200` | 请求成功 |
| `404` | 未找到匹配数据 |
| `500` | 服务器内部错误 |