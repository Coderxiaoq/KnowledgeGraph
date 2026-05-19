# 职业规划知识图谱 (Career Path Knowledge Graph)

![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-4581C3?style=for-the-badge&logo=neo4j&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

基于知识图谱的职业规划交互式 Web 应用。通过图谱可视化的方式，帮助用户探索职业路径、了解岗位技能需求，并实现技能与岗位的智能推荐。

## 功能特性

- **图谱可视化漫游**：基于 Cytoscape.js 渲染的全局职业知识网络，支持缩放、拖拽与节点交互
- **动态检索**：快速搜索特定职业或技能，高亮展示关联节点
- **节点详情侧边栏**：点击节点实时获取职业详情、薪资范围及前置技能
- **智能推荐**：2 选 1 推荐算法，支持"技能+公司→岗位"等三种推荐类型
- **全局过滤器**：多条件过滤（按薪资、技能、公司等），支持正/负向过滤语义

## 技术栈

| 层     | 技术                                                             |
|--------|------------------------------------------------------------------|
| 前端   | React 19 + TypeScript + Cytoscape.js + Tailwind CSS + Vite      |
| 后端   | Python 3.10 + FastAPI                                            |
| 数据库 | Neo4j（图数据库）                                                |
| 部署   | Docker + Docker Compose                                          |

## 项目结构

```
KnowledgeGraph/
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/         # 通用组件（SearchBar、RecommendWindow 等）
│   │   ├── graph/              # 图谱渲染与布局（Cytoscape.js）
│   │   ├── pages/              # 页面
│   │   ├── services/           # API 调用层
│   │   ├── store/              # Zustand 状态管理
│   │   └── types/              # TypeScript 类型
│   └── Dockerfile
├── backend/                    # FastAPI 后端
│   ├── api/graph_api.py        # 路由层
│   ├── service/                # 业务逻辑（图查询、过滤、推荐算法）
│   ├── models/                 # 数据模型
│   ├── core/connect.py         # Neo4j 连接
│   ├── main.py                 # 应用入口
│   ├── requirements.txt
│   ├── .env                    # 环境变量（本地）
│   ├── API_USAGE.md            # 接口文档
│   └── Dockerfile
├── grapth_build/               # 知识图谱构建
│   ├── src/load_graph.py       # Neo4j 导入脚本
│   └── data/                   # 原始数据集
├── docker-compose.yml          # 服务编排
├── neo4j_data_format.md        # Neo4j 数据格式规范
└── README.md
```

## 快速开始

### 前置条件

- Docker & Docker Compose
- Neo4j 实例（本机或远程，Bolt 端口 `7687`）
- Python 3.10+（仅数据导入时需要）

---

### 1. 导入知识图谱数据

安装依赖并运行导入脚本（会清空旧数据、创建约束和索引，然后批量导入节点与关系）：

```bash
pip install neo4j
cd grapth_build/src
python load_graph.py
```

可在 Neo4j Browser（`http://localhost:7474`）中验证导入结果。

---

### 2. 配置后端环境变量

编辑 `backend/.env`：

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

> Docker 容器内默认使用 `bolt://host.docker.internal:7687` 连接宿主机 Neo4j，可通过 `docker-compose.yml` 中的环境变量覆盖。

---

### 3. 启动服务

```bash
# 首次启动（构建镜像）
docker compose up -d --build

# 日常启动
docker compose up -d
```

#### 不用 Docker，直接启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 4. 访问服务

| 服务          | 地址                          |
|---------------|-------------------------------|
| 前端          | http://localhost:5173         |
| 后端 API      | http://localhost:8000         |
| Swagger Docs  | http://localhost:8000/docs    |
| 健康检查      | http://localhost:8000/health  |

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看全部日志
docker compose logs -f

# 查看单服务日志
docker compose logs -f backend

# 停止并清理容器与网络
docker compose down
```

## 文档

- [backend/API_USAGE.md](backend/API_USAGE.md) — 完整接口文档，包含过滤器语义和请求示例
- [backend/推荐算法说明.md](backend/推荐算法说明.md) — 推荐算法评分细节
- [neo4j_data_format.md](neo4j_data_format.md) — Neo4j 节点/边入库格式规范
- [grapth_build/load_into_neo4j.md](grapth_build/load_into_neo4j.md) — 常用 Cypher 查询参考
