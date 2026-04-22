from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

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
        description="包含 nodes 和 edges 的字典",
        example={
            "nodes": [{"id": "s1", "label": "Skill", "properties": {"name": "Python"}}],
            "edges": [{"source": "r1", "target": "s1", "relation": "REQUIRES", "properties": {}}]
        }
    )