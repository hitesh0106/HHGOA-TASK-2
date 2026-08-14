#!/usr/bin/env python3
"""
Add suppressHydrationWarning to every native <button> opening tag in the
given .tsx files. This fixes hydration mismatches caused by browser extensions
(e.g. password managers) that inject attributes like fdprocessedid into
<button> elements before React hydrates.

React docs: https://react.dev/reference/dom/components/common#suppressing-unavoidable-hydration-mismatches
"""
import re
import sys
from pathlib import Path

# Files to patch
FILES = [
    "src/components/rag/navbar.tsx",
    "src/components/rag/voice-recorder.tsx",
    "src/components/rag/transcript-card.tsx",
    "src/components/rag/chunking-selector.tsx",
    "src/components/rag/retrieval-panel.tsx",
    "src/components/rag/evaluation-dashboard.tsx",
    "src/components/rag/answer-card.tsx",
    "src/components/rag/hero.tsx",
    "src/components/rag/sources.tsx",
    "src/components/rag/guardrail-status.tsx",
    "src/components/rag/system-status.tsx",
    "src/components/rag/latency-metrics.tsx",
    "src/components/rag/rag-pipeline.tsx",
    "src/app/page.tsx",
]

# Pattern: a line that is (whitespace)<button followed by whitespace/newline
# We add suppressHydrationWarning right after <button
# Also handles <button> (self-contained on one line) and <button {...props}>
PATTERN = re.compile(r"^(\s*)<button(\s|>|/)", re.MULTILINE)

def patch_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    count = 0

    def replace(m):
        nonlocal count
        indent = m.group(1)
        rest = m.group(2)
        # Check if suppressHydrationWarning is already present on the next few lines
        # (simple heuristic: check if it appears within 500 chars after this match)
        start = m.end()
        window = text[start:start + 500]
        if "suppressHydrationWarning" in window:
            return m.group(0)  # already present, skip
        count += 1
        return f"{indent}<button suppressHydrationWarning{rest}"

    new_text = PATTERN.sub(replace, text)
    if count > 0:
        path.write_text(new_text, encoding="utf-8")
    return count

def main():
    base = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    total = 0
    for rel in FILES:
        p = base / rel
        if not p.exists():
            print(f"  skip (not found): {rel}")
            continue
        n = patch_file(p)
        if n > 0:
            print(f"  patched {n} button(s) in {rel}")
            total += n
        else:
            print(f"  no changes: {rel}")
    print(f"\nTotal: {total} button(s) patched")

if __name__ == "__main__":
    main()
