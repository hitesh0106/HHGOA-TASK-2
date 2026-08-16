import json
import pyarrow.parquet as pq
from pathlib import Path

print("==================================================")
print("1. INSPECTING data/msmarco-xi-subset.json")
print("==================================================")

json_path = Path("data/msmarco-xi-subset.json")
if json_path.exists():
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    docs = data.get("docs", [])
    print(f"File exists: YES ({json_path.stat().st_size} bytes)")
    print(f"Total records: {len(docs)}")
    unique_ids = {d.get("id") for d in docs}
    print(f"Unique IDs count: {len(unique_ids)}")
    if docs:
        print(f"Schema fields: {list(docs[0].keys())}")
        print("\n--- FIRST 5 RECORDS ---")
        print(json.dumps(docs[:5], indent=2))
        print("\n--- 10 REAL QUERY + ANSWER PAIRS ---")
        for i, d in enumerate(docs[:10]):
            print(f"{i+1}. Query:  {d.get('query')}")
            print(f"   Answer: {d.get('answer')}")
            print(f"   Source: {d.get('source')} | Split: {d.get('split')} | ID: {d.get('id')}\n")
else:
    print("File exists: NO")

print("\n==================================================")
print("2. INSPECTING data/sanval.parquet")
print("==================================================")

parquet_path = Path("data/sanval.parquet")
if parquet_path.exists():
    pf = pq.ParquetFile(parquet_path)
    metadata = pf.metadata
    schema = pf.schema
    print(f"File exists: YES ({parquet_path.stat().st_size} bytes)")
    print(f"Total rows: {metadata.num_rows}")
    print(f"Row groups count: {metadata.num_row_groups}")
    print(f"Columns: {schema.names}")
    
    # Read first row group (top 5 records)
    table = pf.read_row_group(0)
    df = table.to_pandas()
    print("\n--- FIRST 5 PARQUET RECORDS ---")
    for i, row in df.head(5).iterrows():
        print(f"Row {i+1}:")
        q_str = str(row.get('query')).encode('ascii', 'ignore').decode('ascii')
        a_str = str(row.get('Answer')).encode('ascii', 'ignore').decode('ascii')
        pos_str = str(row.get('positive_passages')).encode('ascii', 'ignore').decode('ascii')
        print(f"  query: {q_str[:60]}")
        print(f"  Answer: {a_str[:60]}")
        print(f"  positive_passages: {pos_str[:120]}...")
else:
    print("File exists: NO")
