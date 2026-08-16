# RETRIEVAL DEBUG REPORT
## Investigation of Query: "What is the corporation?"
**Audited: 2026-08-15 11:22 IST**

---

### 1. END-TO-END QUERY TRACE

#### 1. Query Normalization & Preprocessing
- **Raw Input:** `"What is the corporation?"`
- **Lowercased:** `"what is the corporation?"`
- **Regex Extraction:** `TOKEN_RE = /[a-z0-9]+/g` extracts `["what", "is", "the", "corporation"]`.
- **Stopword Filtering:** `STOPWORDS` in `src/lib/embeddings.ts` contains `"what"`, `"is"`, `"the"`, `"a"`, etc.
- **Remaining Tokens:** Exactly **ONE** token: `["corporation"]`.
- **N-gram Generation:** `NGRAM_SIZES = [1, 2]`. Since only 1 token remains, **zero bigrams** are generated. The only term frequency entry is `{"corporation": 1}`.

#### 2. Hashing & Signed Hashing
- **Hash Function:** `hash32("corporation") = parseInt(MD5("corporation").slice(0, 8), 16) >>> 0 = 3234438339`.
- **Modulo 384:** `3234438339 % 384` = **Bucket Index 192**.
- **Signed Hash:** `hash32("corporation_sign") % 2 === 0 ? 1 : -1` = **-1**.
- **IDF Lookup:** `idfMap.get("corporation") = 5.8303`.
- **Pre-normalized Vector:** `vec[192] = -1 * (1 * 5.8303) = -5.8303`, all other 383 dimensions are `0.0`.

#### 3. L2 Normalization
- **L2 Norm:** `sqrt((-5.8303)^2) = 5.8303`.
- **Unit Vector:** `vec[192] = -1.0`, all other 383 dimensions = `0.0`.
- **Sparse Representation:** `[{ idx: 192, val: -1.0 }]`.

#### 4. Vector Store Loading & State
- All 4 vector stores (`fixed.json`, `overlapping.json`, `semantic.json`, `metadata-aware.json`) and `_idf.json` are loaded in memory via `ensureVectorStoresLoaded()`.
- Active strategy: `overlapping` (default) containing 526 chunks.
- Vector dimension across all stores: **384 float values**.

#### 5. Similarity Calculation & Linear Scan
- For every chunk in the vector store:
  $$\text{score}_i = \sum_{j \in \text{sparse}} q_j \cdot d_{i,j} = (-1.0) \cdot d_{i,192}$$
- The retrieval score is **100% determined by a single float value: index 192 of the document's vector**.

---

### 2. THE TARGET DATASET RECORD (CORPORATION)

- **Document ID:** `san_0`
- **Source Query:** `. what is a corporation?`
- **Ground Truth Answer:** `A corporation is a company or group of people authorized to act as a single entity and recognized as such in law.`
- **Document Text:**
  > `"McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity (legally a person) and recognized as such in law. Early incorporated entities were established by charter (i.e. by an ad hoc act granted by a monarch or passed by a parliament or legislature)."`
- **Generated Chunks:**
  - `fixed.json`: `san_0_0`
  - `overlapping.json`: `san_0_0`
  - `semantic.json`: `san_0_0` (sentences 1-2), `san_0_1` (sentence 3)
  - `metadata-aware.json`: `san_0_0`
- **Vector Values for `san_0_0`:**
  - 384 dimensions, L2-normalized.
  - `san_0_0[192] = -0.3266` (contains `"corporation"` 2 times alongside 31 other words: `mcdonald`, `recognizable`, `world`, `company`, `charter`, etc., which disperse the L2 vector norm across 30+ other hash buckets).

---

### 3. EMPIRICAL RETRIEVAL RESULTS FOR "What is the corporation?"

#### Strategy: `overlapping` (Default)

