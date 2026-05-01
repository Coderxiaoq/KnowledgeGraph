

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

