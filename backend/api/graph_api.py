from fastapi import APIRouter, Depends, Query, Path
from core.connect import get_db_session
from models.graph import (
    GraphDataResponse,
    GraphFilterOption,
    GraphFilterSetRequest,
    GraphFilterState,
    Recommend2To1Request,
)
from service.graph_service import GraphService
from service.algo_service import RecommendService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_filter_state(state: dict) -> GraphFilterState:
    return GraphFilterState(
        node_filters=[GraphFilterOption(**item) for item in state.get("node_filters", [])],
        edge_filters=[GraphFilterOption(**item) for item in state.get("edge_filters", [])],
    )


@router.get("/filter", response_model=GraphFilterState, summary="获取全局过滤器")
async def get_global_filter_state():
    """获取当前全局过滤器状态，前端可用于回显已选过滤项。

    返回的过滤项 `GraphFilterOption` 包含新增字段 `mode`，可取 `positive`（保留规则）或 `negative`（剔除规则，默认）。
    """
    state = GraphService.get_global_filter()
    return _build_filter_state(state)


@router.post("/filter", response_model=GraphFilterState, summary="覆盖设置全局过滤器")
async def set_global_filter_state(payload: GraphFilterSetRequest):
    """一次性覆盖全局过滤器（节点过滤 + 边过滤）。

    请求体中每个过滤项可包含 `mode` 字段，决定该规则为正过滤还是负过滤。
    """
    state = GraphService.set_global_filter(
        node_filters=[item.model_dump() for item in payload.node_filters],
        edge_filters=[item.model_dump() for item in payload.edge_filters],
    )
    return _build_filter_state(state)


@router.post("/filter/add", response_model=GraphFilterState, summary="新增一个全局过滤选项")
async def add_global_filter_option(option: GraphFilterOption):
    """新增单条过滤选项。可在 `option.mode` 中指定 `positive` 或 `negative`（默认）。"""
    state = GraphService.add_filter_option(option.model_dump())
    return _build_filter_state(state)


@router.post("/filter/remove", response_model=GraphFilterState, summary="删除一个全局过滤选项")
async def remove_global_filter_option(option: GraphFilterOption):
    """删除与请求体完全匹配的过滤选项。

    注意：删除时 `option` 需要与存储中的规则完全一致（包含 `mode` 字段）。
    """
    state = GraphService.remove_filter_option(option.model_dump())
    return _build_filter_state(state)


@router.post("/filter/clear", response_model=GraphFilterState, summary="清空全局过滤器")
async def clear_global_filter_state():
    """清空所有节点/边过滤条件。"""
    state = GraphService.clear_global_filter()
    return _build_filter_state(state)


@router.get("/nodes", response_model=GraphDataResponse, summary="查全节点")
async def get_all_nodes(
    label: str | None = Query(None, description="节点标签，可选：Skill / Role / Company。不传则默认返回三类"),
    limit: int = Query(200, ge=1, le=2000, description="限制返回数量，防止数据过大"),
    session=Depends(get_db_session)
):
    """
    查询全节点接口：
    - 支持传入 label 过滤单一类别
    - 不传 label 时，默认返回 Skill / Role / Company 三类节点
    """
    graph_data = GraphService.get_all_nodes(session, label=label, limit=limit)
    return GraphDataResponse(data=graph_data)


@router.get("/edges", response_model=GraphDataResponse, summary="查全边")
async def get_all_edges(
    relation: str | None = Query(None, description="关系类型，可选：如 REQUIRES / RECRUITS。不传则返回全部关系"),
    limit: int = Query(500, ge=1, le=5000, description="限制返回数量，防止数据过大"),
    session=Depends(get_db_session)
):
    """
    查询全边接口：
    - 支持传入 relation 过滤单一关系类型
    - 不传 relation 时，返回所有关系类型的边
    """
    graph_data = GraphService.get_all_edges(session, relation=relation, limit=limit)
    return GraphDataResponse(data=graph_data)

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


@router.get("/expand/2hop/{node_id}", response_model=GraphDataResponse, summary="扩展查询一跳+两跳")
async def expand_graph_one_two_hops(
    node_id: str = Path(..., description="节点的唯一ID (如 s1, r2, c1)"),
    limit: int = Query(500, ge=1, le=5000, description="限制返回数量，防止数据过大"),
    session=Depends(get_db_session)
):
    """
    查询指定节点的一跳和两跳邻居。
    同时包含从该节点指出去的关系和指向该节点的关系。
    """
    graph_data = GraphService.expand_node_one_two_hops(session, node_id=node_id, limit=limit)
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

@router.post("/recommend/2to1", response_model=GraphDataResponse, summary="2选1推荐")
async def get_2to1_recommendation(
    payload: Recommend2To1Request,
    session=Depends(get_db_session),
) -> GraphDataResponse:
    """
    三种二推一推荐都走同一个入口，request body 里传 4 个偏好列表：
    - primary_pos_list / primary_neg_list
    - secondary_pos_list / secondary_neg_list

    `type` 决定这两组列表分别代表哪两类节点：
    - skill_to_role: 技能 + 公司 -> 岗位
    - role_to_company: 技能 + 岗位 -> 公司
    - company_to_role: 岗位 + 公司 -> 技能
    """
    data = RecommendService.recommend_2to1_linkage(
        session,
        recommend_type=payload.type,
        primary_pos_list=payload.primary_pos_list,
        primary_neg_list=payload.primary_neg_list,
        secondary_pos_list=payload.secondary_pos_list,
        secondary_neg_list=payload.secondary_neg_list,
        limit=payload.limit,
    )
    # 简单日志，便于定位前端传入的偏好与后端返回结果数量
    try:
        chain_count = len(data.get('chains', [])) if isinstance(data, dict) else 0
    except Exception:
        chain_count = 0

    # Log actual lists for debugging mismatch between front-end and back-end
    logger.info(
        "[Recommend] type=%s primary_pos_list=%s primary_neg_list=%s secondary_pos_list=%s secondary_neg_list=%s -> chains=%d",
        payload.type,
        str(payload.primary_pos_list or []),
        str(payload.primary_neg_list or []),
        str(payload.secondary_pos_list or []),
        str(payload.secondary_neg_list or []),
        chain_count,
    )

    return GraphDataResponse(data=data)