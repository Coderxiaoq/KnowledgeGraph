import json
import re
import os
import random
import numpy as np
from collections import defaultdict, Counter
from difflib import SequenceMatcher
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

print("=" * 60)
print("知识图谱融合流水线 (节点消歧 + 属性增强 + 边收敛)")
print("=" * 60)

# ==========================================
# 第一部分: 算法基建 (自包含)
# ==========================================
print("-> 1/5 正在初始化算法模型...")

KNOWN_BIG_TECH = {"字节跳动", "腾讯", "阿里巴巴", "百度", "华为技术有限公司", "网易", "京东", "美团", "快手"}

# --- 主流技能标准库 ---
MAINSTREAM_SKILLS = {
    'Java', 'Python', 'C++', 'C语言', 'C#', 'JavaScript', 'TypeScript', 'Go', 'PHP', 'Ruby',
    'HTML', 'CSS', 'Vue', 'React', 'Angular', 'Node.js', 'Spring', 'SpringBoot', 'Django', 'Flask',
    'MySQL', 'Oracle', 'MongoDB', 'Redis', 'PostgreSQL', 'SQL', 'Hadoop', 'Spark', 'Flink', 'Hive',
    'Linux', 'Docker', 'Kubernetes', 'Git', 'OpenStack', 'AWS', '阿里云', '云计算',
    '机器学习', '深度学习', 'TensorFlow', 'PyTorch', '计算机视觉', 'NLP', '自动化测试', '网络安全'
}

SKILL_CATEGORY_MAP = {
    'Java': '编程语言', 'Python': '编程语言', 'C++': '编程语言', 'C语言': '编程语言', 'C#': '编程语言',
    'JavaScript': '编程语言', 'TypeScript': '编程语言', 'Go': '编程语言', 'PHP': '编程语言', 'Ruby': '编程语言',
    'HTML': '前端技术', 'CSS': '前端技术', 'Vue': '前端框架', 'React': '前端框架', 'Angular': '前端框架',
    'Node.js': '前端框架', 'Spring': '后端框架', 'SpringBoot': '后端框架', 'Django': '后端框架', 'Flask': '后端框架',
    'MySQL': '数据库', 'Oracle': '数据库', 'MongoDB': '数据库', 'Redis': '数据库', 'PostgreSQL': '数据库',
    'SQL': '数据库', 'Hadoop': '大数据', 'Spark': '大数据', 'Flink': '大数据', 'Hive': '大数据',
    'Linux': '运维与部署', 'Docker': '运维与部署', 'Kubernetes': '运维与部署', 'Git': '运维与部署',
    'OpenStack': '云计算', 'AWS': '云计算', '阿里云': '云计算', '云计算': '云计算',
    '机器学习': 'AI/机器学习', '深度学习': 'AI/机器学习', 'TensorFlow': 'AI/机器学习',
    'PyTorch': 'AI/机器学习', '计算机视觉': 'AI/机器学习', 'NLP': 'AI/机器学习',
    '自动化测试': '测试', '网络安全': '安全'
}

SKILL_ALIAS_MAP = {
    'k8s': 'Kubernetes', 'js': 'JavaScript', 'ts': 'TypeScript', 'golang': 'Go',
    'cpp': 'C++', 'c#': 'C#', 'csharp': 'C#', 'dotnet': 'C#',
    'vue.js': 'Vue', 'react.js': 'React', 'angular.js': 'Angular',
    'node': 'Node.js', 'nodejs': 'Node.js', 'springboot': 'SpringBoot',
    'postgresql': 'PostgreSQL', 'mongodb': 'MongoDB', 'redis': 'Redis',
    'hadoop': 'Hadoop', 'spark': 'Spark', 'flink': 'Flink', 'hive': 'Hive',
    'docker': 'Docker', 'kubernetes': 'Kubernetes', 'git': 'Git',
    'linux': 'Linux', 'aws': 'AWS', 'openstack': 'OpenStack',
    'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch',
    'django': 'Django', 'flask': 'Flask',
    'mysql': 'MySQL', 'oracle': 'Oracle',
    'nlp': 'NLP', 'cv': '计算机视觉',
}

