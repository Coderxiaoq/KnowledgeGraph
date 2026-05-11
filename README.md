# 🎓 职业规划知识图谱 (Career Path Knowledge Graph)

![Vue.js](https://img.shields.io/badge/Vue%203-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

本项目是一个基于知识图谱的职业规划交互式 Web 应用。通过图谱可视化的方式，帮助用户探索职业路径、了解岗位技能需求，并实现技能与岗位的反向匹配。

## ✨ 核心功能 (Features)

- 🕸️ **图谱可视化漫游**：基于 AntV G6 渲染的全局职业知识网络，支持自由缩放、拖拽与节点交互。
- 🔍 **动态检索与展示**：快速搜索特定职业或技能，高亮展示其上下游关联节点。
- 📖 **详情沉浸式侧边栏**：点击任意节点，实时获取该职业的详细介绍、薪资范围及前置技能要求。

## 🛠️ 技术栈 (Tech Stack)

- **前端 (Frontend)**: Vue 3 + Element Plus + AntV G6 (图谱可视化)
  > 暂时先这样写，后续会修改
- **后端 (Backend)**: Python 3.10 + FastAPI
- **数据层 (Database)**: 早期原型采用静态 `JSON` 驱动，预留无缝接入 `Neo4j` 图数据库的接口
- **部署 (Deployment)**: Docker + Docker Compose 容器化编排
  > 可以也可以不

## 📂 目录结构 (Project Structure)
暂时这样？
```
career-kg-project/
├── frontend/                # Vue 3 前端代码
│   ├── src/                 # 页面与组件
│   ├── package.json
│   └── Dockerfile           # 前端容器构建脚本
├── backend/                 # FastAPI 后端代码 
│   ├── main.py              # 接口入口文件
│   ├── data.json            # 知识图谱原始数据 (当前数据源)
│   ├── requirements.txt     # Python 依赖清单
│   └── Dockerfile           # 后端容器构建脚本
├── grapth_build/            # 构建知识图谱
│   ├── src/                 # 用于构建图谱的代码
│   └── data/                # 搜集的职业规划数据集
├── docker-compose.yml       # 服务编排配置
├── .gitignore               # Git 忽略规则
└── README.md                # 项目说明文档
```

## 🛠️ 预计工作

- \[  \]搜集职业规划相关数据
- \[  \]构建知识图谱
-   - \[  \]实体识别 （后续补充）
- \[  \]推荐算法的实现
- \[  \]前后端的应用实现
-   - \[  \]后端开发
-   -   - \[✅️\]命名方式统一 
-   -   - \[✅️\]环境配置
-   -   - \[✅️\]连接数据库
-   -   - \[✅️\]数据库查询
-   -   - \[\]查询细节处理（对工资、地点的特殊处理）
-   -   -\[  \]其他实现
-   - \[  \]前端开发

## 🐳 运行与开发 （此为开发用文档，后续启动时会有更改）

本项目提供两类使用方式：

- 只把 Docker 当运行时（适合演示、联调、验收）
- 使用 VS Code 做日常开发（3 种方式，见下文）

### 0. 前置要求

- Docker Desktop（或 Docker Engine + Docker Compose）
- VS Code（开发场景）

---

## 1. 只启动与运行时：Docker 用法

适用场景：你只需要把服务跑起来，不在容器内长期开发。

### 启动

```bash
# 首次启动或 Dockerfile/依赖有变化
docker compose up -d --build

# 日常启动
docker compose up -d
```

### 访问

- Frontend: http://localhost:5173
- Backend Health: http://localhost:8000/health

### 运行期常用命令

```bash
# 查看服务状态
docker compose ps

# 查看全部日志
docker compose logs -f

# 查看单服务日志
docker compose logs -f frontend
docker compose logs -f backend

# 停止并清理容器与网络
docker compose down
```

---

## 2. VS Code 开发：3 种方式

开发覆盖配置使用 `docker-compose.dev.yml`，它会挂载源码并让后端以 `uvicorn --reload` 运行。

### 方式 A：在 VS Code 本地编辑，改完后重启容器

适用场景：不依赖热重载，流程简单直观。

```bash
# 启动开发容器
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 修改代码后，重启后端容器应用变更
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend

# 如有前端构建问题，可重启前端
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart frontend
```

说明：这种方式不需要进入容器，直接在本机 VS Code 编辑源码即可。

### 方式 B：在容器中打开代码并直接修改（Dev Containers / Attach）

适用场景：希望编辑器、解释器和运行环境与容器完全一致。

1. 安装 VS Code 扩展：Dev Containers、Python、Pylance。
2. 先启动开发容器：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

3. 任选一种进入方式：
  - `Dev Containers: Reopen in Container`（项目已提供 `.devcontainer/devcontainer.json`）
  - `Dev Containers: Attach to Running Container...`，选择 `career-kg-backend`
4. 在容器内编辑 `/app` 下的后端代码，保存后会自动热重载。

### 方式 C：在 VS Code 本机运行后端（热重载），Docker 仅作为辅助

适用场景：想使用本机调试能力（断点、插件、任务），同时保留容器化前端或其他服务。

1. 安装后端依赖（本机 Python 环境）：

```bash
pip install -r backend/requirements.txt
```

2. 在项目根目录启动后端热重载：

```bash
uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```

3. 如需容器前端，可单独启动（会按依赖启动后端容器；若你仅用本机后端，可随后停止容器后端）：

```bash
docker compose up -d frontend
docker compose stop backend
```

说明：该方式下，后端代码改动会由本机 `uvicorn --reload` 立即生效，调试体验通常最好。

---

## 3. 建议选择

- 只跑服务、最省心：使用“只启动与运行时 Docker”
- 要环境一致、团队协作：使用“方式 B（容器内开发）”
- 要最快调试闭环：使用“方式 C（本机后端热重载）”





