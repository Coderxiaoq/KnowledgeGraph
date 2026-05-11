from threading import RLock
from typing import Any, Dict, List, Optional


_FILTER_LOCK = RLock()
# 进程内全局过滤状态：所有查询接口都会共享该配置。
_GLOBAL_GRAPH_FILTER: Dict[str, List[Dict[str, Any]]] = {
    "node_filters": [],
    "edge_filters": [],
}


def _extract_node_id(node):
    return node.get("skill_id") or node.get("role_id") or node.get("company_id")


def _normalize_filter_option(option: Dict[str, Any]) -> Dict[str, Any]:
    """将过滤项补齐默认字段，统一成内部结构。"""
    return {
        "target": option.get("target", "node"),
        "field": option.get("field"),
        "value": option.get("value"),
        "op": option.get("op", "eq")
    }


def _safe_float(value: Any) -> float:
    """数值比较前的安全转换，避免 bool 被当作 0/1。"""
    if isinstance(value, bool):
        raise ValueError("bool is not numeric")
    return float(value)


def _matches_filter(item_properties: Dict[str, Any], rule: Dict[str, Any]) -> bool:
    """判断单条节点/边属性是否满足一条过滤规则。"""
    field = rule.get("field")
    op = rule.get("op", "eq")
    expected = rule.get("value")
    if not isinstance(field, str):
        return False
    actual = item_properties.get(field)

    if op == "eq":
        return actual == expected
    if op == "contains":
        if actual is None:
            return False
        return str(expected).lower() in str(actual).lower()
    if op == "gt":
        try:
            return _safe_float(actual) > _safe_float(expected)
        except (TypeError, ValueError):
            return False
    if op == "gte":
        try:
            return _safe_float(actual) >= _safe_float(expected)
        except (TypeError, ValueError):
            return False
    if op == "lt":
        try:
            return _safe_float(actual) < _safe_float(expected)
        except (TypeError, ValueError):
            return False
    if op == "lte":
        try:
            return _safe_float(actual) <= _safe_float(expected)
        except (TypeError, ValueError):
            return False
    if op == "in":
        if isinstance(expected, list):
            return actual in expected
        return actual == expected

    return True


def _apply_rule_list(items: List[Dict[str, Any]], rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """对同类元素应用规则列表：命中规则(AND)的元素会被剔除。"""
    if not rules:
        return items

    filtered = []
    for item in items:
        properties = item.get("properties", {})
        # 满足全部规则 -> 视为命中黑名单，直接剔除。
        if not all(_matches_filter(properties, rule) for rule in rules):
            filtered.append(item)
    return filtered


def apply_graph_json_filter(graph_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    对 format_neo4j_data 的输出做统一后置过滤。
    - 节点命中过滤规则后剔除
    - 边命中过滤规则后剔除
    - 若存在节点过滤，则额外裁剪掉两端不在节点结果中的边
    """
    with _FILTER_LOCK:
        # 复制一份快照，避免过滤过程中被并发修改。
        node_rules = list(_GLOBAL_GRAPH_FILTER["node_filters"])
        edge_rules = list(_GLOBAL_GRAPH_FILTER["edge_filters"])

    nodes = _apply_rule_list(graph_data.get("nodes", []), node_rules)
    node_ids = {node["id"] for node in nodes}

    edges = graph_data.get("edges", [])
    if edge_rules:
        edges = _apply_rule_list(edges, edge_rules)
    if node_rules:
        edges = [edge for edge in edges if edge.get("source") in node_ids and edge.get("target") in node_ids]

    return {"nodes": nodes, "edges": edges}


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
                        "properties": dict(value)
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
                        "properties": dict(value)
                    })

    graph_data = {"nodes": list(nodes_dict.values()), "edges": edges_list}
    return apply_graph_json_filter(graph_data)


class GraphService:
    DEFAULT_LABELS = ["Skill", "Role", "Company"]
    EDGE_LABELS = ["REQUIRES", "RECRUITS"]  # 根据你的数据模型调整

    @staticmethod
    def get_global_filter() -> Dict[str, List[Dict[str, Any]]]:
        """读取当前全局过滤器（用于前端回显当前过滤状态）。"""
        with _FILTER_LOCK:
            return {
                "node_filters": list(_GLOBAL_GRAPH_FILTER["node_filters"]),
                "edge_filters": list(_GLOBAL_GRAPH_FILTER["edge_filters"]),
            }

    @staticmethod
    def set_global_filter(node_filters: List[Dict[str, Any]], edge_filters: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """覆盖设置全局过滤器（整包替换）。"""
        normalized_nodes = [_normalize_filter_option(item) for item in node_filters]
        normalized_edges = [_normalize_filter_option(item) for item in edge_filters]
        with _FILTER_LOCK:
            _GLOBAL_GRAPH_FILTER["node_filters"] = normalized_nodes
            _GLOBAL_GRAPH_FILTER["edge_filters"] = normalized_edges
        return GraphService.get_global_filter()

    @staticmethod
    def add_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """新增一条过滤项，按 target 追加到 node_filters 或 edge_filters。"""
        normalized = _normalize_filter_option(option)
        target = normalized.get("target", "node")
        key = "edge_filters" if target == "edge" else "node_filters"
        with _FILTER_LOCK:
            _GLOBAL_GRAPH_FILTER[key].append(normalized)
        return GraphService.get_global_filter()

    @staticmethod
    def remove_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """删除与传入完全相同的一条过滤项。"""
        normalized = _normalize_filter_option(option)
        target = normalized.get("target", "node")
        key = "edge_filters" if target == "edge" else "node_filters"
        with _FILTER_LOCK:
            _GLOBAL_GRAPH_FILTER[key] = [item for item in _GLOBAL_GRAPH_FILTER[key] if item != normalized]
        return GraphService.get_global_filter()

    @staticmethod
    def clear_global_filter() -> Dict[str, List[Dict[str, Any]]]:
        """清空全局过滤器。"""
        with _FILTER_LOCK:
            _GLOBAL_GRAPH_FILTER["node_filters"] = []
            _GLOBAL_GRAPH_FILTER["edge_filters"] = []
        return GraphService.get_global_filter()

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