"""
阶段2: 知识融合 (Knowledge Fusion)
对原始知识图谱做实体消歧、归一化、去重、关系重定向与权重聚合。
五阶段流水线:
  1. 技能名消歧 (别名映射 + 模糊纠错)
  2. 技能同名合并
  2.5 技能格式归一化合并 (近重复: SQLServer→SQL Server)
  3. 岗位名消歧 (名称清洗 + 关键词优先级匹配 + TF-IDF 兜底)
  4. 边重定向 + 权重聚合
  5. 输出最终高质量图谱
"""
import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# ============================================================
# 0. 加载原始图谱
# ============================================================
with open('knowledge_graph.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# ============================================================
# 1. 规则知识库
# ============================================================

# 主流程技能表 (用于模糊纠错的参照集)
MAINSTREAM_SKILLS = {
    'Java', 'Python', 'C++', 'C语言', 'C#', 'JavaScript', 'TypeScript', 'Go', 'PHP',
    'Ruby', 'Rust', 'Scala', 'Kotlin', 'Swift', 'Dart', 'MATLAB', 'R语言',
    'HTML', 'CSS', 'XML', 'JSON', 'YAML',
    'Vue', 'React', 'Angular', 'Node.js', 'jQuery', 'Bootstrap', 'ElementUI',
    'Spring', 'SpringBoot', 'SpringMVC', 'SpringCloud', 'MyBatis', 'Hibernate',
    'Struts', 'Django', 'Flask', 'Tornado', 'FastAPI',
    'MySQL', 'Oracle', 'SQL Server', 'PostgreSQL', 'MongoDB', 'Redis',
    'SQLite', 'DB2', 'HBase', 'Elasticsearch', 'Cassandra', 'Neo4j',
    'Hadoop', 'Spark', 'Flink', 'Kafka', 'RabbitMQ', 'RocketMQ', 'Zookeeper',
    'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'Ansible',
    'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy',
    '机器学习', '深度学习', '自然语言处理', '计算机视觉', '推荐系统',
    'Linux', 'Unix', 'Windows', 'Android', 'iOS',
    '自动化测试', '性能测试', '单元测试', '集成测试',
    '网络安全', '信息安全', '数据安全',
    '微服务', '分布式系统', '高并发', '数据结构', '设计模式',
    'GIT', 'SVN', 'Maven', 'Gradle', 'Nginx', 'Tomcat', 'Apache',
    'TCP/IP', 'HTTP', 'HTTPS', 'WebSocket', 'RESTful', 'RPC',
    'AJAX', 'Webpack', 'Babel', 'ES6', 'Sass', 'Less',
    'Unity', 'Unity3D', 'UE4', 'Unreal',
    '云计算', '大数据', '人工智能', '区块链', '物联网', '边缘计算',
    '软件工程', '系统架构', '项目管理', '需求分析',
}

# 技能别名映射 (大小写/缩写/常见变体 → 标准名)
SKILL_ALIAS_MAP = {
    'k8s': 'Kubernetes', 'kubernetes': 'Kubernetes',
    'js': 'JavaScript', 'javascript': 'JavaScript',
    'ts': 'TypeScript', 'typescript': 'TypeScript',
    'golang': 'Go', 'go': 'Go',
    'c++': 'C++', 'cpp': 'C++',
    'c#': 'C#', 'csharp': 'C#',
    'python': 'Python', 'py': 'Python',
    'java': 'Java',
    'mysql': 'MySQL',
    'oracle': 'Oracle',
    'postgresql': 'PostgreSQL', 'pg': 'PostgreSQL',
    'mongodb': 'MongoDB', 'mongo': 'MongoDB',
    'redis': 'Redis',
    'sqlserver': 'SQL Server', 'sql serve': 'SQL Server',
    'sqlserve': 'SQL Server', 'mssql': 'SQL Server',
    'sqlite': 'SQLite',
    'elasticsearch': 'Elasticsearch', 'es': 'Elasticsearch',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'jenkins': 'Jenkins',
    'nginx': 'Nginx',
    'tomcat': 'Tomcat',
    'apache': 'Apache',
    'nodejs': 'Node.js', 'node': 'Node.js',
    'vuejs': 'Vue', 'vue.js': 'Vue',
    'reactjs': 'React', 'react.js': 'React',
    'angularjs': 'Angular', 'angular.js': 'Angular',
    'springboot': 'SpringBoot',
    'springcloud': 'SpringCloud',
    'springmvc': 'SpringMVC',
    'mybatis': 'MyBatis',
    'hibernate': 'Hibernate',
    'django': 'Django',
    'flask': 'Flask',
    'fastapi': 'FastAPI',
    'tensorflow': 'TensorFlow', 'tf': 'TensorFlow',
    'pytorch': 'PyTorch',
    'keras': 'Keras',
    'scikit-learn': 'Scikit-learn', 'sklearn': 'Scikit-learn',
    'pandas': 'Pandas',
    'numpy': 'NumPy', 'np': 'NumPy',
    'linux': 'Linux',
    'ubuntu': 'Ubuntu', 'centos': 'CentOS',
    'android': 'Android',
    'ios': 'iOS',
    'git': 'GIT',
    'svn': 'SVN',
    'maven': 'Maven',
    'gradle': 'Gradle',
    'hadoop': 'Hadoop',
    'spark': 'Spark',
    'flink': 'Flink',
    'kafka': 'Kafka',
    'rabbitmq': 'RabbitMQ', 'mq': '消息队列',
    'zookeeper': 'Zookeeper', 'zk': 'Zookeeper',
    'tcp': 'TCP/IP', 'tcp/ip': 'TCP/IP', 'tcpip': 'TCP/IP',
    'http': 'HTTP', 'https': 'HTTPS',
    'websocket': 'WebSocket', 'ws': 'WebSocket',
    'restful': 'RESTful', 'rest': 'RESTful',
    'rpc': 'RPC',
    'ajax': 'AJAX',
    'jquery': 'jQuery',
    'bootstrap': 'Bootstrap',
    'webpack': 'Webpack',
    'unity': 'Unity', 'unity3d': 'Unity3D',
    'unreal': 'Unreal', 'ue4': 'UE4',
    'nlp': '自然语言处理',
    'cv': '计算机视觉',
    'ml': '机器学习',
    'dl': '深度学习',
    'ai': '人工智能',
    'iot': '物联网',
    'h5': 'HTML5',
    'css3': 'CSS3',
    'es6': 'ES6',
    'sass': 'Sass', 'scss': 'Sass',
    'dotnet': '.NET', 'aspnet': 'ASP.NET', 'asp.net': 'ASP.NET',
    'pl/sql': 'PL/SQL', 'plsql': 'PL/SQL',
    'nosql': 'NoSQL',
    'db2': 'DB2',
    'hbase': 'HBase',
}

# 岗位分类体系 (按标准类别组织关键词，长关键词优先匹配)
ROLE_CATEGORIES = {
    '架构师': ['架构师', '系统架构', '技术架构', '软件架构', '数据架构',
               '解决方案架构', '平台架构', '应用架构', '安全架构'],
    '嵌入式开发工程师': ['嵌入式', '单片机', 'ARM', 'DSP', 'FPGA', '底层开发'],
    'C++开发工程师': ['c++开发', 'c++软件', 'c/c++', 'c++高级', 'c++工程'],
    'Java开发工程师': ['java开发', 'java软件', 'java工程', 'j2ee', 'jee'],
    'Python开发工程师': ['python开发', 'python软件', 'python工程'],
    '前端开发工程师': ['前端', 'web前端', 'h5开发', '小程序开发', 'web开发工程师',
                      'web全栈', '页面开发', 'js开发'],
    '后端开发工程师': ['后端', '服务端', '后台开发', 'web后端', '后台工程师', '服务端开发'],
    '全栈开发工程师': ['全栈', '全栈开发', '全栈工程'],
    'PHP开发工程师': ['php开发', 'php软件', 'php工程'],
    'NET开发工程师': ['.net开发', '.net软件', 'c#开发', 'c#软件', 'net开发'],
    'Golang开发工程师': ['golang开发', 'go开发', 'go语言'],
    'Android/iOS工程师': ['android开发', '安卓开发', 'ios开发', '移动端开发', '移动开发'],
    '算法工程师': ['算法工程', '算法开发', '算法设计', '机器学习工程',
                  '深度学习工程', 'nlp算法', '图像算法', '视觉算法', '推荐算法',
                  '语音算法', '自动驾驶算法', '感知算法', '定位算法', '规划算法'],
    'AI/人工智能工程师': ['人工智能', 'ai工程', 'ai开发', 'ai研发', '大模型'],
    '大数据工程师': ['大数据', '数据仓库', '数据开发', 'etl开发', '数据工程',
                     'hadoop开发', 'spark开发', 'flink开发', '数仓'],
    'DBA/数据库工程师': ['dba', '数据库管理', '数据库运维', '数据库开发', '数据库工程'],
    '云计算工程师': ['云计算', '云平台', '云服务', '云原生', 'paas', 'saas', 'iaas'],
    '测试工程师': ['测试工程', '测试开发', '软件测试', '自动化测试', '性能测试',
                  'qa工程', '质量工程', '测试总工', 'app测试'],
    '安全工程师': ['网络安全', '信息安全', '数据安全', '安全工程', '渗透测试',
                   '安全开发', '安全运维', '逆向工程', '安全架构'],
    '网络工程师': ['网络工程', '网络运维', '网络管理', '网络开发', '通信工程'],
    '硬件开发工程师': ['硬件开发', '硬件工程', '硬件设计', 'pcb', '电路设计'],
    '运维工程师': ['运维工程', '系统运维', '应用运维', '运维开发', 'devops',
                   'sre', '系统管理', '运营维护'],
    '技术经理/总监': ['技术经理', '技术总监', '技术负责人', '技术主管',
                     '研发经理', '研发总监', '开发经理', '项目总监', '技术合伙人'],
    '软件开发工程师': ['软件开发', '软件工程', '开发工程', '程序开发',
                      '高级开发工程', '高级软件开发', '高级软件工程'],
    '产品经理': ['产品经理', '产品总监', '产品设计', '需求分析'],
    '数据分析师': ['数据分析', '数据挖掘', '商业分析', 'bi分析', '数据科学'],
    '讲师/培训师': ['讲师', '培训', '授课', '教学'],
    '项目经理': ['项目经理', '项目管理', '交付经理', '实施经理'],
    '销售/商务': ['销售', '客户经理', '商务', '营销'],
}

# ============================================================
# 2. TF-IDF 算法引擎初始化 (用于岗位分类兜底)
# ============================================================
role_classes = list(ROLE_CATEGORIES.keys())
role_corpus = [" ".join(keywords) for keywords in ROLE_CATEGORIES.values()]

vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
tfidf_matrix = vectorizer.fit_transform(role_corpus)

# ============================================================
# 3. 核心消歧函数
# ============================================================


def clean_role_name(name):
    """清洗岗位名称噪声: 括号内容、编号、广告语、公司名等"""
    # 去掉括号及内容: (xxx)、（xxx）、【xxx】、[xxx]
    name = re.sub(r'[（(][^）)]*[）)]', '', name)
    name = re.sub(r'【[^】]*】', '', name)
    name = re.sub(r'\[[^\]]*\]', '', name)
    # 去掉职位编号: MJ000640, J10411, -00022 等
    name = re.sub(r'\(?[A-Z]+\d+\)?', '', name)
    name = re.sub(r'-\d{3,}$', '', name)
    # 去掉薪资/福利广告语
    name = re.sub(r'[，,、]?\s*(高薪|双休|五险|正式编制|上市公司|校招|央企).*$', '', name)
    # 去掉公司名前缀: XX公司-、XX（中国）
    name = re.sub(r'^.*?公司[）)]?[-—]?', '', name)
    name = re.sub(r'（中国）', '', name)
    # 去掉城市/部门后缀
    name = re.sub(r'[（(](北京|上海|深圳|广州|杭州|成都|武汉|南京|雄安)[）)]', '', name)
    name = re.sub(r'[-—](北京|上海|深圳|广州|杭州|成都|武汉|[一-龥]{2,4}部)$', '', name)
    # 去掉纯数字/年份
    if re.match(r'^[\d\s]+$', name):
        return ''
    # 整理空白和标点
    name = re.sub(r'\s+', ' ', name).strip()
    name = name.strip('，,、-— ')
    return name if len(name) >= 2 else name


def hybrid_normalize_role(name, threshold=0.30):
    """
    岗位消歧: 名称清洗 → 最长关键词优先匹配 → TF-IDF余弦相似度兜底
    """
    cleaned = clean_role_name(name)
    if not cleaned:
        return '未分类'

    cleaned_lower = cleaned.lower().strip()

    # 第一层: 关键词优先级匹配 (长词优先, 避免 "测试" 误匹配 "测试架构师")
    best_category = None
    best_keyword_len = 0

    for category, keywords in ROLE_CATEGORIES.items():
        for keyword in keywords:
            if keyword in cleaned_lower:
                if len(keyword) > best_keyword_len:
                    best_keyword_len = len(keyword)
                    best_category = category

    if best_category:
        return best_category

    # 第二层: TF-IDF + 余弦相似度兜底
    query_vec = vectorizer.transform([cleaned_lower])
    similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()

    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]

    if best_score >= threshold:
        return role_classes[best_idx]

    # 兜底: 返回清洗后的原始名称
    return cleaned


