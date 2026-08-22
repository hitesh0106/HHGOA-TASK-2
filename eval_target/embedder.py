"""
Embedder module for rag-local-eval-loop.
Port of src/lib/embeddings.ts producing exact 384-dimensional L2-normalized TF-IDF hash vectors.
"""
from __future__ import annotations

import hashlib
import re
from typing import Dict, List, Sequence
import numpy as np

EMBEDDING_DIM = 384
NGRAM_SIZES = (1, 2)

STOPWORDS = set(
    """
    a an the and or but if then else when while of to in on at for with without
    is are was were be been being this that these those it its as by from
    about into over under again further once here there all any both each
    few more most other some such no nor not only own same so than too very
    can will just don should now i me my we our you your he him his she her
    they them their what which who whom this that am have has had do does did
    """.strip().split()
)

TOKEN_RE = re.compile(r"[a-z0-9]+")

def tokenize(text: str) -> List[str]:
    """Lowercase, alphanumeric tokens, stopwords removed (matches JS tokenize())."""
    lower = text.lower()
    out: List[str] = []
    for match in TOKEN_RE.finditer(lower):
        t = match.group(0)
        if len(t) > 1 and t not in STOPWORDS:
            out.append(t)
    return out

def _hash32(s: str) -> int:
    """First 8 hex chars of MD5 digest converted to 32-bit unsigned int."""
    h = hashlib.md5(s.encode("utf-8")).hexdigest()
    return int(h[:8], 16)

def _signed_hash(s: str) -> float:
    """Used for sign-flipping to reduce collision bias (matches JS signedHash())."""
    return 1.0 if (_hash32(s + "_sign") % 2 == 0) else -1.0

# In-memory IDF dictionary
_idf_map: Dict[str, float] | None = None

def set_idf(idf: Dict[str, float]) -> None:
    global _idf_map
    _idf_map = dict(idf)

def clear_idf() -> None:
    global _idf_map
    _idf_map = None

def embed_text(text: str, idf: Dict[str, float] | None = None) -> np.ndarray:
    """
    Build a 384-dimensional L2-normalized TF-IDF hash vector for `text`.
    Matches JS `embedText(text)` in src/lib/embeddings.ts down to the exact float values.
    """
    tokens = tokenize(text)
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    if not tokens:
        return vec

    # Build n-grams
    ngrams: List[str] = []
    for n in NGRAM_SIZES:
        if len(tokens) < n:
            continue
        for i in range(len(tokens) - n + 1):
            ngrams.append(" ".join(tokens[i : i + n]))

    # Term frequencies
    tf: Dict[str, int] = {}
    for g in ngrams:
        tf[g] = tf.get(g, 0) + 1

    active_idf = idf if idf is not None else _idf_map

    # Project into fixed-dim vector with signed hashing
    for g, count in tf.items():
        idx = _hash32(g) % EMBEDDING_DIM
        weight = float(count)
        if active_idf is not None and g in active_idf:
            weight *= active_idf[g]
        sign = _signed_hash(g)
        vec[idx] += sign * weight

    # L2 normalize
    norm = float(np.linalg.norm(vec))
    if norm > 0.0:
        vec /= norm

    return vec

# ---------------------------------------------------------------------------
# Required rag-local-eval-loop interface
# ---------------------------------------------------------------------------
def embed_one(text: str) -> np.ndarray:
    """Embed single text string -> shape (384,) float32."""
    return embed_text(text)

def embed(texts: Sequence[str]) -> np.ndarray:
    """Embed batch of text strings -> shape (len(texts), 384) float32."""
    if not texts:
        return np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
    return np.vstack([embed_text(t) for t in texts])

def get_model() -> str:
    """Called once to load model (no-op for deterministic hash vectorizer)."""
    return "tf-idf-hash-384"
