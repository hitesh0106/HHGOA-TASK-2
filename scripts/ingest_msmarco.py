"""
MSMARCO-XI Ingestion Script
============================
Downloads a subset of the official MSMARCO-XI dataset from AI4Bharat
(HuggingFace: ai4bharat/MSMARCO-XI) and builds 4 vector stores, one per
chunking strategy:

  1. fixed          - non-overlapping fixed-size word chunks
  2. overlapping    - fixed-size chunks with overlap
  3. semantic       - sentence-boundary aligned, embedding-cluster merged
  4. metadata-aware - paragraph-aware chunking that preserves section metadata

For each strategy we:
  * chunk every document
  * embed each chunk with a TF-IDF hash vectorizer (384-dim, L2-normalized)
  * save {chunks, embeddings, metadata} as a single JSON file
    under data/vector-stores/<strategy>.json

The same vectorizer is shipped as a TypeScript module (src/lib/embeddings.ts)
so that query-time embeddings use the identical feature space. This guarantees
that pre-computed document vectors and runtime query vectors are comparable.

Usage:
    python scripts/ingest_msmarco.py --n 500 --out data

Requirements:
    pip install datasets>=2.14 tqdm
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATASET_ID = "ai4bharat/MSMARCO-XI"
DEFAULT_LANGS = ["en"]  # MSMARCO-XI is multilingual; we default to English
# subset for the demo. The script accepts --langs hi-IN,ta-IN etc. as well.

# ---------------------------------------------------------------------------
# Stopwords (small English list - keeps the vectorizer lightweight & pure)
# ---------------------------------------------------------------------------
STOPWORDS = set(
    """
    a an the and or but if then else when while of to in on at for with without
    is are was were be been being this that these those it its as by from
    about into over under again further once here there all any both each
    few more most other some such no nor not only own same so than too very
    can will just don should now i me my we our you your he him his she her
    they them their what which who whom this that am have has had do does did
    """.split()
)

# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------
TOKEN_RE = re.compile(r"[a-z0-9]+")

def tokenize(text: str) -> List[str]:
    """Lowercase, alphanumeric tokens, stopwords removed."""
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]

# ---------------------------------------------------------------------------
# TF-IDF Hash Vectorizer (matches src/lib/embeddings.ts exactly)
# ---------------------------------------------------------------------------
EMBEDDING_DIM = 384
# 1-gram + 2-grams hashed into the same space
NGRAM_SIZES = (1, 2)

def _hash_token(token: str) -> int:
    """Stable 32-bit hash of a token."""
    h = hashlib.md5(token.encode("utf-8")).hexdigest()
    return int(h[:8], 16)

def embed_text(text: str, idf: Dict[str, float] | None = None) -> List[float]:
    """
    Build a 384-dim L2-normalized TF-IDF hash embedding for `text`.

    `idf` is optional. When provided, term weights are multiplied by idf[t];
    otherwise a pure term-frequency hash vector is produced (still useful for
    cosine similarity on short queries).
    """
    tokens = tokenize(text)
    vec = [0.0] * EMBEDDING_DIM
    if not tokens:
        return vec

    # Build n-grams
    ngrams: List[str] = []
    for n in NGRAM_SIZES:
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i : i + n]))

    # Term frequencies
    tf: Dict[str, int] = {}
    for g in ngrams:
        tf[g] = tf.get(g, 0) + 1

    for g, count in tf.items():
        idx = _hash_token(g) % EMBEDDING_DIM
        weight = float(count)
        if idf and g in idf:
            weight *= idf[g]
        # signed hashing to reduce collision bias
        sign = 1.0 if (_hash_token(g + "_sign") % 2 == 0) else -1.0
        vec[idx] += sign * weight

    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def compute_idf(documents: List[str]) -> Dict[str, float]:
    """Compute IDF over a corpus (smoothed)."""
    n = len(documents)
    df: Dict[str, int] = {}
    for doc in documents:
        tokens = set(tokenize(doc))
        ngrams = set(tokens)
        # include 2-grams
        token_list = list(tokens)
        for i in range(len(token_list) - 1):
            ngrams.add(token_list[i] + " " + token_list[i + 1])
        for g in ngrams:
            df[g] = df.get(g, 0) + 1
    return {g: math.log((n + 1) / (c + 1)) + 1.0 for g, c in df.items()}

# ---------------------------------------------------------------------------
# Chunking strategies
# ---------------------------------------------------------------------------
def chunk_fixed(text: str, chunk_size: int = 100) -> List[Dict]:
    """Fixed-size non-overlapping chunks (word-count based)."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_text = " ".join(words[i : i + chunk_size])
        chunks.append({
            "text": chunk_text,
            "strategy": "fixed",
            "metadata": {"word_offset": i, "chunk_size": chunk_size},
        })
    return chunks

