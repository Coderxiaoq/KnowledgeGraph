import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

class Neo4jDatabase:
    def __init__(self):
        self._driver = None

    def connect(self):
        """建立数据库驱动连接池"""
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "12345678")
        
        try:
            self._driver = GraphDatabase.driver(uri, auth=(user, password))
            # 验证连接是否可用
            self._driver.verify_connectivity()
            print("✅ 成功连接到 Neo4j 数据库")
        except Exception as e:
            print(f"❌ Neo4j 连接失败: {e}")
            self._driver = None

    def close(self):
        """关闭驱动资源"""
        if self._driver:
            self._driver.close()
            print("🔌 Neo4j 连接已关闭")

    def get_session(self):
        """获取一个新的 Session"""
        if not self._driver:
            raise Exception("数据库驱动未初始化")
        return self._driver.session()

# 创建全局唯一的单例实例
db = Neo4jDatabase()

# 定义 FastAPI 依赖项，用于在接口中注入 Session
def get_db_session():
    session = db.get_session()
    try:
        yield session
    finally:
        session.close()