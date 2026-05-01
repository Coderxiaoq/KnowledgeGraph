

## 文件说明
| 文件 | 说明 |
|------|------|
| `load_graph.py` | Neo4j 导入脚本 |
| `knowledge_graph_optimized.json` | 图谱数据（节点+边） |

## 环境准备

### 1. 安装 Neo4j
- 下载 [Neo4j Desktop](https://neo4j.com/download/)
- 创建数据库，密码设为 `iris5678`
- 启动数据库，确认 Bolt 端口为 `7687`

### 2. 安装依赖
```bash
pip install neo4j

执行导入
bash
python load_graph.py
预期输出：

text
✓ 数据库已清空
✓ 唯一约束与索引创建完成
✓ 导入 126 个 Skill 节点
✓ 导入 73 个 Role 节点
✓ 导入 773 条 REQUIRES 关系

========== 图谱统计 ==========
  Skill: 126
  Role: 73
  REQUIRES: 773
✅ 知识图谱导入完成！
在 Neo4j Browser 中查看图谱
1. 打开 Neo4j Browser
访问 http://localhost:7474，登录（用户名 neo4j，密码 iris5678）

2. 执行查询
查看岗位→技能关系图（推荐）：

cypher
MATCH (r:Role)-[:REQUIRES]->(s:Skill) RETURN r, s LIMIT 100;
查看某个具体岗位及其技能：

cypher
MATCH (r:Role {role_id: 'r_1'})-[:REQUIRES]->(s:Skill) RETURN r, s;
查看技能被哪些岗位需要：

cypher
MATCH (r:Role)-[:REQUIRES]->(s:Skill {name: 'Python'}) RETURN r, s;
查看节点统计：

cypher
MATCH (n) RETURN labels(n) AS 类型, count(n) AS 数量 ORDER BY 数量 DESC;
3. 切换到 Graph 视图
执行查询后，点击结果区域左上角的 Graph 图标（圆形节点图案），即可看到可视化图谱。

数据统计
类型	数量
Role 节点	73
Skill 节点	126
REQUIRES 关系	773
常见问题
问题	解决方法
ServiceUnavailable	启动 Neo4j，确认 7687 端口可访问
AuthError	检查密码是否为 iris5678
查询不到关系	执行 MATCH ()-[r:REQUIRES]->() RETURN count(r) 确认是否为 0
与后端 API 配合
导入成功后，后端 FastAPI（backend/graph_api.py）可直接连接 Neo4j 提供以下接口：

GET /api/nodes - 查节点

GET /api/edges - 查边

GET /api/search - 搜索

GET /api/expand/{node_id} - 扩展查询

GET /api/recommend/2to1 - 2选1推荐
