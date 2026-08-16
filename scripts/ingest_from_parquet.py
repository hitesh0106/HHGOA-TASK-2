"""
Ingest MSMARCO-XI from a local parquet file.

Reads /tmp/sanval.parquet (Sanskrit validation split - 494MB, ~98k rows),
extracts the English positive passages as documents, then builds 4 vector
stores using the same TF-IDF hash embedding pipeline as the TS runtime.

Usage:
    python scripts/ingest_from_parquet.py
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List

import pyarrow.parquet as pq

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
def default_parquet_path() -> Path:
    p1 = Path("data/sanval.parquet")
    if p1.exists():
        return p1
    return Path("/tmp/sanval.parquet")

PARQUET_PATH = Path(os.environ.get("MSMARCO_PARQUET", str(default_parquet_path())))
OUT_DIR = Path(os.environ.get("OUT_DIR", "data"))
N_DOCS = int(os.environ.get("N_DOCS", "500"))
EMBEDDING_DIM = 384
NGRAM_SIZES = (1, 2)

# ---------------------------------------------------------------------------
# Tokenizer & embedding (matches src/lib/embeddings.ts)
# ---------------------------------------------------------------------------
STOPWORDS = set("""
a an the and or but if then else when while of to in on at for with without
is are was were be been being this that these those it its as by from
about into over under again further once here there all any both each
few more most other some such no nor not only own same so than too very
can will just don should now i me my we our you your he him his she her
they them their what which who whom this that am have has had do does did
""".split())

TOKEN_RE = re.compile(r"[a-z0-9]+")

def tokenize(text: str) -> List[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]

def _hash_token(token: str) -> int:
    h = hashlib.md5(token.encode("utf-8")).hexdigest()
    return int(h[:8], 16)

def embed_text(text: str, idf: Dict[str, float] | None = None) -> List[float]:
    tokens = tokenize(text)
    vec = [0.0] * EMBEDDING_DIM
    if not tokens:
        return vec
    ngrams: List[str] = []
    for n in NGRAM_SIZES:
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i:i+n]))
    tf: Dict[str, int] = {}
    for g in ngrams:
        tf[g] = tf.get(g, 0) + 1
    for g, count in tf.items():
        idx = _hash_token(g) % EMBEDDING_DIM
        weight = float(count)
        if idf and g in idf:
            weight *= idf[g]
        sign = 1.0 if (_hash_token(g + "_sign") % 2 == 0) else -1.0
        vec[idx] += sign * weight
    norm = math.sqrt(sum(v*v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def compute_idf(documents: List[str]) -> Dict[str, float]:
    n = len(documents)
    df: Dict[str, int] = {}
    for doc in documents:
        tokens = set(tokenize(doc))
        ngrams = set(tokens)
        token_list = list(tokens)
        for i in range(len(token_list) - 1):
            ngrams.add(token_list[i] + " " + token_list[i+1])
        for g in ngrams:
            df[g] = df.get(g, 0) + 1
    return {g: math.log((n + 1) / (c + 1)) + 1.0 for g, c in df.items()}

# ---------------------------------------------------------------------------
# Chunking strategies (matches src/lib/chunking/index.ts)
# ---------------------------------------------------------------------------
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")

def split_sentences(text: str) -> List[str]:
    parts = [s.strip() for s in SENT_SPLIT_RE.split(text) if s and s.strip()]
    return parts or ([text.strip()] if text.strip() else [])

def chunk_fixed(text: str, chunk_size: int = 100) -> List[Dict]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append({
            "text": " ".join(words[i:i+chunk_size]),
            "strategy": "fixed",
            "metadata": {"word_offset": i, "chunk_size": chunk_size},
        })
    return chunks

def chunk_overlapping(text: str, chunk_size: int = 100, overlap: int = 25) -> List[Dict]:
    words = text.split()
    chunks = []
    if not words:
        return chunks
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunks.append({
            "text": " ".join(words[i:i+chunk_size]),
            "strategy": "overlapping",
            "metadata": {"word_offset": i, "chunk_size": chunk_size, "overlap": overlap},
        })
        if i + chunk_size >= len(words):
            break
    return chunks

def chunk_semantic(text: str, max_chunk_sentences: int = 3, max_chunk_words: int = 120) -> List[Dict]:
    sentences = split_sentences(text)
    chunks = []
    current: List[str] = []
    current_words = 0
    for s in sentences:
        sw = len(s.split())
        if current and (current_words + sw > max_chunk_words or len(current) >= max_chunk_sentences):
            chunks.append({
                "text": " ".join(current),
                "strategy": "semantic",
                "metadata": {"sentence_count": len(current), "word_count": current_words},
            })
            current = []
            current_words = 0
        current.append(s)
        current_words += sw
    if current:
        chunks.append({
            "text": " ".join(current),
            "strategy": "semantic",
            "metadata": {"sentence_count": len(current), "word_count": current_words},
        })
    return chunks

def chunk_metadata_aware(text: str, max_chunk_words: int = 120) -> List[Dict]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks = []
    for p_idx, para in enumerate(paragraphs):
        words = para.split()
        if len(words) <= max_chunk_words:
            chunks.append({
                "text": para,
                "strategy": "metadata-aware",
                "metadata": {
                    "paragraph_index": p_idx,
                    "paragraph_total": len(paragraphs),
                    "is_paragraph_start": True,
                    "word_count": len(words),
                },
            })
        else:
            sentences = split_sentences(para)
            current: List[str] = []
            current_words = 0
            is_start = True
            for s in sentences:
                sw = len(s.split())
                if current and current_words + sw > max_chunk_words:
                    chunks.append({
                        "text": " ".join(current),
                        "strategy": "metadata-aware",
                        "metadata": {
                            "paragraph_index": p_idx,
                            "paragraph_total": len(paragraphs),
                            "is_paragraph_start": is_start,
                            "word_count": current_words,
                        },
                    })
                    current = []
                    current_words = 0
                    is_start = False
                current.append(s)
                current_words += sw
            if current:
                chunks.append({
                    "text": " ".join(current),
                    "strategy": "metadata-aware",
                    "metadata": {
                        "paragraph_index": p_idx,
                        "paragraph_total": len(paragraphs),
                        "is_paragraph_start": is_start,
                        "word_count": current_words,
                    },
                })
    return chunks

# ---------------------------------------------------------------------------
# Build vector store
# ---------------------------------------------------------------------------
def build_vector_store(docs: List[Dict], chunker, idf: Dict[str, float]) -> Dict:
    chunks: List[Dict] = []
    embeddings: List[List[float]] = []
    for doc in docs:
        for c_idx, chunk in enumerate(chunker(doc["text"])):
            chunks.append({
                "id": f"{doc['id']}_{c_idx}",
                "doc_id": doc["id"],
                "text": chunk["text"],
                "strategy": chunk["strategy"],
                "metadata": {
                    **chunk["metadata"],
                    "doc_language": doc["language"],
                    "doc_title": doc["title"],
                    "doc_url": doc["url"],
                    "doc_source_query": doc.get("query", ""),
                },
            })
            embeddings.append(embed_text(chunk["text"], idf))
    return {
        "chunks": chunks,
        "embeddings": embeddings,
        "dim": EMBEDDING_DIM,
        "chunk_count": len(chunks),
        "doc_count": len(docs),
    }

# ---------------------------------------------------------------------------
# Extract documents from parquet
# ---------------------------------------------------------------------------
def extract_docs(parquet_path: Path, n: int) -> List[Dict]:
    """Extract positive English passages as documents."""
    print(f"[extract] opening {parquet_path}", flush=True)
    pf = pq.ParquetFile(str(parquet_path))
    print(f"[extract] {pf.metadata.num_rows} rows, {pf.num_row_groups} row groups", flush=True)

    docs: List[Dict] = []
    seen = set()

    # Use iter_batches for memory-efficient streaming
    columns = ["query", "Eng_Query", "Eng_Answer", "Answer", "passages"]
    batch_count = 0
    for batch in pf.iter_batches(batch_size=256, columns=columns):
        if len(docs) >= n:
            break
        if batch_count == 0:
            t0 = time.time()
        d = batch.to_pydict()
        n_rows = len(d.get("query", []))
        batch_count += 1
        if batch_count % 10 == 0:
            print(f"[extract] batch {batch_count}: {n_rows} rows, total docs={len(docs)}, elapsed={time.time()-t0:.1f}s", flush=True)
        for i in range(n_rows):
            if len(docs) >= n:
                break
            query = d["query"][i] if d["query"][i] else ""
            eng_query = d["Eng_Query"][i] if d["Eng_Query"][i] else ""
            eng_answer = d["Eng_Answer"][i] if d["Eng_Answer"][i] else ""
            answer = d["Answer"][i] if d["Answer"][i] else ""
            passages = d["passages"][i] or {}

            # Passages structure: {"English_passages": [str], "Translated_passages": [str], "is_selected": [int]}
            en_passages = passages.get("English_passages") or []
            is_selected = passages.get("is_selected") or []

            # Take only positive passages (is_selected == 1)
            for p_idx, (passage, sel) in enumerate(zip(en_passages, is_selected)):
                if not sel or not passage or not isinstance(passage, str):
                    continue
                passage = passage.strip()
                if len(passage) < 40:
                    continue
                key = hashlib.md5(passage.encode("utf-8")).hexdigest()
                if key in seen:
                    continue
                seen.add(key)
                docs.append({
                    "id": f"san_{len(docs)}",
                    "text": passage,
                    "language": "sa",  # Sanskrit split, but passage text is English (original MSMARCO)
                    "title": "",
                    "url": "",
                    "query": eng_query or query,
                    "answer": eng_answer or answer,
                    "source": "msmarco-xi",
                    "split": "validation",
                    "passage_index": p_idx,
                })
                if len(docs) >= n:
                    break

    print(f"[extract] extracted {len(docs)} unique positive passages", flush=True)
    return docs

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    if not PARQUET_PATH.exists():
        print(f"ERROR: parquet file not found at {PARQUET_PATH}", file=sys.stderr)
        print("Run: curl -L -o /tmp/sanval.parquet https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/sanval.parquet", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    vs_dir = OUT_DIR / "vector-stores"
    vs_dir.mkdir(parents=True, exist_ok=True)

    print(f"[ingest] extracting {N_DOCS} docs from {PARQUET_PATH}", flush=True)
    t0 = time.time()
    docs = extract_docs(PARQUET_PATH, N_DOCS)
    if not docs:
        print("[ingest] no documents extracted - aborting", file=sys.stderr)
        return 1

    # Save raw subset
    subset_path = OUT_DIR / "msmarco-xi-subset.json"
    with open(subset_path, "w", encoding="utf-8") as f:
        json.dump({"docs": docs, "count": len(docs)}, f, ensure_ascii=False)
    print(f"[ingest] saved raw subset -> {subset_path}", flush=True)

    # Compute IDF
    print("[ingest] computing IDF ...", flush=True)
    idf = compute_idf([d["text"] for d in docs])

    # Build all 4 stores
    strategies = [
        ("fixed", chunk_fixed),
        ("overlapping", chunk_overlapping),
        ("semantic", chunk_semantic),
        ("metadata-aware", chunk_metadata_aware),
    ]
    summary = []
    for name, fn in strategies:
        t1 = time.time()
        store = build_vector_store(docs, fn, idf)
        dt = time.time() - t1
        out_path = vs_dir / f"{name}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(store, f)
        print(f"[ingest] {name:18s} -> {out_path} ({store['chunk_count']} chunks, {dt:.2f}s)", flush=True)
        summary.append({
            "strategy": name,
            "chunk_count": store["chunk_count"],
            "doc_count": store["doc_count"],
            "build_time_sec": round(dt, 3),
            "file": str(out_path),
        })

    with open(vs_dir / "_idf.json", "w", encoding="utf-8") as f:
        json.dump(idf, f)
    print(f"[ingest] saved IDF ({len(idf)} terms)", flush=True)

    with open(vs_dir / "_summary.json", "w", encoding="utf-8") as f:
        json.dump({
            "dataset": "ai4bharat/MSMARCO-XI",
            "split": "validation/sanval.parquet",
            "doc_count": len(docs),
            "strategies": summary,
            "embedding_dim": EMBEDDING_DIM,
            "total_time_sec": round(time.time() - t0, 3),
        }, f, indent=2)
    print(f"[ingest] done in {time.time() - t0:.2f}s", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
