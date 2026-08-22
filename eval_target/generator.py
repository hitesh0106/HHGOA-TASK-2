"""
Generator module for rag-local-eval-loop.
Port of src/lib/llm/harness.ts (Fast Local Grounded Synthesizer).
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any, List, Sequence, Set

@dataclass
class GeneratedAnswer:
    text: str
    grounded: bool
    generation_ms: float
    model: str = "fast-local-grounded-synthesizer"

# ---------------------------------------------------------------------------
# Stopwords and Tokenization Helpers (matches src/lib/dataset-index.ts)
# ---------------------------------------------------------------------------
STOPWORDS: Set[str] = set(
    """
    a an the and or but if then else when while of to in on at for with without
    is are was were be been being this that these those it its as by from
    about into over under again further once here there all any both each
    few more most other some such no nor not only own same so than too very
    can will just don should now i me my we our you your he him his she her
    they them their what which who whom am have has had do does did
    vs versus between difference differences compare comparing
    """.strip().split()
)

AUXILIARY_QUESTION_WORDS: Set[str] = {
    "mean", "meaning", "define", "definition", "defined", "defines", "defin",
    "does", "did", "do", "can", "could", "would", "should", "tell", "explain",
    "describe", "show", "give", "please", "what", "when", "where", "which",
    "who", "whom", "whose", "why", "how", "long", "many", "much", "take",
    "takes", "operate", "operates", "oper", "vs", "versus", "between",
    "difference", "differences", "compare", "comparing", "someone", "anybody", "people",
}

CONVERSATIONAL_PREFIXES = [
    re.compile(r"^can\s+(you|someone|anybody)\s+(please\s+)?(tell\s+me|explain|show\s+me|describe|give\s+me)\s+", re.I),
    re.compile(r"^(please\s+)?(tell\s+me|explain\s+to\s+me|describe|show\s+me)\s+", re.I),
    re.compile(r"^(do\s+you\s+know|what\s+do\s+you\s+know\s+about)\s+", re.I),
    re.compile(r"^(can\s+i\s+know|i\s+want\s+to\s+know)\s+", re.I),
    re.compile(r"^what\s+exactly\s+(is|are)\s+", re.I),
    re.compile(r"^what\s+(is|are|was|were)\s+the\s+", re.I),
    re.compile(r"^what\s+(is|are|was|were)\s+a\s+", re.I),
    re.compile(r"^what\s+(is|are|was|were)\s+", re.I),
]

def normalize_query_string(q: str) -> str:
    cleaned = q.strip().lower()
    cleaned = re.sub(r"^[.\s,?!:;'\"-]+", "", cleaned)
    cleaned = re.sub(r"[.\s,?!:;'\"-]+$", "", cleaned)
    cleaned = re.sub(r"\bwhat's\b", "what is", cleaned)
    cleaned = re.sub(r"\bthere's\b", "there is", cleaned)
    cleaned = re.sub(r"\bhow's\b", "how is", cleaned)
    cleaned = re.sub(r"\bwhere's\b", "where is", cleaned)
    cleaned = re.sub(r"\bwho's\b", "who is", cleaned)
    cleaned = re.sub(r"\bcan't\b", "cannot", cleaned)
    cleaned = re.sub(r"\bdon't\b", "do not", cleaned)
    cleaned = re.sub(r"\bdoesn't\b", "does not", cleaned)
    cleaned = re.sub(r"\bwon't\b", "will not", cleaned)
    cleaned = re.sub(r"['’]s\b", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()

def stem_word(word: str) -> str:
    w = word.lower()
    if w.endswith("ies") and len(w) > 4: return w[:-3] + "y"
    if w.endswith("ing") and len(w) > 5: return w[:-3]
    if w.endswith("es") and len(w) > 4: return w[:-2]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3: return w[:-1]
    if w.endswith("ed") and len(w) > 4: return w[:-2]
    if w in ("fly", "flight", "flights", "flying"): return "flight"
    if w in ("married", "marry", "marriage"): return "marri"
    if w in ("defines", "definition", "define", "defined"): return "defin"
    if w in ("entities", "entity"): return "entiti"
    if w in ("service", "services"): return "servic"
    if w in ("phone", "telephone", "helpline", "contact"): return "phone"
    if w in ("travels", "travel", "traveling"): return "travel"
    if w in ("mature", "maturing", "matures"): return "matur"
    if w in ("eagles", "eagle"): return "eagl"
    if w in ("cantaloupes", "cantaloupe"): return "cantaloup"
    if w in ("corporations", "corporation"): return "corpor"
    if w in ("fast", "quickly", "speed", "velocity"): return "speed"
    return w

def tokenize_with_stemming(text: str, use_stemming: bool = True) -> List[str]:
    norm = normalize_query_string(text)
    raw_tokens = re.findall(r"\w+", norm)
    out: List[str] = []
    for t in raw_tokens:
        if len(t) > 1 and t not in STOPWORDS:
            out.append(stem_word(t) if use_stemming else t)
    return out

def get_entity_tokens(tokens: List[str]) -> List[str]:
    return [t for t in tokens if t not in AUXILIARY_QUESTION_WORDS]

SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")

def split_sentences(text: str) -> List[str]:
    parts = [s.strip() for s in SENT_SPLIT_RE.split(text) if s.strip()]
    return parts if parts else ([text.strip()] if text.strip() else [])

# ---------------------------------------------------------------------------
# Generator Implementation
# ---------------------------------------------------------------------------
def generate_answer(query: str, results: Sequence[Any]) -> GeneratedAnswer:
    """
    Synthesizes a grounded answer from retrieved context results.
    Matches synthesizeFastGroundedAnswer() in src/lib/llm/harness.ts.
    """
    t0 = time.perf_counter()

    if not results or len(results) == 0:
        return GeneratedAnswer(
            text="I don't have enough information in the retrieved context to answer this question confidently.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
        )

    q_tokens = tokenize_with_stemming(query, use_stemming=True)
    q_entities = get_entity_tokens(q_tokens)
    target_tokens = q_entities if q_entities else q_tokens

    if not target_tokens:
        return GeneratedAnswer(
            text="I don't have enough information in the retrieved context to answer this question confidently.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
        )

    @dataclass
    class ScoredCandidate:
        sentence: str
        chunk_idx: int
        score: float
        coverage: float
        missing_count: int

    candidates: List[ScoredCandidate] = []

    for c_idx, res in enumerate(results):
        text = getattr(res, "text", "")
        chunk_score = float(getattr(res, "score", 0.5))
        sentences = split_sentences(text)

        for sent in sentences:
            trimmed = sent.strip()
            if len(trimmed) < 10:
                continue

            s_tokens = tokenize_with_stemming(trimmed, use_stemming=True)
            s_token_set = set(s_tokens)

            match_count = sum(1 for tt in target_tokens if tt in s_token_set)
            coverage = match_count / len(target_tokens) if target_tokens else 0.0
            missing_count = len(target_tokens) - match_count

            # Strict entity coverage filter (matches harness.ts)
            if len(target_tokens) >= 3 and coverage < 0.50:
                continue
            if len(target_tokens) == 2 and coverage < 0.50:
                continue
            if len(target_tokens) == 1 and coverage < 1.0:
                continue

            pattern_boost = 1.0
            if re.search(r"is (defined as|a|an|the|called|known as)", trimmed, re.I) or re.search(
                r"(means|refers to|consists of|characterized by)", trimmed, re.I
            ):
                pattern_boost = 1.25
            if re.search(r"^([A-Z][a-z0-9_\s]{2,25})\s+(is|are|was|were)\s+", trimmed, re.I):
                pattern_boost = 1.35

            length_penalty = 0.85 if len(trimmed) > 250 else (0.8 if len(trimmed) < 25 else 1.0)

            score = (
                coverage * 0.55
                + (chunk_score / (c_idx + 1)) * 0.25
                + pattern_boost * 0.15
                + length_penalty * 0.05
                - missing_count * 0.05
            )

            candidates.append(
                ScoredCandidate(
                    sentence=trimmed,
                    chunk_idx=c_idx + 1,
                    score=score,
                    coverage=coverage,
                    missing_count=missing_count,
                )
            )

    if not candidates:
        # Refusal when no sentence has sufficient coverage of query terms
        return GeneratedAnswer(
            text="The provided documents do not contain sufficient information to answer this question.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
        )

    candidates.sort(key=lambda x: x.score, reverse=True)
    best = candidates[0]

    formatted_sentence = best.sentence
    if not re.search(r"[.!?।]$", formatted_sentence):
        formatted_sentence += "."

    answer_text = f"{formatted_sentence} [C{best.chunk_idx}]"

    return GeneratedAnswer(
        text=answer_text,
        grounded=True,
        generation_ms=(time.perf_counter() - t0) * 1000,
    )
