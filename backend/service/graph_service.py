from typing import Any, Dict, List, Optional
from service.fliter_service import (
    _to_jsonable,
    add_filter_option as _add_filter_option,
    apply_graph_json_filter,
    clear_global_filter as _clear_global_filter,
    get_global_filter as _get_global_filter,
    remove_filter_option as _remove_filter_option,
    set_global_filter as _set_global_filter,
)


def _extract_node_id(node):
    return node.get("skill_id") or node.get("role_id") or node.get("company_id")


def format_neo4j_data(result) -> dict:
    """
    工具函数：统一将 Neo4j Record 清洗为前端 JSON。
    最后一步会自动应用全局过滤器。
    """
    nodes_dict = {}
    edges_list = []
    edge_seen = set()

    for record in result:
        for value in record.values():
            # Node: 有 labels 属性
            if hasattr(value, "labels"):
                node_id = _extract_node_id(value)
                if node_id and node_id not in nodes_dict:
                    nodes_dict[node_id] = {
                        "id": node_id,
                        "label": list(value.labels)[0] if value.labels else "Unknown",
                        "properties": _to_jsonable(dict(value))
                    }

            # Relationship: 有 type 和 nodes 属性
            if hasattr(value, "type") and hasattr(value, "nodes"):
                source_id = _extract_node_id(value.nodes[0])
                target_id = _extract_node_id(value.nodes[1])
                edge_key = (source_id, target_id, value.type)

                if source_id and target_id and edge_key not in edge_seen:
                    edge_seen.add(edge_key)
                    edges_list.append({
                        "source": source_id,
                        "target": target_id,
                        "relation": value.type,
                        "properties": _to_jsonable(dict(value))
                    })

    graph_data = {"nodes": list(nodes_dict.values()), "edges": edges_list}
    return apply_graph_json_filter(graph_data)


class GraphService:
    DEFAULT_LABELS = ["Skill", "Role", "Company"]
    EDGE_LABELS = ["REQUIRES", "RECRUITS"]  # 根据你的数据模型调整

    @staticmethod
    def get_global_filter() -> Dict[str, List[Dict[str, Any]]]:
        return _get_global_filter()

    @staticmethod
    def set_global_filter(node_filters: List[Dict[str, Any]], edge_filters: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        return _set_global_filter(node_filters, edge_filters)

    @staticmethod
    def add_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        return _add_filter_option(option)

    @staticmethod
    def remove_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        return _remove_filter_option(option)

    @staticmethod
    def clear_global_filter() -> Dict[str, List[Dict[str, Any]]]:
        return _clear_global_filter()

    @staticmethod
    def search_nodes(session, keyword: str, limit: int = 50) -> dict:
        """功能 1：关键词模糊搜索及一跳关联"""
        query = """
        MATCH (n)
        WHERE toLower(coalesce(n.name, '')) CONTAINS toLower($keyword)
           OR toLower(coalesce(n.description, '')) CONTAINS toLower($keyword)
        OPTIONAL MATCH (n)-[r]-(m)
        RETURN n, r, m
        LIMIT $limit
        """
        result = session.run(query, keyword=keyword, limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def expand_node(session, node_id: str) -> dict:
        """功能 2：点击单个节点，向外扩展查找一跳邻居"""
        # 注意：因为我们的 ID 字段名有三种，这里用 OR 进行匹配
        query = """
        MATCH (n)
        WHERE n.skill_id = $node_id OR n.role_id = $node_id OR n.company_id = $node_id
        OPTIONAL MATCH (n)-[r]-(m)
        RETURN n, r, m
        """
        result = session.run(query, node_id=node_id)
        return format_neo4j_data(result)

    @staticmethod
    def get_nodes_by_category(session, label: str, limit: int = 50) -> dict:
        """功能 3：按类别(Skill/Role/Company)拉取节点（用于渲染三栏列表，特别是压缩后的部分显示）"""
        # Neo4j 的 Cypher 语法中，Label(如 :Skill) 不能直接用参数绑定
        # 所以我们采用 WHERE labels(n) 的方式进行安全过滤
        query = """
        MATCH (n)
        WHERE $label IN labels(n)
        RETURN n
        LIMIT $limit
        """
        result = session.run(query, label=label, limit=limit)
        # 因为只查节点，没有查连线，清洗格式会稍微简单点
        return format_neo4j_data(result)

    @staticmethod
    def get_all_nodes(session, label: Optional[str] = None, limit: int = 200) -> dict:
        """
        功能 4：查询全节点
        - 传 label 时：仅返回该 label 的节点
        - 不传 label 时：默认返回 Skill / Role / Company 三类节点
        """
        labels = [label] if label else GraphService.DEFAULT_LABELS

        query = """
        MATCH (n)
        WHERE any(l IN labels(n) WHERE l IN $labels)
        RETURN n
        LIMIT $limit
        """
        result = session.run(query, labels=labels, limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def get_all_edges(session, relation: Optional[str] = None, limit: int = 500) -> dict:
        """
        功能 5：查询全边
        - 传 relation 时：仅返回该关系类型
        - 不传 relation 时：默认按 EDGE_LABELS 查询
        """
        labels = [relation] if relation else GraphService.EDGE_LABELS
        query = """
        MATCH (a)-[r]-(b)
        WHERE type(r) IN $labels
        RETURN a, r, b
        LIMIT $limit
        """
        result = session.run(query, labels=labels, limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def expand_node_one_two_hops(session, node_id: str, limit: int = 500) -> dict:
        """
        功能 6：同时查询一跳和两跳邻居（包含指向外和指向内）
        """
        query = """
        MATCH (n)
        WHERE n.skill_id = $node_id OR n.role_id = $node_id OR n.company_id = $node_id
        OPTIONAL MATCH (n)-[r1]-(m1)
        OPTIONAL MATCH (n)-[r2]-(mid)-[r3]-(m2)
        RETURN n, r1, m1, r2, mid, r3, m2
        LIMIT $limit
        """
        result = session.run(query, node_id=node_id, limit=limit)
        return format_neo4j_data(result)