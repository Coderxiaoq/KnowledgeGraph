from service.graph_service import format_neo4j_data
#暂时先这样写，后续会有启发性搜索
class RecommendService:
    
    @staticmethod
    def recommend_role_by_skills(session, skill_ids: list, limit: int = 3):
        """
        逻辑：2个技能推1个岗位 (技能 -> 岗位)
        寻找同时要求这些技能的岗位，并按权重排序
        """
        if len(skill_ids) < 2:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (s1:Skill) WHERE s1.skill_id = $s1_id
        MATCH (s2:Skill) WHERE s2.skill_id = $s2_id
        MATCH (r:Role)-[:REQUIRES]->(s1)
        MATCH (r)-[:REQUIRES]->(s2)
        RETURN r, s1, s2
        LIMIT $limit
        """
        result = session.run(query, s1_id=skill_ids[0], s2_id=skill_ids[1], limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def recommend_company_by_roles(session, role_ids: list, limit: int = 3):
        """
        逻辑：2个岗位推1家公司 (岗位 -> 公司)
        寻找同时招聘这两个岗位的公司
        """
        if len(role_ids) < 2:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (r1:Role) WHERE r1.role_id = $r1_id
        MATCH (r2:Role) WHERE r2.role_id = $r2_id
        MATCH (c:Company)-[:RECRUITS]->(r1)
        MATCH (c)-[:RECRUITS]->(r2)
        RETURN c, r1, r2
        LIMIT $limit
        """
        result = session.run(query, r1_id=role_ids[0], r2_id=role_ids[1], limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def recommend_role_by_companies(session, company_ids: list, limit: int = 3):
        """
        逻辑：2个公司推1个岗位 (公司 -> 岗位)
        寻找这两家公司都在热招的共同岗位（行业趋势）
        """
        if len(company_ids) < 2:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (c1:Company) WHERE c1.company_id = $c1_id
        MATCH (c2:Company) WHERE c2.company_id = $c2_id
        MATCH (c1)-[:RECRUITS]->(r:Role)
        MATCH (c2)-[:RECRUITS]->(r)
        RETURN r, c1, c2
        LIMIT $limit
        """
        result = session.run(query, c1_id=company_ids[0], c2_id=company_ids[1], limit=limit)
        return format_neo4j_data(result)