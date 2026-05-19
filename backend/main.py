from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.connect import db, get_db_session
from api import graph_api, recommend_api

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 【启动时执行】：建立连接池
    db.connect()
    yield
    # 【停止时执行】：关闭连接池
    db.close()

app = FastAPI(title="职业规划知识图谱 API", lifespan=lifespan)

origins = [
    "http://localhost:8080",      # Vue 3 本地开发默认端口
    "http://127.0.0.1:8080",
    "http://localhost:5173",      # 如果前端用 Vite 打包，默认可能是这个端口
    # "http://你的线上域名.com",    # 部署到服务器后，把线上域名加进来
]

# 2. 将中间件挂载到 app 上
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # 允许的源列表（如果在开发初期图省事，也可以直接写 ["*"] 允许所有，但上线前千万要改回来）
    allow_credentials=True,       # 是否允许前端请求携带 Cookie（通常设为 True）
    allow_methods=["*"],          # 允许所有的 HTTP 方法，如 GET, POST, PUT, DELETE, OPTIONS
    allow_headers=["*"],          # 允许所有的请求头（例如前端传来的 Authorization 等等）
)

app.include_router(graph_api.router, prefix="/api/graph", tags=["知识图谱核心接口"])
app.include_router(recommend_api.router, prefix="/api/recommend", tags=["智能推荐接口"])

@app.get("/")
def read_root():
    return {"message": "Career Path Knowledge Graph backend placeholder"}


@app.get("/health")
async def health_check(session=Depends(get_db_session)):
    # 简单的连接测试接口
    result = session.run("RETURN 'OK' as status").single()
    return {"status": result["status"]}
