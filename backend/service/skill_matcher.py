# coding:utf-8
# backend/service/skill_matcher.py

from service.graph_service import format_neo4j_data


def _clean_dict(obj):
    """清理字典中的DateTime等不可序列化对象"""
    if isinstance(obj, dict):
        return {k: _clean_dict(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_dict(item) for item in obj]
    elif hasattr(obj, 'iso_format'):
        return obj.iso_format()
    elif hasattr(obj, '__str__'):
        return str(obj)
    else:
        return obj


class SkillMatcher:
    """
    智能职业推荐算法
    基于用户技能和期望薪资推荐最匹配的职业
    """
    
    @staticmethod
    def recommend_by_skills_and_salary(
        session,
        skill_ids: list,
        salary_min: int = None,
        salary_max: int = None,
        limit: int = 10
    ) -> dict:
        """
        基于技能和薪资推荐职业
        
        Args:
            session: Neo4j会话
            skill_ids: 用户掌握的技能ID列表
            salary_min: 最低薪资期望（可选）
            salary_max: 最高薪资期望（可选）
            limit: 返回数量限制
            
        Returns:
            {
                "recommendations": [
                    {
                        "role": {...},
                        "match_score": 0.85,
                        "matched_skills": [...],
                        "missing_skills": [...],
                        "skill_match_rate": 0.75,
                        "companies": [...],
                        "salary_fit": true,
                        "apply_probability": 0.72
                    }
                ]
            }
        """
        if not skill_ids:
            return {"recommendations": []}
        
        query = """
        MATCH (r:Role)
        
        OPTIONAL MATCH (r)-[req:REQUIRES]->(s:Skill)
        WHERE s.skill_id IN $skill_ids
        WITH r, collect(DISTINCT s) as matched_skills
        
        OPTIONAL MATCH (r)-[req_all:REQUIRES]->(all_s:Skill)
        WITH r, matched_skills, collect(DISTINCT all_s) as all_skills
        
        WITH r, matched_skills, all_skills,
             size(matched_skills) as matched_count,
             size(all_skills) as total_count
        
        OPTIONAL MATCH (c:Company)-[rec:RECRUITS]->(r)
        WITH r, matched_skills, all_skills, matched_count, total_count,
             collect(DISTINCT {
                 company_id: c.company_id,
                 name: c.name,
                 salary_range: rec.salary,
                 urgency: coalesce(rec.urgency, '普通'),
                 location: c.location,
                 scale: c.scale
             }) as companies
        
        OPTIONAL MATCH (r)-[core_req:REQUIRES]->(core_s:Skill)
        WHERE core_req.is_core = true
        WITH r, matched_skills, all_skills, matched_count, total_count, companies,
             collect(DISTINCT core_s.skill_id) as core_skill_ids
        
        OPTIONAL MATCH (r)-[user_core_req:REQUIRES]->(user_core_s:Skill)
        WHERE user_core_req.is_core = true AND user_core_s.skill_id IN $skill_ids
        WITH r, matched_skills, all_skills, matched_count, total_count, companies,
             core_skill_ids, collect(DISTINCT user_core_s.skill_id) as matched_core_ids
        
        WITH r, matched_skills, all_skills, matched_count, total_count, companies,
             core_skill_ids, matched_core_ids,
             CASE WHEN total_count > 0 THEN toFloat(matched_count) / total_count ELSE 0 END as skill_match_rate,
             CASE WHEN size(core_skill_ids) > 0 THEN toFloat(size(matched_core_ids)) / size(core_skill_ids) ELSE 1.0 END as core_coverage
        
        RETURN 
            r.role_id as role_id,
            r.name as role_name,
            r.description as description,
            r.avg_salary as salary_range,
            matched_skills,
            [s IN all_skills WHERE NOT s.skill_id IN $skill_ids] as missing_skills,
            matched_count,
            total_count,
            skill_match_rate,
            core_coverage,
            companies,
            core_skill_ids,
            matched_core_ids
        ORDER BY (skill_match_rate * 0.6 + core_coverage * 0.4) DESC
        LIMIT $limit
        """
        
        result = session.run(query, skill_ids=skill_ids, limit=limit)
        
        recommendations = []
        for record in result:
            matched_skills = [_clean_dict(dict(s)) for s in record["matched_skills"]] if record["matched_skills"] else []
            missing_skills = [_clean_dict(dict(s)) for s in record["missing_skills"]] if record["missing_skills"] else []
            companies = _clean_dict(record["companies"]) if record["companies"] else []
            
            skill_match_rate = record["skill_match_rate"]
            core_coverage = record["core_coverage"]
            
            match_score = skill_match_rate * 0.6 + core_coverage * 0.4
            
            salary_fit = True
            if salary_min or salary_max:
                salary_fit = SkillMatcher._check_salary_fit(
                    record.get("salary_range", ""),
                    salary_min,
                    salary_max
                )
            
            apply_probability = SkillMatcher._calculate_apply_probability(
                skill_match_rate,
                core_coverage,
                companies
            )
            
            recommendations.append({
                "role": {
                    "role_id": record["role_id"],
                    "name": record["role_name"],
                    "description": record.get("description", ""),
                    "salary_range": record.get("salary_range", "")
                },
                "match_score": round(match_score, 2),
                "matched_skills": matched_skills,
                "missing_skills": sorted(missing_skills, key=lambda x: x.get("name", "")),
                "skill_match_rate": round(skill_match_rate, 2),
                "core_skill_coverage": round(core_coverage, 2),
                "companies": companies,
                "salary_fit": salary_fit,
                "apply_probability": round(apply_probability, 2),
                "total_required": record["total_count"],
                "total_matched": record["matched_count"]
            })
        
        return {"recommendations": recommendations}
    
    @staticmethod
    def _check_salary_fit(role_salary: str, salary_min: int, salary_max: int) -> bool:
        if not role_salary:
            return True
        
        import re
        numbers = re.findall(r'\d+', role_salary)
        if not numbers:
            return True
        
        salaries = [int(n) for n in numbers]
        role_min = min(salaries)
        role_max = max(salaries)
        
        if salary_min and role_max < salary_min:
            return False
        if salary_max and role_min > salary_max:
            return False
            
        return True
    
    @staticmethod
    def _calculate_apply_probability(
        skill_match_rate: float,
        core_coverage: float,
        companies: list
    ) -> float:
        skill_score = skill_match_rate * 0.5
        core_score = core_coverage * 0.3
        
        company_score = 0.0
        if companies:
            high_urgency = sum(1 for c in companies if c.get("urgency") in ["极高", "高"])
            company_score = min(high_urgency / len(companies), 1.0) * 0.2
        
        probability = skill_score + core_score + company_score
        
        return min(max(probability, 0.0), 1.0)
    
    @staticmethod
    def get_skill_based_roles(session, skill_ids: list, limit: int = 20) -> dict:
        """
        仅根据技能获取相关职业（用于快速推荐）
        """
        if not skill_ids:
            return {"roles": []}
        
        query = """
        MATCH (r:Role)-[req:REQUIRES]->(s:Skill)
        WHERE s.skill_id IN $skill_ids
        WITH r, count(DISTINCT s) as matched_count
        
        OPTIONAL MATCH (r)-[:REQUIRES]->(all_s:Skill)
        WITH r, matched_count, count(DISTINCT all_s) as total_count
        
        OPTIONAL MATCH (c:Company)-[:RECRUITS]->(r)
        WITH r, matched_count, total_count, count(DISTINCT c) as company_count
        
        RETURN 
            r.role_id as role_id,
            r.name as name,
            r.salary_range as salary_range,
            matched_count,
            total_count,
            toFloat(matched_count) / total_count as match_rate,
            company_count
        ORDER BY match_rate DESC, company_count DESC
        LIMIT $limit
        """
        
        result = session.run(query, skill_ids=skill_ids, limit=limit)
        roles = [dict(record) for record in result]
        
        return {"roles": roles}
