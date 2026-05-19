# coding:utf-8
# backend/service/probability_calculator.py


class ProbabilityCalculator:
    """
    应聘概率计算算法
    综合多维度评估应聘成功概率
    """
    
    @staticmethod
    def calculate_apply_probability(
        session,
        user_skill_ids: list,
        role_id: str,
        company_id: str = None
    ) -> dict:
        """
        计算应聘成功概率
        
        评分维度：
        1. 技能匹配度 (40%)
        2. 核心技能覆盖 (30%)
        3. 公司紧急度 (20%)
        4. 市场竞争度 (10%)
        
        Args:
            session: Neo4j会话
            user_skill_ids: 用户掌握的技能ID列表
            role_id: 目标职业ID
            company_id: 目标公司ID（可选）
            
        Returns:
            {
                "probability": 0.75,
                "breakdown": {
                    "skill_match": 0.85,
                    "core_skill_cover": 0.70,
                    "company_urgency": 0.60,
                    "market_competition": 0.80
                },
                "suggestions": [...],
                "skill_analysis": {...}
            }
        """
        skill_analysis = ProbabilityCalculator._analyze_skills(
            session, user_skill_ids, role_id
        )
        
        company_urgency = 0.5
        if company_id:
            company_urgency = ProbabilityCalculator._get_company_urgency(
                session, company_id, role_id
            )
        
        market_factor = ProbabilityCalculator._calculate_market_factor(
            session, role_id
        )
        
        skill_match = skill_analysis["match_rate"]
        core_coverage = skill_analysis["core_skill_coverage"]
        
        breakdown = {
            "skill_match": round(skill_match, 2),
            "core_skill_cover": round(core_coverage, 2),
            "company_urgency": round(company_urgency, 2),
            "market_competition": round(market_factor, 2)
        }
        
        probability = (
            skill_match * 0.4 +
            core_coverage * 0.3 +
            company_urgency * 0.2 +
            market_factor * 0.1
        )
        
        suggestions = ProbabilityCalculator._generate_suggestions(
            skill_analysis,
            company_urgency,
            probability
        )
        
        return {
            "probability": round(probability, 2),
            "breakdown": breakdown,
            "suggestions": suggestions,
            "skill_analysis": {
                "matched_skills": skill_analysis["matched_skills"],
                "missing_skills": skill_analysis["missing_skills"],
                "match_rate": skill_analysis["match_rate"],
                "core_skill_coverage": skill_analysis["core_skill_coverage"]
            }
        }
    
    @staticmethod
    def _analyze_skills(session, user_skill_ids: list, role_id: str) -> dict:
        query = """
        MATCH (r:Role {role_id: $role_id})-[req:REQUIRES]->(s:Skill)
        RETURN 
            s.skill_id as skill_id,
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
            "missing_skills": missing,
            "match_rate": match_rate,
            "core_skill_coverage": core_coverage,
            "total_required": len(all_skills),
            "total_matched": len(matched)
        }
    
    @staticmethod
    def _get_company_urgency(session, company_id: str, role_id: str) -> float:
        query = """
        MATCH (c:Company {company_id: $company_id})-[rec:RECRUITS]->(r:Role {role_id: $role_id})
        RETURN coalesce(rec.urgency, '普通') as urgency
        """
        
        result = session.run(query, company_id=company_id, role_id=role_id)
        record = result.single()
        
        if not record:
            return 0.5
        
        urgency = record["urgency"]
        urgency_map = {"极高": 1.0, "高": 0.8, "中": 0.6, "普通": 0.4}
        return urgency_map.get(urgency, 0.5)
    
    @staticmethod
    def _calculate_market_factor(session, role_id: str) -> float:
        query = """
        MATCH (c:Company)-[:RECRUITS]->(r:Role {role_id: $role_id})
        RETURN count(DISTINCT c) as company_count
        """
        
        result = session.run(query, role_id=role_id)
        record = result.single()
        
        if not record:
            return 0.5
        
        company_count = record["company_count"]
        
        if company_count >= 10:
            return 0.9
        elif company_count >= 5:
            return 0.7
        elif company_count >= 2:
            return 0.5
        else:
            return 0.3
    
    @staticmethod
    def _generate_suggestions(
        skill_analysis: dict,
        company_urgency: float,
        probability: float
    ) -> list:
        suggestions = []
        
        missing_core = [
            s["name"] for s in skill_analysis["missing_skills"]
            if s.get("is_core")
        ]
        
        if missing_core:
            suggestions.append(f"补充核心技能: {', '.join(missing_core[:3])}")
        
        missing_regular = [
            s["name"] for s in skill_analysis["missing_skills"]
            if not s.get("is_core")
        ]
        
        if missing_regular:
            suggestions.append(f"建议学习: {', '.join(missing_regular[:2])}")
        
        if skill_analysis["match_rate"] >= 0.8:
            suggestions.append("技能匹配度高，竞争力强")
        elif skill_analysis["match_rate"] >= 0.5:
            suggestions.append("技能基本符合，有较大机会")
        else:
            suggestions.append("技能缺口较大，建议优先补强")
        
        if company_urgency >= 0.8:
            suggestions.append("公司急需人才，机会很大")
        elif company_urgency >= 0.6:
            suggestions.append("公司招聘意愿较强")
        
        if probability >= 0.7:
            suggestions.append("综合评估：建议投递简历")
        elif probability >= 0.4:
            suggestions.append("综合评估：有一定机会，可尝试投递")
        else:
            suggestions.append("综合评估：建议先提升技能再投递")
        
        return suggestions
    
    @staticmethod
    def batch_calculate_probability(
        session,
        user_skill_ids: list,
        role_company_pairs: list
    ) -> dict:
        """
        批量计算多个职业-公司组合的应聘概率
        
        Args:
            role_company_pairs: [{"role_id": "r1", "company_id": "c1"}, ...]
        """
        results = []
        
        for pair in role_company_pairs:
            role_id = pair.get("role_id")
            company_id = pair.get("company_id")
            
            prob_result = ProbabilityCalculator.calculate_apply_probability(
                session, user_skill_ids, role_id, company_id
            )
            
            results.append({
                "role_id": role_id,
                "company_id": company_id,
                **prob_result
            })
        
        return {"results": sorted(results, key=lambda x: x["probability"], reverse=True)}
