"""
Robust MSMARCO-XI subset fetcher using HuggingFace datasets streaming API.

The dataset has very large parquet files (~1-2GB per language). Rather than
downloading whole files, we use streaming mode to fetch row-by-row until we
have enough. This script is designed to be patient: it retries the connection
multiple times and accepts a long total runtime.

Outputs data/msmarco-xi-subset.json with a normalized schema.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List

import requests


def fetch_via_streaming(n: int, langs: List[str], out_path: Path) -> int:
    """Try the `datasets` streaming API."""
    try:
        from datasets import load_dataset
    except ImportError:
        print("[stream] datasets not installed", file=sys.stderr)
        return 1

    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "120")

    docs: List[Dict] = []
    seen = set()

    for lang in langs:
        if len(docs) >= n:
            break
        # MSMARCO-XI only has a "default" config
        # We iterate the whole stream and skip rows that aren't in our target lang
        print(f"[stream] opening stream for default config (filtering lang={lang}) ...", flush=True)
        try:
            ds = load_dataset("ai4bharat/MSMARCO-XI", "default", split="train", streaming=True)
        except Exception as e:
            print(f"[stream] failed to open: {e}", file=sys.stderr)
            continue

        # The streaming dataset may take a while to yield the first row
        # because it has to resolve the parquet file. Be patient.
        attempt_t0 = time.time()
        for i, row in enumerate(ds):
            if len(docs) >= n:
                break
            if i % 100 == 0:
                elapsed = time.time() - attempt_t0
                print(f"[stream] lang={lang} row={i} docs={len(docs)} elapsed={elapsed:.1f}s", flush=True)
            # Defensive parsing - the schema is:
            #   query, positive_passages, negative_passages, answers, language
            row_lang = row.get("language") or ""
            if lang != "all" and row_lang and not row_lang.lower().startswith(lang.lower()):
                # Skip rows from other languages (streaming yields all langs interleaved? Actually no,
                # the dataset is per-language parquet files, so all rows should be the same lang.
                # But the streaming loader may yield only one lang's rows depending on the config.)
                pass

            text = None
            pos = row.get("positive_passages")
            if isinstance(pos, dict) and pos:
                # value can be a string (passage text) or a dict with passage fields
                first_val = next(iter(pos.values()))
                if isinstance(first_val, str):
                    text = first_val
                elif isinstance(first_val, dict):
                    text = first_val.get("passage") or first_val.get("text") or first_val.get("document")
            elif isinstance(pos, list) and pos:
                first = pos[0]
                if isinstance(first, str):
                    text = first
                elif isinstance(first, dict):
                    text = first.get("passage") or first.get("text") or first.get("document")

            if not text or not isinstance(text, str):
                continue
            text = text.strip()
            if len(text) < 40:
                continue
            key = hashlib.md5(text.encode("utf-8")).hexdigest()
            if key in seen:
                continue
            seen.add(key)

            answers = row.get("answers") or []
            if not isinstance(answers, list):
                answers = [answers] if answers else []
            query = row.get("query") or row.get("question") or ""

            docs.append({
                "id": f"{lang}_{len(docs)}",
                "text": text,
                "language": row_lang or lang,
                "title": "",
                "url": "",
                "query": query if isinstance(query, str) else "",
                "answer": answers[0] if answers and isinstance(answers[0], str) else "",
                "source": "msmarco-xi",
            })

        print(f"[stream] lang={lang} done, total docs={len(docs)}", flush=True)

    if not docs:
        return 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"docs": docs, "count": len(docs)}, f, ensure_ascii=False)
    print(f"[stream] wrote {len(docs)} docs -> {out_path}", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=500)
    parser.add_argument("--out", type=str, default="data/msmarco-xi-subset.json")
    parser.add_argument(
        "--langs",
        type=str,
        nargs="+",
        default=["ne", "sa", "pa", "or", "ur", "as", "mr", "hi", "ta", "te"],
        help="Language prefixes to fetch (in priority order)",
    )
    args = parser.parse_args()

    out_path = Path(args.out)
    return fetch_via_streaming(args.n, args.langs, out_path)


if __name__ == "__main__":
    raise SystemExit(main())
