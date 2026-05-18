# 后端 API 使用说明

本文档说明当前后端图谱接口的使用方式，重点包含全局过滤器的语义和示例。

## 1. 基础信息

- 服务默认地址: `http://localhost:8000`
- 路由前缀: `/api/graph`
- 完整接口前缀: `http://localhost:8000/api/graph`
- 认证: 当前版本无需 Token
- 返回结构: 统一为

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "nodes": [],
    "edges": []
  }
}
```

其中:
- `nodes[].id`: 节点 ID (例如 `s1`, `r2`, `c1`)
- `nodes[].label`: 节点标签 (`Skill`/`Role`/`Company`)
- `nodes[].properties`: 节点属性
- `edges[].source`/`edges[].target`: 边两端节点 ID
- `edges[].relation`: 关系类型 (如 `REQUIRES`/`RECRUITS`)
- `edges[].properties`: 边属性

---

## 2. 全局过滤器 (重点)

### 2.1 设计说明

过滤器是**进程内全局状态**，不是单请求级别：
- 你一旦设置过滤规则，后续查询接口都会生效
- 直到你清空或重新覆盖这些规则
- 典型用法: 前端面板维护一份“当前过滤条件”，通过接口同步到后端

### 2.2 过滤项结构
过滤项结构如下（新增 `mode` 字段用于声明正/负过滤语义）:

```json
{
  "target": "node",
  "field": "name",
  "value": "Python",
  "op": "contains",
  "mode": "negative"
}
```

字段说明:
- `target`: 过滤对象
  - `node` 过滤节点
  - `edge` 过滤边
- `field`: 属性字段名，来自 `properties` 下的 key
- `value`: 过滤值
- `op`: 操作符，支持:
  - `eq`: 等于
  - `contains`: 字符串包含 (大小写不敏感)
  - `gt`/`gte`/`lt`/`lte`: 数值比较
  - `in`: 是否在给定列表中
  - `salary_in`: 薪资区间判断，检查规则中的数字是否落在节点薪资区间内
- `mode`: 过滤模式（可选，默认 `negative`）
  - `negative`: 负过滤，任一条件命中即剔除该元素及其关联边
  - `positive`: 正过滤，仅当元素满足所有正向规则时才保留（正规则组内为 AND）

### 2.3 语义注意点 (非常重要)

过滤器现在支持两种语义：正过滤(`positive`) 与负过滤(`negative`, 默认)。

1. 负过滤（`mode=negative`, 默认）
- 任一负过滤规则命中某元素，即将该元素及其所有关联边剔除（视为黑名单）。
- 多条负过滤规则之间为 OR：只要一条命中即可被剔除。

2. 正过滤（`mode=positive`）
- 正过滤为保留集语义：若存在正过滤规则，则只有满足该组所有正向规则的元素才会被保留；不满足则被剔除。
- 正过滤规则之间为 AND：元素必须同时满足组内所有正向规则才能保留。

3. 节点过滤与边裁剪
- 若任意节点过滤（正或负）存在，最终会裁剪掉两端不在节点结果集中的边，保证前端展示的边两端节点均可见。

4. 边同时支持正/负过滤
- 边过滤按其 `mode` 字段分别应用正或负语义，且在节点裁剪后仍会生效（即边可能被属性过滤或节点裁剪二次筛除）。

5. 其他运算符语义
- `contains` 是大小写不敏感。
- `in` 建议传数组，若 `value` 为数组则使用 `actual in value`；否则退化为等值比较。
- `salary_in` 适用于 `salary` / `avg_salary` 这类区间字符串，`value` 传单个数字即可，例如 `40000`。若节点属性是 `40000-80000`，则会判断 `40000` 是否在该区间内。

### 2.4 过滤器接口

#### 2.4.1 获取当前全局过滤器

- 方法: `GET`
- 路径: `/filter`

示例:

```bash
curl -X GET "http://localhost:8000/api/graph/filter"
```

#### 2.4.2 覆盖设置过滤器 (推荐用于“应用筛选”按钮)

- 方法: `POST`
- 路径: `/filter`
- 含义: 用当前请求体完全替换后端已有过滤状态

请求体示例:

```json
{
  "node_filters": [
    {
      "target": "node",
      "field": "name",
      "value": "实习",
      "op": "contains"
    }
  ],
  "edge_filters": [
    {
      "target": "edge",
      "field": "weight",
      "value": 0.2,
      "op": "lt"
    }
  ]
}
```

示例:

```bash
curl -X POST "http://localhost:8000/api/graph/filter" \
  -H "Content-Type: application/json" \
  -d '{
    "node_filters": [
      {"target": "node", "field": "name", "value": "实习", "op": "contains"}
    ],
    "edge_filters": [
      {"target": "edge", "field": "weight", "value": 0.2, "op": "lt"}
    ]
  }'