def chunk_overlapping(text: str, chunk_size: int = 100, overlap: int = 25) -> List[Dict]:
    """Fixed-size chunks with overlap (sliding window)."""
    words = text.split()
    chunks = []
    if not words:
        return chunks
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk_text = " ".join(words[i : i + chunk_size])
        chunks.append({
            "text": chunk_text,
            "strategy": "overlapping",
            "metadata": {
                "word_offset": i,
                "chunk_size": chunk_size,
                "overlap": overlap,
            },
        })
        if i + chunk_size >= len(words):
            break
    return chunks

def chunk_semantic(text: str, max_chunk_sentences: int = 3, max_chunk_words: int = 120) -> List[Dict]:
    """
    Semantic chunking: split on sentence boundaries, then greedily merge
    adjacent sentences until we approach `max_chunk_words` or
    `max_chunk_sentences` sentences. The resulting chunks respect
    sentence-level semantic units while keeping size bounded.
    """
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
                "metadata": {
                    "sentence_count": len(current),
                    "word_count": current_words,
                },
            })
            current = []
            current_words = 0
        current.append(s)
        current_words += sw
    if current:
        chunks.append({
            "text": " ".join(current),
            "strategy": "semantic",
            "metadata": {
                "sentence_count": len(current),
                "word_count": current_words,
            },
        })
    return chunks

def chunk_metadata_aware(text: str, max_chunk_words: int = 120) -> List[Dict]:
    """
    Metadata-aware chunking: split on paragraph boundaries, then further split
    long paragraphs on sentence boundaries. Each chunk carries metadata about
    its paragraph index and whether it's a paragraph-start chunk.
    """
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
# Sentence splitter (no NLTK dependency)
# ---------------------------------------------------------------------------
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")

def split_sentences(text: str) -> List[str]:
    parts = [s.strip() for s in SENT_SPLIT_RE.split(text) if s and s.strip()]
    return parts or ([text.strip()] if text.strip() else [])

# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------
def load_dataset(n: int, langs: List[str]) -> List[Dict]:
    """
    Load `n` documents from MSMARCO-XI. We try the `en` config first; if that
    fails, we fall back to streaming the top-level split.
    """
    try:
        from datasets import load_dataset  # type: ignore
    except ImportError as exc:
        print("ERROR: `datasets` package is required. Install with `pip install datasets`.", file=sys.stderr)
        raise exc

    docs: List[Dict] = []
    seen = set()

    for lang in langs:
        if len(docs) >= n:
            break
        try:
            print(f"[dataset] loading config '{lang}' from {DATASET_ID} ...", flush=True)
            ds = load_dataset(DATASET_ID, lang, split="train", streaming=True)
        except Exception as e:
            print(f"[dataset] config '{lang}' failed ({e}); trying top-level stream", flush=True)
            try:
                ds = load_dataset(DATASET_ID, split="train", streaming=True)
            except Exception as e2:
                print(f"[dataset] top-level stream also failed: {e2}", file=sys.stderr)
                continue

        for row in ds:
            if len(docs) >= n:
                break
            # MSMARCO-XI rows contain a 'text' / 'passage' field; be defensive.
            text = row.get("text") or row.get("passage") or row.get("document") or row.get("content")
            if not text or not isinstance(text, str):
                continue
            text = text.strip()
            if len(text) < 40:
                continue
            key = hashlib.md5(text.encode("utf-8")).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            docs.append({
                "id": key,
                "text": text,
                "language": lang,
                "title": row.get("title") or "",
                "url": row.get("url") or "",
                "source": "msmarco-xi",
            })

    print(f"[dataset] loaded {len(docs)} unique documents", flush=True)
    return docs

