import json
import re
from collections import defaultdict
from difflib import SequenceMatcher

# ============ 加载数据 ============
with open('../data/knowledge_graph.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# ============ 主流IT技能定义（更精简） ============
MAINSTREAM_SKILLS = {
    # ---- 核心编程语言 ----
    'Java', 'Python', 'C++', 'C语言', 'C#', 'JavaScript', 'TypeScript',
    'Go', 'PHP', 'Ruby', 'Scala', 'Kotlin', 'Swift', 'Rust', 'Shell',

    # ---- 前端技术 ----
    'HTML', 'HTML5', 'CSS', 'CSS3', 'Vue', 'React', 'Angular', 'Node.js',
    'jQuery', 'Bootstrap', 'Webpack', 'Ajax', '小程序开发',

    # ---- 后端框架 ----
    'Spring', 'SpringBoot', 'SpringCloud', 'SpringMVC', 'MyBatis',
    'Django', 'Flask', 'Hibernate', 'Dubbo', 'Netty', 'Nginx', 'Apache',

    # ---- 数据库 ----
    'MySQL', 'Oracle', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLServer',
    'DB2', 'HBase', 'Hive', 'ElasticSearch', 'SQL', 'NoSQL',

    # ---- 大数据 ----
    'Hadoop', 'Spark', 'Flink', 'Kafka', 'HDFS', 'ZooKeeper',
    'HBase', 'Hive', 'Storm', 'ETL', '数据仓库', '数据挖掘',
    '数据分析', '数据建模', '数据可视化', 'Flink',

    # ---- 云计算/DevOps ----
    'Docker', 'Kubernetes', 'OpenStack', 'Jenkins', 'Ansible',
    'Git', 'SVN', 'Maven', '微服务', '分布式', 'CI/CD',

    # ---- AI/机器学习 ----
    '机器学习', '深度学习', 'TensorFlow', 'PyTorch', 'Keras',
    'NLP', '计算机视觉', '自然语言处理', '图像识别', '强化学习',
    '神经网络', '目标检测', '图像处理',

    # ---- 算法相关 ----
    '算法', '数据结构', '设计模式', '排序算法', '搜索算法',
    '推荐算法', '图像算法', '语音算法',

    # ---- 操作系统 ----
    'Linux', 'Unix', 'Windows',

    # ---- 移动开发 ----
    'Android', 'iOS', 'Flutter', 'React Native',

    # ---- 嵌入式 ----
    '嵌入式', '单片机', 'ARM', 'DSP', 'FPGA', 'RTOS', 'MCU',

    # ---- 测试 ----
    '自动化测试', '性能测试', '功能测试', '单元测试', '集成测试',
    '接口测试', 'Selenium', 'Jmeter', 'TestNG',

    # ---- 网络安全 ----
    '网络安全', '渗透测试', '漏洞扫描', '安全', '防火墙',

    # ---- 软件工程 ----
    'Git', '敏捷开发', '面向对象', '设计模式', 'RESTful',

    # ---- 网络协议 ----
    'TCP/IP', 'HTTP', 'HTTPS', 'DNS', 'WebSocket',

    # ---- 架构 ----
    '架构设计', '系统架构', '微服务架构', '分布式架构', 'SOA',

    # ---- 工具/平台 ----
    'IntelliJ', 'Eclipse', 'VS Code', 'Postman', 'Jira',
    'Confluence', 'Swagger', 'Gradle', 'npm', 'Yarn',
}

# 技能别名映射表（大小写不敏感）
SKILL_ALIAS_MAP = {
    'java': 'Java', 'JAVA': 'Java', 'java开发': 'Java',
    'python': 'Python', 'PYTHON': 'Python', 'python开发': 'Python',
    'c++': 'C++', 'C/C++': 'C++', 'cpp': 'C++',
    'c#': 'C#', 'csharp': 'C#',
    'javascript': 'JavaScript', 'js': 'JavaScript', 'JS': 'JavaScript',
    'typescript': 'TypeScript', 'ts': 'TypeScript',
    'go': 'Go', 'golang': 'Go', 'Golang': 'Go',
    'php': 'PHP', 'PHP': 'PHP',
    'scala': 'Scala', 'SCALA': 'Scala',
    'kotlin': 'Kotlin', 'KOTLIN': 'Kotlin',
    'swift': 'Swift', 'SWIFT': 'Swift',
    'rust': 'Rust', 'RUST': 'Rust',
    'shell': 'Shell', 'Shell编程': 'Shell', 'bash': 'Shell',
    'c语言': 'C语言', 'C': 'C语言',

    'html': 'HTML', 'html5': 'HTML5', 'H5': 'HTML5', 'h5': 'HTML5',
    'css': 'CSS', 'css3': 'CSS3', 'CSS': 'CSS',
    'vue': 'Vue', 'vue.js': 'Vue', 'vuejs': 'Vue', 'Vue.js': 'Vue',
    'react': 'React', 'react.js': 'React', 'reactjs': 'React', 'React.js': 'React',
    'angular': 'Angular', 'angularjs': 'Angular',
    'node': 'Node.js', 'node.js': 'Node.js', 'nodejs': 'Node.js',
    'jquery': 'jQuery', 'jQuery': 'jQuery',
    'bootstrap': 'Bootstrap', 'Bootstrap': 'Bootstrap',
    'webpack': 'Webpack', 'WEBPACK': 'Webpack',
    'ajax': 'Ajax', 'AJAX': 'Ajax',
    '小程序': '小程序开发', '微信小程序': '小程序开发',

    'spring': 'Spring', 'SPRING': 'Spring',
    'springboot': 'SpringBoot', 'SPRINGBOOT': 'SpringBoot',
    'springcloud': 'SpringCloud', 'SPRINGCLOUD': 'SpringCloud',
    'springmvc': 'SpringMVC', 'SPRINGMVC': 'SpringMVC',
    'mybatis': 'MyBatis', 'MYBATIS': 'MyBatis',
    'django': 'Django', 'DJANGO': 'Django',
    'flask': 'Flask', 'FLASK': 'Flask',
    'hibernate': 'Hibernate', 'HIBERNATE': 'Hibernate',
    'dubbo': 'Dubbo', 'DUBBO': 'Dubbo',
    'netty': 'Netty', 'NETTY': 'Netty',
    'nginx': 'Nginx', 'NGINX': 'Nginx',
    'apache': 'Apache', 'APACHE': 'Apache',

    'mysql': 'MySQL', 'MYSQL': 'MySQL',
    'oracle': 'Oracle', 'ORACLE': 'Oracle',
    'postgresql': 'PostgreSQL', 'POSTGRESQL': 'PostgreSQL', 'pg': 'PostgreSQL',
    'mongodb': 'MongoDB', 'MONGODB': 'MongoDB', 'mongo': 'MongoDB',
    'redis': 'Redis', 'REDIS': 'Redis',
    'sqlserver': 'SQLServer', 'SQLSERVER': 'SQLServer', 'mssql': 'SQLServer',
    'db2': 'DB2', 'DB2': 'DB2',
    'hbase': 'HBase', 'HBASE': 'HBase',
    'hive': 'Hive', 'HIVE': 'Hive',
    'elasticsearch': 'ElasticSearch', 'ELASTICSEARCH': 'ElasticSearch', 'es': 'ElasticSearch',
    'sql': 'SQL', 'SQL': 'SQL',
    'nosql': 'NoSQL', 'NOSQL': 'NoSQL',

    'hadoop': 'Hadoop', 'HADOOP': 'Hadoop',
    'spark': 'Spark', 'SPARK': 'Spark',
    'flink': 'Flink', 'FLINK': 'Flink',
    'kafka': 'Kafka', 'KAFKA': 'Kafka',
    'hdfs': 'HDFS', 'HDFS': 'HDFS',
    'zookeeper': 'ZooKeeper', 'ZOOKEEPER': 'ZooKeeper',
    'storm': 'Storm', 'STORM': 'Storm',
    'etl': 'ETL', 'ETL': 'ETL',
    '数据仓库': '数据仓库', 'data warehouse': '数据仓库',
    '数据挖掘': '数据挖掘', 'data mining': '数据挖掘',
    '数据分析': '数据分析', 'data analysis': '数据分析',

    'docker': 'Docker', 'DOCKER': 'Docker',
    'kubernetes': 'Kubernetes', 'KUBERNETES': 'Kubernetes', 'k8s': 'Kubernetes', 'K8S': 'Kubernetes',
    'openstack': 'OpenStack', 'OPENSTACK': 'OpenStack',
    'jenkins': 'Jenkins', 'JENKINS': 'Jenkins',
    'ansible': 'Ansible', 'ANSIBLE': 'Ansible',
    'git': 'Git', 'GIT': 'Git',
    'svn': 'SVN', 'SVN': 'SVN',
    'maven': 'Maven', 'MAVEN': 'Maven',
    '微服务': '微服务', 'microservices': '微服务',
    '分布式': '分布式', 'distributed': '分布式',
    'cicd': 'CI/CD', 'CI/CD': 'CI/CD', 'CICD': 'CI/CD',

    '机器学习': '机器学习', 'machine learning': '机器学习',
    '深度学习': '深度学习', 'deep learning': '深度学习',
    'tensorflow': 'TensorFlow', 'TENSORFLOW': 'TensorFlow', 'tf': 'TensorFlow',
    'pytorch': 'PyTorch', 'PYTORCH': 'PyTorch', 'torch': 'PyTorch',
    'keras': 'Keras', 'KERAS': 'Keras',
    'nlp': 'NLP', 'NLP': 'NLP',
    '计算机视觉': '计算机视觉', 'cv': '计算机视觉',
    '自然语言处理': '自然语言处理', 'NLP': '自然语言处理',
    '图像识别': '图像识别', 'image recognition': '图像识别',
    '强化学习': '强化学习', 'reinforcement learning': '强化学习',
    '神经网络': '神经网络', 'neural network': '神经网络',
    '目标检测': '目标检测', 'object detection': '目标检测',
    '图像处理': '图像处理', 'image processing': '图像处理',

    'linux': 'Linux', 'LINUX': 'Linux',
    'unix': 'Unix', 'UNIX': 'Unix',
    'windows': 'Windows', 'WINDOWS': 'Windows',

    'android': 'Android', 'ANDROID': 'Android',
    'ios': 'iOS', 'IOS': 'iOS', 'iOS': 'iOS',
    'flutter': 'Flutter', 'FLUTTER': 'Flutter',

    '嵌入式': '嵌入式', 'embedded': '嵌入式',
    '单片机': '单片机', 'mcu': 'MCU',
    'arm': 'ARM', 'ARM': 'ARM',
    'dsp': 'DSP', 'DSP': 'DSP',
    'fpga': 'FPGA', 'FPGA': 'FPGA',
    'rtos': 'RTOS', 'RTOS': 'RTOS',

    '自动化测试': '自动化测试', 'automation test': '自动化测试',
    '性能测试': '性能测试', 'performance test': '性能测试',
    '功能测试': '功能测试', 'functional test': '功能测试',
    '单元测试': '单元测试', 'unit test': '单元测试',
    '集成测试': '集成测试', 'integration test': '集成测试',
    '接口测试': '接口测试', 'api test': '接口测试',
    'selenium': 'Selenium', 'SELENIUM': 'Selenium',
    'jmeter': 'Jmeter', 'JMETER': 'Jmeter',
    'testng': 'TestNG', 'TESTNG': 'TestNG',

    '网络安全': '网络安全', 'network security': '网络安全',
    '渗透测试': '渗透测试', 'penetration test': '渗透测试',

    'tcp': 'TCP/IP', 'tcp/ip': 'TCP/IP',
    'http': 'HTTP', 'HTTP': 'HTTP',
    'https': 'HTTPS', 'HTTPS': 'HTTPS',
    'websocket': 'WebSocket', 'ws': 'WebSocket',

    '软件测试': '软件测试', '测试': '软件测试',
    '运维': '运维', '系统运维': '运维',
    '大数据': '大数据', 'big data': '大数据',
}

# ============ 岗位标准化配置 ============
ROLE_CATEGORIES = {
    '运维类': {
        'keywords': ['运维', '维护', '运营维护', '系统管理员', '支持工程师'],
        'core_name': '运维工程师'
    },
    'Java开发类': {
        'keywords': ['java', 'j2ee', 'jee'],
        'core_name': 'Java开发工程师'
    },
    'Python开发类': {
        'keywords': ['python', 'pyhton'],
        'core_name': 'Python开发工程师'
    },
    '前端开发类': {
        'keywords': ['前端', 'web前端', 'h5', 'react', 'vue', 'angular', '小程序'],
        'core_name': '前端开发工程师'
    },
    '后端开发类': {
        'keywords': ['后端', '服务端', '后台开发', 'web后端'],
        'core_name': '后端开发工程师'
    },
    '全栈开发类': {
        'keywords': ['全栈', '全站'],
        'core_name': '全栈开发工程师'
    },
    'C++开发类': {
        'keywords': ['c++', 'cpp'],
        'core_name': 'C++开发工程师'
    },
    '算法工程师类': {
        'keywords': ['算法', '机器学习', '深度学习', 'nlp', '图像', '语音', '推荐', '搜索算法'],
        'core_name': '算法工程师'
    },
    '测试类': {
        'keywords': ['测试', 'qa', '质量'],
        'core_name': '测试工程师'
    },
    '大数据类': {
        'keywords': ['大数据', '数据仓库', '数据开发', 'etl', 'hadoop', 'spark', 'flink'],
        'core_name': '大数据工程师'
    },
    '嵌入式类': {
        'keywords': ['嵌入式', '单片机', 'arm', 'dsp', 'fpga', '底层'],
        'core_name': '嵌入式开发工程师'
    },
    '网络类': {
        'keywords': ['网络', '网管', '网工', 'ccie', 'ccnp', 'hcie'],
        'core_name': '网络工程师'
    },
    '安全类': {
        'keywords': ['安全', '渗透', '攻防', '加密', '等保'],
        'core_name': '安全工程师'
    },
    '架构师类': {
        'keywords': ['架构师', '架构', '技术总监', 'cto'],
        'core_name': '架构师'
    },
    '产品类': {
        'keywords': ['产品经理', '产品总监', '需求分析'],
        'core_name': '产品经理'
    },
    '数据分析类': {
        'keywords': ['数据分析', '数据挖掘', '商业分析', 'bi'],
        'core_name': '数据分析师'
    },
    'Android开发类': {
        'keywords': ['android', '安卓', 'android开发'],
        'core_name': 'Android开发工程师'
    },
    'iOS开发类': {
        'keywords': ['ios', '苹果', 'iphone', 'swift'],
        'core_name': 'iOS开发工程师'
    },
    '.NET开发类': {
        'keywords': ['.net', 'c#', 'dotnet', 'asp.net'],
        'core_name': '.NET开发工程师'
    },
    'PHP开发类': {
        'keywords': ['php'],
        'core_name': 'PHP开发工程师'
    },
    'Go开发类': {
        'keywords': ['go', 'golang'],
        'core_name': 'Go开发工程师'
    },
    '项目管理类': {
        'keywords': ['项目经理', '项目总监', 'pmo', '敏捷', 'scrum'],
        'core_name': '项目经理'
    },
    '数据库类': {
        'keywords': ['dba', '数据库', 'oracle dba', 'mysql dba'],
        'core_name': '数据库工程师'
    },
    '云计算类': {
        'keywords': ['云计算', '云平台', 'aws', 'azure', '阿里云', '腾讯云', '华为云'],
        'core_name': '云计算工程师'
    },
    'DevOps类': {
        'keywords': ['devops', 'sre', 'cicd'],
        'core_name': 'DevOps工程师'
    },
    '技术支持类': {
        'keywords': ['技术支持', '售后', '客服', 'helpdesk'],
        'core_name': '技术支持工程师'
    },
    'UI/UX类': {
        'keywords': ['ui', 'ux', '设计', '视觉', '交互', '美工'],
        'core_name': 'UI设计师'
    },
    '实习生/校招类': {
        'keywords': ['实习', '实习生', '校招', '应届', '培训生', '管培生'],
        'core_name': '实习生'
    },
    '总监/管理类': {
        'keywords': ['总监', '总监', 'vp', '副总', '技术总监', '研发总监', 'cto', '技术经理', '部门经理'],
        'core_name': '技术管理岗'
    },
    '开发通用类': {
        'keywords': ['开发', '软件', '程序员', '研发'],
        'core_name': '软件开发工程师'
    },
}


def normalize_role_name(name):
    """标准化岗位名称"""
    name_lower = name.lower().strip()

    # 先检查具体岗位类别
    for category, config in ROLE_CATEGORIES.items():
        for keyword in config['keywords']:
            if keyword in name_lower:
                return config['core_name']

    # 默认返回原名称
    return name


def extract_location(location):
    """提取标准化地点（城市级别）"""
    if not location:
        return '未知'

    # 提取城市名（取"-"分割的第一部分）
    parts = location.split('-')
    city = parts[0].strip() if parts else location.strip()

    # 城市名标准化
    city_map = {
        '阿克苏': '阿克苏', '阿勒泰': '阿勒泰', '安顺': '安顺', '安阳': '安阳',
        '鞍山': '鞍山', '巴彦淖尔': '巴彦淖尔', '白城': '白城', '白山': '白山',
        '白银': '白银', '包头': '包头', '保定': '保定', '北京': '北京',
    }

    for key, value in city_map.items():
        if key in city:
            return value

    return city


def parse_salary(salary_str):
    """解析薪资字符串为(min, max)"""
    if not salary_str:
        return (0, 0)
    try:
        parts = str(salary_str).split('-')
        low = float(parts[0]) if parts[0] else 0
        high = float(parts[1]) if len(parts) > 1 and parts[1] else low
        return (int(low), int(high))
    except:
        return (0, 0)


def merge_salaries(salaries):
    """合并多个薪资范围"""
    if not salaries:
        return "0-0"
    min_sal = min(s[0] for s in salaries)
    max_sal = max(s[1] for s in salaries)
    return f"{min_sal}-{max_sal}"


def similarity(a, b):
    """字符串相似度"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


# ============ 主流程 ============

# 1. 技能实体处理
print("=" * 60)
print("阶段1: 技能实体筛选与标准化")
print("=" * 60)

total_skills = 0
kept_skills = 0
removed_skills_name = set()
skill_nodes = [n for n in data['nodes'] if n['label'] == 'Skill']

# 先标准化所有技能名
for node in skill_nodes:
    total_skills += 1
    name = node['properties']['name']
    # 标准化名称
    if name in SKILL_ALIAS_MAP:
        node['properties']['name'] = SKILL_ALIAS_MAP[name]
    # 尝试小写匹配
    elif name.lower() in SKILL_ALIAS_MAP:
        node['properties']['name'] = SKILL_ALIAS_MAP[name.lower()]

# 筛选主流技能
valid_skill_ids = set()
skills_removed_ids = set()  # 新增：标记要删除的技能ID

for node in skill_nodes:
    name = node['properties']['name']
    if name in MAINSTREAM_SKILLS:
        valid_skill_ids.add(node['id'])
        kept_skills += 1
    else:
        removed_skills_name.add(name)
        skills_removed_ids.add(node['id'])  # 新增：直接标记删除

print(f"总技能数: {total_skills}")
print(f"保留技能数: {kept_skills}")
print(f"删除技能数: {total_skills - kept_skills}")

# 2. 技能实体去重合并
print("\n" + "=" * 60)
print("阶段2: 技能实体去重合并")
print("=" * 60)

skill_by_name = defaultdict(list)
for node in skill_nodes:
    if node['id'] in valid_skill_ids:
        skill_by_name[node['properties']['name']].append(node)

skill_id_mapping = {}
skills_removed = set()
skill_merge_count = 0

for name, nodes in skill_by_name.items():
    if len(nodes) > 1:
        keeper = nodes[0]
        for dup in nodes[1:]:
            skill_id_mapping[dup['id']] = keeper['id']
            skills_removed.add(dup['id'])
            skill_merge_count += 1

print(f"技能合并数: {skill_merge_count}")

# 3. 岗位实体处理
print("\n" + "=" * 60)
print("阶段3: 岗位实体标准化与合并")
print("=" * 60)

total_roles = 0
role_nodes = [n for n in data['nodes'] if n['label'] == 'Role']

# 标准化岗位名称和地点
for node in role_nodes:
    total_roles += 1
    node['properties']['_core_name'] = normalize_role_name(node['properties']['name'])
    node['properties']['_city'] = extract_location(node['properties'].get('location', ''))

# 按(核心名称, 城市)分组
role_groups = defaultdict(list)
for node in role_nodes:
    key = (node['properties']['_core_name'], node['properties']['_city'])
    role_groups[key].append(node)

role_id_mapping = {}
roles_removed = set()
role_merge_count = 0

for key, nodes in role_groups.items():
    if len(nodes) > 1:
        keeper = nodes[0]

        # 收集所有属性进行合并
        all_names = set()
        all_salaries = []
        all_educations = set()
        all_locations = set()

        for node in nodes:
            # 保留原始名称
            all_names.add(node['properties']['name'])
            # 收集薪资
            if 'salary' in node['properties']:
                all_salaries.append(parse_salary(node['properties']['salary']))
            # 收集学历
            if 'education' in node['properties']:
                all_educations.add(node['properties']['education'])
            # 收集地点
            if 'location' in node['properties']:
                all_locations.add(node['properties']['location'])

        # 更新keeper的属性
        keeper['properties']['name'] = key[0]  # 使用核心名称
        keeper['properties']['_original_names'] = list(all_names)
        keeper['properties']['salary'] = merge_salaries(all_salaries)
        keeper['properties']['education'] = '/'.join(sorted(all_educations)) if all_educations else '本科'
        keeper['properties']['location'] = key[1]  # 城市级别
        keeper['properties']['_merge_count'] = len(nodes)

        for dup in nodes[1:]:
            role_id_mapping[dup['id']] = keeper['id']
            roles_removed.add(dup['id'])
            role_merge_count += 1
    else:
        # 单个节点也更新名称
        nodes[0]['properties']['name'] = key[0]

print(f"总岗位数: {total_roles}")
print(f"岗位合并数: {role_merge_count}")

# 4. 边的处理
print("\n" + "=" * 60)
print("阶段4: 边的融合")
print("=" * 60)

original_edge_count = len(data['edges'])
edge_dict = {}
removed_edges = 0

for edge in data['edges']:
    new_source = edge['source']
    new_target = edge['target']

    # 映射source
    if new_source in skill_id_mapping:
        new_source = skill_id_mapping[new_source]
    if new_source in role_id_mapping:
        new_source = role_id_mapping[new_source]

    # 映射target
    if new_target in skill_id_mapping:
        new_target = skill_id_mapping[new_target]
    if new_target in role_id_mapping:
        new_target = role_id_mapping[new_target]

    # 检查目标技能是否有效
    if edge['target'] not in valid_skill_ids and new_target not in valid_skill_ids and new_target in skills_removed:
        removed_edges += 1
        continue

    # 检查目标技能是否在主流技能中（不在的直接删除边）
    if new_target in skills_removed_ids:  # 新增：目标技能不在主流列表中
        removed_edges += 1
        continue
    # 检查节点是否还存在
    if new_source in roles_removed or new_target in roles_removed:
        # 如果源或目标已被合并到其他节点
        if new_source in roles_removed:
            if new_source in role_id_mapping:
                new_source = role_id_mapping[new_source]
            else:
                removed_edges += 1
                continue
        if new_target in roles_removed:
            if new_target in role_id_mapping:
                new_target = role_id_mapping[new_target]
            else:
                removed_edges += 1
                continue

    # 边去重与权重合并
    edge_key = (new_source, new_target, edge['label'])

    if edge_key in edge_dict:
        # 累加权重
        existing = edge_dict[edge_key]
        existing_weight = existing['properties'].get('weight', 0)
        current_weight = edge['properties'].get('weight', 0)

        # 权重累加（因为融合同类实体，关系也应该是相同的）
        existing['properties']['weight'] = existing_weight + current_weight

        # 熟练度取最高级别
        proficiency_order = ['了解', '熟悉', '精通', '专家']
        existing_prof = existing['properties'].get('proficiency', '了解')
        current_prof = edge['properties'].get('proficiency', '了解')
        if proficiency_order.index(current_prof) > proficiency_order.index(existing_prof):
            existing['properties']['proficiency'] = current_prof

        removed_edges += 1
        continue

    edge['source'] = new_source
    edge['target'] = new_target
    edge_dict[edge_key] = edge

new_edges = list(edge_dict.values())

for edge in new_edges:
    weight = edge['properties'].get('weight', 1)
    if weight == 1:
        edge['properties']['proficiency'] = '了解'
    elif weight < 5:
        edge['properties']['proficiency'] = '熟悉'
    else:
        edge['properties']['proficiency'] = '精通'

print(f"原始边数: {original_edge_count}")
print(f"合并后边数: {len(new_edges)}")
print(f"删除边数: {original_edge_count - len(new_edges)}")

# 5. 构建最终结果
print("\n" + "=" * 60)
print("阶段5: 生成最终结果")
print("=" * 60)

all_removed = roles_removed | skills_removed | skills_removed_ids
new_nodes = []

for node in data['nodes']:
    if node['id'] not in all_removed:
        # 清理临时属性
        props = node['properties']
        if '_core_name' in props:
            del props['_core_name']
        if '_city' in props:
            del props['_city']
        # 保留原始名称列表（可选）
        if '_original_names' in props:
            del props['_original_names']
        if '_merge_count' in props:
            del props['_merge_count']
        new_nodes.append(node)

role_nodes_result = [n for n in new_nodes if n['label'] == 'Role']
skill_nodes_result = [n for n in new_nodes if n['label'] == 'Skill']

# 构建旧ID到新ID的映射
id_remapping = {}

# 角色节点重新编号
for i, node in enumerate(role_nodes_result, 1):
    old_id = node['id']
    new_id = f'r_{i}'
    id_remapping[old_id] = new_id
    node['id'] = new_id

# 技能节点重新编号
for i, node in enumerate(skill_nodes_result, 1):
    old_id = node['id']
    new_id = f's_{i}'
    id_remapping[old_id] = new_id
    node['id'] = new_id

# 更新边中的source和target引用
for edge in new_edges:
    old_source = edge['source']
    old_target = edge['target']
    if old_source in id_remapping:
        edge['source'] = id_remapping[old_source]
    if old_target in id_remapping:
        edge['target'] = id_remapping[old_target]

# 重新组合节点
new_nodes = role_nodes_result + skill_nodes_result

result = {
    "nodes": new_nodes,
    "edges": new_edges,
    "stats": {
        "total_nodes": len(new_nodes),
        "role_count": len([n for n in new_nodes if n['label'] == 'Role']),
        "skill_count": len([n for n in new_nodes if n['label'] == 'Skill']),
        "total_edges": len(new_edges),
        "removed_skills": list(removed_skills_name)[:50],  # 只保留前50个
        "merge_summary": {
            "skill_merges": skill_merge_count,
            "role_merges": role_merge_count,
            "edge_merges": original_edge_count - len(new_edges)
        }
    }
}

# 保存
with open('knowledge_graph_optimized.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# 6. 详细统计
print("\n" + "=" * 60)
print("最终统计")
print("=" * 60)
print(f"节点总数: {len(new_nodes)}")
print(f"  岗位节点: {len([n for n in new_nodes if n['label'] == 'Role'])}")
print(f"  技能节点: {len([n for n in new_nodes if n['label'] == 'Skill'])}")
print(f"边总数: {len(new_edges)}")
print(f"技能合并: {skill_merge_count}")
print(f"岗位合并: {role_merge_count}")
print(f"边合并: {original_edge_count - len(new_edges)}")

# 打印岗位分类统计
print("\n--- 岗位分类统计 ---")
role_stats = defaultdict(int)
for node in new_nodes:
    if node['label'] == 'Role':
        role_stats[node['properties']['name']] += 1

for name, count in sorted(role_stats.items(), key=lambda x: -x[1])[:20]:
    print(f"  {name}: {count}个")

# 打印技能列表
print("\n--- 保留的技能列表 (Top 50) ---")
skills_list = sorted(set(
    n['properties']['name'] for n in new_nodes if n['label'] == 'Skill'
))
for i, skill in enumerate(skills_list[:50]):
    print(f"  {i + 1}. {skill}")
print(f"  ... 共 {len(skills_list)} 个技能")

print("\n" + "=" * 60)
print("知识融合完成！结果保存到 knowledge_graph_optimized.json")
print("=" * 60)