import json
import os
from neo4j import GraphDatabase
from datetime import datetime

class StandardGraphImporter:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def clear_db(self):
        """清空所有数据"""
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        print("✓ 数据库已清空")

    def create_constraints(self):
        """根据规范创建唯一约束"""
        with self.driver.session() as session:
            session.run("CREATE CONSTRAINT skill_id_unique IF NOT EXISTS FOR (s:Skill) REQUIRE (s.skill_id) IS UNIQUE")
            session.run("CREATE CONSTRAINT role_id_unique IF NOT EXISTS FOR (r:Role) REQUIRE (r.role_id) IS UNIQUE")
            session.run("CREATE CONSTRAINT company_id_unique IF NOT EXISTS FOR (c:Company) REQUIRE (c.company_id) IS UNIQUE")
            session.run("CREATE INDEX skill_name_index IF NOT EXISTS FOR (s:Skill) ON (s.name)")
            session.run("CREATE INDEX role_name_index IF NOT EXISTS FOR (r:Role) ON (r.name)")
            session.run("CREATE INDEX company_name_index IF NOT EXISTS FOR (c:Company) ON (c.name)")
        print("✓ 唯一约束与索引创建完成")

    def import_nodes(self, nodes):
        """批量导入节点"""
        skill_nodes = [n for n in nodes if n.get('label') == 'Skill']
        role_nodes = [n for n in nodes if n.get('label') == 'Role']
        company_nodes = [n for n in nodes if n.get('label') == 'Company']

        if skill_nodes:
            query = """
            UNWIND $batch AS item
            MERGE (s:Skill {skill_id: item.id})
            SET s += item.properties,
                s.import_time = datetime()
            """
            self._run_batch(query, skill_nodes)
            print(f"✓ 导入 {len(skill_nodes)} 个 Skill 节点")

        if role_nodes:
            query = """
            UNWIND $batch AS item
            MERGE (r:Role {role_id: item.id})
            SET r += item.properties,
                r.import_time = datetime()
            """
            self._run_batch(query, role_nodes)
            print(f"✓ 导入 {len(role_nodes)} 个 Role 节点")

        if company_nodes:
            query = """
            UNWIND $batch AS item
            MERGE (c:Company {company_id: item.id})
            SET c += item.properties,
                c.import_time = datetime()
            """
            self._run_batch(query, company_nodes)
            print(f"✓ 导入 {len(company_nodes)} 个 Company 节点")

    def import_edges(self, edges):
        requires_edges = [e for e in edges if e.get('label') == 'REQUIRES']
        recruits_edges = [e for e in edges if e.get('label') == 'RECRUITS']

        print(f"找到 REQUIRES 边: {len(requires_edges)} 条")

        # REQUIRES (Role -> Skill)
        if requires_edges:
            query = """
            UNWIND $batch AS edge
            MATCH (r:Role {role_id: edge.source})
            MATCH (s:Skill {skill_id: edge.target})
            MERGE (r)-[rel:REQUIRES]->(s)
            SET rel += edge.properties
            """
            self._run_batch(query, requires_edges)
            print(f"✓ 导入 {len(requires_edges)} 条 REQUIRES 关系")


    def _run_batch(self, cypher, data, batch_size=5000):
        """分批执行 UNWIND 操作"""
        total = len(data)
        for i in range(0, total, batch_size):
            batch = data[i:i+batch_size]
            with self.driver.session() as session:
                session.run(cypher, {"batch": batch})
            print(f"  已处理 {min(i+batch_size, total)} / {total}")

    def get_statistics(self):
        """统计节点和关系数量"""
        with self.driver.session() as session:
            node_result = session.run("""
                MATCH (n) 
                RETURN labels(n) AS type, count(n) AS count
                ORDER BY count DESC
            """)
            nodes_stats = {record["type"][0]: record["count"] for record in node_result}
            rel_result = session.run("""
                MATCH ()-[r]->() 
                RETURN type(r) AS type, count(r) AS count
            """)
            rel_stats = {record["type"]: record["count"] for record in rel_result}
            print("\n========== 图谱统计 ==========")
            for typ, cnt in nodes_stats.items():
                print(f"  {typ}: {cnt}")
            for typ, cnt in rel_stats.items():
                print(f"  {typ}: {cnt}")
            return nodes_stats, rel_stats

if __name__ == "__main__":
    URI = "bolt://localhost:7687"
    USER = "neo4j"
    PASSWORD = "iris5678"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "knowledge_graph_optimized.json")

    if not os.path.exists(json_path):
        print(f"错误: 找不到 {json_path}")
        exit(1)

    print(f"使用数据文件: {json_path}")

    with open(json_path, 'r', encoding='utf-8') as f:
        graph_data = json.load(f)

    if "nodes" not in graph_data or "edges" not in graph_data:
        print("错误: JSON 文件缺少 'nodes' 或 'edges' 字段")
        exit(1)

    importer = StandardGraphImporter(URI, USER, PASSWORD)

    # 清空旧数据并重新导入
    importer.clear_db()
    importer.create_constraints()
    importer.import_nodes(graph_data["nodes"])
    importer.import_edges(graph_data["edges"])
    importer.get_statistics()
    importer.close()

    print("\n知识图谱导入完成！")