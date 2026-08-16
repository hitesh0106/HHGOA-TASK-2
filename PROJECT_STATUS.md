# PROJECT STATUS: VOICE RAG SYSTEM (PHASE 0 DEEP VERIFICATION)
**Hacker House Goa 2026 - Task 2 Implementation Status**

---

## 1. CURRENT ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                BROWSER (Next.js)                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐   │
│  │ Mic btn  │→ │ MediaRecorder│→ │ /api/stt   │  │ Result tabs:          │  │
│  │ Recording│  │ (webm/opus)  │  │ (Sarvam)   │  │ answer / sources /    │  │
│  │ State    │  │              │  │            │  │ guardrails / latency  │  │
│  └──────────┘  └──────────────┘  └─────┬──────┘  │ context / observability│  │
│                                       │         └───────────┬──────────┘   │
│                                       │ transcript          │              │
│                                       ▼                     ▼              │
└───────────────────────────────────────┼─────────────────────┼──────────────┘
                                        │                     │
                                        ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS API ROUTES                                │
│  POST /api/stt  ──────────►  Sarvam Saaras v3  (/speech-to-text)              │
│  POST /api/rag  ──────────►  RAG pipeline orchestrator (src/lib/pipeline.ts)  │
│  POST /api/benchmark  ───►  Benchmark runner (30 queries × 4 strategies)      │
│  GET  /api/health  ───────►  System status, loaded vector stores              │
│  GET  /api/datasets  ─────►  Dataset metadata, sample documents               │
└──────────────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              RAG PIPELINE                                      │
│                                                                               │
│  query                                                                        │
│    │                                                                          │
│    ├─► 1. Input guardrails  ──►  off-topic + unsafe-content detection         │
│    │                                                                          │
│    ├─► 2. Retrieval         ──►  TF-IDF hash embed ──► cosine search ──► topK │
│    │                             (src/lib/embeddings.ts)                       │
│    │                             (src/lib/vector-db.ts)                        │
│    │                                                                          │
│    ├─► 3. Retrieval guardrails  ─► sufficient context? top score ≥ threshold? │
│    │                                                                          │
│    ├─► 4. LLM harness        ──►  GLM-4.5 via z-ai-web-dev-sdk                │
│    │       (src/lib/llm/harness.ts)                                          │
│    │       - structured JSON I/O                                              │
│    │       - retries, timeouts, error recovery                               │
│    │       - citation extraction                                             │
│    │       - confidence + grounded flags                                     │
│    │                                                                          │
│    ├─► 5. Output guardrails  ──►  hallucination (lexical + LLM judge)         │
│    │                              unsupported-answer (refusal validation)     │
│    │                                                                          │
│    └─► 6. Final response     ──►  answer + sources + citations + timings     │
│                                  + guardrail decisions                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

The system uses Next.js 16 App Router on Node.js. It features a client-side React 19 UI connecting to server-side Next.js API routes. Retrieval is performed using an in-memory 384-dimensional TF-IDF MD5 signed hashing vectorizer over pre-computed JSON chunk stores. Grounded answers are generated using GLM-4.5 via `z-ai-web-dev-sdk`, protected by 5 guardrails.

---

## 2. CURRENT WORKING FEATURES

- **SPA User Interface (`src/app/page.tsx`):** Responsive multi-tab UI ("Voice RAG", "Evaluation Dashboard", "System Status") built with Tailwind CSS v4 and Radix UI primitives.
- **TF-IDF Hash Vectorizer (`src/lib/embeddings.ts`):** 384-dim MD5 signed hashing vectorizer and sparse dot-product similarity search (<1.5ms per query).
- **4 Chunking Strategies (`src/lib/chunking/index.ts`):** Fixed-size, Overlapping, Semantic (sentence-boundary aware), and Metadata-aware (paragraph splitting) chunking implementations.
- **In-Memory Vector Search Engine (`src/lib/vector-db.ts`):** Fast linear scan over Float32Array embeddings loaded into memory.
- **Multi-Stage Guardrails (`src/lib/guardrails/index.ts`):**
  - Stage 1: Input safety (unsafe content regex) and off-topic filtering.
  - Stage 3: Retrieval context sufficiency verification (`topScore >= 0.10`).
  - Stage 5: Output hallucination detection (lexical overlap + optional LLM judge) and refusal validation.
- **Structured LLM Model Harness (`src/lib/llm/harness.ts`):** Structured JSON prompt builder, schema validator, citation extractor (`[C1]`, `[C2]`), and plain-text fallback on parse failure.
- **Latency Instrumentation & Evaluation Suite (`src/lib/benchmarks/runner.ts`):** Measures P50, P70, P90, P95, P99, P100 latency percentiles across 31 test queries.
- **Sarvam AI STT Integration (`src/lib/sarvam.ts`):** Server-side multipart/form-data upload to Sarvam `saaras:v3` with strict browser MIME type sanitization (`audio/webm;codecs=opus` -> `audio/webm`).

---

## 3. CURRENT BROKEN / PARTIAL FEATURES

