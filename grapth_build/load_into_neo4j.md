# 知识图谱查询指南

## 前提条件

- Neo4j 数据库已启动（`bolt://localhost:7687`）
- 已执行 `load_graph.py` 导入节点和关系（包含 `Company`、`Role`、`Skill` 以及 `RECRUITS`、`REQUIRES`）
- 浏览器访问 `http://localhost:7474`，登录（用户名 `neo4j`，密码 `iris5678`）

## 基础查询

```cypher
-- 1. 查看所有招聘关系（公司 → 岗位）
MATCH (c:Company)-[rec:RECRUITS]->(r:Role)
RETURN c, rec, r
LIMIT 100;

-- 2. 查看所有技能要求关系（岗位 → 技能）
MATCH (r:Role)-[req:REQUIRES]->(s:Skill)
RETURN r, req, s
LIMIT 100;

-- 3. 同时查看两种关系（注意 LIMIT 可能截断，见下方常见问题）
MATCH (n)-[r:REQUIRES|RECRUITS]->(m)
RETURN n, r, m
LIMIT 200;
```
## 招聘分析
```cypher
-- 4. 公司招聘明细（含薪资、人数、紧急度）
MATCH (c:Company)-[rec:RECRUITS]->(r:Role)
RETURN c.name AS 公司, r.name AS 岗位, rec.salary AS 薪资, rec.headcount AS 人数, rec.urgency AS 紧急度
LIMIT 50;

-- 5. 岗位总需求人数排行
MATCH (c:Company)-[rec:RECRUITS]->(r:Role)
RETURN r.name AS 岗位, sum(rec.headcount) AS 总需求人数
ORDER BY 总需求人数 DESC;

-- 6. 高紧急度招聘
MATCH (c:Company)-[rec:RECRUITS {urgency: "高"}]->(r:Role)
RETURN c.name, r.name, rec.salary, rec.headcount;

-- 7. 招聘岗位数量最多的公司 Top 5
MATCH (c:Company)-[:RECRUITS]->(r:Role)
RETURN c.name AS 公司, count(DISTINCT r) AS 招聘岗位数
ORDER BY 招聘岗位数 DESC
LIMIT 5;
```
## 技能需求分析
```cypher
-- 8. 岗位所需技能列表
MATCH (r:Role)-[req:REQUIRES]->(s:Skill)
RETURN r.name AS 岗位, collect(s.name) AS 技能列表
LIMIT 50;

-- 9. 根据技能反向查找公司
MATCH (s:Skill {name: "Python"})<-[:REQUIRES]-(r:Role)<-[:RECRUITS]-(c:Company)
RETURN c.name AS 公司, r.name AS 岗位, s.name AS 技能;

-- 10. 最热门技能 Top10
MATCH (r:Role)-[:REQUIRES]->(s:Skill)
RETURN s.name AS 技能, count(r) AS 需求岗位数
ORDER BY 需求岗位数 DESC
LIMIT 10;
```
## 完整链路（公司->技能->岗位）
```cypher
-- 11. 展示招聘完整路径
MATCH (c:Company)-[:RECRUITS]->(r:Role)-[:REQUIRES]->(s:Skill)
RETURN c.name AS 公司, r.name AS 岗位, collect(s.name) AS 所需技能
LIMIT 50;

-- 12. 某公司的所有招聘链路
MATCH (c:Company {name: "某科技有限公司"})-[:RECRUITS]->(r:Role)-[:REQUIRES]->(s:Skill)
RETURN r.name AS 岗位, collect(s.name) AS 技能列表;
```
常见问题与解决
Q1：MATCH (n)-[r:REQUIRES|RECRUITS]->(m) 看不到 RECRUITS 关系
原因：数据中 REQUIRES 数量远多于 RECRUITS，LIMIT 200 只返回了前 200 条路径，而这 200 条全是 REQUIRES。

解决：增大 LIMIT 或使用 UNION 强制分组合并。
```cypher
-- 方案一：移除 LIMIT（或设为大值）
MATCH (n)-[r:REQUIRES|RECRUITS]->(m)
RETURN n, r, m;

-- 方案二：UNION 分开查询（推荐）
MATCH (c:Company)-[r:RECRUITS]->(ro:Role)
RETURN c AS n, r, ro AS m
UNION
MATCH (ro:Role)-[r:REQUIRES]->(s:Skill)
RETURN ro AS n, r, s AS m;
```

导入成功后，后端 FastAPI（`backend/graph_api.py`）可直接连接 Neo4j 提供以下接口：

| 接口 | 说明 |
|------|------|
| `GET /api/nodes` | 查节点 |
| `GET /api/edges` | 查边 |
| `GET /api/search` | 搜索 |
| `GET /api/expand/{node_id}` | 扩展查询 |
| `GET /api/recommend/2to1` | 2选1推荐 |