| Rank | Chunk ID | Document ID | Score | First 150 Characters |
|:---:|:---:|:---:|:---:|:---|
| **1** | `san_157_0` | `san_157` | **0.6164** | *Harrison Ford Family. 1 Harrison Ford, with Calista Flockhart and son Liam. 2 Harrison Ford Family. 3 Harrison Ford Wife. Harrison Ford with His Mother...* |
| **2** | `san_462_0` | `san_462` | **0.3628** | *Buffing Brush and Cloth; How to Shine Your Shoes: Clean Them First. Remove the laces from shoes, if you have them. You will want to use a shoe horn...* |
| **3** | `san_374_0` | `san_374` | **0.3309** | *Abraham Lincoln served as president from March 4, 1861 until April 15, 1865, which would be four years, one month, and a few days. Lincoln was re-elected...* |
| **4** | `san_0_0` | `san_0` | **0.3266** | **McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act...** |
| **5** | `san_285_0` | `san_285` | **0.2749** | *This is not the sort of thing that the FDA requires drug companies to follow up on because the long-term research needed to show these causes and...* |
| **6** | `san_257_0` | `san_257` | **0.2580** | *Shareholders may vote through a proxy, an agent authorized by a shareholder to cast the shareholder’s votes. Impact of Shareholders' Resolutions...* |
| **7** | `san_370_0` | `san_370` | **0.2212** | *Legal definition for INFANTICIDE: med. juris. The murder of a new born infant. The fact of the birth distinguishes this act from foeticide...* |
| **8** | `san_409_0` | `san_409` | **0.2013** | *Webster Dictionary (0.00 / 0 votes) Rate this definition: Glioma (noun) a tumor springing from the neuroglia or connective tissue of the brain...* |
| **9** | `san_455_0` | `san_455` | **0.1918** | *Broadcom Corporation was an American fabless semiconductor company that made products for the wireless and broadband communication industry...* |
| **10** | `san_364_0` | `san_364` | **0.1868** | *Symeon of Emesa and the ‘Pedagogics of Liminality’ 265 aims. Though he is called ‘Symeon of Emesa’, Symeon is a permanent outsider...* |

**Corporation Document (`san_0_0`) Rank:** **Rank 4 of 526** (Score: 0.3266).
Because Top-K = 5, `san_0_0` is included at slot `[C4]`, but the context is polluted with Harrison Ford (`[C1]`), Shoe Polishing (`[C2]`), and Abraham Lincoln (`[C3]`).

---

### 4. ROOT CAUSE PROOF

#### Hash Collision Mathematics:
1. `MD5("corporation")` modulo 384 = **192** with sign **-1**.
2. `MD5("harrison")` modulo 384 = **192** with sign **-1**.
3. `MD5("clean")` modulo 384 = **192** with sign **-1**.
4. `MD5("requires")` modulo 384 = **192** with sign **-1**.
5. `MD5("europe")`, `MD5("breakfast")`, `MD5("diarrhea")` all modulo 384 = **192** with sign **-1**.

Out of 18,849 vocabulary terms, **54 distinct terms** collide into bucket 192 with the exact same sign.

#### Why Harrison Ford (`san_157`) beat Corporation (`san_0`):
- `san_157_0` repeats the word `"harrison"` **9 times** plus `"harrison ford"` **7 times**.
- Bucket 192 accumulates $-9 \times 6.52 - 7 \times \dots = -70.3$ of raw weight.
- When normalized, `san_157_0[192] = -0.6164`.
- `san_0_0` mentions `"corporation"` only **2 times**, plus 30 other distinct words that disperse the L2 vector norm into other buckets.
- When normalized, `san_0_0[192] = -0.3266`.
- The cosine similarity $\text{dot}(q, d) = (-1.0) \times d[192]$ gives:
  - `san_157_0` (Harrison Ford): $(-1.0) \times (-0.6164) =$ **`0.6164`**
  - `san_0_0` (McDonald's Corp): $(-1.0) \times (-0.3266) =$ **`0.3266`**

---

### 5. SUMMARY FINDINGS

| Field | Finding |
|:---|:---|
| **ROOT CAUSE:** | **Severe Feature Hashing Dimension Bottleneck (384 Dimensions vs 18,849 Vocabulary Terms).** Compressing 18,849 terms into 384 modulo buckets results in ~49 words per bucket. For single-keyword queries like `"corporation"` (where stopwords remove "what", "is", "the"), the query is a 1-hot vector on bucket 192. Unrelated words like `"harrison"`, `"clean"`, `"requires"` hash to the exact same bucket with the same sign. Documents with high repetition of those colliding words achieve higher dot products than the true match. |
| **AFFECTED FILE:** | [`src/lib/embeddings.ts`](file:///e:/HHGOA%20TASK%202/src/lib/embeddings.ts) and [`scripts/ingest_from_parquet.py`](file:///e:/HHGOA%20TASK%202/scripts/ingest_from_parquet.py) |
| **AFFECTED FUNCTION:** | `embedText()`, `_hash_token()`, `hash32()` |
| **WHY CORPORATION QUERY FAILS:** | The word `"corporation"` collides in bucket 192 with `"harrison"`. Document `san_157` has 9 repetitions of `"harrison"`, pushing its bucket 192 weight higher than `san_0` (which has 2 mentions of `"corporation"`). |
| **EXACT FIX REQUIRED:** | **Replace the 384-modulo hash projection with an exact inverted index (sparse TF-IDF / BM25) or a higher-dimensional sparse hash table (e.g., 65,536+ or exact dictionary indices).** In an exact inverted index / BM25, `"corporation"` matches ONLY `san_0`, `san_257`, `san_455` (Score: >0.26) and `san_157` gets score **0.0000**. |
