# DATA PIPELINE & VECTOR STORE SPECIFICATION
**Hacker House Goa 2026 - Task 2 Ingestion Documentation**

---

## 1. DATASET SOURCE & INGESTION OVERVIEW

* **Dataset Identifier:** `ai4bharat/MSMARCO-XI` (HuggingFace)
* **Dataset Subset Used:** Official validation split (`validation/sanval.parquet`) containing 97,941 rows.
* **Document Extraction:** Extracted 500 unique positive English passages (`is_selected == 1`) with deduplication based on MD5 content hashes.
* **Primary Ingestion Command:**
  ```bash
  python scripts/dl_sanval.py
  python scripts/ingest_from_parquet.py
  ```
  *(Alternative streaming command: `python scripts/ingest_msmarco.py --n 500 --out data`)*

---

## 2. CHUNKING & EMBEDDING GENERATION

### Chunking Strategies
Each of the 500 documents was processed through four distinct chunking strategies:

| Strategy | Strategy Description | Chunk Count | Metadata Fields Preserved |
| :--- | :--- | :--- | :--- |
| **Fixed-size** | 100-word non-overlapping sliding window | **526 chunks** | `word_offset`, `chunk_size`, `doc_language`, `doc_source_query` |
| **Overlapping** | 100-word window with 25-word overlap | **526 chunks** | `word_offset`, `chunk_size`, `overlap`, `doc_language` |
| **Semantic** | Sentence-boundary grouping (max 3 sents / 120 words)| **800 chunks** | `sentence_count`, `word_count`, `doc_language` |
| **Metadata-aware** | Paragraph boundary split with sentence fallback | **507 chunks** | `paragraph_index`, `paragraph_total`, `is_paragraph_start` |

### Embedding Vectorizer Specifications
* **Algorithm:** 384-dimensional TF-IDF Hash Vectorizer with MD5 Signed Hashing and L2 Normalization.
* **Feature Space:** 1-grams and 2-grams tokenized via regex `/[a-z0-9]+/g` with 50 English stopwords removed.
* **Signed Hashing:** N-gram buckets mapped via `MD5(gram) % 384` with weight sign `+1.0 / -1.0` derived from `MD5(gram + "_sign") % 2`.
* **IDF Vocabulary:** Pre-computed corpus-wide Inverse Document Frequency over 18,849 unique vocabulary terms.

---

## 3. PERSISTED OUTPUT FILES

All data files have been generated under `data/` and `data/vector-stores/`:

| Output File Path | Size (Bytes) | Contents / Schema Description |
| :--- | :--- | :--- |
| [`data/msmarco-xi-subset.json`](file:///e:/HHGOA%20TASK%202/data/msmarco-xi-subset.json) | **263,410** | 500 extracted raw document records with query & answer pairs |
| [`data/vector-stores/fixed.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/fixed.json) | **1,745,967** | 526 Float32Array embeddings (384-dim) + fixed chunk records |
| [`data/vector-stores/overlapping.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/overlapping.json) | **1,770,429** | 526 Float32Array embeddings (384-dim) + overlapping chunk records |
| [`data/vector-stores/semantic.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/semantic.json) | **2,365,021** | 800 Float32Array embeddings (384-dim) + semantic chunk records |
| [`data/vector-stores/metadata-aware.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/metadata-aware.json) | **1,734,733** | 507 Float32Array embeddings (384-dim) + metadata chunk records |
| [`data/vector-stores/_idf.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/_idf.json) | **643,842** | Pre-computed IDF dictionary (18,849 terms mapped to float weights) |
| [`data/vector-stores/_summary.json`](file:///e:/HHGOA%20TASK%202/data/vector-stores/_summary.json) | **920** | Ingestion build metadata, strategy counts, and timestamps |

---

## 4. INTEGRITY VERIFICATION RESULTS

An automated node execution test verified all persisted files:

- **JSON Schema Validation:** All 6 JSON files parse cleanly with 0 syntax errors.
- **Vector Dimension Verification:** All vector arrays across all 4 strategies are strictly **384 dimensions**.
- **Unique Identifier Check:** 100% unique chunk IDs verified across every strategy (`0` duplicate IDs).
- **TypeScript Runtime Parity:** The Node.js application startup auto-loader ([`src/lib/init.ts`](file:///e:/HHGOA%20TASK%202/src/lib/init.ts)) successfully loads all 4 vector stores into memory upon application launch.