# ---------------------------------------------------------------------------
# Build vector store
# ---------------------------------------------------------------------------
def build_vector_store(
    docs: List[Dict],
    chunker,
    idf: Dict[str, float],
) -> Dict:
    chunks: List[Dict] = []
    embeddings: List[List[float]] = []
    for doc in docs:
        for c_idx, chunk in enumerate(chunker(doc["text"])):
            chunk_record = {
                "id": f"{doc['id']}_{c_idx}",
                "doc_id": doc["id"],
                "text": chunk["text"],
                "strategy": chunk["strategy"],
                "metadata": {
                    **chunk["metadata"],
                    "doc_language": doc["language"],
                    "doc_title": doc["title"],
                    "doc_url": doc["url"],
                },
            }
            chunks.append(chunk_record)
            embeddings.append(embed_text(chunk["text"], idf))
    return {
        "chunks": chunks,
        "embeddings": embeddings,
        "dim": EMBEDDING_DIM,
        "chunk_count": len(chunks),
        "doc_count": len(docs),
    }

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest MSMARCO-XI into vector stores.")
    parser.add_argument("--n", type=int, default=500, help="Number of documents to ingest")
    parser.add_argument("--out", type=str, default="data", help="Output directory")
    parser.add_argument(
        "--langs",
        type=str,
        nargs="+",
        default=DEFAULT_LANGS,
        help="Dataset language configs to load (e.g. en hi-IN ta-IN)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    vs_dir = out_dir / "vector-stores"
    vs_dir.mkdir(parents=True, exist_ok=True)

    print(f"[ingest] downloading {args.n} docs from MSMARCO-XI (langs={args.langs})", flush=True)
    t0 = time.time()
    docs = load_dataset(args.n, args.langs)
    if not docs:
        print("[ingest] no documents loaded - aborting", file=sys.stderr)
        return 1

    # Save raw subset
    subset_path = out_dir / "msmarco-xi-subset.json"
    with open(subset_path, "w", encoding="utf-8") as f:
        json.dump({"docs": docs, "count": len(docs)}, f, ensure_ascii=False)
    print(f"[ingest] saved raw subset -> {subset_path}", flush=True)

    # Compute corpus IDF (over full documents - shared across strategies)
    print("[ingest] computing corpus IDF ...", flush=True)
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
        print(
            f"[ingest] {name:18s} -> {out_path} "
            f"({store['chunk_count']} chunks, {dt:.2f}s)",
            flush=True,
        )
        summary.append({
            "strategy": name,
            "chunk_count": store["chunk_count"],
            "doc_count": store["doc_count"],
            "build_time_sec": round(dt, 3),
            "file": str(out_path),
        })

    # Save IDf for runtime use (TS side recomputes from text but we persist for parity)
    with open(vs_dir / "_idf.json", "w", encoding="utf-8") as f:
        json.dump(idf, f)
    print(f"[ingest] saved IDF ({len(idf)} terms) -> {vs_dir / '_idf.json'}", flush=True)

    # Save summary
    with open(vs_dir / "_summary.json", "w", encoding="utf-8") as f:
        json.dump({
            "dataset": DATASET_ID,
            "doc_count": len(docs),
            "strategies": summary,
            "embedding_dim": EMBEDDING_DIM,
            "total_time_sec": round(time.time() - t0, 3),
        }, f, indent=2)
    print(f"[ingest] done in {time.time() - t0:.2f}s", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