def normalize_skill_form(name):
    """技能名格式归一化: 去大小写+去空白+去常见标点, 用于发现近重复实体"""
    return re.sub(r'[\s._\-/]+', '', name).lower()


def hybrid_normalize_skill(skill_name, threshold=0.80):
    """
    技能消歧: 别名映射 → 主流程表精确匹配 → 格式归一化匹配 → 模糊匹配
    """
    name_lower = skill_name.lower().strip()

    # 第一层: 精确别名映射
    if name_lower in SKILL_ALIAS_MAP:
        return SKILL_ALIAS_MAP[name_lower]

    # 第二层: 主流程技能表精确匹配 (忽略大小写和常见分隔符)
    normalized = normalize_skill_form(name_lower)
    for standard_skill in MAINSTREAM_SKILLS:
        if normalize_skill_form(standard_skill) == normalized:
            return standard_skill

    # 第三层: 模糊匹配 (基于 SequenceMatcher 编辑距离)
    best_match = None
    highest_ratio = 0.0

    for standard_skill in MAINSTREAM_SKILLS:
        ratio = SequenceMatcher(None, name_lower, standard_skill.lower()).ratio()
        if ratio > highest_ratio:
            highest_ratio = ratio
            best_match = standard_skill

    # 短技能名 (≤4字符) 提高阈值防止误匹配 (如 Boot↔Boost)
    effective_threshold = max(threshold, 0.90) if len(name_lower) <= 4 else threshold

    if highest_ratio >= effective_threshold:
        return best_match

    # 全部未匹配, 保留原名
    return skill_name


