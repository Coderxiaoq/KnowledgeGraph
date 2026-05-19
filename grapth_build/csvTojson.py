import pandas as pd
import re
import json
from collections import defaultdict

# ==========================================
# 步骤 1: 数据加载与预处理
# ==========================================
print("1:正在加载数据...")
df = pd.read_csv('data.csv')

# 初始化存储容器
jobs_map = {}  # 用于去重岗位：{岗位名称: 岗位信息字典}
skills_map = {}  # 用于去重技能：{技能名称: 技能信息字典}
edge_counter = defaultdict(int)  # 用于统计边权重：{(岗位名, 技能名): 次数}

print("步骤 2: 正在构建岗位节点...")

for index, row in df.iterrows():
    job_name = str(row['岗位名称']).strip()

    # 如果该岗位还没记录过，则创建新记录
    if job_name not in jobs_map:
        jobs_map[job_name] = {
            "id": f"r_{len(jobs_map) + 1}",  # 生成唯一 ID
            "label": "Role",  # 本体类型
            "properties": {
                "name": job_name,
                "salary": str(row['薪资']).strip(),
                "location": str(row['工作地址']).strip(),
                "education": str(row['学历要求']).strip()
            }
        }

print("步骤 3: 正在构建技能节点并统计关系...")

for index, row in df.iterrows():
    job_name = str(row['岗位名称']).strip()
    skills_raw = str(row['专业学术术语']).strip()

    if skills_raw and skills_raw != 'nan':
        # 使用正则分割技能词（支持逗号、空格、顿号分隔）
        skill_list = re.split(r'[,;、\s]', skills_raw)

        for skill in skill_list:
            skill = skill.strip()
            if skill and len(skill) > 1:  # 过滤空词或单字

                # 1. 构建技能节点 (如果不存在)
                if skill not in skills_map:
                    skills_map[skill] = {
                        "id": f"s_{len(skills_map) + 1}",
                        "label": "Skill",
                        "properties": {
                            "name": skill
                        }
                    }

                # 2. 统计边的权重 (岗位 -> 技能)
                edge_key = (job_name, skill)
                edge_counter[edge_key] += 1

# ==========================================
# 步骤 4: 关系构建 - 计算权重与掌握情况
# ==========================================
print("步骤 4: 正在计算边的属性...")

relationships = []


def get_proficiency(weight):
    """根据权重定义掌握情况"""
    if weight < 3:
        return "了解"
    elif weight < 10:
        return "熟悉"
    else:
        return "精通"


for (job_name, skill_name), weight in edge_counter.items():
    # 获取对应的 ID
    source_id = jobs_map[job_name]['id']
    target_id = skills_map[skill_name]['id']

    # 计算掌握情况
    proficiency = get_proficiency(weight)

    relationships.append({
        "source": source_id,
        "target": target_id,
        "label": "REQUIRES",  # 边的类型
        "properties": {
            "weight": weight,
            "proficiency": proficiency
        }
    })

print("步骤 5: 正在组装 JSON 并保存...")

# 将所有节点放入一个列表
all_nodes = list(jobs_map.values()) + list(skills_map.values())

# 最终的数据结构
graph_data = {
    "nodes": all_nodes,
    "edges": relationships
}

# 保存为 JSON 文件
output_file = 'knowledge_graph.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(graph_data, f, ensure_ascii=False, indent=4)

print(f"✅ 完成！文件已保存为 {output_file}")
print(f"📊 统计信息：共 {len(jobs_map)} 个岗位，{len(skills_map)} 个技能，{len(relationships)} 条关系。")

# --- 打印预览 ---
# print(json.dumps(graph_data, ensure_ascii=False, indent=4))