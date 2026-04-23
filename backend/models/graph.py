from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal

# ==========================================
# 图谱基础元素模型
# ==========================================
class GraphNode(BaseModel):
    id: str = Field(..., description="节点的唯一标识 (对应我们存的 skill_id/role_id/company_id)")
    label: str = Field(..., description="节点类型 (如 Skill, Role, Company)")
    properties: Dict[str, Any] = Field(default_factory=dict, description="节点的其他属性(如名称、薪资等)")

class GraphEdge(BaseModel):
    source: str = Field(..., description="连线起点的节点ID")
    target: str = Field(..., description="连线终点的节点ID")
    relation: str = Field(..., description="关系类型 (如 REQUIRES, RECRUITS)")
    properties: Dict[str, Any] = Field(default_factory=dict, description="关系的属性(如权重、是否核心等)")

# ==========================================
# 返回给前端的完整图谱结构
# ==========================================
class GraphDataResponse(BaseModel):
    code: int = 200
    msg: str = "success"
    data: dict = Field(
        default_factory=dict,
        description="包含 nodes 和 edges 的字典",
        examples=[
            {
                "nodes": [{"id": "s1", "label": "Skill", "properties": {"name": "Python"}}],
                "edges": [{"source": "r1", "target": "s1", "relation": "REQUIRES", "properties": {}}]
            }
        ]
    )


class GraphFilterOption(BaseModel):
    target: Literal["node", "edge"] = Field(default="node", description="过滤对象：节点或边")
    field: str = Field(..., description="过滤的属性名，来自 properties 下的字段")
    value: Any = Field(..., description="过滤值")
    op: Literal["eq", "contains", "gt", "gte", "lt", "lte", "in"] = Field(
        default="eq",
        description="过滤操作符"
    )


class GraphFilterState(BaseModel):
    node_filters: List[GraphFilterOption] = Field(default_factory=list, description="节点过滤规则列表")
    edge_filters: List[GraphFilterOption] = Field(default_factory=list, description="边过滤规则列表")


class GraphFilterSetRequest(BaseModel):
    node_filters: List[GraphFilterOption] = Field(default_factory=list)
    edge_filters: List[GraphFilterOption] = Field(default_factory=list)