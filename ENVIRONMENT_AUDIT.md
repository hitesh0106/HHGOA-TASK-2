# ENVIRONMENT VARIABLE AUDIT REPORT
**Hacker House Goa 2026 - Task 2 Configuration Audit**

| Variable Name | Required | Purpose / Usage | Current Verified State |
| :--- | :--- | :--- | :--- |
| `SARVAM_API_KEY` | **YES (for STT)** | Authentication header for Sarvam Saaras STT REST API | **PRESENT** (36-char string starting with `sk_` in `.env`) |
| `SARVAM_STT_MODEL` | No | STT model identifier | **PRESENT** (`saaras:v3`) |
| `SARVAM_STT_MODE` | No | Default transcription mode (`transcribe`, `translate`, `verbatim`, `translit`, `codemix`) | **PRESENT** (`transcribe`) |
| `SARVAM_STT_ENDPOINT` | No | REST endpoint URL for Sarvam STT API | **PRESENT** (`https://api.sarvam.ai/speech-to-text`) |
| `ZAI_LLM_MODEL` | No | Model identifier for grounded LLM answer generation | **PRESENT** (`glm-4.5`) |
| `LLM_TIMEOUT_MS` | No | Timeout for LLM generation requests | **PRESENT** (`15000`) |
| `LLM_MAX_RETRIES` | No | Maximum retry attempts for LLM calls | **PRESENT** (`2`) |
| `DEFAULT_CHUNKING_STRATEGY` | No | Strategy to use if query request omits `strategy` parameter | **PRESENT** (`overlapping`) |
| `RETRIEVAL_TOP_K` | No | Default top K chunks to retrieve per query | **PRESENT** (`5`) |
| `RETRIEVAL_MIN_SCORE` | No | Minimum similarity threshold for retrieval inclusion | **PRESENT** (`0.10`) |
| `RETRIEVAL_CONTEXT_MAX_TOKENS` | No | Maximum token cap for formatted context window | **PRESENT** (`2048`) |
| `TARGET_RETRIEVAL_LATENCY_MS`| No | Retrieval target benchmark threshold | **PRESENT** (`50`) |
| `TARGET_PIPELINE_LATENCY_MS` | No | Target full pipeline latency threshold | **PRESENT** (`3000`) |
| `MSMARCO_XI_SUBSET_SIZE` | No | Target document count for dataset ingestion | **PRESENT** (`500`) |
| `DATASET_PATH` | No | Path to raw extracted document subset JSON | **PRESENT** (`data/msmarco-xi-subset.json`) |
| `PORT` | No | Web server binding port | **PRESENT** (`3000`) |
| `NODE_ENV` | No | Node.js execution environment | **PRESENT** (`development`) |
| `DATABASE_URL` | **NO (Legacy)** | SQLite database connection string from unused Prisma schema | **PRESENT** (`file:/home/z/my-project/db/custom.db` - Unused) |
