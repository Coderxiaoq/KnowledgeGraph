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
├── grapth_build/
│   ├── src/
│   └── data/     
├── docker-compose.yml       # 服务编排配置
├── .gitignore               # Git 忽略规则
└── README.md                # 项目说明文档
```

## 🛠️ 预计工作

- \[  \]搜集职业规划相关数据
- \[  \]构建知识图谱
-   - \[  \]实体识别 （后续补充）
- \[  \]前后端的应用实现
-   - \[  \]环境配置



