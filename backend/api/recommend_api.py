# coding:utf-8
# backend/api/recommend_api.py

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from core.connect import get_db_session
from service.career_analyzer import CareerAnalyzer
from service.skill_matcher import SkillMatcher
from service.probability_calculator import ProbabilityCalculator

router = APIRouter()


class RoleDetailResponse(BaseModel):
    code: int = 200
    msg: str = "success"
    data: dict


class CareerRecommendRequest(BaseModel):
    skill_ids: List[str] = Field(..., description="用户掌握的技能ID列表")
    salary_min: Optional[int] = Field(None, description="最低薪资期望")
    salary_max: Optional[int] = Field(None, description="最高薪资期望")
    limit: int = Field(10, ge=1, le=50, description="返回数量限制")


class ApplyProbabilityRequest(BaseModel):
    user_skill_ids: List[str] = Field(..., description="用户掌握的技能ID列表")
    role_id: str = Field(..., description="目标职业ID")
    company_id: Optional[str] = Field(None, description="目标公司ID")


class SkillGapRequest(BaseModel):
    role_id: str = Field(..., description="目标职业ID")
    user_skill_ids: List[str] = Field(..., description="用户掌握的技能ID列表")


@router.get("/role/{role_id}/detail", summary="获取职业详情")
async def get_role_detail(
    role_id: str,
    session=Depends(get_db_session)
):
    """
    职业详情洞察接口
    
    返回：
    - 职业基本信息
    - 所需技能列表（按重要性排序）
    - 招聘公司列表（按紧急度排序）
    - 统计信息
    """
    result = CareerAnalyzer.analyze_role_detail(session, role_id)
    return {"code": 200, "msg": "success", "data": result}


@router.post("/role/skill-gap", summary="分析技能差距")
async def analyze_skill_gap(
    request: SkillGapRequest,
    session=Depends(get_db_session)
):
    """
    分析用户技能与目标职业的差距
    
    返回：
    - 已匹配技能
    - 缺失技能
    - 匹配率
    - 核心技能覆盖率
    """
    result = CareerAnalyzer.get_role_skill_gap(
        session, request.role_id, request.user_skill_ids
    )
    return {"code": 200, "msg": "success", "data": result}


@router.post("/career", summary="智能职业推荐")
async def recommend_career(
    request: CareerRecommendRequest,
    session=Depends(get_db_session)
):
    """
    基于技能和薪资的智能职业推荐
    
    返回：
    - 推荐职业列表（按匹配度排序）
    - 每个职业包含：
      - 匹配评分
      - 已匹配/缺失技能
      - 推荐公司列表
      - 应聘概率
      - 薪资符合度
    """
    result = SkillMatcher.recommend_by_skills_and_salary(
        session,
        request.skill_ids,
        request.salary_min,
        request.salary_max,
        request.limit
    )
    return {"code": 200, "msg": "success", "data": result}


@router.get("/quick", summary="快速技能推荐")
async def quick_recommend_by_skills(
    skill_ids: str = Query(..., description="技能ID列表，逗号分隔"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    session=Depends(get_db_session)
):
    """
    快速推荐：仅根据技能获取相关职业
    
    适用场景：技能多选时实时展示相关职业
    """
    skill_id_list = [s.strip() for s in skill_ids.split(",") if s.strip()]
    
    result = SkillMatcher.get_skill_based_roles(session, skill_id_list, limit)
    return {"code": 200, "msg": "success", "data": result}


@router.post("/probability/apply", summary="计算应聘概率")
async def calculate_apply_probability(
    request: ApplyProbabilityRequest,
    session=Depends(get_db_session)
):
    """
    计算应聘成功概率
    
    多维度评估：
    - 技能匹配度
    - 核心技能覆盖
    - 公司紧急度
    - 市场竞争度
    
    返回：
    - 综合概率
    - 各维度得分
    - 改进建议
    """
    result = ProbabilityCalculator.calculate_apply_probability(
        session,
        request.user_skill_ids,
        request.role_id,
        request.company_id
    )
    return {"code": 200, "msg": "success", "data": result}


@router.post("/probability/batch", summary="批量计算应聘概率")
async def batch_calculate_probability(
    user_skill_ids: List[str],
    role_company_pairs: List[dict],
    session=Depends(get_db_session)
):
    """
    批量计算多个职业-公司组合的应聘概率
    
    输入：
    - user_skill_ids: 用户技能列表
    - role_company_pairs: [{"role_id": "r1", "company_id": "c1"}, ...]
    
    返回按概率排序的结果列表
    """
    result = ProbabilityCalculator.batch_calculate_probability(
        session, user_skill_ids, role_company_pairs
    )
    return {"code": 200, "msg": "success", "data": result}
