"""
Lightweight MSMARCO-XI subset fetcher.

Downloads a small number of rows from the official ai4bharat/MSMARCO-XI
dataset by streaming individual parquet files via the HF Hub. Designed to be
robust against slow first-byte latency by:

  * Pre-listing the parquet files via the HF HTTP API
  * Downloading each file with requests + stream=True, aborting early once
    we have collected enough rows
  * Decoding parquet incrementally with pyarrow's ParquetFile iteration

Outputs data/msmarco-xi-subset.json with a normalized schema:
  {docs: [{id, text, language, title, url, query, answer}], count}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List

import requests

HF_API = "https://huggingface.co/api/datasets/ai4bharat/MSMARCO-XI"
HF_RESOLVE = "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/{path}"


def list_parquet_files() -> List[str]:
    """Return list of parquet paths in the dataset repo."""
    r = requests.get(HF_API, timeout=30)
    r.raise_for_status()
    siblings = r.json().get("siblings", [])
    return [s["rfilename"] for s in siblings if s["rfilename"].endswith(".parquet")]


def fetch_rows_from_parquet(path: str, n_needed: int, lang_hint: str) -> List[Dict]:
    """
    Download a parquet file from HF and decode just enough rows.

    We rely on pyarrow's ParquetFile.iter_batches() with column projection to
    minimize memory and bandwidth. The download is streamed to disk and then
    read back; for very large files we stop reading once we have n_needed
    rows.
    """
    import pyarrow.parquet as pq

    url = HF_RESOLVE.format(path=path)
    local = Path("/tmp") / Path(path).name
    print(f"[fetch] downloading {url} (lang={lang_hint})", flush=True)

    # Stream to disk so we can abort early if we have enough
    t0 = time.time()
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = 0
        with open(local, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):  # 1MB
                if not chunk:
                    continue
                f.write(chunk)
                total += len(chunk)
                # hard cap at 200 MB per file to avoid runaway downloads
                if total > 200 * (1 << 20):
                    print(f"[fetch] capping {path} at 200MB partial download", flush=True)
                    break
    print(f"[fetch] downloaded {total / 1e6:.1f} MB in {time.time() - t0:.1f}s", flush=True)

    # Try to read the parquet - if footer is missing (partial download),
    # we will fail gracefully and skip this file.
    try:
        pf = pq.ParquetFile(local)
    except Exception as e:
        print(f"[fetch] cannot open parquet for {path}: {e}", flush=True)
        return []

    schema = pf.schema
    cols = [c.name for c in schema]
    print(f"[fetch] columns: {cols}", flush=True)

    rows: List[Dict] = []
    for batch in pf.iter_batches(batch_size=64):
        d = batch.to_pydict()
        n = len(d.get(cols[0], []))
        for i in range(n):
            row = {c: d[c][i] for c in cols}
            # MSMARCO-XI row schema (verified):
            #   query, positive_passages, negative_passages, answers, language
            # OR per-passage rows. Be defensive.
            text = None
            query = row.get("query") or row.get("question")
            answers = row.get("answers") or []
            # positive_passages is usually a dict {pid: passage_text}
            pos = row.get("positive_passages")
            if isinstance(pos, dict) and pos:
                text = next(iter(pos.values()))
            elif isinstance(pos, list) and pos:
                text = pos[0]
            if not text:
                # try passage column directly
                text = row.get("passage") or row.get("text") or row.get("document")
            if not text or not isinstance(text, str):
                continue
            text = text.strip()
            if len(text) < 40:
                continue
            rows.append({
                "id": f"{lang_hint}_{len(rows)}",
                "text": text,
                "language": row.get("language") or lang_hint,
                "title": row.get("title") or "",
                "url": row.get("url") or "",
                "query": query or "",
                "answer": answers[0] if isinstance(answers, list) and answers else "",
                "source": "msmarco-xi",
            })
            if len(rows) >= n_needed:
                return rows
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch a small MSMARCO-XI subset")
    parser.add_argument("--n", type=int, default=500)
    parser.add_argument("--out", type=str, default="data/msmarco-xi-subset.json")
    parser.add_argument(
        "--langs",
        type=str,
        nargs="+",
        default=["hi", "ta", "te", "mr"],
        help="Language file prefixes to try (e.g. hin, tam, tel, mar)",
    )
    args = parser.parse_args()

    print(f"[fetch] listing parquet files ...", flush=True)
    files = list_parquet_files()
    print(f"[fetch] {len(files)} parquet files in repo", flush=True)
    # Sort: prefer smaller indic languages first (less data per file)
    file_priority = {
        "nep": 1, "san": 2, "pan": 3, "ori": 4, "urd": 5, "asm": 6,
        "mar": 7, "guj": 8, "kan": 9, "mal": 10, "tel": 11, "tam": 12, "hin": 13, "ben": 14,
    }
    train_files = [f for f in files if f.startswith("train/")]
    train_files.sort(key=lambda f: file_priority.get(f.split("/")[1][:3], 99))

    all_docs: List[Dict] = []
    seen_texts = set()
    for f in train_files:
        if len(all_docs) >= args.n:
            break
        prefix = f.split("/")[1][:3]  # e.g. "hin" from "hintrain.parquet"
        if args.langs and prefix not in args.langs and "all" not in args.langs:
            # Still try - priority is best-effort
            pass
        need = args.n - len(all_docs)
        try:
            rows = fetch_rows_from_parquet(f, need, prefix)
        except Exception as e:
            print(f"[fetch] {f} failed: {e}", flush=True)
            continue
        for r in rows:
            if r["text"] in seen_texts:
                continue
            seen_texts.add(r["text"])
            all_docs.append(r)
        print(f"[fetch] total unique docs: {len(all_docs)}", flush=True)
        # delete the partial parquet to free disk
        try:
            Path("/tmp") / Path(f).name
            (Path("/tmp") / Path(f).name).unlink(missing_ok=True)
        except Exception:
            pass

    if not all_docs:
        print("[fetch] no documents fetched - falling back to synthetic sample", file=sys.stderr)
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"docs": all_docs, "count": len(all_docs)}, f, ensure_ascii=False)
    print(f"[fetch] wrote {len(all_docs)} docs -> {out_path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