```

#### 2.4.3 新增一条过滤项

- 方法: `POST`
- 路径: `/filter/add`
- 含义: 追加到 `node_filters` 或 `edge_filters`

```bash
curl -X POST "http://localhost:8000/api/graph/filter/add" \
  -H "Content-Type: application/json" \
  -d '{"target": "node", "field": "salary", "value": 40000, "op": "salary_in"}'
```

#### 2.4.4 删除一条过滤项

- 方法: `POST`
- 路径: `/filter/remove`
- 含义: 删除与请求体**完全一致**的一条规则

```bash
curl -X POST "http://localhost:8000/api/graph/filter/remove" \
  -H "Content-Type: application/json" \
  -d '{"target": "node", "field": "salary", "value": 40000, "op": "salary_in"}'
```

#### 2.4.5 清空所有过滤项

- 方法: `POST`
- 路径: `/filter/clear`

```bash
curl -X POST "http://localhost:8000/api/graph/filter/clear"
```

### 2.5 一个典型前端流程

1. 页面进入: `GET /filter` 回显筛选面板
2. 用户点“应用”: `POST /filter` 覆盖设置
3. 拉图数据: 调用 `/nodes`、`/edges`、`/search` 等，自动应用过滤
4. 用户点“重置”: `POST /filter/clear`

---

## 3. 图谱查询接口

### 3.1 查询节点

- 方法: `GET`
- 路径: `/nodes`
- 参数:
  - `label` (可选): 指定节点标签，如 `Skill`/`Role`/`Company`
  - `limit` (可选): 默认 `200`，范围 `1~2000`

```bash
curl -X GET "http://localhost:8000/api/graph/nodes?label=Skill&limit=100"
```

### 3.2 查询边

- 方法: `GET`
- 路径: `/edges`
- 参数:
  - `relation` (可选): 指定关系类型，如 `REQUIRES`/`RECRUITS`
  - `limit` (可选): 默认 `500`，范围 `1~5000`

```bash
curl -X GET "http://localhost:8000/api/graph/edges?relation=REQUIRES&limit=200"
```

### 3.3 模糊搜索节点

- 方法: `GET`
- 路径: `/search`
- 参数:
  - `keyword` (必填): 匹配 `name` 和 `description`

```bash
curl -X GET "http://localhost:8000/api/graph/search?keyword=python"
```

### 3.4 一跳扩展

- 方法: `GET`
- 路径: `/expand/{node_id}`

```bash
curl -X GET "http://localhost:8000/api/graph/expand/s1"
```

### 3.5 一跳 + 两跳扩展

- 方法: `GET`
- 路径: `/expand/2hop/{node_id}`
- 参数:
  - `limit` (可选): 默认 `500`，范围 `1~5000`

```bash
curl -X GET "http://localhost:8000/api/graph/expand/2hop/s1?limit=300"
```

### 3.6 按类别取节点

- 方法: `GET`
- 路径: `/category/{label}`
- 参数:
  - `label` (路径参数): `Skill`/`Role`/`Company`
  - `limit` (可选): 默认 `50`

```bash
curl -X GET "http://localhost:8000/api/graph/category/Skill?limit=50"
```

---

## 4. 推荐接口

### 4.1 2 选 1 推荐

- 方法: `GET`
- 路径: `/recommend/2to1`
- 参数:
  - `type` (必填):
    - `skill_to_role`: 两个技能推荐岗位
    - `role_to_company`: 两个岗位推荐公司
    - `company_to_role`: 两个公司推荐岗位
  - `id1` (必填): 第一个输入节点 ID
  - `id2` (必填): 第二个输入节点 ID
  - `limit` (可选): 默认 `3`，范围 `1~20`

```bash
curl -X GET "http://localhost:8000/api/graph/recommend/2to1?type=skill_to_role&id1=s1&id2=s2&limit=3"
```

---

## 5. 调试建议

- 如果你发现“接口数据变少了”，先检查是否设置了全局过滤器:

```bash
curl -X GET "http://localhost:8000/api/graph/filter"
```

- 如果需要恢复默认行为，执行清空:

```bash
curl -X POST "http://localhost:8000/api/graph/filter/clear"
```
