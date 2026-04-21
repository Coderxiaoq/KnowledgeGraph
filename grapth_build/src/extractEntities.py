import os
import json
import uuid
import requests
import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from zai import ZhipuAiClient

# ==========================================
# 配置区
# ==========================================
# 初始化客户端 (确保环境变量里有 ZAI_API_KEY)
zai_client = ZhipuAiClient(api_key=os.getenv("ZAI_API_KEY"))

# 文件路径配置
INPUT_FOLDER = "grapth_build\data\input_texts"    # 存放待处理文本的文件夹
OUTPUT_FOLDER = "grapth_build\data\processsed_kg"  # 存放生成的 JSON 数据的文件夹

# 全局实体缓存，避免重复查询相同的实体
ENTITY_CACHE = {}

# 确保文件夹存在
os.makedirs(INPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ==========================================
# 工具定义与逻辑区
# ==========================================
#这是一个符合ZhipuAI函数调用规范的列表。定义了模型必须输出的 JSON 结构。
#entities: 实体数组。每个实体包含 id（名称）、type（类型，如人物/地点）、description（简述）。
#relations: 关系数组。每个关系包含 source（起点）、target（终点）、relation_type（关系类型，如“出生于”）。

kg_extraction_tools =[{
    "type": "function", "function": {
        "name": "extract_knowledge_graph",
        "description": "从非结构化文本中提取实体和关系",
        "parameters": {
            "type": "object",
            "properties": {
                "entities": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "type": {"type": "string"}, "description": {"type": "string"}}, "required":["id", "type"]}},
                "relations": {"type": "array", "items": {"type": "object", "properties": {"source": {"type": "string"}, "target": {"type": "string"}, "relation_type": {"type": "string"}}, "required":["source", "target", "relation_type"]}}
            }, "required": ["entities", "relations"]
        }
    }
}]

def process_unstructured_text_to_kg(text: str) -> dict:
    print("[Step 1] AI 抽取中...")
    try:
        response = zai_client.chat.completions.create(
            model='glm-4.5',
            messages=[{"role": "system", "content": "提取核心实体和关系。"}, {"role": "user", "content": text}],
            tools=kg_extraction_tools, tool_choice={"type": "function", "function": {"name": "extract_knowledge_graph"}},
            temperature=0.1
        )
        msg = response.choices[0].message
        if msg.tool_calls:
            return json.loads(msg.tool_calls[0].function.arguments)
    except Exception as e:
        print(f"抽取失败: {e}")
    return None

def search_wikidata(entity_name):
    try:
        url = "https://www.wikidata.org/w/api.php"
        params = {"action": "wbsearchentities", "search": entity_name, "language": "zh", "format": "json", "limit": 3}
        data = requests.get(url, params=params, timeout=5).json()
        return [{"qid": i["id"], "label": i["label"], "description": i.get("description", "无")} for i in data.get("search",[])]
    except:
        return[]


def link_entity(new_entity, context_text):
    entity_name = new_entity.get('id')
    
    # 优化：检查缓存，如果有直接返回
    if entity_name in ENTITY_CACHE:
        return entity_name, ENTITY_CACHE[entity_name]

    candidates = search_wikidata(entity_name)
    if not candidates: 
        new_id = "LOCAL_" + str(uuid.uuid4()).split('-')[0]
        ENTITY_CACHE[entity_name] = new_id
        return entity_name, new_id

    c_str = "\n".join([f"- QID:{c['qid']}, 名称:{c['label']}, 描述:{c['description']}" for c in candidates])
    prompt = f"判断抽取实体对应候选实体中的哪一个。上下文: {context_text}\n抽取实体: {entity_name}\n候选:\n{c_str}\n只输出对应QID或NONE。"
    
    try:
        res = zai_client.chat.completions.create(model='glm-4.5', messages=[{"role": "user", "content": prompt}], temperature=0.1)
        ans = res.choices[0].message.content.strip().upper()
        match = re.search(r'Q\d+', ans)
        if match: 
            new_id = match.group(0)
            ENTITY_CACHE[entity_name] = new_id
            return entity_name, new_id
    except: 
        pass
    
    new_id = "LOCAL_" + str(uuid.uuid4()).split('-')[0]
    ENTITY_CACHE[entity_name] = new_id
    return entity_name, new_id

def run_kg_pipeline(text: str):
    kg_data = process_unstructured_text_to_kg(text)
    if not kg_data: return None
    
    print(f"  [Step 2] 实体链接与对齐 (并发请求中)...")
    id_mapping = {}
    entities = kg_data.get('entities',[])
    
    # 优化：使用线程池并发进行实体链接
    # 注意：max_workers 不要设置太大，否则容易触发大模型 API 的并发限制 (Rate Limit)
    # 推荐设置为 5 到 10 之间
    with ThreadPoolExecutor(max_workers=10) as executor:
        # 提交所有任务到线程池
        futures = {executor.submit(link_entity, entity, text): entity for entity in entities}
        
        for future in as_completed(futures):
            entity = futures[future]
            try:
                # 获取返回值 (entity_name, new_id)
                old_name, new_id = future.result()
                id_mapping[old_name] = new_id
                entity['kg_id'] = new_id
                entity['name'] = old_name
            except Exception as e:
                print(f"实体 {entity.get('id')} 链接出错: {e}")
                
    for rel in kg_data.get('relations',[]):
        rel['source_kg_id'] = id_mapping.get(rel['source'], rel['source'])
        rel['target_kg_id'] = id_mapping.get(rel['target'], rel['target'])
        
    return kg_data

def save_json_data(data, filename):
    """保存处理好的结构化数据到本地 JSON"""
    output_path = os.path.join(OUTPUT_FOLDER, filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"  [Save] 结构化数据已保存至: {output_path}")

# ==========================================
# 主入口
# ==========================================
if __name__ == "__main__":
    print("====== 🚀 知识图谱信息抽取启动 ======")
    
    files =[f for f in os.listdir(INPUT_FOLDER) if f.endswith('.txt')]
    
    if not files:
        print(f"⚠️  在 {INPUT_FOLDER} 文件夹下未找到 .txt 文件，请先放入文件。")
    else:
        for file_name in files:
            file_path = os.path.join(INPUT_FOLDER, file_name)
            print(f"\n📄 正在处理文件: {file_name}")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                print(f"跳过空文件: {file_name}")
                continue

            final_cleaned_data = run_kg_pipeline(content)
            
            if final_cleaned_data:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_json_name = f"kg_output_{file_name.split('.')[0]}_{timestamp}.json"
                save_json_data(final_cleaned_data, output_json_name)
                print(f"✅ 文件 {file_name} 抽取完成！")
            else:
                print(f"❌ 文件 {file_name} 抽取失败。")
                
    print("\n🎉 所有文件抽取完毕，请运行导入脚本以存入Neo4j。")