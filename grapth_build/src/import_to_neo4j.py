import os
import json
from neo4j import GraphDatabase

# ==========================================
# 配置区
# ==========================================
# Neo4j 数据库连接信息
NEO4J_URI = "neo4j://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "neo4j_kg" 

# 存放生成的 JSON 数据的文件夹（从这里读取）
OUTPUT_FOLDER = "../data/processed_kg"

# ==========================================
# 存储逻辑区
# ==========================================
class Neo4jStorage:
    def __init__(self, uri, user, pwd):
        self.driver = GraphDatabase.driver(uri, auth=(user, pwd))

    def upsert_knowledge_graph(self, kg_data: dict):
        if not kg_data: return
        with self.driver.session() as session:
            if kg_data.get('entities'):
                session.execute_write(self._upsert_nodes, kg_data['entities'])
            if kg_data.get('relations'):
                session.execute_write(self._upsert_edges_apoc, kg_data['relations'])

    @staticmethod
    def _upsert_nodes(tx, nodes: list):
        query = """
        UNWIND $nodes AS node
        MERGE (n:Entity {kg_id: node.kg_id})
        ON CREATE SET n.name = node.name, n.type = node.type, n.description = node.description, n.aliases = [node.name]
        ON MATCH SET n.aliases = CASE WHEN NOT node.name IN coalesce(n.aliases,[]) THEN coalesce(n.aliases,[]) + node.name ELSE n.aliases END
        """
        tx.run(query, nodes=nodes)

    @staticmethod
    def _upsert_edges_apoc(tx, edges: list):
        query = """
        UNWIND $edges AS edge
        MATCH (source:Entity {kg_id: edge.source_kg_id})
        MATCH (target:Entity {kg_id: edge.target_kg_id})
        WITH source, target, edge, toUpper(replace(edge.relation_type, ' ', '_')) AS relType
        CALL apoc.merge.relationship(source, relType, {}, {}, target, {}) YIELD rel
        RETURN count(rel)
        """
        tx.run(query, edges=edges)

# ==========================================
# 主入口
# ==========================================
if __name__ == "__main__":
    print("====== 💾 Neo4j 图数据库导入启动 ======")
    
    if not os.path.exists(OUTPUT_FOLDER):
        print(f"⚠️  找不到文件夹 {OUTPUT_FOLDER}，请先运行抽取脚本生成数据。")
        exit()
        
    json_files =[f for f in os.listdir(OUTPUT_FOLDER) if f.endswith('.json')]
    
    if not json_files:
        print(f"⚠️  在 {OUTPUT_FOLDER} 文件夹下未找到 .json 数据文件。")
    else:
        try:
            # 初始化 Neo4j 存储
            storage = Neo4jStorage(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
            
            for file_name in json_files:
                file_path = os.path.join(OUTPUT_FOLDER, file_name)
                print(f"\n📄 正在导入数据: {file_name}")
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    kg_data = json.load(f)
                
                print(f"  [Import] 写入 Neo4j 节点与关系...")
                storage.upsert_knowledge_graph(kg_data)
                print(f"✅ 文件 {file_name} 成功导入图数据库！")
                
            storage.driver.close()
            
        except Exception as e:
            print(f"❌ 运行过程中发生错误: {e}")

    print("\n🎉 所有数据导入完毕。")