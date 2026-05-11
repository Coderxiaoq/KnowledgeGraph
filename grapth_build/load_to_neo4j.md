# 知识图谱查询指南（成员 C）

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