# ============================================================
# 4. 工具函数
# ============================================================


def parse_salary(salary_str):
    """解析薪资字符串为 (min, max) 元组"""
    try:
        parts = str(salary_str).split('-')
        low = float(parts[0].replace('K', '000').replace('k', '000')) if parts[0] else 0
        high = float(parts[1].replace('K', '000').replace('k', '000')) if len(parts) > 1 and parts[1] else low
        return (int(low), int(high))
    except Exception:
        return (0, 0)


def merge_salaries(salaries):
    """合并多个薪资范围, 取全局 min-max"""
    if not salaries:
        return "0-0"
    return f"{min(s[0] for s in salaries)}-{max(s[1] for s in salaries)}"


# ============================================================
# 5. 主流程: 五阶段知识融合
# ============================================================

print("=" * 60)
print("Phase 1: 技能实体消歧 (别名映射 + 模糊纠错)")
print("=" * 60)

skill_nodes = [n for n in data['nodes'] if n['label'] == 'Skill']
skill_by_name = defaultdict(list)

for node in skill_nodes:
    original_name = node['properties']['name']
    normalized_name = hybrid_normalize_skill(original_name)
    node['properties']['name'] = normalized_name
    skill_by_name[normalized_name].append(node)

# -------- Phase 2: 同名合并 --------
print("Phase 2: 技能同名合并")

