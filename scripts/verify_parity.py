"""
Parity verification script: compares Python app/embedder.py and app/generator.py
against TypeScript src/lib/embeddings.ts and src/lib/llm/harness.ts.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np

# Ensure app is importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eval_target.embedder import embed_one, tokenize as py_tokenize
from eval_target.generator import generate_answer

def test_embedding_parity():
    ref_path = ROOT / "data" / "ts_parity_reference.json"
    with open(ref_path, "r", encoding="utf-8") as f:
        ref_data = json.load(f)

    print("=" * 70)
    print("EMBEDDING PARITY VERIFICATION (TypeScript vs Python)")
    print("=" * 70)

    all_passed = True

    for i, item in enumerate(ref_data, 1):
        text = item["input"]
        ts_vec = np.array(item["vector"], dtype=np.float32)
        ts_dim = item["dimension"]
        ts_norm = item["norm"]

        py_vec = embed_one(text)
        py_dim = len(py_vec)
        py_norm = float(np.linalg.norm(py_vec))

        # Check dimensions
        dim_match = (py_dim == ts_dim == 384)

        # Max absolute difference
        max_abs_diff = float(np.max(np.abs(py_vec - ts_vec)))

        # Cosine similarity
        if ts_norm > 0 and py_norm > 0:
            cos_sim = float(np.dot(py_vec, ts_vec) / (py_norm * ts_norm))
        else:
            cos_sim = 1.0 if (ts_norm == 0 and py_norm == 0) else 0.0

        passed = dim_match and max_abs_diff < 1e-6 and (cos_sim > 0.9999 or (ts_norm == 0 and py_norm == 0))
        if not passed:
            all_passed = False

        status = "✓ PASS" if passed else "✗ FAIL"
        label = f'"{text[:35]}..."' if len(text) > 35 else f'"{text}"'
        print(f"Test {i:2d}: {status} | Input: {label:<40}")
        print(f"         Dim: {py_dim} (TS: {ts_dim}) | L2 Norm: {py_norm:.6f} (TS: {ts_norm:.6f})")
        print(f"         Max Diff: {max_abs_diff:.8e} | Cosine Sim: {cos_sim:.6f}")
        print("-" * 70)

    print(f"\nOverall Embedding Parity: {'PASSED (10/10)' if all_passed else 'FAILED'}\n")
    return all_passed

def test_generator_parity():
    print("=" * 70)
    print("GENERATOR PARITY VERIFICATION (Refusal & Grounding)")
    print("=" * 70)

    class DummyContext:
        def __init__(self, text, source="test", score=0.8):
            self.text = text
            self.source = source
            self.score = score

    # Case 1: Answerable corporation query
    query1 = "What is a corporation?"
    context1 = [
        DummyContext(
            "McDonald's Corporation is a recognized company. A corporation is a company or group of people authorized to act as a single entity and recognized as such in law. Early incorporated entities were established by charter.",
            "doc_0",
            0.85
        )
    ]
    ans1 = generate_answer(query1, context1)
    print(f"Query: \"{query1}\"")
    print(f"Answer: {ans1.text}")
    print(f"Grounded: {ans1.grounded} (Expected: True)")
    print(f"Model: {ans1.model} | Latency: {ans1.generation_ms:.2f}ms")
    passed1 = ans1.grounded and "corporation is a company" in ans1.text.lower() and "[C1]" in ans1.text
    print(f"Result: {'✓ PASS' if passed1 else '✗ FAIL'}\n")

    # Case 2: Unanswerable query (no match in context)
    query2 = "What is the capital of Mars?"
    context2 = [
        DummyContext(
            "McDonald's Corporation is a company. It sells fast food burgers and fries across 100 countries.",
            "doc_0",
            0.15
        )
    ]
    ans2 = generate_answer(query2, context2)
    print(f"Query: \"{query2}\"")
    print(f"Answer: {ans2.text}")
    print(f"Grounded: {ans2.grounded} (Expected: False - Refusal)")
    print(f"Model: {ans2.model} | Latency: {ans2.generation_ms:.2f}ms")
    passed2 = not ans2.grounded and "not contain sufficient information" in ans2.text.lower()
    print(f"Result: {'✓ PASS' if passed2 else '✗ FAIL'}\n")

    # Case 3: Empty results (refusal)
    ans3 = generate_answer("any query", [])
    passed3 = not ans3.grounded
    print(f"Empty results refusal: {'✓ PASS' if passed3 else '✗ FAIL'}\n")

    all_gen_passed = passed1 and passed2 and passed3
    print(f"Overall Generator Parity: {'PASSED (3/3)' if all_gen_passed else 'FAILED'}\n")
    return all_gen_passed

if __name__ == "__main__":
    emb_ok = test_embedding_parity()
    gen_ok = test_generator_parity()
    if not (emb_ok and gen_ok):
        sys.exit(1)