1. **RAG Pipeline Out-of-the-Box (BROKEN):**
   - Calling `/api/rag` on a clean clone returns `HTTP 503 ("No vector stores loaded")` because pre-computed index files in `data/vector-stores/` are missing from git.
2. **Speech-to-Text Audio Transcription (PARTIAL):**
   - Code is complete in `src/lib/sarvam.ts`, but `.env` lacks a valid `SARVAM_API_KEY`, causing runtime audio transcription calls to fail.
3. **Database ORM Integration (BROKEN / DEAD CODE):**
   - `prisma/schema.prisma` contains boilerplate `User` and `Post` models. `src/lib/db.ts` is imported nowhere in `src/`. `.env` contains an invalid Linux path (`DATABASE_URL=file:/home/z/my-project/db/custom.db`).
4. **Test Suite Execution (BROKEN):**
   - Test specs in `tests/rag/` use `import { describe, test, expect } from "bun:test"`, but the `bun` binary is not installed in the Windows environment.
5. **Python Ingestion Environment (BROKEN):**
   - Running `python scripts/ingest_msmarco.py` fails due to missing Python packages (`datasets`, `pyarrow`, `tqdm`).

---

## 4. MISSING DEPENDENCIES & DATA INDEXES

### Missing Python Environment Packages
- `datasets` (>=2.14)
- `pyarrow`
- `tqdm`
- `requests`

### Missing Data & Index Files
- `data/msmarco-xi-subset.json` (Raw 500-doc subset)
- `data/vector-stores/fixed.json` (Pre-computed fixed strategy vectors)
- `data/vector-stores/overlapping.json` (Pre-computed overlapping strategy vectors)
- `data/vector-stores/semantic.json` (Pre-computed semantic strategy vectors)
- `data/vector-stores/metadata-aware.json` (Pre-computed metadata-aware strategy vectors)
- `data/vector-stores/_idf.json` (Pre-computed corpus IDF map)
- `data/vector-stores/_summary.json` (Pre-computed ingestion metadata)

---

## 5. REQUIRED ENVIRONMENT VARIABLES

| Variable Name | Required? | Purpose | Current State |
| :--- | :--- | :--- | :--- |
| `SARVAM_API_KEY` | **YES** (for STT) | Sarvam AI API Authorization Key | **MISSING** (Placeholder in `.env.example`) |
| `SARVAM_STT_MODEL` | Optional | Model identifier (default: `saaras:v3`) | Set to `saaras:v3` |
| `SARVAM_STT_MODE` | Optional | Transcription mode (`transcribe`) | Set to `transcribe` |
| `ZAI_LLM_MODEL` | Optional | LLM model identifier (default: `glm-4.5`)| Set to `glm-4.5` |
| `DEFAULT_CHUNKING_STRATEGY` | Optional | Default chunking strategy (`overlapping`) | Set to `overlapping` |
| `PORT` | Optional | Web server port (default: 3000) | Set to 3000 |

---

## 6. EXACT COMMANDS TO RUN THE PROJECT

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Install Python Ingestion Dependencies
```bash
pip install datasets pyarrow tqdm requests
```

### 3. Generate Pre-computed Vector Stores
```bash
python scripts/ingest_msmarco.py --n 500 --out data
```

### 4. Start Development Web Server
```bash
npm run dev
```

### 5. Execute Production Build
```bash
npm run build
```

---

## 7. RECOMMENDED FIX ORDER

1. **Phase 1 (Data Pipeline):** Install python requirements and execute `scripts/ingest_msmarco.py` to generate all 6 missing vector store JSON files under `data/vector-stores/`. Verify 384-dim, unique IDs, and loading capability.
2. **Phase 2 (Sarvam STT):** Verify STT route, document environment configuration, ensure graceful UI state when `SARVAM_API_KEY` is missing/invalid.
3. **Phase 3 & 4 (RAG Pipeline & LLM Harness):** Verify end-to-end RAG execution across normal, off-topic, unsafe, and insufficient retrieval queries. Ensure strict grounding & refusal.
4. **Phase 5 & 6 (Latency & Evaluation Dashboard):** Ensure real latency measurements are displayed. Clearly distinguish **Retrieval Target (<50ms)** from **End-to-End Voice-to-Answer Latency (~3s)**.
5. **Phase 7, 8, 9, 10 (UI, Voice Animation, Evaluation, System Status):** Verify visual state management (IDLE, LISTENING, TRANSCRIBING, RETRIEVING, GENERATING, VALIDATING, READY, ERROR) and ensure System Status tab accurately reflects component health.
6. **Phase 11 (Hydration Cleanup):** Audit client/server rendering differences and confirm no application hydration errors occur during `npm run build`.
7. **Phase 12 & 13 (Dead Code & Testing):** Isolate/remove dead Prisma code, update/verify tests, ensure reproducible test execution.
8. **Phase 14, 15, 16 (Security, Final E2E Test & Documentation):** Audit security, run full E2E verification, update `README.md` and generate `FINAL_VERIFICATION.md`.