# --- 标签语义质心 ---
TAG_PROFILES = {
    "高薪": "40000 50000 60000 80000 专家 架构师 总监 高级 领先",
    "技术大牛多": "深度学习 机器视觉 NLP 架构 分布式 大数据 算法 模型 顶级",
    "节奏快": "敏捷 迭代 字节跳动 快手 美团 拼多多 互联网 挑战 抗压",
    "弹性工作": "双休 不加班 稳定 运维 桌面 支持 内部系统 轻松",
    "福利好": "六险二金 补贴 假期 体检 国企 移动 电信 政务",
    "成长快": "校招 实习 培训生 初级 培养 导师 学习",
    "核心大厂": "字节跳动 腾讯 阿里 百度 华为 京东"
}
tag_names = list(TAG_PROFILES.keys())
tag_corpus = list(TAG_PROFILES.values())
tag_vectorizer = TfidfVectorizer(analyzer='word', token_pattern=r'(?u)\b\w+\b')
tag_tfidf_matrix = tag_vectorizer.fit_transform(tag_corpus)


# ==========================================
# 第二部分: 消歧函数
# ==========================================

def clean_role_name(name):
    """清洗角色名：去括号内容、去地点/编号后缀"""
    s = name.strip()
    # 去掉中文括号内容：(...)
    s = re.sub(r'（[^）]*）', '', s)
    # 去掉英文括号内容：(...)
    s = re.sub(r'\([^)]*\)', '', s)
    # 去掉破折号后的地点/驻场/项目编号后缀
    s = re.sub(r'[-–—][^-–—]*?(?:驻场|派驻|项目|编号|DW\d|[一-鿿]{2,4}市?).*$', '', s)
    # 去掉常见招聘噪音词
    noise = ['可签长期', '双休', '薪资高', '薪资面议', '福利好', '待遇优',
             '五险一金', '周末双休', '带薪年假', '年终奖', '包吃住', '可兼职', '全职']
    for nw in noise:
        s = s.replace(nw, '')
    # 清理多余空格
    s = re.sub(r'\s+', '', s)
    return s.strip()


def normalize_role_name(raw_name, threshold=0.82):
    """角色名标准化：清洗后聚类消歧"""
    cleaned = clean_role_name(raw_name)
    if not cleaned or len(cleaned) < 2:
        return raw_name.strip()
    return cleaned


