# coding:utf-8
# backend/service/career_analyzer.py

from service.graph_service import format_neo4j_data


class CareerAnalyzer:
    """
    职业详情分析算法
    提供职业洞察功能：分析职业所需技能、招聘公司、薪资统计等
    """
    
    @staticmethod
    def analyze_role_detail(session, role_id: str) -> dict:
        """
        分析职业详情
        
        Args:
            session: Neo4j会话
            role_id: 职业ID
            
        Returns:
            {
                "role": {...},
                "required_skills": [
                    {"skill": {...}, "importance": 0.9, "is_core": true}
                ],
                "hiring_companies": [
                    {"company": {...}, "salary_range": "15-25K", "urgency": "高"}
                ],
                "statistics": {
                    "avg_salary": 20000,
                    "skill_count": 10,
                    "company_count": 5
                }
            }
        """
        query = """
        MATCH (r:Role {role_id: $role_id})
        
        OPTIONAL MATCH (r)-[req:REQUIRES]->(s:Skill)
        WITH r, 
             collect({
                 skill_id: s.skill_id,
                 name: s.name,
                 category: s.category,
                 importance: coalesce(req.weight, 1.0),
                 is_core: coalesce(req.is_core, false)
             }) as skills_raw
        
        OPTIONAL MATCH (c:Company)-[rec:RECRUITS]->(r)
        WITH r, skills_raw,
             collect({
                 company_id: c.company_id,
                 name: c.name,
                 industry: c.industry,
                 salary_range: c.salary_range,
                 urgency: coalesce(rec.urgency, '普通'),
                 location: c.location
             }) as companies_raw
        
        WITH r, skills_raw, companies_raw,
             [s IN skills_raw WHERE s.skill_id IS NOT NULL] as valid_skills,
             [c IN companies_raw WHERE c.company_id IS NOT NULL] as valid_companies
        
        RETURN 
            r.role_id as role_id,
            r.name as role_name,
            r.description as description,
            r.salary_range as salary_range,
            valid_skills as required_skills,
            valid_companies as hiring_companies,
            size(valid_skills) as skill_count,
            size(valid_companies) as company_count
        """
        
        result = session.run(query, role_id=role_id)
        record = result.single()
        
        if not record:
            return {
                "role": None,
                "required_skills": [],
                "hiring_companies": [],
                "statistics": {}
            }
        
        skills = record["required_skills"]
        companies = record["hiring_companies"]
        
        stats = CareerAnalyzer._calculate_statistics(skills, companies, record.get("salary_range"))
        
        return {
            "role": {
                "role_id": record["role_id"],
                "name": record["role_name"],
                "description": record.get("description", ""),
                "salary_range": record.get("salary_range", "")
            },
            "required_skills": sorted(skills, key=lambda x: x["importance"], reverse=True),
            "hiring_companies": sorted(companies, key=lambda x: CareerAnalyzer._urgency_score(x["urgency"]), reverse=True),
            "statistics": stats
        }
    
    @staticmethod
    def _urgency_score(urgency: str) -> int:
        urgency_map = {"极高": 3, "高": 2, "中": 1, "普通": 0}
        return urgency_map.get(urgency, 0)
    
    @staticmethod
    def _calculate_statistics(skills: list, companies: list, role_salary: str) -> dict:
        core_count = sum(1 for s in skills if s.get("is_core"))
        avg_importance = sum(s["importance"] for s in skills) / len(skills) if skills else 0
        
        return {
            "skill_count": len(skills),
            "core_skill_count": core_count,
            "avg_importance": round(avg_importance, 2),
            "company_count": len(companies),
            "high_urgency_count": sum(1 for c in companies if c["urgency"] in ["极高", "高"])
        }
    
    @staticmethod
    def get_role_skill_gap(session, role_id: str, user_skill_ids: list) -> dict:
        """
        分析用户技能与目标职业的差距
        
        Returns:
            {
                "matched_skills": [...],
                "missing_skills": [...],
                "match_rate": 0.75,
                "core_skill_coverage": 0.8
            }
        """
        query = """
        MATCH (r:Role {role_id: $role_id})-[req:REQUIRES]->(s:Skill)
        RETURN s.skill_id as skill_id,
               s.name as name,
               s.category as category,
               coalesce(req.weight, 1.0) as importance,
               coalesce(req.is_core, false) as is_core
        """
        
        result = session.run(query, role_id=role_id)
        all_skills = [dict(record) for record in result]
        
        matched = []
        missing = []
        core_matched = 0
        core_total = 0
        
        for skill in all_skills:
            if skill["skill_id"] in user_skill_ids:
                matched.append(skill)
                if skill["is_core"]:
                    core_matched += 1
            else:
                missing.append(skill)
            
            if skill["is_core"]:
                core_total += 1
        
        match_rate = len(matched) / len(all_skills) if all_skills else 0
        core_coverage = core_matched / core_total if core_total > 0 else 1.0
        
        return {
            "matched_skills": matched,
            "missing_skills": sorted(missing, key=lambda x: x["importance"], reverse=True),
            "match_rate": round(match_rate, 2),
            "core_skill_coverage": round(core_coverage, 2),
            "total_required": len(all_skills),
            "total_matched": len(matched)
        }
