import os
import json
import uuid
import requests
import re
from datetime import datetime
from zai import ZhipuAiClient

# ==========================================
# 配置区
# ==========================================
# 初始化客户端 (确保环境变量里有 ZAI_API_KEY)
zai_client = ZhipuAiClient(api_key=os.getenv("ZAI_API_KEY"))

# 文件路径配置
INPUT_FOLDER = "./input_texts"    # 存放待处理文本的文件夹
OUTPUT_FOLDER = "./processed_kg"  # 存放生成的 JSON 数据的文件夹

# 确保文件夹存在
os.makedirs(INPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ==========================================
# 工具定义与逻辑区
# ==========================================
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
            model='glm-4.7',
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
    candidates = search_wikidata(new_entity.get('id'))
    if not candidates: return "LOCAL_" + str(uuid.uuid4()).split('-')[0]
    c_str = "\n".join([f"- QID:{c['qid']}, 名称:{c['label']}, 描述:{c['description']}" for c in candidates])
    prompt = f"判断抽取实体对应候选实体中的哪一个。上下文: {context_text}\n抽取实体: {new_entity.get('id')}\n候选:\n{c_str}\n只输出对应QID或NONE。"
    try:
        res = zai_client.chat.completions.create(model='glm-4.7', messages=[{"role": "user", "content": prompt}], temperature=0.1)
        ans = res.choices[0].message.content.strip().upper()
        match = re.search(r'Q\d+', ans)
        if match: return match.group(0)
    except: pass
    return "LOCAL_" + str(uuid.uuid4()).split('-')[0]

def run_kg_pipeline(text: str):
    kg_data = process_unstructured_text_to_kg(text)
    if not kg_data: return None
    print(f"  [Step 2] 实体链接与对齐 (Wikidata)...")
    id_mapping = {}
    for entity in kg_data.get('entities', []):
        old_name = entity['id']
        new_id = link_entity(entity, text)
        id_mapping[old_name] = new_id
        entity['kg_id'], entity['name'] = new_id, old_name
        
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