def normalize_skill_name(skill_str, threshold=0.80):
    """技能名标准化：别名映射 + 大小写统一 + 编辑距离纠错"""
    s = skill_str.strip()
    s_lower = s.lower()

    # 别名精确映射
    if s_lower in SKILL_ALIAS_MAP:
        canonical = SKILL_ALIAS_MAP[s_lower]
        category = SKILL_CATEGORY_MAP.get(canonical, "通用技术")
        return canonical, category

    # 主流技能精确匹配 (case-insensitive)
    for std in MAINSTREAM_SKILLS:
        if s_lower == std.lower():
            category = SKILL_CATEGORY_MAP.get(std, "通用技术")
            return std, category

    # 编辑距离兜底（仅对非主流技能）
    best_ratio = 0.0
    best_match = s
    for std in MAINSTREAM_SKILLS:
        ratio = SequenceMatcher(None, s_lower, std.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = std
    if best_ratio >= threshold:
        category = SKILL_CATEGORY_MAP.get(best_match, "通用技术")
        return best_match, category

    return s, "通用技术"


def algorithmic_infer_tags(doc_text):
    """TF-IDF 语义标签推断，返回 top-3 标签"""
    if not doc_text.strip():
        return ["弹性工作", "成长快", "福利好"]
    doc_vec = tag_vectorizer.transform([doc_text])
    similarities = cosine_similarity(doc_vec, tag_tfidf_matrix).flatten()
    top_3 = np.argsort(similarities)[-3:][::-1]
    assigned = [tag_names[i] for i in top_3 if similarities[i] > 0.05]
    defaults = ["福利好", "弹性工作", "成长快"]
    for d in defaults:
        if len(assigned) >= 3:
            break
        if d not in assigned:
            assigned.append(d)
    return assigned[:3]


def generate_description(c_name, role_name, location, skill_text, salary):
    """生成动态描述文本"""
    loc = location.split('/')[0].split('-')[0] if location else '未知'
    skill_short = skill_text[:30] if skill_text else '相关技术'
    templates = [
        f"{c_name}位于{loc}，现招聘{role_name}。该岗位核心要求掌握{skill_short}等技术栈，提供{salary}薪资待遇。",
        f"加入{c_name}（{loc}研发中心），担任{role_name}。我们需要您具备{skill_short}研发能力，公司提供{salary}竞争性薪酬。",
        f"{c_name}正在寻找优秀的{role_name}。工作地点在{loc}，深耕{skill_short}领域。提供{salary}回报，期待您的加入。"
    ]
    return random.choice(templates)


def infer_scale(company_name, headcount, tags):
    """推断公司规模"""
    if company_name in KNOWN_BIG_TECH:
        return "大厂 (>10000人)"
    if headcount > 15 or ("国企" in tags):
        return "大型 (500-10000人)"
    if headcount > 5:
        return "中型 (100-500人)"
    return "小型 (<100人)"


def infer_industry(company_name):
    """根据公司名推断行业"""
    n = company_name.lower()
    if any(k in n for k in ['游戏', 'game']):
        return '游戏'
    if any(k in n for k in ['汽车', '车', 'auto']):
        return '智能制造'
    if any(k in n for k in ['银行', '金融', '证券', '保险']):
        return '金融'
    if any(k in n for k in ['医院', '医疗', '药', '健康']):
        return '医疗健康'
    if any(k in n for k in ['教育', '学', '培训']):
        return '教育'
    if any(k in n for k in ['移动', '电信', '联通', '政务', '数字']):
        return '政企服务'
    return '互联网软件'


# ==========================================
# 第三部分: 加载图谱 A
# ==========================================
INPUT_FILE = "knowledge_graph.json"
print(f"-> 2/5 正在加载图谱: {INPUT_FILE} ...")

if not os.path.exists(INPUT_FILE):
    print(f"错误：找不到文件 {INPUT_FILE}")
    exit(1)

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    graph_a = json.load(f)

nodes_a = graph_a['nodes']
edges_a = graph_a['edges']

roles_a = [n for n in nodes_a if n['label'] == 'Role']
skills_a = [n for n in nodes_a if n['label'] == 'Skill']
companies_a = [n for n in nodes_a if n['label'] == 'Company']

print(f"   输入: {len(companies_a)} Company, {len(roles_a)} Role, {len(skills_a)} Skill, {len(edges_a)} edges")

node_by_id = {n['id']: n for n in nodes_a}

# ==========================================
# 第四部分: 角色消歧
# ==========================================
print("-> 3/5 正在执行角色消歧...")

# 第一遍：清洗后精确匹配分组
role_groups = defaultdict(list)
for role in roles_a:
    raw_name = role['properties']['name']
    norm = normalize_role_name(raw_name)
    role_groups[norm].append(role)

# 第二遍：TF-IDF 相似度聚类（合并相近但名称不同的组）
norm_names = sorted(role_groups.keys())
if len(norm_names) > 1:
    role_vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
    role_tfidf_matrix = role_vectorizer.fit_transform(norm_names)

    merge_map = {}
    merged = set()
    for i, name_i in enumerate(norm_names):
        if name_i in merged:
            continue
        query_vec = role_vectorizer.transform([name_i])
        similarities = cosine_similarity(query_vec, role_tfidf_matrix).flatten()
        for j, name_j in enumerate(norm_names):
            if i >= j or name_j in merged:
                continue
            if similarities[j] >= 0.85:
                canonical = name_i if len(name_i) <= len(name_j) else name_j
                other = name_j if canonical == name_i else name_i
                merge_map[other] = canonical
                merged.add(other)

    for src, dst in merge_map.items():
        if src in role_groups and dst in role_groups:
            role_groups[dst].extend(role_groups.pop(src))

# 构建融合后的 Role 节点
roles_fused = {}
old_role_to_new = {}

for canonical_name, role_list in role_groups.items():
    all_salaries = []
    all_locations = set()
    all_educations = set()
    all_aliases = set()

    for r in role_list:
        props = r['properties']
        all_aliases.add(props['name'])
        sal = str(props.get('salary', '')).strip()
        if sal and sal != 'nan':
            all_salaries.append(sal)
        loc = str(props.get('location', '')).strip()
        if loc and loc != 'nan':
            all_locations.add(loc)
        edu = str(props.get('education', '')).strip()
        if edu and edu != 'nan':
            all_educations.add(edu)

    # 薪资取中位数
    median_salary = '面议'
    if all_salaries:
        median_salary = sorted(all_salaries)[len(all_salaries) // 2]

    # 取最短别名作为展示名
    display_name = min(all_aliases, key=len) if all_aliases else canonical_name

    new_id = f"r_{len(roles_fused) + 1}"
    roles_fused[canonical_name] = {
        "id": new_id,
        "label": "Role",
        "properties": {
            "name": display_name,
            "salary": median_salary,
            "location": "/".join(sorted(all_locations)[:5]),
            "education": "/".join(sorted(all_educations)[:5]),
            "aliases": sorted(all_aliases, key=len),
            "demand_count": len(role_list),
            "industry": infer_industry(canonical_name)
        }
    }

    for r in role_list:
        old_role_to_new[r['id']] = new_id

role_by_new_id = {v['id']: v for v in roles_fused.values()}

print(f"   角色消歧: {len(roles_a)} -> {len(roles_fused)} (去重率 {100*(1-len(roles_fused)/len(roles_a)):.1f}%)")

# ==========================================
# 第五部分: 技能消歧
# ==========================================
print("-> 4/5 正在执行技能消歧...")

skill_groups = defaultdict(list)
for skill in skills_a:
    raw_name = skill['properties']['name']
    canonical, category = normalize_skill_name(raw_name)
    skill_groups[canonical].append(skill)

skills_fused = {}
old_skill_to_new = {}

for canonical_name, skill_list in skill_groups.items():
    all_aliases = set()
    for s in skill_list:
        all_aliases.add(s['properties']['name'])

    _, category = normalize_skill_name(canonical_name)

    new_id = f"s_{len(skills_fused) + 1}"
    skills_fused[canonical_name] = {
        "id": new_id,
        "label": "Skill",
        "properties": {
            "name": canonical_name,
            "category": category,
            "aliases": sorted(all_aliases, key=len),
            "demand_count": len(skill_list),
            "description": f"{category}领域的核心技术能力要求。"
        }
    }

    for s in skill_list:
        old_skill_to_new[s['id']] = new_id

skill_by_new_id = {v['id']: v for v in skills_fused.values()}

print(f"   技能消歧: {len(skills_a)} -> {len(skills_fused)} (去重率 {100*(1-len(skills_fused)/len(skills_a)):.1f}%)")

# ==========================================
# 第六部分: 公司增强 + 边收敛
# ==========================================
print("-> 5/5 正在增强公司属性并收敛关系边...")

# 统计每个公司的招聘数据
company_hc = Counter()
company_roles = defaultdict(set)
company_locations = defaultdict(set)
company_salaries = defaultdict(list)

for edge in edges_a:
    if edge['label'] == 'RECRUITS':
        c_id = edge['source']
        r_id = edge['target']
        company_hc[c_id] += edge['properties'].get('weight', 1)
        company_roles[c_id].add(r_id)

for edge in edges_a:
    if edge['label'] == 'RECRUITS':
        r_id = edge['target']
        c_id = edge['source']
        role_node = node_by_id.get(r_id)
        if role_node:
            props = role_node['properties']
            loc = str(props.get('location', '')).strip()
            sal = str(props.get('salary', '')).strip()
            if loc and loc != 'nan':
                company_locations[c_id].add(loc.split('-')[0])
            if sal and sal != 'nan':
                company_salaries[c_id].append(sal)

# 构建增强后的 Company 节点
companies_fused = {}
old_company_to_new = {}

for comp in companies_a:
    old_id = comp['id']
    name = comp['properties']['name']
    hc = company_hc.get(old_id, 0)

    loc_str = "/".join(sorted(company_locations.get(old_id, set()))[:3]) or '未知'
    sal_list = company_salaries.get(old_id, ['面议'])
    median_company_sal = sorted(sal_list)[len(sal_list) // 2] if sal_list else '面议'

    # 收集公司招聘的岗位所需技能
    skill_keywords = []
    for edge in edges_a:
        if edge['label'] == 'REQUIRES':
            r_id = edge['source']
            s_id = edge['target']
            # 检查该岗位是否属于这家公司
            is_company_role = False
            for e2 in edges_a:
                if e2['label'] == 'RECRUITS' and e2['source'] == old_id and e2['target'] == r_id:
                    is_company_role = True
                    break
            if is_company_role:
                if s_id in old_skill_to_new:
                    skill_keywords.append(old_skill_to_new.get(s_id))
                else:
                    sn = node_by_id.get(s_id)
                    if sn:
                        skill_keywords.append(sn['properties']['name'])

    skill_text = ' '.join(skill_keywords[:10])
    doc = f"{name} {loc_str} {median_company_sal} {skill_text}"
    tags = algorithmic_infer_tags(doc)

    scale = infer_scale(name, hc, tags)
    industry = infer_industry(name)

    # 找出公司最常招的岗位名作为描述中的主岗位
    role_names_in_company = []
    for r_id in company_roles.get(old_id, set()):
        if r_id in old_role_to_new:
            role_names_in_company.append(
                role_by_new_id[old_role_to_new[r_id]]['properties']['name']
            )
        else:
            rn = node_by_id.get(r_id)
            if rn:
                role_names_in_company.append(rn['properties']['name'])
    main_role = role_names_in_company[0] if role_names_in_company else '技术人才'

    desc = generate_description(
        name, main_role, loc_str,
        ' '.join(skill_keywords[:5]),
        median_company_sal
    )

    new_id = f"c_{len(companies_fused) + 1}"
    companies_fused[name] = {
        "id": new_id,
        "label": "Company",
        "properties": {
            "name": name,
            "location": loc_str,
            "scale": scale,
            "industry": industry,
            "tags": tags,
            "headcount": hc,
            "description": desc
        }
    }
    old_company_to_new[old_id] = new_id

print(f"   公司增强: {len(companies_a)} 家 -> 补充行业/规模/标签/描述")

# --- 边收敛 ---
new_edges = []

# REQUIRES 边：按融合后的 (role, skill) 聚合
requires_agg = Counter()
for edge in edges_a:
    if edge['label'] != 'REQUIRES':
        continue
    old_r = edge['source']
    old_s = edge['target']
    if old_r in old_role_to_new and old_s in old_skill_to_new:
        new_r = old_role_to_new[old_r]
        new_s = old_skill_to_new[old_s]
        requires_agg[(new_r, new_s)] += edge['properties'].get('weight', 1)

for (r_id, s_id), weight in requires_agg.items():
    proficiency = "精通" if weight >= 5 else ("掌握" if weight >= 2 else "熟悉")
    new_edges.append({
        "relation": "REQUIRES",
        "source": r_id,
        "target": s_id,
        "properties": {
            "weight": min(weight, 10),
            "is_core": weight >= 3,
            "proficiency": proficiency
        }
    })

# RECRUITS 边：按融合后的 (company, role) 聚合
recruits_agg = Counter()
recruits_sal = defaultdict(list)
for edge in edges_a:
    if edge['label'] != 'RECRUITS':
        continue
    old_c = edge['source']
    old_r = edge['target']
    if old_c in old_company_to_new and old_r in old_role_to_new:
        new_c = old_company_to_new[old_c]
        new_r = old_role_to_new[old_r]
        recruits_agg[(new_c, new_r)] += edge['properties'].get('weight', 1)
        rn = node_by_id.get(old_r)
        if rn:
            sal = str(rn['properties'].get('salary', '')).strip()
            if sal and sal != 'nan':
                recruits_sal[(new_c, new_r)].append(sal)

for (c_id, r_id), headcount in recruits_agg.items():
    sals = recruits_sal.get((c_id, r_id), ['面议'])
    median_sal = sorted(sals)[len(sals) // 2]
    urgency = "极高" if headcount > 10 else ("高" if headcount > 3 else "普通")
    new_edges.append({
        "relation": "RECRUITS",
        "source": c_id,
        "target": r_id,
        "properties": {
            "headcount": headcount,
            "salary": median_sal,
            "urgency": urgency
        }
    })

print(f"   边收敛: {len(edges_a)} -> {len(new_edges)} (REQUIRES {len(requires_agg)}, RECRUITS {len(recruits_agg)})")

# ==========================================
# 第七部分: 输出
# ==========================================
all_nodes_fused = list(companies_fused.values()) + list(roles_fused.values()) + list(skills_fused.values())
graph_final = {"nodes": all_nodes_fused, "edges": new_edges}

OUTPUT_FILE = "knowledge_graph_final.json"
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(graph_final, f, ensure_ascii=False, indent=2)

print()
print("=" * 60)
print(f"知识融合完成！文件: {OUTPUT_FILE}")
print(f"图谱统计：")
print(f"   Company: {len(companies_fused)} (增强: 行业/规模/标签/描述)")
print(f"   Role:   {len(roles_fused)} (消歧: {len(roles_a)} -> {len(roles_fused)})")
print(f"   Skill:  {len(skills_fused)} (消歧: {len(skills_a)} -> {len(skills_fused)})")
print(f"   Edges:  {len(new_edges)} (收敛: {len(edges_a)} -> {len(new_edges)})")
print(f"   总节点: {len(all_nodes_fused)} (原 {len(nodes_a)})")
print("=" * 60)
