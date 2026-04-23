from neo4j import GraphDatabase
# 这只是一个测试用例，其中很多命名，如role，desc，category，甚至id的命名方式都有可能在后期改动
# ==========================================
# 1. 数据库连接配置 (请修改为你的实际密码)
# ==========================================
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "password"

# ==========================================
# 2. 准备测试数据
# ==========================================
# 节点：技能 (Skill)
skills_data = [
    {"id": "s1", "name": "Python", "category": "编程语言", "desc": "后端与AI主流语言"},
    {"id": "s2", "name": "Java", "category": "编程语言", "desc": "企业级后端绝对主力"},
    {"id": "s3", "name": "Vue 3", "category": "前端框架", "desc": "国内最火的前端框架"},
    {"id": "s4", "name": "MySQL", "category": "数据库", "desc": "关系型数据库基石"},
    {"id": "s5", "name": "Neo4j", "category": "数据库", "desc": "强大的图数据库"},
    {"id": "s6", "name": "Docker", "category": "运维与部署", "desc": "容器化标准工具"}
]

# 节点：岗位 (Role)
roles_data = [
    {"id": "r1", "name": "Python后端开发工程师", "industry": "互联网软件", "salary": "12k-25k", "desc": "负责系统后端API与核心逻辑开发"},
    {"id": "r2", "name": "Java架构师", "industry": "互联网软件", "salary": "25k-45k", "desc": "负责超大规模分布式系统设计"},
    {"id": "r3", "name": "全栈开发工程师", "industry": "互联网软件", "salary": "15k-30k", "desc": "前后端一把梭的超级多面手"},
    {"id": "r4", "name": "知识图谱算法工程师", "industry": "人工智能", "salary": "20k-40k", "desc": "负责图谱构建与图推导算法研发"}
]

# 节点：公司 (Company)
companies_data = [
    {"id": "c1", "name": "字节跳动", "scale": "大厂 (>10000人)", "location": "北京/上海/深圳", "tags": ["高薪", "节奏快", "技术大牛多"]},
    {"id": "c2", "name": "阿里灵犀互娱", "scale": "大厂 (>10000人)", "location": "广州", "tags": ["游戏业务", "福利好"]},
    {"id": "c3", "name": "某AI独角兽初创", "scale": "中型 (100-500人)", "location": "武汉", "tags": ["期权激励", "弹性工作", "扁平管理"]}
]

# 关系：岗位 -[REQUIRES]-> 技能
requires_edges = [
    {"role_id": "r1", "skill_id": "s1", "weight": 5, "is_core": True, "proficiency": "精通"}, # Python后端需要Python
    {"role_id": "r1", "skill_id": "s4", "weight": 4, "is_core": True, "proficiency": "熟悉"}, # Python后端需要MySQL
    {"role_id": "r1", "skill_id": "s6", "weight": 3, "is_core": False, "proficiency": "了解"},# Python后端最好会Docker
    {"role_id": "r2", "skill_id": "s2", "weight": 5, "is_core": True, "proficiency": "精通"}, # Java架构师需要Java
    {"role_id": "r2", "skill_id": "s4", "weight": 5, "is_core": True, "proficiency": "精通"}, # Java架构师需要MySQL精通
    {"role_id": "r3", "skill_id": "s1", "weight": 4, "is_core": True, "proficiency": "熟悉"}, # 全栈需要Python
    {"role_id": "r3", "skill_id": "s3", "weight": 4, "is_core": True, "proficiency": "熟悉"}, # 全栈需要Vue 3
    {"role_id": "r4", "skill_id": "s1", "weight": 5, "is_core": True, "proficiency": "精通"}, # 图谱算法需要Python
    {"role_id": "r4", "skill_id": "s5", "weight": 5, "is_core": True, "proficiency": "精通"}  # 图谱算法需要Neo4j
]

# 关系：公司 -[RECRUITS]-> 岗位
recruits_edges = [
    {"company_id": "c1", "role_id": "r2", "headcount": 10, "urgency": "极高"}, # 字节招Java架构
    {"company_id": "c1", "role_id": "r3", "headcount": 5, "urgency": "普通"},  # 字节招全栈
    {"company_id": "c2", "role_id": "r2", "headcount": 2, "urgency": "普通"},  # 阿里招Java架构
    {"company_id": "c3", "role_id": "r1", "headcount": 3, "urgency": "高"},    # 独角兽招Python后端
    {"company_id": "c3", "role_id": "r4", "headcount": 1, "urgency": "极高"}   # 独角兽急招图谱算法
]


# ==========================================
# 3. 核心导入逻辑 (执行 Cypher)
# ==========================================
def init_database():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    with driver.session() as session:
        # 1. 导入技能节点
        print("正在导入能力节点 (Skills)...")
        session.run("""
            UNWIND $data AS item
            MERGE (s:Skill {skill_id: item.id})
            SET s.name = item.name, 
                s.category = item.category, 
                s.description = item.desc
        """, data=skills_data)

        # 2. 导入岗位节点
        print("正在导入岗位节点 (Roles)...")
        session.run("""
            UNWIND $data AS item
            MERGE (r:Role {role_id: item.id})
            SET r.name = item.name, 
                r.industry = item.industry, 
                r.avg_salary = item.salary,
                r.description = item.desc
        """, data=roles_data)

        # 3. 导入公司节点
        print("正在导入公司节点 (Companies)...")
        session.run("""
            UNWIND $data AS item
            MERGE (c:Company {company_id: item.id})
            SET c.name = item.name, 
                c.scale = item.scale, 
                c.location = item.location,
                c.tags = item.tags
        """, data=companies_data)

        # 4. 创建 岗位->技能 的关联连线
        print("正在构建 岗位->技能 关系网...")
        session.run("""
            UNWIND $data AS item
            MATCH (r:Role {role_id: item.role_id})
            MATCH (s:Skill {skill_id: item.skill_id})
            MERGE (r)-[rel:REQUIRES]->(s)
            SET rel.weight = item.weight,
                rel.is_core = item.is_core,
                rel.proficiency = item.proficiency
        """, data=requires_edges)

        # 5. 创建 公司->岗位 的关联连线
        print("正在构建 公司->岗位 关系网...")
        session.run("""
            UNWIND $data AS item
            MATCH (c:Company {company_id: item.company_id})
            MATCH (r:Role {role_id: item.role_id})
            MERGE (c)-[rel:RECRUITS]->(r)
            SET rel.headcount = item.headcount,
                rel.urgency = item.urgency
        """, data=recruits_edges)

    driver.close()
    print("✅ 恭喜！所有测试数据已成功导入 Neo4j 图数据库。")

if __name__ == "__main__":
    init_database()