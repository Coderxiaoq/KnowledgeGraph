# coding:utf-8
# backend/service/algo_service.py

from __future__ import annotations

import math
import re
from typing import Any, Dict, Iterable, Literal

from service.fliter_service import _to_jsonable


class CareerLinkageLogic:
    """
    三种二推一推荐的核心实现。

    每种算法都接收两种节点的正向/负向偏好列表：
    - skill_to_role: skill + company -> role
    - role_to_company: skill + role -> company
    - company_to_role: role + company -> skill

    统一的执行方式是：
    1. 先查出所有相关的 company-role-skill 单链条；
    2. 对每条单链条计算边分与节点偏好系数；
    3. 按推荐锚点做组内展开；
    4. 对组合链条做平均分排序并返回。
    """

    TYPE_CONFIG: Dict[str, Dict[str, Any]] = {
        "skill_to_role": {
            "query": """
                MATCH (company:Company)-[recruit:RECRUITS]->(role:Role)-[requirement:REQUIRES]->(skill:Skill)
                WHERE skill.skill_id IN $primary_ids OR company.company_id IN $secondary_ids
                RETURN DISTINCT company, recruit, role, requirement, skill
            """,
            "primary_type": "skill",
            "secondary_type": "company",
        },
        "role_to_company": {
            "query": """
                MATCH (company:Company)-[recruit:RECRUITS]->(role:Role)-[requirement:REQUIRES]->(skill:Skill)
                WHERE skill.skill_id IN $primary_ids OR role.role_id IN $secondary_ids
                RETURN DISTINCT company, recruit, role, requirement, skill
            """,
            "primary_type": "skill",
            "secondary_type": "role",
        },
        "company_to_role": {
            "query": """
                MATCH (company:Company)-[recruit:RECRUITS]->(role:Role)-[requirement:REQUIRES]->(skill:Skill)
                WHERE role.role_id IN $primary_ids OR company.company_id IN $secondary_ids
                RETURN DISTINCT company, recruit, role, requirement, skill
            """,
            "primary_type": "role",
            "secondary_type": "company",
        },
    }

    NODE_KEY_MAP = {
        "skill": "skill_id",
        "role": "role_id",
        "company": "company_id",
    }

    NODE_LABEL_MAP = {
        "skill": "Skill",
        "role": "Role",
        "company": "Company",
    }

    PREFERENCE_WEIGHT = 3.0
    NEGATIVE_WEIGHT = 1.5
    PAIR_BONUS = 3.0
    PROFICIENCY_MULTIPLIER = {
        "精通": 1.5,
        "熟悉": 1.3,
        "掌握": 1.1,
        "了解": 0.7,
    }
    URGENCY_SCORE = {
        "极高": 3.0,
        "高": 2.0,
        "普通": 1.0,
    }
    SALARY_DIVISOR = 10000.0

    @classmethod
    def _node_id(cls, node) -> str | None:
        """从 Neo4j 节点里提取统一 ID 字段。"""
        if node is None:
            return None

        return (
            node.get("skill_id")
            or node.get("role_id")
            or node.get("company_id")
        )

    @classmethod
    def _node_kind(cls, node) -> str:
        """识别节点属于 Skill / Role / Company 哪一类。"""
        if node is None:
            return "unknown"

        if node.get("skill_id"):
            return "skill"
        if node.get("role_id"):
            return "role"
        if node.get("company_id"):
            return "company"
        return "unknown"

    @classmethod
    def _node_payload(cls, node) -> Dict[str, Any]:
        """把 Neo4j 节点转换成前端可消费的统一 JSON 结构。"""
        node_kind = cls._node_kind(node)
        return {
            "id": cls._node_id(node),
            "label": cls.NODE_LABEL_MAP.get(node_kind, "Unknown"),
            "properties": _to_jsonable(dict(node)) if node is not None else {},
        }

    @staticmethod
    def _edge_payload(edge, source_id: str, target_id: str) -> Dict[str, Any]:
        """把 Neo4j 关系转换成前端可消费的统一 JSON 结构。"""
        return {
            "source": source_id,
            "target": target_id,
            "relation": edge.type,
            "properties": _to_jsonable(dict(edge)) if edge is not None else {},
        }

    @classmethod
    def _normalize_ids(cls, ids: Iterable[str] | None) -> list[str]:
        """过滤空值，保证传给 Cypher 的 ID 列表干净。"""
        if not ids:
            return []

        return [item for item in ids if item]

    @classmethod
    def _build_result_sets(
        cls,
        primary_pos_list: Iterable[str] | None,
        primary_neg_list: Iterable[str] | None,
        secondary_pos_list: Iterable[str] | None,
        secondary_neg_list: Iterable[str] | None,
        primary_type: str,
        secondary_type: str,
    ) -> Dict[str, set[str]]:
        """把两个维度的正负列表整理成便于 O(1) 命中的集合。"""
        return {
            f"{primary_type}_pos": set(cls._normalize_ids(primary_pos_list)),
            f"{primary_type}_neg": set(cls._normalize_ids(primary_neg_list)),
            f"{secondary_type}_pos": set(cls._normalize_ids(secondary_pos_list)),
            f"{secondary_type}_neg": set(cls._normalize_ids(secondary_neg_list)),
        }

    @classmethod
    def _parse_salary_score(cls, recruit) -> float:
        """将薪资区间折算成统一的数值特征，供后续边分使用。

        规则：
        - 支持字符串区间，如 `30000-60000`
        - 取上下限均值
        - 再除以 `SALARY_DIVISOR`
        """
        salary_value = recruit.get("salary")
        if not salary_value:
            return 0.0

        if isinstance(salary_value, (int, float)):
            return float(salary_value) / cls.SALARY_DIVISOR

        salary_text = str(salary_value).strip()
        parts = [part for part in re.split(r"[-~～—至到]", salary_text) if part]

        numbers: list[float] = []
        for part in parts:
            match = re.search(r"\d+(?:\.\d+)?", part)
            if match:
                numbers.append(float(match.group()))

        if not numbers:
            match = re.search(r"\d+(?:\.\d+)?", salary_text)
            if not match:
                return 0.0
            numbers.append(float(match.group()))

        if len(numbers) == 1:
            average_salary = numbers[0]
        else:
            average_salary = sum(numbers[:2]) / 2.0

        return average_salary / cls.SALARY_DIVISOR

    @classmethod
    def _score_recruit_edge(cls, recruit) -> float:
        """计算 `Company -> Role` 这一条招聘边的基础分。"""
        urgency_score = cls.URGENCY_SCORE.get(recruit.get("urgency"), 1.0)
        salary_score = math.sqrt(cls._parse_salary_score(recruit))
        headcount_score = 1.0-1.0/float(recruit.get("headcount") or 0)

        return urgency_score + salary_score + headcount_score

    @classmethod
    def _score_requirement_edge(cls, requirement, skill) -> float:
        """计算 `Role -> Skill` 这一条要求边的基础分。"""
        requirement_score = float(requirement.get("weight") or 1.0)
        proficiency = str(requirement.get("proficiency") or "").strip()
        requirement_score *= cls.PROFICIENCY_MULTIPLIER.get(proficiency, 1.0)
        if requirement.get("is_core") is True:
            requirement_score *= 2.0
        if skill.get("category") == "软技能":
            requirement_score *= 0.4

        return requirement_score

    @classmethod
    def _node_multiplier(
        cls,
        node_id: str | None,
        *,
        positive_ids: set[str],
        negative_ids: set[str],
    ) -> tuple[float, list[str], list[str]]:
        """计算节点偏好系数，并返回命中的正/负向节点 ID。"""
        if not node_id:
            return 1.0, [], []

        multiplier = 1.0
        matched_positive = []
        matched_negative = []

        if node_id in positive_ids:
            multiplier *= cls.PREFERENCE_WEIGHT
            matched_positive.append(node_id)

        if node_id in negative_ids:
            multiplier *= -(cls.NEGATIVE_WEIGHT)
            matched_negative.append(node_id)

        return multiplier, matched_positive, matched_negative

    @classmethod
    def _score_chain(
        cls,
        company,
        recruit,
        role,
        requirement,
        skill,
        *,
        type_config: Dict[str, Any],
        preference_sets: Dict[str, set[str]],
    ) -> Dict[str, Any]:
        """计算单条 company-role-skill 链条的分数与解释信息。"""
        node_ids = {
            "skill": cls._node_id(skill),
            "role": cls._node_id(role),
            "company": cls._node_id(company),
        }

        primary_type = type_config["primary_type"]
        secondary_type = type_config["secondary_type"]

        primary_multiplier, primary_positive, primary_negative = cls._node_multiplier(
            node_ids.get(primary_type),
            positive_ids=preference_sets[f"{primary_type}_pos"],
            negative_ids=preference_sets[f"{primary_type}_neg"],
        )
        secondary_multiplier, secondary_positive, secondary_negative = cls._node_multiplier(
            node_ids.get(secondary_type),
            positive_ids=preference_sets[f"{secondary_type}_pos"],
            negative_ids=preference_sets[f"{secondary_type}_neg"],
        )

        matched_positive = []
        matched_negative = []

        matched_positive.extend(primary_positive)
        matched_positive.extend(secondary_positive)
        matched_negative.extend(primary_negative)
        matched_negative.extend(secondary_negative)

        # 当前版本采用乘法模型：边分是主系数，节点偏好是倍率。
        edge_company_role = cls._score_recruit_edge(recruit)
        edge_role_skill = cls._score_requirement_edge(requirement, skill)
        total_score = edge_company_role * primary_multiplier * edge_role_skill * secondary_multiplier

        reason_parts = [
            f"edge_company_role={edge_company_role:.2f}",
            f"edge_role_skill={edge_role_skill:.2f}",
            f"primary_factor={primary_multiplier:.2f}",
            f"secondary_factor={secondary_multiplier:.2f}",
        ]
        if matched_positive:
            reason_parts.append(f"pos={','.join(matched_positive)}")
        if matched_negative:
            reason_parts.append(f"neg={','.join(matched_negative)}")

        return {
            "score": total_score,
            "base_score": edge_company_role * edge_role_skill,
            "preference_score": (primary_multiplier * secondary_multiplier),
            "pair_bonus": 0.0,
            "matched_positive_ids": matched_positive,
            "matched_negative_ids": matched_negative,
            "reason": " | ".join(reason_parts),
            "nodes": {
                "company": cls._node_payload(company),
                "role": cls._node_payload(role),
                "skill": cls._node_payload(skill),
            },
            "edges": [
                cls._edge_payload(recruit, cls._node_id(company), cls._node_id(role)),
                cls._edge_payload(requirement, cls._node_id(role), cls._node_id(skill)),
            ],
        }

    @classmethod
    def _combo_group_key(cls, recommend_type: str, chain: Dict[str, Any]) -> tuple[str, str]:
        """根据推荐类型决定组合链的分组锚点。"""
        nodes = chain["nodes"]

        if recommend_type == "skill_to_role":
            return nodes["role"]["id"], nodes["company"]["id"]

        if recommend_type == "role_to_company":
            return nodes["company"]["id"], nodes["skill"]["id"]

        return nodes["role"]["id"], nodes["skill"]["id"]

    @classmethod
    def _aggregate_combo_chains(
        cls,
        session,
        recommend_type: str,
        chains: list[Dict[str, Any]],
        type_config: Dict[str, Any],
        preference_sets: Dict[str, set[str]],
        limit: int,
    ) -> list[Dict[str, Any]]:
        """把单链条聚合成组合链，并输出平均分排序结果。"""
        grouped: Dict[tuple[str, str], Dict[str, Any]] = {}

        for chain in chains:
            group_key = cls._combo_group_key(recommend_type, chain)
            group = grouped.setdefault(
                group_key,
                {
                    "score": 0.0,
                    "base_score": 0.0,
                    "preference_score": 0.0,
                    "pair_bonus": 0.0,
                    "matched_positive_ids": [],
                    "matched_negative_ids": [],
                    "reason_parts": [],
                    "nodes": {},
                    "edges": [],
                    "edge_seen": set(),
                    "member_scores": [],
                    "member_count": 0,
                },
            )

            group["score"] += float(chain["score"])
            group["base_score"] += float(chain["base_score"])
            group["preference_score"] += float(chain["preference_score"])
            group["pair_bonus"] += float(chain["pair_bonus"])
            group["member_scores"].append(float(chain["score"]))
            group["member_count"] += 1
            group["reason_parts"].append(chain["reason"])

            for node in chain["nodes"].values():
                node_id = node.get("id")
                if node_id and node_id not in group["nodes"]:
                    group["nodes"][node_id] = node

            for edge in chain["edges"]:
                edge_key = (edge["source"], edge["target"], edge["relation"])
                if edge_key not in group["edge_seen"]:
                    group["edge_seen"].add(edge_key)
                    group["edges"].append(edge)

            for node_id in chain["matched_positive_ids"]:
                if node_id not in group["matched_positive_ids"]:
                    group["matched_positive_ids"].append(node_id)

            for node_id in chain["matched_negative_ids"]:
                if node_id not in group["matched_negative_ids"]:
                    group["matched_negative_ids"].append(node_id)

        combo_chains = []
        for (left_id, right_id), group in grouped.items():
            member_count = max(1, group["member_count"])
            average_score = group["score"] / member_count

            expanded = cls._expand_combo_group(
                session,
                recommend_type=recommend_type,
                left_id=left_id,
                right_id=right_id,
                preference_sets=preference_sets,
                type_config=type_config,
            )
            if expanded:
                group = expanded
                member_count = max(1, group["member_count"])
                average_score = group["score"] / member_count

            combo_chains.append(
                {
                    "group_key": {"left_id": left_id, "right_id": right_id},
                    "score": average_score,
                    "total_score": group["score"],
                    "base_score": group["base_score"],
                    "preference_score": group["preference_score"],
                    "pair_bonus": group["pair_bonus"],
                    "member_count": group["member_count"],
                    "member_scores": group["member_scores"],
                    "matched_positive_ids": group["matched_positive_ids"],
                    "matched_negative_ids": group["matched_negative_ids"],
                    "reason": f"avg_score={average_score:.2f} || " + " || ".join(group.get("reason_parts", [])),
                    "nodes": list(group["nodes"].values()),
                    "edges": group["edges"],
                }
            )

        combo_chains.sort(key=lambda item: item["score"], reverse=True)
        return combo_chains[:limit]

    @classmethod
    def _expand_combo_group(
        cls,
        session,
        recommend_type: str,
        left_id: str,
        right_id: str,
        preference_sets: Dict[str, set[str]],
        type_config: Dict[str, Any],
    ) -> Dict[str, Any] | None:
        """按组合键重新拉取该组下的所有单链条。

        - skill_to_role: 以 role + company 为组，展开组内全部 skill
        - role_to_company: 以 company + skill 为组，展开组内全部 role
        - company_to_role: 以 role + skill 为组，展开组内全部 company
        """
        if recommend_type == "skill_to_role":
            query = """
            MATCH (company:Company {company_id: $right_id})-[recruit:RECRUITS]->(role:Role {role_id: $left_id})
            MATCH (role)-[requirement:REQUIRES]->(skill:Skill)
            RETURN company, recruit, role, requirement, skill
            """
            result = session.run(query, left_id=left_id, right_id=right_id)
        elif recommend_type == "role_to_company":
            query = """
            MATCH (company:Company {company_id: $left_id})-[recruit:RECRUITS]->(role:Role)
            MATCH (role)-[requirement:REQUIRES]->(skill:Skill {skill_id: $right_id})
            RETURN company, recruit, role, requirement, skill
            """
            result = session.run(query, left_id=left_id, right_id=right_id)
        else:
            query = """
            MATCH (company:Company)-[recruit:RECRUITS]->(role:Role {role_id: $left_id})
            MATCH (role)-[requirement:REQUIRES]->(skill:Skill {skill_id: $right_id})
            RETURN company, recruit, role, requirement, skill
            """
            result = session.run(query, left_id=left_id, right_id=right_id)

        members: list[Dict[str, Any]] = []
        seen_member_keys: set[tuple[str | None, str | None, str | None]] = set()

        for record in result:
            company = record.get("company")
            recruit = record.get("recruit")
            role = record.get("role")
            requirement = record.get("requirement")
            skill = record.get("skill")

            company_id = cls._node_id(company)
            role_id = cls._node_id(role)
            skill_id = cls._node_id(skill)

            member_key = (company_id, role_id, skill_id)
            if not company_id or not role_id or not skill_id or member_key in seen_member_keys:
                continue
            seen_member_keys.add(member_key)

            members.append(
                cls._score_chain(
                    company,
                    recruit,
                    role,
                    requirement,
                    skill,
                    type_config=type_config,
                    preference_sets=preference_sets,
                )
            )

        if not members:
            return None

        total_score = sum(item["score"] for item in members)
        member_count = len(members)
        average_score = total_score / member_count

        nodes_dict: Dict[str, Dict[str, Any]] = {}
        edges_list: list[Dict[str, Any]] = []
        edge_seen = set()
        matched_positive_ids: list[str] = []
        matched_negative_ids: list[str] = []
        reason_parts: list[str] = []

        for item in members:
            for node in item["nodes"].values():
                node_id = node.get("id")
                if node_id and node_id not in nodes_dict:
                    nodes_dict[node_id] = node

            for edge in item["edges"]:
                edge_key = (edge["source"], edge["target"], edge["relation"])
                if edge_key not in edge_seen:
                    edge_seen.add(edge_key)
                    edges_list.append(edge)

            for node_id in item["matched_positive_ids"]:
                if node_id not in matched_positive_ids:
                    matched_positive_ids.append(node_id)

            for node_id in item["matched_negative_ids"]:
                if node_id not in matched_negative_ids:
                    matched_negative_ids.append(node_id)

            reason_parts.append(item["reason"])

        return {
            "score": total_score,
            "base_score": sum(item["base_score"] for item in members),
            "preference_score": sum(item["preference_score"] for item in members),
            "pair_bonus": 0.0,
            "matched_positive_ids": matched_positive_ids,
            "matched_negative_ids": matched_negative_ids,
            "reason": f"avg_score={average_score:.2f} || " + " || ".join(reason_parts),
            "nodes": nodes_dict,
            "edges": edges_list,
            "member_scores": [item["score"] for item in members],
            "member_count": member_count,
            "reason_parts": reason_parts,
            "edge_seen": edge_seen,
        }

    @classmethod
    def _recommend_chains(
        cls,
        session,
        recommend_type: Literal["skill_to_role", "role_to_company", "company_to_role"],
        primary_pos_list: Iterable[str] | None,
        primary_neg_list: Iterable[str] | None,
        secondary_pos_list: Iterable[str] | None,
        secondary_neg_list: Iterable[str] | None,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """统一推荐入口：查单链、算分、聚合、裁剪预览。"""
        type_config = cls.TYPE_CONFIG[recommend_type]

        primary_ids = cls._normalize_ids(primary_pos_list) + cls._normalize_ids(primary_neg_list)
        secondary_ids = cls._normalize_ids(secondary_pos_list) + cls._normalize_ids(secondary_neg_list)

        if not primary_ids and not secondary_ids:
            return {"nodes": [], "edges": [], "chains": []}

        query = type_config["query"]
        result = session.run(
            query,
            primary_ids=primary_ids,
            secondary_ids=secondary_ids,
        )

        preference_sets = cls._build_result_sets(
            primary_pos_list,
            primary_neg_list,
            secondary_pos_list,
            secondary_neg_list,
            type_config["primary_type"],
            type_config["secondary_type"],
        )

        ranked_chains = []
        seen_chain_keys = set()

        for record in result:
            company = record.get("company")
            recruit = record.get("recruit")
            role = record.get("role")
            requirement = record.get("requirement")
            skill = record.get("skill")

            company_id = cls._node_id(company)
            role_id = cls._node_id(role)
            skill_id = cls._node_id(skill)

            if not company_id or not role_id or not skill_id:
                continue

            chain_key = (company_id, role_id, skill_id)
            if chain_key in seen_chain_keys:
                continue
            seen_chain_keys.add(chain_key)

            scored_chain = cls._score_chain(
                company,
                recruit,
                role,
                requirement,
                skill,
                type_config=type_config,
                preference_sets=preference_sets,
            )
            ranked_chains.append(scored_chain)

        ranked_chains.sort(key=lambda item: item["score"], reverse=True)

        # 聚合成组合链之后，再做一层摘要裁剪，避免 docs 响应过大。
        combo_chains = cls._aggregate_combo_chains(
            session,
            recommend_type,
            ranked_chains,
            type_config,
            preference_sets,
            limit,
        )

        # 单链条候选可能很多，docs 里完整返回会非常重；这里只保留一小段预览。
        single_chain_preview_limit = min(len(ranked_chains), max(limit * 3, 10))

        # 将 ranked_chains 按 combo 组键分桶，注入到对应 combo_chain 的 member_chains 字段
        single_by_group: Dict[tuple, list] = {}
        for chain in ranked_chains:
            key = cls._combo_group_key(recommend_type, chain)
            single_by_group.setdefault(key, []).append({
                "score": chain["score"],
                "base_score": chain["base_score"],
                "nodes": chain["nodes"],  # dict: {company/role/skill: node_dict}
                "edges": chain["edges"],
                "reason": chain["reason"],
            })

        for combo in combo_chains:
            left = combo["group_key"]["left_id"]
            right = combo["group_key"]["right_id"]
            combo["member_chains"] = single_by_group.get((left, right), [])

        return {
            "chains": combo_chains,
            "single_chains": ranked_chains[:single_chain_preview_limit],
        }

    @classmethod
    def recommend_role_by_skills(
        cls,
        session,
        skill_pos_list: list,
        skill_neg_list: list,
        company_pos_list: list,
        company_neg_list: list,
        limit: int = 5,
    ):
        return cls._recommend_chains(
            session,
            "skill_to_role",
            skill_pos_list,
            skill_neg_list,
            company_pos_list,
            company_neg_list,
            limit=limit,
        )

    @classmethod
    def recommend_company_by_roles(
        cls,
        session,
        skill_pos_list: list,
        skill_neg_list: list,
        role_pos_list: list,
        role_neg_list: list,
        limit: int = 5,
    ):
        return cls._recommend_chains(
            session,
            "role_to_company",
            skill_pos_list,
            skill_neg_list,
            role_pos_list,
            role_neg_list,
            limit=limit,
        )

    @classmethod
    def recommend_role_by_companies(
        cls,
        session,
        role_pos_list: list,
        role_neg_list: list,
        company_pos_list: list,
        company_neg_list: list,
        limit: int = 5,
    ):
        return cls._recommend_chains(
            session,
            "company_to_role",
            role_pos_list,
            role_neg_list,
            company_pos_list,
            company_neg_list,
            limit=limit,
        )


class RecommendService:
    """后端推荐服务接口类。

    这个类只负责参数归一化和路由分发，不直接承载评分逻辑。
    """

    @staticmethod
    def recommend_2to1_linkage(
        session,
        recommend_type: Literal["skill_to_role", "role_to_company", "company_to_role"],
        primary_pos_list: list = None,
        primary_neg_list: list = None,
        secondary_pos_list: list = None,
        secondary_neg_list: list = None,
        limit: int = 5,
    ):
        """把前端传入的两组偏好列表分发到对应的推荐实现。"""
        primary_pos_list = primary_pos_list or []
        primary_neg_list = primary_neg_list or []
        secondary_pos_list = secondary_pos_list or []
        secondary_neg_list = secondary_neg_list or []

        if recommend_type == "skill_to_role":
            return CareerLinkageLogic.recommend_role_by_skills(
                session,
                skill_pos_list=primary_pos_list,
                skill_neg_list=primary_neg_list,
                company_pos_list=secondary_pos_list,
                company_neg_list=secondary_neg_list,
                limit=limit,
            )

        if recommend_type == "role_to_company":
            return CareerLinkageLogic.recommend_company_by_roles(
                session,
                skill_pos_list=primary_pos_list,
                skill_neg_list=primary_neg_list,
                role_pos_list=secondary_pos_list,
                role_neg_list=secondary_neg_list,
                limit=limit,
            )

        if recommend_type == "company_to_role":
            return CareerLinkageLogic.recommend_role_by_companies(
                session,
                role_pos_list=primary_pos_list,
                role_neg_list=primary_neg_list,
                company_pos_list=secondary_pos_list,
                company_neg_list=secondary_neg_list,
                limit=limit,
            )

        return {"nodes": [], "edges": [], "chains": []}
