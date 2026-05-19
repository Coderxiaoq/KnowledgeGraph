"""
阶段1: 知识提取 (Knowledge Extraction)
从 data.csv 提取 Role + Skill 实体和 REQUIRES 关系，构建原始知识图谱。
"""
import pandas as pd
import re
import json
from collections import defaultdict

# ==========================================
# 步骤 1: 数据加载与预处理
# ==========================================
print("[1/5] 加载数据...")
df = pd.read_csv('../data/data.csv')

jobs_map = {}          # {岗位名称: Role节点}
skills_map = {}        # {技能名称: Skill节点}
edge_counter = defaultdict(int)  # {(岗位名, 技能名): 同现次数}

# ==========================================
# 步骤 2: 构建岗位节点 (按原始名称去重)
# ==========================================
print("[2/5] 构建岗位节点...")

for _, row in df.iterrows():
    job_name = str(row['岗位名称']).strip()
    if not job_name or job_name == 'nan':
        continue

    if job_name not in jobs_map:
        jobs_map[job_name] = {
            "id": f"r_{len(jobs_map) + 1}",
            "label": "Role",
            "properties": {
                "name": job_name,
                "salary": str(row['薪资']).strip(),
                "location": str(row['工作地址']).strip(),
                "education": str(row['学历要求']).strip()
            }
        }

# ==========================================
# 步骤 3: 构建技能节点并统计边权重
# ==========================================
print("[3/5] 构建技能节点并统计关系...")

# 多词技能名保护：拆分前替换为占位符，拆分后还原
MULTI_WORD_PROTECT = {
    'SQL Server': 'SQL_Server',
    'SQL server': 'SQL_Server',
    'Node.js': 'Node_js',
    'C++': 'CPlusPlus',
    'C#': 'CSharp',
    '.NET': 'DotNet',
    'ASP.NET': 'ASP_DotNet',
    'TCP/IP': 'TCP_IP',
    'PL/SQL': 'PL_SQL',
}

for _, row in df.iterrows():
    job_name = str(row['岗位名称']).strip()
    skills_raw = str(row['专业学术术语']).strip()

    if not job_name or job_name == 'nan':
        continue
    if not skills_raw or skills_raw == 'nan':
        continue

    # 保护多词技能名
    for orig, placeholder in MULTI_WORD_PROTECT.items():
        skills_raw = skills_raw.replace(orig, placeholder)

    # 分割技能词: 逗号、分号、顿号、空白字符
    skill_list = re.split(r'[,;、\s]+', skills_raw)

    for skill in skill_list:
        skill = skill.strip()

        # 还原被保护的技能名
        for orig, placeholder in MULTI_WORD_PROTECT.items():
            skill = skill.replace(placeholder, orig)

        # 过滤空词和单字符
        if not skill or len(skill) <= 1:
            continue

        # 创建技能节点 (如果不存在)
        if skill not in skills_map:
            skills_map[skill] = {
                "id": f"s_{len(skills_map) + 1}",
                "label": "Skill",
                "properties": {"name": skill}
            }

        # 统计边权重
        edge_counter[(job_name, skill)] += 1

# ==========================================
# 步骤 4: 构建关系边
# ==========================================
print("[4/5] 构建关系边...")


def get_proficiency(weight):
    if weight >= 5:
        return "精通"
    elif weight >= 2:
        return "熟悉"
    else:
        return "了解"


relationships = []
for (job_name, skill_name), weight in edge_counter.items():
    relationships.append({
        "source": jobs_map[job_name]['id'],
        "target": skills_map[skill_name]['id'],
        "label": "REQUIRES",
        "properties": {
            "weight": weight,
            "proficiency": get_proficiency(weight)
        }
    })

# ==========================================
# 步骤 5: 组装并输出 JSON
# ==========================================
print("[5/5] 保存图谱...")

all_nodes = list(jobs_map.values()) + list(skills_map.values())
graph_data = {"nodes": all_nodes, "edges": relationships}

with open('knowledge_graph.json', 'w', encoding='utf-8') as f:
    json.dump(graph_data, f, ensure_ascii=False, indent=2)

print(f"[完成] 岗位: {len(jobs_map)} | 技能: {len(skills_map)} | 关系: {len(relationships)}")
