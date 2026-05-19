from threading import RLock
from typing import Any, Dict, List
from datetime import date, datetime, time


_FILTER_LOCK = RLock()
# 进程内全局过滤状态：所有查询接口都会共享该配置。
_GLOBAL_GRAPH_FILTER: Dict[str, List[Dict[str, Any]]] = {
    "node_filters": [],
    "edge_filters": [],
}


def _to_jsonable(value: Any) -> Any:
    """递归转换属性值，确保可被 FastAPI/Pydantic 序列化。"""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(item) for item in value]

    # 兼容 Neo4j temporal/spatial 等对象（常见有 iso_format 方法）。
    iso_format = getattr(value, "iso_format", None)
    if callable(iso_format):
        try:
            return iso_format()
        except Exception:
            pass

    return str(value)


def _normalize_filter_option(option: Dict[str, Any]) -> Dict[str, Any]:
    """将过滤项补齐默认字段，统一成内部结构。"""
    return {
        "target": option.get("target", "node"),
        "field": option.get("field"),
        "value": option.get("value"),
        "op": option.get("op", "eq"),
        "mode": option.get("mode", "negative")
    }


def _safe_float(value: Any) -> float:
    """数值比较前的安全转换，避免 bool 被当作 0/1。"""
    if isinstance(value, bool):
        raise ValueError("bool is not numeric")
    return float(value)


def _parse_salary_token(token: Any) -> float:
    """解析单个薪资片段，兼容 40000、40k、40K 等格式。"""
    if isinstance(token, bool):
        raise ValueError("bool is not numeric")
    if isinstance(token, (int, float)):
        return float(token)

    text = str(token).strip().lower()
    if not text:
        raise ValueError("empty salary token")

    multiplier = 1.0
    if text.endswith("k"):
        multiplier = 1000.0
        text = text[:-1].strip()

    return float(text) * multiplier


def _parse_salary_range(value: Any) -> tuple[float, float]:
    """解析薪资区间，支持 '40000-80000'、'12k-25k'，也支持单值。"""
    if isinstance(value, (list, tuple)) and len(value) == 2:
        start = _parse_salary_token(value[0])
        end = _parse_salary_token(value[1])
        return (min(start, end), max(start, end))

    text = str(value).strip().lower()
    if not text:
        raise ValueError("empty salary range")

    parts = [part.strip() for part in text.split("-") if part.strip()]
    if len(parts) == 1:
        amount = _parse_salary_token(parts[0])
        return (amount, amount)

    if len(parts) >= 2:
        start = _parse_salary_token(parts[0])
        end = _parse_salary_token(parts[1])
        return (min(start, end), max(start, end))

    raise ValueError(f"invalid salary range: {value}")


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
    if op == "salary_in":
        try:
            salary_min, salary_max = _parse_salary_range(actual)
            salary_value = _parse_salary_token(expected)
            return salary_min <= salary_value <= salary_max
        except (TypeError, ValueError):
            return False

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


def _filter_items_with_mode(items: List[Dict[str, Any]], rules: List[Dict[str, Any]], mode: str) -> List[Dict[str, Any]]:
    """按过滤模式处理元素：缺少 rule.field 时直接跳过该规则并保留元素。"""
    if not rules:
        return items

    filtered = []
    for item in items:
        properties = item.get("properties", {})
        applicable_rules = [rule for rule in rules if isinstance(rule.get("field"), str) and rule.get("field") in properties]

        if not applicable_rules:
            filtered.append(item)
            continue

        if mode == "positive":
            if all(_matches_filter(properties, rule) for rule in applicable_rules):
                filtered.append(item)
            continue

        if not any(_matches_filter(properties, rule) for rule in applicable_rules):
            filtered.append(item)

    return filtered


def _prune_edges_by_nodes(edges: List[Dict[str, Any]], visible_node_ids: set[str]) -> List[Dict[str, Any]]:
    """只保留两端都仍然可见的边。"""
    return [
        edge
        for edge in edges
        if edge.get("source") in visible_node_ids and edge.get("target") in visible_node_ids
    ]


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

    original_nodes = list(graph_data.get("nodes", []))
    original_edges = list(graph_data.get("edges", []))

    # 将规则按 mode 分成正/负两类
    node_pos = [r for r in node_rules if r.get("mode") == "positive"]
    node_neg = [r for r in node_rules if r.get("mode") != "positive"]

    edge_pos = [r for r in edge_rules if r.get("mode") == "positive"]
    edge_neg = [r for r in edge_rules if r.get("mode") != "positive"]

    # 正过滤：只有满足所有正向规则的元素被保留；缺字段的规则直接跳过。
    nodes = _filter_items_with_mode(original_nodes, node_pos, "positive")

    # 负过滤：任何一条负向规则命中即剔除元素；缺字段的规则直接跳过。
    nodes = _filter_items_with_mode(nodes, node_neg, "negative")

    node_ids = {node["id"] for node in nodes}

    # 边的正/负过滤：先按属性筛边，再按可见节点集合裁剪掉失联边。
    edges = _filter_items_with_mode(original_edges, edge_pos, "positive")
    edges = _filter_items_with_mode(edges, edge_neg, "negative")

    # 只要节点过滤参与过计算，就必须保证边仍然连接到可见节点。
    if node_pos or node_neg:
        edges = _prune_edges_by_nodes(edges, node_ids)

    return {"nodes": nodes, "edges": edges}


def get_global_filter() -> Dict[str, List[Dict[str, Any]]]:
    """读取当前全局过滤器（用于前端回显当前过滤状态）。"""
    with _FILTER_LOCK:
        return {
            "node_filters": list(_GLOBAL_GRAPH_FILTER["node_filters"]),
            "edge_filters": list(_GLOBAL_GRAPH_FILTER["edge_filters"]),
        }


def set_global_filter(node_filters: List[Dict[str, Any]], edge_filters: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """覆盖设置全局过滤器（整包替换）。"""
    normalized_nodes = [_normalize_filter_option(item) for item in node_filters]
    normalized_edges = [_normalize_filter_option(item) for item in edge_filters]
    with _FILTER_LOCK:
        _GLOBAL_GRAPH_FILTER["node_filters"] = normalized_nodes
        _GLOBAL_GRAPH_FILTER["edge_filters"] = normalized_edges
    return get_global_filter()


def add_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """新增一条过滤项，按 target 追加到 node_filters 或 edge_filters。"""
    normalized = _normalize_filter_option(option)
    target = normalized.get("target", "node")
    key = "edge_filters" if target == "edge" else "node_filters"
    with _FILTER_LOCK:
        _GLOBAL_GRAPH_FILTER[key].append(normalized)
    return get_global_filter()


def remove_filter_option(option: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """删除与传入完全相同的一条过滤项。"""
    normalized = _normalize_filter_option(option)
    target = normalized.get("target", "node")
    key = "edge_filters" if target == "edge" else "node_filters"
    with _FILTER_LOCK:
        _GLOBAL_GRAPH_FILTER[key] = [item for item in _GLOBAL_GRAPH_FILTER[key] if item != normalized]
    return get_global_filter()


def clear_global_filter() -> Dict[str, List[Dict[str, Any]]]:
    """清空全局过滤器。"""
    with _FILTER_LOCK:
        _GLOBAL_GRAPH_FILTER["node_filters"] = []
        _GLOBAL_GRAPH_FILTER["edge_filters"] = []
    return get_global_filter()
