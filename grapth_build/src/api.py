from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from neo4j import GraphDatabase
import uvicorn

# ==========================================
# 1. 数据库连接配置
# ==========================================
NEO4J_URI = "neo4j://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "neo4j_kg" # 请替换为你的真实密码

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

app = FastAPI(
    title="Knowledge Graph MVP API",
    description="为前端可视化与 GraphRAG 提供数据支撑的知识图谱接口",
    version="1.0.0"
)

# ==========================================
# 2. Pydantic Schema 定义 (接口输入输出规范)
# ==========================================
class EntityNode(BaseModel):
    kg_id: str
    name: str
    type: str
    description: Optional[str] = ""

class RelationEdge(BaseModel):
    source_kg_id: str
    target_kg_id: str
    relation_type: str

class GraphVizResponse(BaseModel):
    nodes: List[EntityNode]
    edges: List[RelationEdge]

class NeighborInfo(BaseModel):
    relation_type: str
    neighbor_id: str
    neighbor_name: str

class GraphRAGResponse(BaseModel):
    entity_name: str
    kg_id: str
    context_sentences: List[str]  # 直接拼装好的人类可读句子，方便喂给大模型

# ==========================================
# 3. 核心 API 路由
# ==========================================

@app.on_event("shutdown")
def shutdown_db_client():
    """应用关闭时断开数据库连接"""
    driver.close()

# ---------------------------------------------------------
# API 1: 实体检索入口 (Semantic Search / Keyword Match)
# 场景: 用户在搜索框输入“乔布斯”，我们要返回对应的 kg_id (Q19837)
# ---------------------------------------------------------
@app.get("/api/v1/search", response_model=List[EntityNode], summary="根据名称或别名搜索实体")
def search_entity(keyword: str = Query(..., description="要搜索的实体名称")):
    query = """
    MATCH (n:Entity)
    // 利用上一阶段存下来的 aliases 数组进行模糊匹配
    WHERE any(alias IN n.aliases WHERE alias CONTAINS $keyword)
    RETURN n.kg_id AS kg_id, n.name AS name, n.type AS type, n.description AS description
    LIMIT 5
    """
    with driver.session() as session:
        result = session.run(query, keyword=keyword)
        records =[record.data() for record in result]
        
    if not records:
        raise HTTPException(status_code=404, detail="未找到匹配的实体")
    return records

# ---------------------------------------------------------
# API 2: 图谱可视化支持 (Graph Viz)
# 场景: 前端 Echarts 或 G6 请求全局或局部的节点和关系用来画图
# ---------------------------------------------------------
@app.get("/api/v1/graph/all", response_model=GraphVizResponse, summary="获取图谱数据用于可视化")
def get_graph_for_viz(limit: int = 100):
    """直接拉取图谱中最新的节点和关系用于展示"""
    query = """
    MATCH (s:Entity)-[r]->(t:Entity)
    RETURN 
        s.kg_id AS source_id, s.name AS source_name, s.type AS source_type, s.description AS source_desc,
        type(r) AS rel_type,
        t.kg_id AS target_id, t.name AS target_name, t.type AS target_type, t.description AS target_desc
    LIMIT $limit
    """
    nodes_dict = {}
    edges =[]
    
    with driver.session() as session:
        result = session.run(query, limit=limit)
        for record in result:
            # 处理起点
            if record["source_id"] not in nodes_dict:
                nodes_dict[record["source_id"]] = EntityNode(
                    kg_id=record["source_id"], name=record["source_name"], 
                    type=record["source_type"], description=record["source_desc"]
                )
            # 处理终点
            if record["target_id"] not in nodes_dict:
                nodes_dict[record["target_id"]] = EntityNode(
                    kg_id=record["target_id"], name=record["target_name"], 
                    type=record["target_type"], description=record["target_desc"]
                )
            # 处理边
            edges.append(RelationEdge(
                source_kg_id=record["source_id"],
                target_kg_id=record["target_id"],
                relation_type=record["rel_type"]
            ))
            
    return GraphVizResponse(nodes=list(nodes_dict.values()), edges=edges)

# ---------------------------------------------------------
# API 3: GraphRAG 上下文拼装 (核心加分项)
# 场景: 大模型回答问题前，先通过这个接口把实体的一度关联知识拉取出来作为 Prompt
# ---------------------------------------------------------
@app.get("/api/v1/graphrag/{kg_id}/context", response_model=GraphRAGResponse, summary="获取 GraphRAG 所需的实体上下文")
def get_graphrag_context(kg_id: str):
    query = """
    MATCH (center:Entity {kg_id: $kg_id})
    OPTIONAL MATCH (center)-[r]-(neighbor:Entity)
    RETURN center.name AS center_name, type(r) AS rel_type, neighbor.name AS neighbor_name,
           startNode(r) = center AS is_outgoing
    """
    with driver.session() as session:
        result = session.run(query, kg_id=kg_id)
        records = [r.data() for r in result]
        
    if not records or not records[0].get("center_name"):
        raise HTTPException(status_code=404, detail="未找到该节点")
        
    center_name = records[0]["center_name"]
    sentences =[]
    
    # 将关系图谱数据转化为自然语言描述，方便无缝喂给 LLM
    for rec in records:
        if rec["neighbor_name"] and rec["rel_type"]:
            if rec["is_outgoing"]:
                sentences.append(f"{center_name} 是/有 {rec['rel_type']} 于 {rec['neighbor_name']}。")
            else:
                sentences.append(f"{rec['neighbor_name']} 是/有 {rec['rel_type']} 于 {center_name}。")
                
    return GraphRAGResponse(
        entity_name=center_name,
        kg_id=kg_id,
        context_sentences=list(set(sentences)) # 去重
    )

# ==========================================
# 4. 启动服务
# ==========================================
if __name__ == "__main__":
    print("🚀 正在启动 FastAPI 服务...")
    print("👉 请在浏览器访问 API 文档: http://127.0.0.1:8000/docs")
    uvicorn.run(app, host="127.0.0.1", port=8000)