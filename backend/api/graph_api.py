from fastapi import APIRouter, Depends, Query, Path
from core.connect import get_db_session
from models.graph import GraphDataResponse
from service.graph_service import GraphService

router = APIRouter()

@router.get("/search", response_model=GraphDataResponse, summary="模糊搜索节点")
async def search_graph(
    keyword: str = Query(..., description="搜索关键词，匹配名称和简介"),
    session = Depends(get_db_session)
):
    """
    接收前端搜索框的输入，返回匹配的节点及其关联的上下游节点。
    """
    graph_data = GraphService.search_nodes(session, keyword=keyword)
    return GraphDataResponse(data=graph_data)


@router.get("/expand/{node_id}", response_model=GraphDataResponse, summary="扩展查询单节点")
async def expand_graph(
    node_id: str = Path(..., description="节点的唯一ID (如 s1, r2, c1)"),
    session = Depends(get_db_session)
):
    """
    当用户在前端点击某个孤立节点时，调用此接口获取它的一跳邻居。
    常用于用户聚焦某一栏位时的动态加载。
    """
    graph_data = GraphService.expand_node(session, node_id=node_id)
    return GraphDataResponse(data=graph_data)


@router.get("/category/{label}", response_model=GraphDataResponse, summary="按类别获取节点集")
async def get_category_nodes(
    label: str = Path(..., description="节点分类名称，可选值：Skill, Role, Company"),
    limit: int = Query(50, description="限制返回数量，防止画布卡顿"),
    session = Depends(get_db_session)
):
    """
    获取某一栏位的初始数据。
    例如：页面刚加载时，前端调用 /category/Skill 铺满左侧能力栏。
    """
    graph_data = GraphService.get_nodes_by_category(session, label=label, limit=limit)
    return GraphDataResponse(data=graph_data)