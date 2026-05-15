# coding:utf-8
# backend/service/algo_service.py

# 从你刚刚创建的文件中导入核心算法逻辑类
from service.linkage_logic import CareerLinkageLogic


class RecommendService:
    """
    后端推荐服务接口类
    由夏林琦集成：确保接口名与后端原有规范一致，同时引入加权联动逻辑
    """

    @staticmethod
    def recommend_role_by_skills(session, skill_ids: list, limit: int = 5):
        """
        接口 1：由 [技能] 推荐 [岗位]
        应用场景：用户在左侧勾选技能，中间岗位栏即时联动。
        """
        # 调用逻辑 A：将公司列表传为空 []，实现从技能出发的单向或多向推荐
        return CareerLinkageLogic.recommend_roles_by_skills_and_companies(
            session,
            skill_ids=skill_ids,
            company_ids=[],
            limit=limit
        )

    @staticmethod
    def recommend_company_by_roles(session, role_ids: list, limit: int = 5):
        """
        接口 2：由 [岗位] 推荐 [公司]
        应用场景：用户在中间勾选岗位，右侧公司栏即时联动。
        """
        # 调用逻辑 B：将技能列表传为空 []，实现从岗位出发的推荐
        return CareerLinkageLogic.recommend_companies_by_skills_and_roles(
            session,
            skill_ids=[],
            role_ids=role_ids,
            limit=limit
        )

    @staticmethod
    def recommend_role_by_companies(session, company_ids: list, limit: int = 5):
        """
        接口 3：由 [公司] 推荐 [岗位/技能]
        应用场景：用户在右侧勾选公司，中间或左侧栏目联动。
        """
        # 调用逻辑 C：根据公司推导出相关的技能建议或岗位
        return CareerLinkageLogic.recommend_skills_by_roles_and_companies(
            session,
            role_ids=[],
            company_ids=company_ids,
            limit=limit
        )

    @staticmethod
    def recommend_2to1_linkage(session, skill_ids: list = None, role_ids: list = None, company_ids: list = None,
                               limit: int = 5):
        """
        接口 4：【全联动核心接口】
        应用场景：实现真正的“二推一”。无论用户选哪两栏，自动触发对应的算法。
        """
        skill_ids = skill_ids or []
        role_ids = role_ids or []
        company_ids = company_ids or []

        # 情况 A: [技能 + 公司] -> 推荐 [岗位]
        if skill_ids and company_ids and not role_ids:
            return CareerLinkageLogic.recommend_roles_by_skills_and_companies(session, skill_ids, company_ids, limit)

        # 情况 B: [技能 + 岗位] -> 推荐 [公司]
        if skill_ids and role_ids and not company_ids:
            return CareerLinkageLogic.recommend_companies_by_skills_and_roles(session, skill_ids, role_ids, limit)

        # 情况 C: [岗位 + 公司] -> 推荐 [技能]
        if role_ids and company_ids and not skill_ids:
            return CareerLinkageLogic.recommend_skills_by_roles_and_companies(session, role_ids, company_ids, limit)

        return {"nodes": [], "edges": []}