skill_id_mapping = {}   # 旧id → 新id
skills_removed = set()  # 被合并掉的节点id集合

for name, nodes in skill_by_name.items():
    if len(nodes) > 1:
        keeper = nodes[0]
        for dup in nodes[1:]:
            skill_id_mapping[dup['id']] = keeper['id']
            skills_removed.add(dup['id'])

# -------- Phase 2.5: 格式归一化合并 (近重复实体) --------
print("Phase 2.5: 技能格式归一化合并 (SQLServer → SQL Server)")

# 对未被合并的技能按归一化形式重新分组
form_groups = defaultdict(list)
for node in skill_nodes:
    if node['id'] not in skills_removed:
        form_key = normalize_skill_form(node['properties']['name'])
        form_groups[form_key].append(node)

for form_key, nodes in form_groups.items():
    if len(nodes) > 1:
        # 选择最规范的名字作为 keeper: 优先有空格(如 SQL Server) + 有大小写
        def name_score(n):
            nm = n['properties']['name']
            score = 0
            if ' ' in nm:
                score += 2
            if any(c.isupper() for c in nm):
                score += 1
            if any(c.islower() for c in nm):
                score += 1
            return score

        keeper = max(nodes, key=name_score)
        for dup in nodes:
            if dup['id'] != keeper['id']:
                skill_id_mapping[dup['id']] = keeper['id']
                skills_removed.add(dup['id'])

