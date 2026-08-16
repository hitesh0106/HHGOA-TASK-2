import os
import sys
import time
import urllib.request
from pathlib import Path

URL = "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/sanval.parquet"
OUT = os.environ.get("OUT_PARQUET", "data/sanval.parquet")
Path(OUT).parent.mkdir(parents=True, exist_ok=True)

def log(msg):
    print(msg, flush=True)
    sys.stdout.flush()

log(f"Downloading {URL}")
req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
t0 = time.time()
with urllib.request.urlopen(req, timeout=600) as resp:
    total = int(resp.headers.get("Content-Length", 0))
    log(f"Size: {total/1e6:.1f} MB")
    done = 0
    with open(OUT, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if done % (20 << 20) < (1 << 20):
                pct = (done / total * 100) if total else 0
                rate = done / (time.time() - t0) / 1e6 if time.time() > t0 else 0
                log(f"  {done/1e6:.1f} / {total/1e6:.1f} MB ({pct:.1f}%, {rate:.1f} MB/s)")
log(f"Done: {done/1e6:.1f} MB in {time.time()-t0:.1f}s")
