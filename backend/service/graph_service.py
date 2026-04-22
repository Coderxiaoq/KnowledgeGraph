def format_neo4j_data(result) -> dict:
    """工具函数：统一将 Neo4j 返回的 Record 清洗为前端需要的 JSON 格式"""
    nodes_dict = {}
    edges_list = []

    for record in result:
        for node_alias in ["n", "m"]:
            if record.get(node_alias):
                node = record[node_alias]
                # 兼容处理我们 seed 数据中不同的 ID 字段名
                node_id = node.get("skill_id") or node.get("role_id") or node.get("company_id")
                if node_id and node_id not in nodes_dict:
                    nodes_dict[node_id] = {
                        "id": node_id,
                        "label": list(node.labels)[0] if node.labels else "Unknown",
                        "properties": dict(node)
                    }
        
        if record.get("r"):
            rel = record["r"]
            source_id = rel.nodes[0].get("skill_id") or rel.nodes[0].get("role_id") or rel.nodes[0].get("company_id")
            target_id = rel.nodes[1].get("skill_id") or rel.nodes[1].get("role_id") or rel.nodes[1].get("company_id")
            
            edges_list.append({
                "source": source_id,
                "target": target_id,
                "relation": rel.type,
                "properties": dict(rel)
            })

    return {"nodes": list(nodes_dict.values()), "edges": edges_list}


class GraphService:
    @staticmethod
    def search_nodes(session, keyword: str, limit: int = 50) -> dict:
        """功能 1：关键词模糊搜索及一跳关联"""
        query = """
        MATCH (n)
        WHERE n.name CONTAINS $keyword OR n.description CONTAINS $keyword
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
        """功能 3：按类别(Skill/Role/Company)拉取节点（用于初次渲染三栏列表）"""
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