# 解析传递链: s_10 → s_5 → s_1 最终指向 s_1
for old_id, new_id in list(skill_id_mapping.items()):
    resolved = new_id
    seen = {old_id, resolved}
    while resolved in skill_id_mapping:
        resolved = skill_id_mapping[resolved]
        if resolved in seen:
            break
        seen.add(resolved)
    skill_id_mapping[old_id] = resolved

# -------- Phase 3: 岗位消歧 + 合并 --------
print("Phase 3: 岗位实体消歧与收束")

role_nodes = [n for n in data['nodes'] if n['label'] == 'Role']
role_groups = defaultdict(list)

for node in role_nodes:
    core_name = hybrid_normalize_role(node['properties']['name'])
    node['properties']['_core_name'] = core_name
    role_groups[core_name].append(node)

role_id_mapping = {}
roles_removed = set()

for core_name, nodes in role_groups.items():
    keeper = nodes[0]
    all_salaries = []

    for node in nodes:
        if 'salary' in node['properties']:
            all_salaries.append(parse_salary(node['properties']['salary']))

    # 更新 keeper 属性
    keeper['properties']['name'] = core_name
    keeper['properties']['salary'] = merge_salaries(all_salaries)
    # 跨城市合并后 location 不再有意义
    if 'location' in keeper['properties']:
        del keeper['properties']['location']

    if len(nodes) > 1:
        for dup in nodes[1:]:
            role_id_mapping[dup['id']] = keeper['id']
            roles_removed.add(dup['id'])

# -------- Phase 4: 边重定向 + 权重聚合 --------
print("Phase 4: 边重定向与权重聚合")

edge_dict = {}

for edge in data['edges']:
    new_source = edge['source']
    new_target = edge['target']

    # 重定向到合并后的实体
    if new_source in role_id_mapping:
        new_source = role_id_mapping[new_source]
    if new_target in skill_id_mapping:
        new_target = skill_id_mapping[new_target]

    # 丢弃指向已删除实体的边
    if new_target in skills_removed:
        continue
    if new_source in roles_removed:
        continue

    edge_key = (new_source, new_target, edge['label'])

    if edge_key in edge_dict:
        edge_dict[edge_key]['properties']['weight'] += edge['properties'].get('weight', 1)
    else:
        new_edge = {
            "source": new_source,
            "target": new_target,
            "label": edge['label'],
            "properties": {"weight": edge['properties'].get('weight', 1)}
        }
        edge_dict[edge_key] = new_edge

# 重新计算 proficiency
new_edges = list(edge_dict.values())
for edge in new_edges:
    w = edge['properties']['weight']
    edge['properties']['proficiency'] = '精通' if w >= 5 else ('熟悉' if w >= 2 else '了解')

# -------- Phase 5: 输出 --------
print("Phase 5: 生成最终图谱")

all_removed = roles_removed | skills_removed
new_nodes = [n for n in data['nodes'] if n['id'] not in all_removed]

# 清理辅助字段
for node in new_nodes:
    node['properties'].pop('_core_name', None)

result = {"nodes": new_nodes, "edges": new_edges}

with open('knowledge_graph_optimized.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# 统计
final_roles = [n for n in new_nodes if n['label'] == 'Role']
final_skills = [n for n in new_nodes if n['label'] == 'Skill']

print(f"\n[完成] 知识融合结束")
print(f"  Role:  {len(role_nodes)} → {len(final_roles)} (合并 {len(roles_removed)} 个)")
print(f"  Skill: {len(skill_nodes)} → {len(final_skills)} (合并 {len(skills_removed)} 个)")
print(f"  Edge:  {len(data['edges'])} → {len(new_edges)} (聚合)")
print(f"  输出: knowledge_graph_optimized.json")
