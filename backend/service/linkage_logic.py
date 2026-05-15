# coding:utf-8
# backend/service/linkage_logic.py

class CareerLinkageLogic:
    """
    【夏林琦核心算法库 - 全能兼容版】
    实现：技能(Skill)、岗位(Role)、公司(Company) 之间的“二推一”及“一推一”联动。
    """

    @staticmethod
    def recommend_roles_by_skills_and_companies(session, skill_ids: list, company_ids: list, limit: int = 5):
        """ 路径 A：根据技能和公司推荐岗位 """
        if not skill_ids and not company_ids:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (c:Company)-[rel_recruit:RECRUITS]->(r:Role)-[rel_req:REQUIRES]->(s:Skill)

        // 兼容逻辑：如果某项没选（size=0），则跳过该项过滤，实现灵活联动
        WHERE (size($s_ids) = 0 OR s.skill_id IN $s_ids)
          AND (size($c_ids) = 0 OR c.company_id IN $c_ids)

        WITH r, s, c, rel_req,
             CASE 
                  WHEN rel_req.is_core = true THEN rel_req.weight * 2.0 
                  WHEN s.category = '软技能' THEN rel_req.weight * 0.2 
                  ELSE rel_req.weight * 1.0 
             END AS score
        RETURN r, collect(s) as matched_skills, collect(c) as hiring_companies, sum(score) as total_score
        ORDER BY total_score DESC LIMIT $limit
        """
        from service.graph_service import format_neo4j_data
        result = session.run(query, s_ids=skill_ids, c_ids=company_ids, limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def recommend_companies_by_skills_and_roles(session, skill_ids: list, role_ids: list, limit: int = 5):
        """ 路径 B：根据技能和岗位推荐公司 """
        if not skill_ids and not role_ids:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (c:Company)-[rel_recruit:RECRUITS]->(r:Role)-[rel_req:REQUIRES]->(s:Skill)
        WHERE (size($r_ids) = 0 OR r.role_id IN $r_ids)
          AND (size($s_ids) = 0 OR s.skill_id IN $s_ids)
        WITH c, r, s, rel_recruit,
             CASE rel_recruit.urgency WHEN '极高' THEN 100 WHEN '高' THEN 50 ELSE 10 END AS priority
        RETURN c, collect(r) as roles, collect(s) as skills, sum(priority) as final_priority
        ORDER BY final_priority DESC LIMIT $limit
        """
        from service.graph_service import format_neo4j_data
        result = session.run(query, s_ids=skill_ids, r_ids=role_ids, limit=limit)
        return format_neo4j_data(result)

    @staticmethod
    def recommend_skills_by_roles_and_companies(session, role_ids: list, company_ids: list, limit: int = 5):
        """ 路径 C：根据岗位和公司推荐技能（补差建议） """
        if not role_ids and not company_ids:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (c:Company)-[:RECRUITS]->(r:Role)-[rel_req:REQUIRES]->(s:Skill)
        WHERE (size($r_ids) = 0 OR r.role_id IN $r_ids)
          AND (size($c_ids) = 0 OR c.company_id IN $c_ids)
        WITH s, r, c, rel_req,
             CASE 
                  WHEN rel_req.is_core = true THEN rel_req.weight * 2.0 
                  WHEN s.category = '软技能' THEN rel_req.weight * 0.2 
                  ELSE rel_req.weight * 1.0 
             END AS importance
        RETURN s, collect(r) as roles, collect(c) as companies, sum(importance) as total_weight
        ORDER BY total_weight DESC LIMIT $limit
        """
        from service.graph_service import format_neo4j_data
        result = session.run(query, r_ids=role_ids, c_ids=company_ids, limit=limit)
        return format_neo4j_data(result)

    """
    如果你点了一个，我按一个推；你点了两个，我按两个精准推。
    优势：它能完美实现你图片里的**“即时反馈”**。点一下动一下，点两下动得更准
    在Application分支集成全兼容、带权重计算的三栏联动算法
    """
